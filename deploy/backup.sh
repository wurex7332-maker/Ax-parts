#!/usr/bin/env bash
# 在线备份 SQLite 数据库。
# 用 better-sqlite3 自带的 backup API，不需要停服务，也不要求宿主机装 sqlite3。
# 校验在容器内完成（避免挂载路径在不同系统上的差异），宿主机只负责搬移。
set -euo pipefail

cd "$(dirname "$0")"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="./backups"
FILE="ax-parts-$STAMP.sqlite"
mkdir -p "$BACKUP_DIR"

echo "[1/4] 在线备份并就地校验…"
docker compose exec -T backend node -e "
const Database = require('better-sqlite3');

(async () => {
  const src = new Database(process.env.DATABASE_PATH, { readonly: true });
  const out = '/app/data/.backup-tmp.sqlite';
  await src.backup(out);
  src.close();

  const db = new Database(out, { readonly: true });
  const tables = db
    .prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\")
    .all()
    .map((r) => r.name);
  const materials = db.prepare('SELECT COUNT(*) AS n FROM materials').get().n;
  const movements = db.prepare('SELECT COUNT(*) AS n FROM stock_movements').get().n;
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  db.close();

  console.log('  表(' + tables.length + '):', tables.join(', '));
  console.log('  物料:', materials, '| 流水:', movements, '| 用户:', users);

  if (materials === 0) {
    console.error('  [失败] 备份中没有物料数据');
    process.exit(1);
  }
})().catch((e) => {
  console.error('  [失败]', e.message);
  process.exit(1);
});
"

echo "[2/4] 移动到宿主机备份目录…"
mv "./data/.backup-tmp.sqlite" "$BACKUP_DIR/$FILE"

echo "[3/4] 记录文件大小…"
ls -lh "$BACKUP_DIR/$FILE" | awk '{print "  ", $9, $5}'

echo "[4/4] 清理旧备份（保留最近 14 份）…"
ls -1t "$BACKUP_DIR"/ax-parts-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "完成：$BACKUP_DIR/$FILE"
