# Ax-parts 车间辅料管理平台（后端）

面向测试项目的后端服务：用一套 REST API 与 SQLite 数据层统一管理辅料档案、库存流水、低库存预警、两级采购审批、看板与报表。Web 端与手机端共用同一份库存/审批状态。

- 技术栈：Node.js ≥ 20 + TypeScript + NestJS 10 + better-sqlite3 + Jest/supertest
- API 前缀：`/api/v1`；健康检查：`GET /health`
- 身份：测试项目不做登录；写操作从请求头 `X-Actor` 取操作人，缺省 `system`
- 响应：成功直接返回资源或 `{ items, total, page, pageSize }`；失败返回 `{ code, message, details? }`

## 1. 启动与配置

```bash
npm install
npm run seed       # 可选：显式导入种子（服务首次启动也会自动幂等导入）
npm run start:dev  # http://localhost:3000
```

生产式启动：

```bash
npm run build && npm run start:prod
```

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_PATH` | `./data/ax-parts.sqlite` | SQLite 文件；`:memory:` 用于测试 |
| `SKIP_SEED` | 未设置 | 设为 `1` 时启动不导入种子 |
| `PORT` | `3000` | HTTP 端口 |

`better-sqlite3` 是原生模块；若换 Node 版本后启动失败，执行 `npm rebuild better-sqlite3`。

测试命令：

```bash
npm test          # 领域纯函数单测（库存汇总/健康分桶/状态机/建议量）
npm run test:e2e  # AC-1~AC-5、种子、幂等、流水不可变 E2E
npm run test:cov  # 全量测试 + 覆盖率
```

## 2. 枚举与业务口径

| 字段 | 取值 |
|---|---|
| `category` | 计算机设备、计算机配件、打印设备、耗材、网络设备 |
| `unit` | 台、个、盒、箱 |
| `material.status` | `ENABLED` / `DISABLED` |
| `movement.type` | `IN_PURCHASE`、`IN_RETURN`、`OUT_ISSUE`、`COUNT_GAIN`、`COUNT_LOSS`、`ADJUST_LOSS`、`TRANSFER_OUT`、`TRANSFER_IN`、`REVERSAL` |
| `request.status` | `PENDING`(待审批) → `APPROVED`(已审批) → `PURCHASING`(采购中) → `ARRIVED`(已到货) → `COMPLETED`(已完成)；驳回回到 `PENDING` |
| `order.status` | `OPEN` / `CLOSED` |
| `notification.type` | `ALERT`、`STOCKOUT`、`APPROVED`、`REJECTED`、`ARRIVED` |
| `alert.level` | `LOW`(预警) / `STOCKOUT`(断料) |

口径（与 `design.md` 的两处澄清一致）：

1. **健康分桶用当前库存**：`current ≤ 0` → `STOCKOUT`；`0 < current ≤ safetyStock` → `LOW`；否则 `NORMAL`。**出库校验用可用库存**（当前库存 − 锁定库存）。一期锁定库存默认 0；`StockService.lockStock/unlockStock` 提供内部锁定/解锁能力（无对外端点）。
2. **到货即完成**：`POST /purchase/orders/{id}/arrive` 在单个事务内完成 `PURCHASING → ARRIVED → COMPLETED`，对外终态为 `COMPLETED`、订单为 `CLOSED`；`ARRIVED` 为事务内瞬时态。保留 `POST /purchase/requests/{id}/close` 作为补单兼容端点（已完成时为幂等 no-op）。
3. 当前库存始终由 `SUM(stock_movements.quantity_signed)` 现算，不缓存；流水只增不改不删，数据库触发器强制禁止 `UPDATE`/`DELETE`，冲正通过新增 `REVERSAL` 流水实现。
4. 预警建议量 = `max(2 × 安全库存 − 当前库存, 1)`。看板 `alertCount` 只统计 `LOW`，断料单列；`pendingPurchaseCount` 统计 `PENDING/APPROVED/PURCHASING` 的申请。
5. 站内消息按"状态跃迁"产生（健康分桶恶化、审批通过/驳回、到货完成），读取预警列表不会重复刷屏。
6. 扫码出库支持 `Idempotency-Key` 请求头：相同 key 回放首次结果，不会重复入库流水。

## 3. API 一览

### F1 辅料档案

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/materials` | 新增，SKU 唯一；非法枚举 400，重复 409 |
| GET | `/api/v1/materials` | 筛选 `category`/`keyword`/`status`/`sku`，分页 |
| GET | `/api/v1/materials/{sku}` | 详情（含 `currentStock`） |
| PUT | `/api/v1/materials/{sku}` | 编辑（body 中不允许携带 `sku`） |
| POST | `/api/v1/materials/{sku}/disable` | 逻辑停用，历史流水保留 |

