import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infra/database.module';
import { Errors } from '../../common/errors';
import { signToken, tokenTtlSeconds, type AuthUser, type Role } from '../../common/jwt';
import { verifyPassword } from '../../common/password';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: Role;
  status: 'ENABLED' | 'DISABLED';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export function toUserView(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? '',
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly dbService: DatabaseService) {}

  private get db() {
    return this.dbService.db;
  }

  login(username: string, password: string) {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username.trim()) as UserRow | undefined;

    // 用户不存在与密码错误返回同一提示，避免暴露账号是否存在
    if (!row || !verifyPassword(password, row.password_hash)) throw Errors.invalidCredentials();
    if (row.status !== 'ENABLED') throw Errors.userDisabled(row.username);

    const now = new Date().toISOString();
    this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, row.id);

    const user: AuthUser = {
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    };
    return {
      token: signToken(user),
      expiresIn: tokenTtlSeconds(),
      user,
    };
  }

  me(username: string) {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | UserRow
      | undefined;
    if (!row) throw Errors.userNotFound(username);
    return {
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    };
  }
}
