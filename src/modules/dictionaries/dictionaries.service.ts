import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import { CreateDictionaryDto, DictionaryQueryDto, DictionaryType, UpdateDictionaryDto } from './dto';

interface DictionaryRow {
  id: number;
  type: DictionaryType;
  value: string;
  label: string;
  sort_order: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function toView(row: DictionaryRow) {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    label: row.label,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class DictionariesService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  list(query: DictionaryQueryDto): Paged<ReturnType<typeof toView>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.type) {
      clauses.push('type = @type');
      params.type = query.type;
    }
    if (query.includeDisabled !== '1') {
      clauses.push('enabled = 1');
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM dictionaries ${where} ORDER BY type, sort_order, id`)
      .all(params) as DictionaryRow[];
    return paginate(rows.map(toView), query.page, query.pageSize);
  }

  /** 供物料模块校验：类别/单位必须存在于启用状态的字典中。 */
  isEnabled(type: DictionaryType, value: string): boolean {
    const row = this.db
      .prepare('SELECT 1 AS ok FROM dictionaries WHERE type = ? AND value = ? AND enabled = 1')
      .get(type, value) as { ok: number } | undefined;
    return Boolean(row);
  }

  assertEnabled(type: DictionaryType, value: string, fieldLabel: string): void {
    if (!this.isEnabled(type, value)) {
      throw Errors.validation(`${fieldLabel}「${value}」不在启用的数据字典中，请先在数据字典中维护`);
    }
  }

  create(dto: CreateDictionaryDto) {
    const existing = this.db
      .prepare('SELECT 1 FROM dictionaries WHERE type = ? AND value = ?')
      .get(dto.type, dto.value);
    if (existing) throw Errors.duplicateDictionary(dto.type, dto.value);

    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `INSERT INTO dictionaries (type, value, label, sort_order, enabled, created_at, updated_at)
         VALUES (@type, @value, @label, @sortOrder, 1, @now, @now)`,
      )
      .run({
        type: dto.type,
        value: dto.value.trim(),
        label: dto.label.trim(),
        sortOrder: dto.sortOrder ?? 100,
        now,
      });
    const row = this.db.prepare('SELECT * FROM dictionaries WHERE id = ?').get(info.lastInsertRowid) as DictionaryRow;
    return toView(row);
  }

  update(id: number, dto: UpdateDictionaryDto) {
    const row = this.db.prepare('SELECT * FROM dictionaries WHERE id = ?').get(id) as
      | DictionaryRow
      | undefined;
    if (!row) throw Errors.dictionaryNotFound(id);

    // 停用前检查是否仍被物料引用，避免产生无法解释的历史数据
    if (dto.enabled === false && row.enabled === 1) {
      const column = row.type === 'CATEGORY' ? 'category' : 'unit';
      const used = this.db
        .prepare(`SELECT COUNT(*) AS n FROM materials WHERE ${column} = ?`)
        .get(row.value) as { n: number };
      if (used.n > 0) throw Errors.dictionaryInUse(row.value);
    }

    this.db
      .prepare(
        `UPDATE dictionaries SET label = @label, sort_order = @sortOrder, enabled = @enabled, updated_at = @now
         WHERE id = @id`,
      )
      .run({
        id,
        label: dto.label?.trim() || row.label,
        sortOrder: dto.sortOrder ?? row.sort_order,
        enabled: dto.enabled === undefined ? row.enabled : dto.enabled ? 1 : 0,
        now: new Date().toISOString(),
      });
    const updated = this.db.prepare('SELECT * FROM dictionaries WHERE id = ?').get(id) as DictionaryRow;
    return toView(updated);
  }
}