字段均为 camelCase：`specModel`、`priceCents`、`safetyStock`、`imageUrl`。`priceCents` 以整数分存储。

### F2 库存与流水

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/stock` | 按 `sku`/`location` 筛选；返回 `currentStock`/`availableStock`/`lockedStock` |
| POST | `/api/v1/stock/inbound` | `source=PURCHASE\|RETURN`，可带 `relatedDocNo` |
| POST | `/api/v1/stock/outbound` | 领用出库：`sku, quantity, recipient, purpose?, batch?`；支持 `Idempotency-Key` |
| POST | `/api/v1/stock/count` | `sku, location, actualQty` → 自动盘盈/盘亏，差额为 0 不写流水 |
| POST | `/api/v1/stock/adjust` | `type=LOSS\|TRANSFER`；调拨需 `sourceLocation`/`targetLocation` |
| GET | `/api/v1/stock/movements` | 按 `sku`/`type`/`operator`/`from`/`to` 筛选，分页 |
| POST | `/api/v1/stock/movements/{id}/reverse` | 冲正（新增反向流水，原流水不变） |

所有写操作可用 `X-Actor` 指定经手人；流水包含 `movementNo`、`operator`、`occurredAt`、`relatedDocNo` 等追溯字段。库存不足返回 409 `STOCK_INSUFFICIENT`。

### F3 预警与站内消息

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/alerts` | 预警 + 断料，`level=LOW\|STOCKOUT` 筛选 |
| POST | `/api/v1/alerts/generate-suggestions` | 生成建议草稿（不落库，数量提交前可改） |
| GET | `/api/v1/notifications` | 按 `recipient`/`isRead` 筛选，分页 |
| POST | `/api/v1/notifications/{id}/read` | 标记已读（幂等） |

### F4 采购管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/purchase/requests` | `sku, quantity, expectedDate, reason, source?, applicant?` |
| GET | `/api/v1/purchase/requests` | 按 `status`/`applicant` 筛选 |
| POST | `/api/v1/purchase/requests/{id}/approve` | 主管通过：`PENDING → APPROVED` |
| POST | `/api/v1/purchase/requests/{id}/reject` | 主管驳回：`{ "reason": "..." }` 必填，退回 `PENDING` |
| POST | `/api/v1/purchase/requests/{id}/resubmit` | 申请人重提 |
| POST | `/api/v1/purchase/orders` | `{ "requestId": 1, "quantity"? }`，仅 `APPROVED` 可建单 |
| GET | `/api/v1/purchase/orders` | 订单列表 |
| POST | `/api/v1/purchase/orders/{id}/arrive` | 到货入库 + 关单到 `COMPLETED` |
| POST | `/api/v1/purchase/requests/{id}/close` | 补单关闭（已完成时 no-op） |

非法迁移返回 409 `ILLEGAL_STATE_TRANSITION`；订单未 OPEN 返回 409 `ORDER_NOT_OPEN`。

### F5 看板与报表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/dashboard` | `skuTotal`、`alertCount`、`stockoutCount`、`pendingPurchaseCount`、`healthDistribution{normal,low,stockout}` |
| GET | `/api/v1/reports/movements` | 出入库流水（筛选同流水接口） |
| GET | `/api/v1/reports/consumption-rank` | 出库量降序，支持 `from`/`to` |
| GET | `/api/v1/reports/alerts` | 预警清单 |
| GET | `/api/v1/reports/purchase` | 各状态申请数、申请/订单数量、到货量、未关闭订单数 |

## 4. curl 示例（全链路）

