import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import { generateNo } from '../../common/no';
import {
  assertSufficient,
  availableStock,
  countAction,
  countDifference,
  reversalOf,
  sumSigned,
  transferLegs,
} from '../../domain/stock-math';
import { classify, HealthLevel } from '../../domain/health';
import { DomainError } from '../../domain/domain-error';
import { MaterialsService } from '../materials/materials.service';
import { notifyHealthChange } from '../notifications/notification.helper';
import {
  AdjustDto,
  CountDto,
  InboundDto,
  MovementQueryDto,
  OutboundDto,
  StockQueryDto,
} from './dto';

type MovementRow = {
  id: number;
  movement_no: string;
  sku: string;
  location: string;
  type: string;
  quantity_signed: number;
  source: string;
  recipient: string;
  purpose: string;
  batch: string;
  operator: string;
  occurred_at: string;
  related_doc_no: string;
  related_movement_no: string;
  idempotency_key: string | null;
  created_at: string;
};

interface InsertMovementInput {
  sku: string;
  location: string;
  type: string;
  quantity_signed: number;
  operator: string;
  source?: string;
  recipient?: string;
  purpose?: string;
  batch?: string;
  relatedDocNo?: string;
  relatedMovementNo?: string;
  idempotencyKey?: string | null;
}

function toMovementView(row: MovementRow) {
  return {
    id: row.id,
    movementNo: row.movement_no,
    sku: row.sku,
    location: row.location,
    type: row.type,
    quantitySigned: row.quantity_signed,
    source: row.source,
    recipient: row.recipient,
    purpose: row.purpose,
    batch: row.batch,
    operator: row.operator,
    occurredAt: row.occurred_at,
    relatedDocNo: row.related_doc_no,
    relatedMovementNo: row.related_movement_no,
    createdAt: row.created_at,
  };
}

