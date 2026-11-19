# 上云操作手册（练习版）

> 目标不是"生产上线"，而是**亲手走一遍**：部署 → 访问 → 看日志 → 改代码发版 → 备份 → 故意搞坏再恢复。
> 每一步都给了「验证方法」，做完能自己确认对不对。

---

## 0. 你需要准备

| 项 | 说明 | 检查方式 |
| --- | --- | --- |
| 服务器 | Ubuntu 22.04/24.04，2 核 2G 起，能 SSH 登录 | `ssh 用户名@公网IP` 能进去 |
| 域名 | 已解析到服务器公网 IP（A 记录） | `ping 你的域名` 返回服务器 IP |
| 端口 | 安全组/防火墙放行 80、443 | 云控制台「安全组」里能看到规则 |

> 域名备案说明：用**已备案**的域名最省事；没有备案时，国内服务器用 80/443 绑域名会被拦，只能先用 IP + 非标准端口跑通，但**扫码功能不可用**（无 HTTPS）。

---

## 1. 装 Docker（一次）

```bash
# 官方一键脚本，装完执行 newgrp docker 免 sudo
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

docker --version && docker compose version
```

**验证**：`docker run --rm hello-world` 能打印欢迎语。

---

## 2. 拉代码

```bash
sudo mkdir -p /opt/ax-parts && sudo chown $USER:$USER /opt/ax-parts
git clone https://github.com/wurex7332-maker/Ax-parts.git /opt/ax-parts
cd /opt/ax-parts
git log --oneline -3          # 确认拉到了最新提交
```

---

## 3. 配置环境变量

```bash
cd /opt/ax-parts/deploy
cp .env.example .env

# 生成随机密钥并写入 JWT_SECRET
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.tmp
# 手工编辑，填 DOMAIN 和 SEED_PASSWORD
nano .env
```

`.env` 里必须改的三项：

- `DOMAIN`：你的域名（如 `parts.example.com`）
- `JWT_SECRET`：随机 64 位十六进制
- `SEED_PASSWORD`：种子账号初始密码（不要用 `axparts123`）

**验证**：`grep -E 'DOMAIN|JWT_SECRET' .env` 看不到示例值。

---

## 4. 启动

```bash
cd /opt/ax-parts/deploy
docker compose up -d --build      # 首次构建约 3–6 分钟

docker compose ps                 # 两个容器都应为 running / healthy
docker compose logs -f backend    # 看到 "Ax-parts backend listening on ..." 即成功，Ctrl+C 退出
```

**验证三步**：

```bash
curl -s http://127.0.0.1/health                                  # {"status":"ok",...}
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/api/v1/dashboard   # 401（未登录，正常）
curl -sI https://你的域名 | head -1                               # HTTP/2 200
```

浏览器打开 `https://你的域名`，用 `supervisor` + 你设置的密码登录。

---

## 5. 日常运维（这几条要练熟）

```bash
cd /opt/ax-parts/deploy

docker compose ps                    # 看状态
docker compose logs -f --tail=100 backend   # 实时日志
docker compose restart backend       # 只重启后端（改环境变量后用）
docker stats --no-stream             # 看内存/CPU 占用
```

**发版流程**（改完代码后）：

```bash
cd /opt/ax-parts
git pull
cd deploy
docker compose up -d --build backend web   # 只重建变更的服务
docker compose ps                          # 确认 healthy
```

> 数据库在宿主机 `deploy/data/` 目录，重建容器不会丢数据——这一点可以自己验证：发版后登录，看数据还在不在。

---

## 6. 备份与恢复（重点练习）

```bash
cd /opt/ax-parts/deploy
chmod +x backup.sh restore.sh

./backup.sh                 # 备份 + 自动校验表结构与条数
ls -lh backups/             # 看到 ax-parts-时间戳.sqlite
```

**完整的灾难演练**（建议至少做一次）：

1. `./backup.sh` 记下当前物料数量
2. 登录系统，故意删/改几条数据（或直接 `docker compose down` 后删掉 `data/ax-parts.sqlite`）
3. `./restore.sh backups/<刚才那份>` 
4. 刷新页面，确认数据回到备份时点

**为什么要练**：备份不验证等于没有备份。很多人第一次恢复时才发现备份是空的或打不开。

---

## 7. 数据库维护练习

见 [`web/docs/DB-PRACTICE.md`](../../web/docs/DB-PRACTICE.md)，包含 10 个可动手的练习：查看表结构、写统计 SQL、加索引看执行计划、验证触发器、加字段做数据迁移、并发写测试、备份恢复、以及从 SQLite 迁到 PostgreSQL 的思路。

---

## 8. 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 打不开、连接超时 | 安全组没放行 80/443 | 云控制台加规则 |
| 证书申请失败 | 域名没解析到本机，或 80 端口被占 | `dig 你的域名` 核对；`docker compose logs web` 看 Caddy 报错 |
| 502 Bad Gateway | 后端还没起来或崩了 | `docker compose logs backend` |
| 登录 401 但密码对 | `.env` 改了但没重启 | `docker compose up -d backend` |
| 数据好像丢了 | 用了 `docker compose down -v` 或删了 data 目录 | `./restore.sh` |
| 构建卡在 better-sqlite3 | 缺构建工具 | 镜像里已装 python3/make/g++，若仍失败看日志里的编译错误 |

---

## 9. 练习阶段可以不做 vs 真实上线必须补

| 项 | 练习阶段 | 真实上线 |
| --- | --- | --- |
| HTTPS | 有域名就自动有 | 必须 |
| 改默认密码 / JWT 密钥 | **必须**（否则等于敞开） | 必须 |
| 数据库备份 | 手动跑脚本即可 | 定时任务 + 异地存放 + 定期恢复演练 |
| 登录失败锁定 / 限流 | 可跳过 | 必须 |
| 令牌吊销（停用账号立即失效） | 可跳过 | 必须 |
| 多实例 / 负载均衡 | 不需要 | 视并发 |
| 监控告警 | 不需要（看日志够） | 建议 |
| 备案 | 用已备案域名即可 | 必须 |
| 等保 / WAF | 不需要 | 视行业要求 |

> 提醒：SQLite 单文件适合练习和小规模（几十人以内、写操作不密集）。真实车间的并发写如果上来了，就要换 PostgreSQL/MySQL——这正是 [`DB-PRACTICE.md`](../../web/docs/DB-PRACTICE.md) 最后一个练习的内容。
