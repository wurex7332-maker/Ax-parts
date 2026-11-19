#!/usr/bin/env bash
# 在线备份 SQLite 数据库。
# 用 better-sqlite3 自带的 backup API，不需要停服务，也不要求宿主机装 sqlite3。
set -euo pipefail

cd "$(dirname "$0")"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="./backups"
FILE="ax-parts-$STAMP.sqlite"
mkdir -p "$BACKUP_DIR"

echo "[1/4] 在线备份中（写入 /app/data 下的临时文件）…"
docker compose exec -T backend node -e "
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
db.backup('/app/data/.backup-tmp.sqlite')
  .then(() => { console.log('  数据库已复制'); process.exit(0); })
  .catch((e) => { console.error('  备份失败:', e.message); process.exit(1); });
"

echo "[2/4] 移动到宿主机备份目录…"
mv "./data/.backup-tmp.sqlite" "$BACKUP_DIR/$FILE"

echo "[3/4] 校验备份可读、表数量正确…"
docker compose run --rm --no-deps -v "$(pwd)/backups:/verify:ro" backend \
  node -e "
const Database = require('better-sqlite3');
const db = new Database('/verify/$FILE', { readonly: true });
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\").all().map(r => r.name);
const materials = db.prepare('SELECT COUNT(*) AS n FROM materials').get().n;
const movements = db.prepare('SELECT COUNT(*) AS n FROM stock_movements').get().n;
console.log('  表:', tables.join(', '));
console.log('  物料:', materials, '条；流水:', movements, '条');
if (materials === 0) { console.error('  [警告] 备份里没有物料数据'); process.exit(1); }
"

echo "[4/4] 清理旧备份（保留最近 14 份）…"
ls -1t "$BACKUP_DIR"/ax-parts-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "完成：$BACKUP_DIR/$FILE"
