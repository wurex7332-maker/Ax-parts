# 数据库维护练习（10 个可动手的题目）

> 这套系统用的是 **SQLite 单文件数据库**（`deploy/data/ax-parts.sqlite`）。
> 选它正是为了练习：一个文件就是全部数据，拷走即备份，用任何工具都能打开看。
> 下面每个练习都给了「怎么做」「看什么」「为什么值得做」。

进入容器里的 SQLite（容器内有 better-sqlite3，用 Node 交互）：

```bash
cd /opt/ax-parts/deploy
docker compose exec backend node
```

然后粘贴下面这段，进入可交互的 SQL 环境：

```js
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH);
globalThis.q = (sql, ...p) => console.table(db.prepare(sql).all(...p));
globalThis.x = (sql, ...p) => db.prepare(sql).run(...p);
console.log('已就绪：q(SQL) 查询并表格输出，x(SQL) 执行写入');
```

---

## 练习 1：认识数据模型

```js
q("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
q("SELECT sql FROM sqlite_master WHERE name='stock_movements'");
```

**看什么**：7 张业务表 + `users`/`audit_logs`/`dictionaries`/`idempotency_records`。
**为什么**：先弄清"库存不是存一个数字，而是流水求和"，后面所有统计都基于这个事实。

---

## 练习 2：验证「库存 = 流水求和」

```js
q(`SELECT m.sku, m.safety_stock,
          COALESCE(SUM(s.quantity_signed), 0) AS current
   FROM materials m
   LEFT JOIN stock_movements s ON s.sku = m.sku
   GROUP BY m.sku ORDER BY current`);
```

**对比**：打开页面「库存台账」，数字应当完全一致。
**为什么**：这是这套系统的核心设计——**不缓存余额**。好处是不会对不上账，代价是每次都要算（练习 7 会看到性能问题）。

---

## 练习 3：写一个"三态"判定

```js
q(`WITH stock AS (
     SELECT m.sku, m.name, m.safety_stock,
            COALESCE(SUM(s.quantity_signed),0) AS current
     FROM materials m LEFT JOIN stock_movements s ON s.sku=m.sku
     GROUP BY m.sku)
   SELECT sku, name, current, safety_stock,
     CASE WHEN current <= 0 THEN '断料'
          WHEN current <= safety_stock THEN '预警'
          ELSE '正常' END AS health
   FROM stock ORDER BY health DESC, current`);
```

**为什么**：业务规则落在 SQL 里长什么样。注意 `current <= 0` 必须排在前面，否则安全库存为 0 时会误判。

---

## 练习 4：看看索引有没有被用上

```js
q("EXPLAIN QUERY PLAN SELECT * FROM stock_movements WHERE sku = 'MON-004'");
q("EXPLAIN QUERY PLAN SELECT * FROM stock_movements WHERE operator = 'warehouse'");
```

**看什么**：输出里出现 `USING INDEX idx_movements_sku` 表示走索引；出现 `SCAN` 表示全表扫描。
**为什么**：这是判断"查询慢不慢"的第一手证据，比猜有用。

---

## 练习 5：亲手加一个索引，观察差别

```js
// 先关掉索引，模拟没优化的状态（SQLite 无法直接禁用，改用一个没索引的列对比）
q("EXPLAIN QUERY PLAN SELECT * FROM stock_movements WHERE occurred_at > '2026-11-01'");
q("EXPLAIN QUERY PLAN SELECT * FROM stock_movements WHERE batch = 'B-1'");

// 给 batch 加索引，再对比
x("CREATE INDEX IF NOT EXISTS idx_movements_batch ON stock_movements(batch)");
q("EXPLAIN QUERY PLAN SELECT * FROM stock_movements WHERE batch = 'B-1'");
```

**进阶**：造 10 万条流水，用 `.timer on` 比较加索引前后的耗时：

```js
x(`INSERT INTO stock_movements (movement_no, sku, location, type, quantity_signed, source, operator, occurred_at, created_at)
   SELECT 'BENCH-'||value, 'MON-004', 'A-03', 'OUT_ISSUE', -1, 'BENCH', 'bench',
          datetime('now','-'||value||' minutes'), datetime('now')
   FROM (WITH RECURSIVE c(value) AS (SELECT 1 UNION ALL SELECT value+1 FROM c WHERE value < 100000)
         SELECT value FROM c)`);
db.prepare('ANALYZE').run();
```

