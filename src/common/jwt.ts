import { createHmac, timingSafeEqual } from 'node:crypto';

/** 角色枚举：与前端 useSession 保持一致，沿用需求定义的 4 个业务角色。 */
export const ROLES = ['warehouse', 'supervisor', 'buyer', 'operator'] as const;
export type Role = (typeof ROLES)[number];

export interface TokenPayload {
  sub: string;
  name: string;
  role: Role;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function secret(): string {
  return process.env.JWT_SECRET || 'ax-parts-dev-secret-change-me';
}

export function tokenTtlSeconds(): number {
  const raw = Number(process.env.JWT_TTL_SECONDS || 43200); // 默认 12 小时
  return Number.isFinite(raw) && raw > 0 ? raw : 43200;
}

/** HS256 签名，避免引入第三方 JWT 库。 */
export function signToken(user: { username: string; displayName: string; role: Role }): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.username,
    name: user.displayName,
    role: user.role,
    iat: now,
    exp: now + tokenTtlSeconds(),
  };
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = createHmac('sha256', secret()).update(`${header}.${body}`).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.sub !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!ROLES.includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: Role;
}