```bash
# 0. 健康检查与初始看板
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/dashboard

# 1. 新建辅料并入库，扫码领用
curl -X POST http://localhost:3000/api/v1/materials \
  -H 'Content-Type: application/json' \
  -d '{"sku":"TST-001","name":"测试耗材","category":"耗材","unit":"个","location":"T-01","priceCents":150,"safetyStock":2}'
curl -X POST http://localhost:3000/api/v1/stock/inbound \
  -H 'Content-Type: application/json' -H 'X-Actor: keeper' \
  -d '{"sku":"TST-001","quantity":10,"source":"PURCHASE"}'
curl -X POST http://localhost:3000/api/v1/stock/outbound \
  -H 'Content-Type: application/json' -H 'X-Actor: worker' -H 'Idempotency-Key: scan-001' \
  -d '{"sku":"TST-001","quantity":3,"recipient":"张三","purpose":"车间领用","batch":"B-1"}'
curl 'http://localhost:3000/api/v1/stock?sku=TST-001'

# 2. 预警 / 建议 / 两级审批 / 到货
curl http://localhost:3000/api/v1/alerts
curl -X POST http://localhost:3000/api/v1/alerts/generate-suggestions
curl -X POST http://localhost:3000/api/v1/purchase/requests \
  -H 'Content-Type: application/json' \
  -d '{"sku":"PC-002","quantity":3,"expectedDate":"2026-12-31","reason":"预警补货","source":"ALERT","applicant":"alice"}'
curl -X POST http://localhost:3000/api/v1/purchase/requests/7/approve -H 'X-Actor: supervisor'
curl -X POST http://localhost:3000/api/v1/purchase/orders \
  -H 'Content-Type: application/json' -H 'X-Actor: purchaser' -d '{"requestId":7}'
curl -X POST http://localhost:3000/api/v1/purchase/orders/2/arrive -H 'X-Actor: purchaser'

# 3. 报表（id 以实际返回为准）
curl 'http://localhost:3000/api/v1/reports/movements?sku=PC-002'
curl http://localhost:3000/api/v1/reports/consumption-rank
curl http://localhost:3000/api/v1/reports/purchase
```

## 5. 种子数据

服务首次启动（或 `npm run seed`）时，若 `materials` 表为空，则导入：

| SKU | 名称 | 期初当前库存 | 安全库存 | 库位 | 分桶 |
|---|---|---:|---:|---|---|
| PRT-001 | 激光打印机 | 3 | 2 | A-01 | 正常 |
| PC-002 | 办公台式机 | 1 | 2 | A-02 | 预警 |
| HDD-003 | 1TB 机械硬盘 | 0 | 5 | B-01 | 断料 |
| MON-004 | 24 寸显示器 | 8 | 3 | A-03 | 正常 |
| TNR-005 | 硒鼓 | 12 | 10 | C-01 | 正常 |
| NET-006 | 千兆交换机 | 2 | 2 | B-02 | 预警 |

期初库存均以期初入库流水写入（库存为 0 的 HDD-003 不写 0 数量流水），因此"库存由流水汇总"对种子同样成立。初始看板：`skuTotal=6, alertCount=2, stockoutCount=1, pendingPurchaseCount=1`。种子另含 HDD-003 的采购中申请 `PR-SEED-0001`、OPEN 订单 `PO-SEED-0001`（数量 20）和断料站内消息，便于直接验证到货闭环。重置种子：停止服务后删除 `DATABASE_PATH` 指向的 SQLite 文件再启动。

## 6. 错误码

| code | HTTP | 场景 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 参数/枚举校验失败 |
| `DUPLICATE_SKU` | 409 | SKU 重复 |
| `MATERIAL_NOT_FOUND` / `MATERIAL_DISABLED` | 404 / 409 | 档案不存在 / 已停用 |
| `STOCK_INSUFFICIENT` | 409 | 出库/报损/调拨超过可用库存 |
| `MOVEMENT_NOT_FOUND` / `ALREADY_REVERSED` | 404 / 409 | 流水不存在 / 已冲正 |
| `REQUEST_NOT_FOUND` / `ORDER_NOT_FOUND` | 404 | 采购单据不存在 |
| `REJECT_REASON_REQUIRED` | 400 | 驳回未填原因 |
| `ILLEGAL_STATE_TRANSITION` | 409 | 非法状态迁移 |
| `ORDER_NOT_OPEN` / `DUPLICATE_ORDER` | 409 | 订单非 OPEN / 申请已有订单 |
| `IDEMPOTENCY_CONFLICT` | 409 | 幂等键被其他端点占用 |
| `INTERNAL_ERROR` | 500 | 未预期错误 |

## 7. 数据模型

`materials`、`stock_movements`（append-only，带 `BEFORE UPDATE/DELETE RAISE(ABORT)` 触发器）、`stock_locks`、`purchase_requests`（`version` 乐观锁）、`purchase_orders`、`notifications`、`idempotency_records`。建表语句见 `src/infra/schema.ts`。所有时间字段为服务端 ISO8601 字符串，单价为整数分，库存数量为整数。

> 本项目为测试项目，`X-Actor` 可伪造，不具备真实鉴权；请勿用于生产环境。
