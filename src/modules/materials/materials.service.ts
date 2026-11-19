import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import {
  CreateMaterialDto,
  MaterialQueryDto,
  MaterialRow,
  materialColumnMap,
  toMaterialView,
  UpdateMaterialDto,
} from './dto';
import { sumSigned } from '../../domain/stock-math';
import { DictionariesService } from '../dictionaries/dictionaries.service';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly dictionaries: DictionariesService,
  ) {}

  private get db() {
    return this.dbService.db;
  }

  findAll(query: MaterialQueryDto): Paged<ReturnType<typeof toMaterialView>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.category) {
      clauses.push('category = @category');
      params.category = query.category;
    }
    if (query.status) {
      clauses.push('status = @status');
      params.status = query.status;
    }
    if (query.sku) {
      clauses.push('sku = @sku');
      params.sku = query.sku;
    }
    if (query.keyword) {
      clauses.push('(name LIKE @keyword OR sku LIKE @keyword)');
      params.keyword = `%${query.keyword}%`;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM materials ${where} ORDER BY created_at, sku`)
      .all(params) as MaterialRow[];
    return paginate(rows.map(toMaterialView), query.page, query.pageSize);
  }

  findOne(sku: string) {
    const row = this.db.prepare('SELECT * FROM materials WHERE sku = ?').get(sku) as
      | MaterialRow
      | undefined;
    if (!row) throw Errors.materialNotFound(sku);
    const sums = this.db
      .prepare('SELECT COALESCE(SUM(quantity_signed), 0) AS current FROM stock_movements WHERE sku = ?')
      .get(sku) as { current: number };
    return { ...toMaterialView(row), currentStock: sums.current };
  }

  create(dto: CreateMaterialDto) {
    this.dictionaries.assertEnabled('CATEGORY', dto.category, '类别');
    this.dictionaries.assertEnabled('UNIT', dto.unit, '单位');
    const exists = this.db.prepare('SELECT 1 FROM materials WHERE sku = ?').get(dto.sku);
    if (exists) throw Errors.duplicateSku(dto.sku);
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO materials (sku, name, category, spec_model, brand, unit, location,
          price_cents, safety_stock, supplier, image_url, status, created_at, updated_at)
        VALUES (@sku, @name, @category, @specModel, @brand, @unit, @location,
          @priceCents, @safetyStock, @supplier, @imageUrl, 'ENABLED', @now, @now)
      `)
      .run({ ...dto, now });
    return this.findOne(dto.sku);
  }

  update(sku: string, dto: UpdateMaterialDto) {
    this.findOne(sku);
    if (dto.category !== undefined) this.dictionaries.assertEnabled('CATEGORY', dto.category, '类别');
    if (dto.unit !== undefined) this.dictionaries.assertEnabled('UNIT', dto.unit, '单位');
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (entries.length) {
      const assignments = entries
        .map(([key]) => `${materialColumnMap(key)} = @${key}`)
        .join(', ');
      const params = Object.fromEntries(entries);
      params.sku = sku;
      params.now = new Date().toISOString();
      this.db
        .prepare(`UPDATE materials SET ${assignments}, updated_at = @now WHERE sku = @sku`)
        .run(params);
    }
    return this.findOne(sku);
  }

  disable(sku: string) {
    this.findOne(sku);
    this.db
      .prepare("UPDATE materials SET status = 'DISABLED', updated_at = ? WHERE sku = ?")
      .run(new Date().toISOString(), sku);
    return this.findOne(sku);
  }

  /** 供库存/采购模块复用：确认 SKU 存在且启用。 */
  assertEnabled(sku: string): MaterialRow {
    const row = this.db.prepare('SELECT * FROM materials WHERE sku = ?').get(sku) as
      | MaterialRow
      | undefined;
    if (!row) throw Errors.materialNotFound(sku);
    if (row.status !== 'ENABLED') throw Errors.materialDisabled(sku);
    return row;
  }

  /** 到货入库按档案库位落账；历史申请即便档案停用也可到货。 */
  locationOf(sku: string): string {
    const row = this.db.prepare('SELECT location FROM materials WHERE sku = ?').get(sku) as
      | { location: string }
      | undefined;
    if (!row) throw Errors.materialNotFound(sku);
    return row.location;
  }

  currentStock(sku: string): number {
    const rows = this.db
      .prepare('SELECT quantity_signed FROM stock_movements WHERE sku = ?')
      .all(sku) as Array<{ quantity_signed: number }>;
    return sumSigned(rows);
  }
}
