import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import { generateNo } from '../../common/no';
import {
  applyTransition,
  PURCHASE_STATUS_LABEL,
  PurchaseAction,
  PurchaseStatus,
} from '../../domain/purchase-machine';
import { MaterialsService } from '../materials/materials.service';
import { StockService } from '../stock/stock.service';
import { createNotification } from '../notifications/notification.helper';
import {
  CreateOrderDto,
  CreateRequestDto,
  RequestQueryDto,
} from './dto';

type RequestRow = {
  id: number;
  request_no: string;
  sku: string;
  quantity: number;
  expected_date: string;
  reason: string;
  status: PurchaseStatus;
  applicant: string;
  source: string;
  reject_reason: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: number;
  order_no: string;
  request_no: string;
  sku: string;
  quantity: number;
  status: string;
  created_by: string;
  created_at: string;
  closed_at: string;
};

function requestView(row: RequestRow) {
  return {
    id: row.id,
    requestNo: row.request_no,
    sku: row.sku,
    quantity: row.quantity,
    expectedDate: row.expected_date,
    reason: row.reason,
    status: row.status,
    statusLabel: PURCHASE_STATUS_LABEL[row.status],
    applicant: row.applicant,
    source: row.source,
    rejectReason: row.reject_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function orderView(row: OrderRow) {
  return {
    id: row.id,
    orderNo: row.order_no,
    requestNo: row.request_no,
    sku: row.sku,
    quantity: row.quantity,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

@Injectable()
export class PurchaseService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly materials: MaterialsService,
    private readonly stock: StockService,
  ) {}

  private get db() {
    return this.dbService.db;
  }

  private findRequest(id: number): RequestRow {
    const row = this.db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id) as
      | RequestRow
      | undefined;
    if (!row) throw Errors.requestNotFound(id);
    return row;
  }

  private findOrder(id: number): OrderRow {
    const row = this.db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as
      | OrderRow
      | undefined;
    if (!row) throw Errors.orderNotFound(id);
    return row;
  }

  private transition(
    request: RequestRow,
    action: PurchaseAction,
    options: { rejectReason?: string; nextStatus?: PurchaseStatus } = {},
  ) {
    let result;
    try {
      result = applyTransition(request.status, action, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('REJECT_REASON_REQUIRED')) throw Errors.rejectReasonRequired();
      throw Errors.illegalTransition(request.status, action);
    }
    const next = options.nextStatus ?? result.next;
    const rejectReason =
      action === 'REJECT'
        ? options.rejectReason ?? ''
        : action === 'RESUBMIT'
          ? ''
          : request.reject_reason;
    const update = this.db
      .prepare(
        `UPDATE purchase_requests
         SET status = ?, reject_reason = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      )
      .run(next, rejectReason, new Date().toISOString(), request.id, request.version);
    if (update.changes !== 1) throw Errors.illegalTransition(request.status, action);
    return result;
  }

  createRequest(dto: CreateRequestDto) {
    this.materials.assertEnabled(dto.sku);
    const now = new Date().toISOString();
    const requestNo = generateNo('PR');
    this.db
      .prepare(`
        INSERT INTO purchase_requests (request_no, sku, quantity, expected_date, reason,
          status, applicant, source, reject_reason, version, created_at, updated_at)
        VALUES (@requestNo, @sku, @quantity, @expectedDate, @reason, 'PENDING',
          @applicant, @source, '', 1, @now, @now)
      `)
      .run({ ...dto, requestNo, now });
    const row = this.db
      .prepare('SELECT * FROM purchase_requests WHERE request_no = ?')
      .get(requestNo) as RequestRow;
    return requestView(row);
  }

  approve(id: number, actor: string) {
    return this.db.transaction(() => {
      const request = this.findRequest(id);
      this.transition(request, 'APPROVE');
      createNotification(this.db, {
        recipient: request.applicant,
        type: 'APPROVED',
        title: `采购申请已通过：${request.sku}`,
        content: `申请 ${request.request_no} 已由 ${actor} 审批通过，可由采购员建单。`,
        relatedDocNo: request.request_no,
      });
      return requestView(this.findRequest(id));
    })();
  }

  reject(id: number, reason: string, actor: string) {
    return this.db.transaction(() => {
      const request = this.findRequest(id);
      this.transition(request, 'REJECT', { rejectReason: reason });
      createNotification(this.db, {
        recipient: request.applicant,
        type: 'REJECTED',
        title: `采购申请被驳回：${request.sku}`,
        content: `申请 ${request.request_no} 被 ${actor} 驳回：${reason}`,
        relatedDocNo: request.request_no,
      });
      return requestView(this.findRequest(id));
    })();
  }

  resubmit(id: number) {
    return this.db.transaction(() => {
      const request = this.findRequest(id);
      this.transition(request, 'RESUBMIT');
      return requestView(this.findRequest(id));
    })();
  }

  createOrder(dto: CreateOrderDto, actor: string) {
    return this.db.transaction(() => {
      const request = this.findRequest(dto.requestId);
      const existing = this.db
        .prepare('SELECT 1 FROM purchase_orders WHERE request_no = ?')
        .get(request.request_no);
      if (existing) throw Errors.duplicateOrder(request.request_no);
      this.transition(request, 'CREATE_ORDER');

      const orderNo = generateNo('PO');
      const now = new Date().toISOString();
      const quantity = dto.quantity ?? request.quantity;
      this.db
        .prepare(`
          INSERT INTO purchase_orders (order_no, request_no, sku, quantity, status,
            created_by, created_at, closed_at)
          VALUES (?, ?, ?, ?, 'OPEN', ?, ?, '')
        `)
        .run(orderNo, request.request_no, request.sku, quantity, actor, now);
      return orderView(this.findOrderByIdentity(orderNo));
    })();
  }

  private findOrderByIdentity(orderNo: string): OrderRow {
    return this.db.prepare('SELECT * FROM purchase_orders WHERE order_no = ?').get(orderNo) as OrderRow;
  }

  arrive(orderId: number, actor: string) {
    return this.db.transaction(() => {
      const order = this.findOrder(orderId);
      if (order.status !== 'OPEN') throw Errors.orderNotOpen(orderId);
      const request = this.db
        .prepare('SELECT * FROM purchase_requests WHERE request_no = ?')
        .get(order.request_no) as RequestRow | undefined;
      if (!request) throw Errors.requestNotFound(order.id);

      const location = this.materials.locationOf(order.sku);

      const before = this.stock.currentAndHealth(order.sku);
      try {
        applyTransition(request.status, 'ARRIVE');
      } catch {
        throw Errors.illegalTransition(request.status, 'ARRIVE');
      }

      const movement = this.stock.recordPurchaseArrival({
        sku: order.sku,
        quantity: order.quantity,
        location,
        operator: actor,
        orderNo: order.order_no,
      });

      // ARRIVED 为事务内瞬时态，对外终态为 COMPLETED（AC-4）。
      this.transition(request, 'ARRIVE', { nextStatus: 'ARRIVED' });
      this.db
        .prepare("UPDATE purchase_orders SET status = 'CLOSED', closed_at = ? WHERE id = ?")
        .run(new Date().toISOString(), order.id);
      this.transition(this.findRequest(request.id), 'CLOSE');

      createNotification(this.db, {
        recipient: request.applicant,
        type: 'ARRIVED',
        title: `采购到货完成：${order.sku}`,
        content: `订单 ${order.order_no} 到货 ${order.quantity} 件，申请 ${request.request_no} 已完成。`,
        relatedDocNo: order.order_no,
      });

      const after = this.stock.currentAndHealth(order.sku);
      return {
        order: orderView(this.findOrder(order.id)),
        request: requestView(this.findRequest(request.id)),
        movement,
        currentStock: after.current,
        previousHealth: before.level,
        health: after.level,
      };
    })();
  }

  close(requestId: number) {
    return this.db.transaction(() => {
      const request = this.findRequest(requestId);
      if (request.status === 'COMPLETED') {
        return { request: requestView(request), order: null, noOp: true };
      }
      this.transition(request, 'CLOSE');
      const order = this.db
        .prepare("SELECT * FROM purchase_orders WHERE request_no = ? AND status = 'OPEN'")
        .get(request.request_no) as OrderRow | undefined;
      if (order) {
        this.db
          .prepare("UPDATE purchase_orders SET status = 'CLOSED', closed_at = ? WHERE id = ?")
          .run(new Date().toISOString(), order.id);
      }
      return {
        request: requestView(this.findRequest(requestId)),
        order: order ? orderView(this.findOrder(order.id)) : null,
        noOp: false,
      };
    })();
  }

  listRequests(query: RequestQueryDto): Paged<ReturnType<typeof requestView>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.status) {
      clauses.push('status = @status');
      params.status = query.status;
    }
    if (query.applicant) {
      clauses.push('applicant = @applicant');
      params.applicant = query.applicant;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM purchase_requests ${where} ORDER BY id ASC`)
      .all(params) as RequestRow[];
    return paginate(rows.map(requestView), query.page, query.pageSize);
  }

  listOrders(): { items: ReturnType<typeof orderView>[]; total: number } {
    const rows = this.db.prepare('SELECT * FROM purchase_orders ORDER BY id ASC').all() as OrderRow[];
    return { items: rows.map(orderView), total: rows.length };
  }
}