> 做完记得清理：`x("DELETE FROM stock_movements WHERE movement_no LIKE 'BENCH-%'")`。
> **注意**：这张表有触发器禁止 DELETE，会报错——这正好是练习 6 的内容。清理办法：恢复备份。

---

## 练习 6：验证「流水不可篡改」

```js
x("UPDATE stock_movements SET quantity_signed = 999 WHERE id = 1");
x("DELETE FROM stock_movements WHERE id = 1");
```

**预期**：两次都报 `stock_movements is append-only`。
**为什么**：数据完整性不是靠"小心操作"，而是靠数据库层强制。真实系统里这两条触发器能挡掉绝大多数误操作与内部作弊。

---

## 练习 7：改表结构 + 回填数据（迁移演练）

场景：给物料加一个「保质期天数」字段。

```js
x("ALTER TABLE materials ADD COLUMN shelf_life_days INTEGER NOT NULL DEFAULT 0");
q("PRAGMA table_info(materials)");

// 回填：耗材类默认 365 天
x("UPDATE materials SET shelf_life_days = 365 WHERE category = '耗材'");
q("SELECT sku, name, category, shelf_life_days FROM materials");
```

**为什么**：这是最常见的线上变更。要点是——**新增字段必须给默认值**，否则老数据是 NULL，代码读的时候会炸。
**进阶**：思考如果要把字段改名或改类型，SQLite 不支持直接改，得建新表复制数据（本项目 `src/infra/migrations.ts` 里就有这样的完整例子，可以对照读）。

---

## 练习 8：找出"谁改了什么"（审计查询）

```js
q(`SELECT created_at, actor, action, resource_id, detail
   FROM audit_logs ORDER BY id DESC LIMIT 20`);

// 统计每个人今天做了多少写操作
q(`SELECT actor, COUNT(*) AS ops FROM audit_logs
   GROUP BY actor ORDER BY ops DESC`);
```

**为什么**：出了问题第一件事是查审计。练习写出"某个 SKU 今天被谁动过"的 SQL。

---

## 练习 9：并发写会怎样

开两个终端，都进入容器，同时各执行 200 次出库：

```js
// 终端 A
for (let i = 0; i < 200; i++) {
  db.prepare("INSERT INTO stock_movements (movement_no,sku,location,type,quantity_signed,source,operator,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run('CONC-A-'+i, 'TNR-005','C-01','OUT_ISSUE',-1,'CONC','a',new Date().toISOString(),new Date().toISOString());
}
```

**看什么**：会不会出现 `SQLITE_BUSY: database is locked`。
**为什么**：这就是 SQLite 的边界——**单写者**。练习阶段的两个人同时操作可能已经偶发报错，这就是真实车间上量后必须换 PostgreSQL 的理由。
> 清理：恢复备份。

---

## 练习 10：如果换成 PostgreSQL，要改什么

不用真做，先想清楚（也可以真做）：

1. **驱动与建表**：`better-sqlite3` → `pg`；`INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL`/`GENERATED`；`TEXT` 时间戳 → `timestamptz`
2. **事务与并发**：SQLite 单写 → PG 行级锁；`version` 乐观锁逻辑可以保留
3. **触发器**：`RAISE(ABORT)` → PL/pgSQL 函数 + `BEFORE UPDATE` 触发器
4. **布尔**：`is_read INTEGER 0/1` → `boolean`
5. **迁移数据**：写脚本从 SQLite 读、往 PG 写，跑完核对每张表条数与关键汇总（如库存合计）
6. **不改的部分**：业务规则（三态判定、状态机）是纯函数，换库不影响——这正是把它们抽到 `src/domain/` 的价值

---

## 附：几个日常会用到的命令

```bash
# 宿主机直接看文件大小
ls -lh deploy/data/

# 把库拷回本地用可视化工具打开（推荐 DB Browser for SQLite）
scp 用户名@服务器:/opt/ax-parts/deploy/data/ax-parts.sqlite ./

# 备份
./deploy/backup.sh

# 恢复
./deploy/restore.sh deploy/backups/ax-parts-xxxx.sqlite
```
