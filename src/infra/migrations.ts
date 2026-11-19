import type Database from 'better-sqlite3';

/**
 * 历史库迁移：早期 materials 表把 category/unit 写死为 CHECK 约束，
 * 导致数据字典无法新增取值。这里把表重建为无 CHECK 的版本（校验改由字典负责）。
 * 幂等：已迁移过的库检测不到 CHECK 直接返回。
 */
export function migrateMaterialsDictionary(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'materials'")
    .get() as { sql?: string } | undefined;
  const sql = row?.sql ?? '';
  const needsMigration = sql.includes('CHECK (category IN') || sql.includes('CHECK (unit IN');
  if (!needsMigration) return false;

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      BEGIN;
      CREATE TABLE materials__migrating (
        sku TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        spec_model TEXT NOT NULL DEFAULT '',
        brand TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL,
        location TEXT NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
        safety_stock INTEGER NOT NULL CHECK (safety_stock >= 0),
        supplier TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO materials__migrating
        SELECT sku, name, category, spec_model, brand, unit, location, price_cents,
               safety_stock, supplier, image_url, status, created_at, updated_at
        FROM materials;
      DROP TABLE materials;
      ALTER TABLE materials__migrating RENAME TO materials;
      COMMIT;
    `);
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
  // eslint-disable-next-line no-console
  console.log('已迁移 materials 表：移除类别/单位 CHECK 约束，改由数据字典校验');
  return true;
}
