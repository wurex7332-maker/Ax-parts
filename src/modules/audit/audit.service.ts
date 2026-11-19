import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { paginate, Paged } from '../../common/pagination';
import type { AuthUser } from '../../common/jwt';
import { AuditQueryDto, type AuditAction } from './dto';

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string | number;
  detail?: Record<string, unknown>;
}

interface AuditRow {
  id: number;
  actor: string;
  actor_role: string;
  action: string;
  resource: string;
  resource_id: string;
  detail: string;
  created_at: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  /** 审计写入失败不应影响业务成功，因此内部吞异常并打印。 */
  log(user: AuthUser | null, entry: AuditEntry): void {
    try {
      this.db
        .prepare(
          `INSERT INTO audit_logs (actor, actor_role, action, resource, resource_id, detail, created_at)
           VALUES (@actor, @role, @action, @resource, @resourceId, @detail, @now)`,
        )
        .run({
          actor: user?.username ?? 'system',
          role: user?.role ?? '',
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId === undefined ? '' : String(entry.resourceId),
          detail: entry.detail ? JSON.stringify(entry.detail) : '',
          now: new Date().toISOString(),
        });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('审计日志写入失败:', error);
    }
  }

  list(query: AuditQueryDto): Paged<Record<string, unknown>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.actor) {
      clauses.push('actor LIKE @actor');
      params.actor = `%${query.actor}%`;
    }
    if (query.action) {
      clauses.push('action = @action');
      params.action = query.action;
    }
    if (query.resource) {
      clauses.push('resource = @resource');
      params.resource = query.resource;
    }
    if (query.from) {
      clauses.push('created_at >= @from');
      params.from = query.from;
    }
    if (query.to) {
      clauses.push('created_at <= @to');
      params.to = query.to;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC`)
      .all(params) as AuditRow[];

    const items = rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      actorRole: row.actor_role,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      detail: row.detail,
      createdAt: row.created_at,
    }));
    return paginate(items, query.page, query.pageSize);
  }
}
