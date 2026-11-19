import type Database from 'better-sqlite3';
import { hashPassword } from '../common/password';
import type { Role } from '../common/jwt';

interface SeedUser {
  username: string;
  displayName: string;
  role: Role;
}

/** 与既有 X-Actor 取值保持一致，避免历史流水中的 operator 对不上。 */
const SEED_USERS: SeedUser[] = [
  { username: 'warehouse', displayName: '库管员', role: 'warehouse' },
  { username: 'supervisor', displayName: '车间主管', role: 'supervisor' },
  { username: 'purchaser', displayName: '采购员', role: 'buyer' },
  { username: 'operator', displayName: '领用人员', role: 'operator' },
];

const SEED_CATEGORIES = ['计算机设备', '计算机配件', '打印设备', '耗材', '网络设备'];
const SEED_UNITS = ['台', '个', '盒', '箱'];

/**
 * 幂等写入用户与数据字典。与物料种子相互独立，
 * 因此旧库（已有物料但没有 users 表数据）也会被补齐。
 */
export function seedAccessData(db: Database.Database): void {
  const now = new Date().toISOString();
  const defaultPassword = process.env.SEED_PASSWORD || 'axparts123';

  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (userCount === 0) {
    const insert = db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, status, created_at, updated_at)
       VALUES (@username, @hash, @displayName, @role, 'ENABLED', @now, @now)`,
    );
    const hash = hashPassword(defaultPassword);
    db.transaction(() => {
      for (const user of SEED_USERS) {
        insert.run({ ...user, hash, now });
      }
    })();
  }

  const dictCount = (db.prepare('SELECT COUNT(*) AS n FROM dictionaries').get() as { n: number }).n;
  if (dictCount === 0) {
    const insert = db.prepare(
      `INSERT INTO dictionaries (type, value, label, sort_order, enabled, created_at, updated_at)
       VALUES (@type, @value, @label, @sortOrder, 1, @now, @now)`,
    );
    db.transaction(() => {
      SEED_CATEGORIES.forEach((value, index) =>
        insert.run({ type: 'CATEGORY', value, label: value, sortOrder: index + 1, now }),
      );
      SEED_UNITS.forEach((value, index) =>
        insert.run({ type: 'UNIT', value, label: value, sortOrder: index + 1, now }),
      );
    })();
  }
}

export const SEED_CREDENTIALS = {
  password: () => process.env.SEED_PASSWORD || 'axparts123',
  users: SEED_USERS.map((u) => ({ username: u.username, displayName: u.displayName, role: u.role })),
};
