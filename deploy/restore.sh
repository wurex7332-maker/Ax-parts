#!/usr/bin/env bash
# 从备份恢复数据库。会先停后端避免文件被占用，恢复后再启动。
# 用法：./restore.sh backups/ax-parts-20261119-160000.sqlite
set -euo pipefail

cd "$(dirname "$0")"

if [ $# -lt 1 ]; then
  echo "用法: ./restore.sh backups/<备份文件>"
  echo "现有备份："
  ls -1t ./backups 2>/dev/null | head -10 || echo "  （无）"
  exit 1
fi

SRC="$1"
if [ ! -f "$SRC" ]; then
  echo "找不到备份文件：$SRC"
  exit 1
fi

echo "[1/4] 停后端（避免替换文件时被占用）…"
docker compose stop backend

echo "[2/4] 先把当前库另存为 .before-restore，便于反悔…"
STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -f ./data/ax-parts.sqlite ]; then
  cp ./data/ax-parts.sqlite "./data/ax-parts.before-restore-$STAMP.sqlite"
  echo "  已保存：data/ax-parts.before-restore-$STAMP.sqlite"
fi

echo "[3/4] 覆盖数据库文件…"
cp "$SRC" ./data/ax-parts.sqlite

echo "[4/4] 启动后端…"
docker compose start backend

sleep 3
echo "验证健康检查（Caddy 会把 http 重定向到 https，故直接查 https）："
curl -sk -o /dev/null -w "  https://localhost/health -> %{http_code}\n" https://localhost/health \
  || echo "  健康检查未通过，请查看 docker compose logs backend"
echo "完成。用浏览器登录后核对数据是否符合预期。"