@Injectable()
export class StockService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly materials: MaterialsService,
  ) {}

  private get db(): Database.Database {
    return this.dbService.db;
  }

  private currentBySku(sku: string): number {
    const rows = this.db
      .prepare('SELECT quantity_signed FROM stock_movements WHERE sku = ?')
      .all(sku) as Array<{ quantity_signed: number }>;
    return sumSigned(rows);
  }

  private currentByLocation(sku: string, location: string): number {
    const row = this.db
      .prepare(
        'SELECT COALESCE(SUM(quantity_signed), 0) AS n FROM stock_movements WHERE sku = ? AND location = ?',
      )
      .get(sku, location) as { n: number };
    return row.n;
  }

  private lockedBySku(sku: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_locks WHERE sku = ?')
      .get(sku) as { n: number };
    return row.n;
  }

  private healthOf(sku: string): { current: number; level: HealthLevel } {
    const material = this.db.prepare('SELECT safety_stock FROM materials WHERE sku = ?').get(sku) as
      | { safety_stock: number }
      | undefined;
    const current = this.currentBySku(sku);
    return { current, level: classify(current, material?.safety_stock ?? 0) };
  }

  private insertMovement(input: InsertMovementInput): MovementRow {
    const now = new Date().toISOString();
    const movementNo = generateNo('MOV');
    this.db
      .prepare(`
        INSERT INTO stock_movements (
          movement_no, sku, location, type, quantity_signed, source, recipient,
          purpose, batch, operator, occurred_at, related_doc_no,
          related_movement_no, idempotency_key, created_at)
        VALUES (
          @movementNo, @sku, @location, @type, @quantity_signed, @source, @recipient,
          @purpose, @batch, @operator, @now, @relatedDocNo,
          @relatedMovementNo, @idempotencyKey, @now)
      `)
      .run({
        movementNo,
        sku: input.sku,
        location: input.location,
        type: input.type,
        quantity_signed: input.quantity_signed,
        source: input.source ?? '',
        recipient: input.recipient ?? '',
        purpose: input.purpose ?? '',
        batch: input.batch ?? '',
        operator: input.operator,
        now,
        relatedDocNo: input.relatedDocNo ?? '',
        relatedMovementNo: input.relatedMovementNo ?? '',
        idempotencyKey: input.idempotencyKey ?? null,
      });
    return this.db
      .prepare('SELECT * FROM stock_movements WHERE movement_no = ?')
      .get(movementNo) as MovementRow;
  }

  /** A3：内部锁定/解锁能力，使可用库存 = 当前库存 − Σlocks 可真实计算。 */
  lockStock(sku: string, quantity: number, refDocNo: string) {
    this.materials.assertEnabled(sku);
    if (!Number.isInteger(quantity) || quantity <= 0 || !refDocNo) {
      throw Errors.validation('锁定数量必须为正整数且需提供 refDocNo');
    }
    this.db
      .prepare(`
        INSERT INTO stock_locks (sku, quantity, ref_doc_no, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(sku, ref_doc_no) DO UPDATE SET quantity = excluded.quantity
      `)
      .run(sku, quantity, refDocNo, new Date().toISOString());
    return this.lockView(sku);
  }

  unlockStock(sku: string, refDocNo: string) {
    this.db.prepare('DELETE FROM stock_locks WHERE sku = ? AND ref_doc_no = ?').run(sku, refDocNo);
    return this.lockView(sku);
  }

  private lockView(sku: string) {
    const lockedStock = this.lockedBySku(sku);
    return {
      sku,
      lockedStock,
      currentStock: this.currentBySku(sku),
      availableStock: availableStock(this.currentBySku(sku), lockedStock),
    };
  }

  /** 库存台账：按 SKU + 库位展示由流水汇总出的库存视图。 */
  getStock(query: StockQueryDto): Paged<Record<string, unknown>> {
    const pairs = this.db
      .prepare(
        `SELECT sku, location FROM (
           SELECT sku, location FROM materials
           UNION
           SELECT sku, location FROM stock_movements
         )`,
      )
      .all() as Array<{ sku: string; location: string }>;
    const filtered = pairs.filter(
      (pair) =>
        (!query.sku || pair.sku === query.sku) &&
        (!query.location || pair.location === query.location),
    );
    const items = filtered.map((pair) => {
      const material = this.db
        .prepare('SELECT * FROM materials WHERE sku = ?')
        .get(pair.sku) as { safety_stock: number } | undefined;
      const current = this.currentByLocation(pair.sku, pair.location);
      const locked = this.lockedBySku(pair.sku);
      const skuCurrent = this.currentBySku(pair.sku);
      return {
        sku: pair.sku,
        location: pair.location,
        currentStock: current,
        lockedStock: locked,
        availableStock: availableStock(current, locked),
        skuCurrentStock: skuCurrent,
        safetyStock: material?.safety_stock ?? 0,
        health: classify(skuCurrent, material?.safety_stock ?? 0),
      };
    });
    return paginate(items, query.page, query.pageSize);
  }

  inbound(dto: InboundDto, actor: string) {
    const material = this.materials.assertEnabled(dto.sku);
    return this.db.transaction(() => {
      const before = this.healthOf(dto.sku);
      const movement = this.insertMovement({
        sku: dto.sku,
        location: dto.location || material.location,
        type: dto.source === 'RETURN' ? 'IN_RETURN' : 'IN_PURCHASE',
        quantity_signed: dto.quantity,
        source: dto.source,
        purpose: dto.purpose ?? '',
        batch: dto.batch ?? '',
        operator: actor,
        relatedDocNo: dto.relatedDocNo ?? '',
      });
      const after = this.healthOf(dto.sku);
      notifyHealthChange(this.db, dto.sku, before.level, after.level, movement.movement_no);
      return {
        movement: toMovementView(movement),
        currentStock: after.current,
        health: after.level,
      };
    })();
  }

  outbound(dto: OutboundDto, idempotencyKey?: string, actor = 'system') {
    const endpoint = 'outbound';
    return this.db.transaction(() => {
      if (idempotencyKey) {
        const existing = this.db
          .prepare('SELECT * FROM idempotency_records WHERE key = ?')
          .get(idempotencyKey) as
          | { endpoint: string; response_json: string }
          | undefined;
        if (existing) {
          if (existing.endpoint !== endpoint) throw Errors.idempotencyConflict(idempotencyKey);
          return JSON.parse(existing.response_json);
        }
      }

      const material = this.materials.assertEnabled(dto.sku);
      const before = this.healthOf(dto.sku);
      const available = availableStock(before.current, this.lockedBySku(dto.sku));
      try {
        assertSufficient(available, dto.quantity);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'STOCK_INSUFFICIENT') {
          throw Errors.stockInsufficient(dto.sku);
        }
        throw Errors.validation(error instanceof Error ? error.message : '数量不合法');
      }

      const movement = this.insertMovement({
        sku: dto.sku,
        location: dto.location || material.location,
        type: 'OUT_ISSUE',
        quantity_signed: -dto.quantity,
        recipient: dto.recipient,
        purpose: dto.purpose ?? '',
        batch: dto.batch ?? '',
        operator: actor,
        idempotencyKey: idempotencyKey ?? null,
      });
      const after = this.healthOf(dto.sku);
      notifyHealthChange(this.db, dto.sku, before.level, after.level, movement.movement_no);

      const response = {
        movement: toMovementView(movement),
        currentStock: after.current,
        availableStock: availableStock(after.current, this.lockedBySku(dto.sku)),
        health: after.level,
      };
      if (idempotencyKey) {
        this.db
          .prepare(
            'INSERT INTO idempotency_records (key, endpoint, response_json, created_at) VALUES (?, ?, ?, ?)',
          )
          .run(idempotencyKey, endpoint, JSON.stringify(response), new Date().toISOString());
      }
      return response;
    })();
  }

  count(dto: CountDto, actor: string) {
    const material = this.materials.assertEnabled(dto.sku);
    return this.db.transaction(() => {
      const before = this.healthOf(dto.sku);
      const book = this.currentByLocation(dto.sku, dto.location);
      const difference = countDifference(dto.actualQty, book);
      const action = countAction(difference);
      let movement: MovementRow | null = null;
      if (action) {
        movement = this.insertMovement({
          sku: dto.sku,
          location: dto.location,
          type: action,
          quantity_signed: difference,
          purpose: '盘点',
          operator: actor,
        });
      }
      const after = this.healthOf(dto.sku);
      notifyHealthChange(this.db, dto.sku, before.level, after.level, movement?.movement_no ?? '');
      return {
        sku: dto.sku,
        location: dto.location || material.location,
        bookStock: book,
        actualQty: dto.actualQty,
        difference,
        action,
        movement: movement ? toMovementView(movement) : null,
        currentStock: after.current,
      };
    })();
  }

  adjust(dto: AdjustDto, actor: string) {
    this.materials.assertEnabled(dto.sku);
    return this.db.transaction(() => {
      const before = this.healthOf(dto.sku);
      const current = before.current;
      const available = availableStock(current, this.lockedBySku(dto.sku));
      const docNo = generateNo('ADJ');
      let movements: MovementRow[] = [];

      if (dto.type === 'LOSS') {
        try {
          assertSufficient(available, dto.quantity);
        } catch (error) {
          if (error instanceof DomainError && error.code === 'STOCK_INSUFFICIENT') {
            throw Errors.stockInsufficient(dto.sku);
          }
          throw Errors.validation('报损数量必须为正整数');
        }
        movements = [
          this.insertMovement({
            sku: dto.sku,
            location: dto.location || '',
            type: 'ADJUST_LOSS',
            quantity_signed: -dto.quantity,
            purpose: dto.purpose ?? '报损',
            batch: dto.batch ?? '',
            operator: actor,
            relatedDocNo: docNo,
          }),
        ];
      } else {
        if (!dto.sourceLocation || !dto.targetLocation) {
          throw Errors.validation('调拨必须提供 sourceLocation 与 targetLocation');
        }
        try {
          assertSufficient(available, dto.quantity);
        } catch (error) {
          if (error instanceof DomainError && error.code === 'STOCK_INSUFFICIENT') {
            throw Errors.stockInsufficient(dto.sku);
          }
          throw Errors.validation('调拨数量必须为正整数');
        }
        const legs = transferLegs(dto.quantity, dto.sourceLocation, dto.targetLocation);
        const out = this.insertMovement({
          sku: dto.sku,
          location: legs.out.location,
          type: 'TRANSFER_OUT',
          quantity_signed: legs.out.quantity_signed,
          purpose: dto.purpose ?? '调拨',
          batch: dto.batch ?? '',
          operator: actor,
          relatedDocNo: docNo,
        });
        const inbound = this.insertMovement({
          sku: dto.sku,
          location: legs.in.location,
          type: 'TRANSFER_IN',
          quantity_signed: legs.in.quantity_signed,
          purpose: dto.purpose ?? '调拨',
          batch: dto.batch ?? '',
          operator: actor,
          relatedDocNo: docNo,
          relatedMovementNo: out.movement_no,
        });
        movements = [out, inbound];
      }

      const after = this.healthOf(dto.sku);
      notifyHealthChange(this.db, dto.sku, before.level, after.level, docNo);
      return {
        type: dto.type,
        relatedDocNo: docNo,
        movements: movements.map(toMovementView),
        currentStock: after.current,
      };
    })();
  }

  /** 供采购到货事务调用：不自行开启事务，由调用方保证原子性。 */
  recordPurchaseArrival(input: {
    sku: string;
    quantity: number;
    location?: string;
    operator: string;
    orderNo: string;
  }) {
    const movement = this.insertMovement({
      sku: input.sku,
      location: input.location ?? '',
      type: 'IN_PURCHASE',
      quantity_signed: input.quantity,
      source: 'PURCHASE',
      purpose: '采购到货入库',
      operator: input.operator,
      relatedDocNo: input.orderNo,
    });
    return toMovementView(movement);
  }

  currentAndHealth(sku: string) {
    return this.healthOf(sku);
  }

  getMovements(query: MovementQueryDto): Paged<ReturnType<typeof toMovementView>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.sku) {
      clauses.push('sku = @sku');
      params.sku = query.sku;
    }
    if (query.type) {
      clauses.push('type = @type');
      params.type = query.type;
    }
    if (query.operator) {
      clauses.push('operator = @operator');
      params.operator = query.operator;
    }
    if (query.from) {
      clauses.push('occurred_at >= @from');
      params.from = query.from;
    }
    if (query.to) {
      clauses.push('occurred_at <= @to');
      params.to = query.to;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM stock_movements ${where} ORDER BY id ASC`)
      .all(params) as MovementRow[];
    return paginate(rows.map(toMovementView), query.page, query.pageSize);
  }

  reverse(id: number, actor: string) {
    const original = this.db
      .prepare('SELECT * FROM stock_movements WHERE id = ?')
      .get(id) as MovementRow | undefined;
    if (!original) throw Errors.movementNotFound(id);
    const reversed = this.db
      .prepare(
        "SELECT 1 FROM stock_movements WHERE related_movement_no = ? AND type = 'REVERSAL'",
      )
      .get(original.movement_no);
    if (reversed) throw Errors.alreadyReversed(id);

    return this.db.transaction(() => {
      const reversal = reversalOf({
        movementNo: original.movement_no,
        quantitySigned: original.quantity_signed,
      });
      const before = this.healthOf(original.sku);
      const movement = this.insertMovement({
        sku: original.sku,
        location: original.location,
        type: reversal.type,
        quantity_signed: reversal.quantity_signed,
        operator: actor,
        source: 'REVERSAL',
        purpose: `冲正 ${original.movement_no}`,
        relatedMovementNo: reversal.related_movement_no,
      });
      const after = this.healthOf(original.sku);
      notifyHealthChange(this.db, original.sku, before.level, after.level, movement.movement_no);
      return {
        movement: toMovementView(movement),
        currentStock: after.current,
      };
    })();
  }
}
