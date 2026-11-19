import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { paginate, Paged } from '../../common/pagination';
import { hashPassword } from '../../common/password';
import type { AuthUser, Role } from '../../common/jwt';
import { toUserView, type UserRow } from '../auth/auth.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserQueryDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  private assertSupervisorRemains(excludeId: number): void {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'supervisor' AND status = 'ENABLED' AND id <> ?")
      .get(excludeId) as { n: number };
    if (row.n === 0) {
      throw Errors.validation('至少需要保留一名启用状态的车间主管，否则将无人可管理用户');
    }
  }

  findAll(query: UserQueryDto): Paged<ReturnType<typeof toUserView>> {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (query.role) {
      clauses.push('role = @role');
      params.role = query.role;
    }
    if (query.status) {
      clauses.push('status = @status');
      params.status = query.status;
    }
    if (query.keyword) {
      clauses.push('(username LIKE @keyword OR display_name LIKE @keyword)');
      params.keyword = `%${query.keyword}%`;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM users ${where} ORDER BY id`)
      .all(params) as UserRow[];
    return paginate(rows.map(toUserView), query.page, query.pageSize);
  }

  create(dto: CreateUserDto) {
    const username = dto.username.trim();
    const existing = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) throw Errors.duplicateUser(username);

    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, role, status, created_at, updated_at)
         VALUES (@username, @hash, @displayName, @role, 'ENABLED', @now, @now)`,
      )
      .run({
        username,
        hash: hashPassword(dto.password),
        displayName: dto.displayName.trim(),
        role: dto.role,
        now,
      });
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
    return toUserView(row);
  }

  update(id: number, dto: UpdateUserDto) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!row) throw Errors.userNotFound(String(id));

    const nextRole: Role = dto.role ?? row.role;
    const nextStatus = dto.status ?? row.status;
    const isLosingSupervisor =
      row.role === 'supervisor' &&
      row.status === 'ENABLED' &&
      (nextRole !== 'supervisor' || nextStatus !== 'ENABLED');
    if (isLosingSupervisor) this.assertSupervisorRemains(row.id);

    this.db
      .prepare('UPDATE users SET display_name = @displayName, role = @role, status = @status, updated_at = @now WHERE id = @id')
      .run({
        id,
        displayName: dto.displayName?.trim() || row.display_name,
        role: nextRole,
        status: nextStatus,
        now: new Date().toISOString(),
      });

    const updated = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    return toUserView(updated);
  }

  resetPassword(id: number, dto: ResetPasswordDto) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!row) throw Errors.userNotFound(String(id));
    this.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(dto.password), new Date().toISOString(), id);
    return { ok: true, username: row.username };
  }

  changeOwnPassword(user: AuthUser, nextPassword: string) {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(user.username) as
      | UserRow
      | undefined;
    if (!row) throw Errors.userNotFound(user.username);
    this.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashPassword(nextPassword), new Date().toISOString(), row.id);
    return { ok: true };
  }
}
