# 车间辅料管理平台 · 技术方案

| 项目 | 内容 |
| --- | --- |
| 对应 PRD | `PRD-车间辅料管理平台.md` |
| 契约来源 | `Ax-parts` 分支 `feature/requirement-2-20261118-0936`（NestJS 10 + better-sqlite3，已实测提取） |
| 交付分支 | `feature/requirement-3-20261118-0936` |
| 技术栈 | React 18 + Vite + TypeScript + Tailwind CSS；Vitest + Testing Library |

---

## 1. 总体架构

```
┌────────────────────────── 单一 SPA（纯静态产物） ──────────────────────────┐
│  /admin/*  桌面布局                     /m/*  移动布局                    │
│      │                                      │                            │
│      └──────────┬───────────────────────────┘                            │
│                 ▼                                                        │
│      路由守卫（角色视角）→ 页面 → 组件（HealthBadge / Field / Table …）    │
│                 ▼                                                        │
│      useQuery / useMutation（缓存 + 失效表 + aria-live 播报）             │
│                 ▼                                                        │
│      ┌──────── ApiPort（唯一契约面，与 mode 无关）────────┐               │
│      │  mock 适配器                │   http 适配器        │               │
│      │  localStorage + 状态机      │   fetch + /api/v1    │               │
│      └─────────────────────────────┴──────────────────────┘               │
└──────────────────────────────────────────────────────────────────────────┘
                                  │ http 模式
                                  ▼
                 NestJS 后端 :3000（独立需求，已实现）
```

三个关键决策：

1. **`ApiPort` 单一契约面**：组件只依赖接口，不感知数据来源。mock 与 http 是同一接口的两个实现，因此「静态可点」与「真实联调」不必写两套 UI。
2. **mock 复刻后端行为而非简化**：同分页结构、同错误码、同状态机、同枚举、同 append-only 语义。目的是 mock 下通过的流程接后端时不因契约差异崩掉。
3. **写后重拉、不做本地累加**：满足「单一权威数据源」；失效表是显式常量，可审阅、可测试。

---

## 2. 模块拆分

```
Ax-parts/             # 仓库根目录：后端服务（feature/requirement-2）
└─ web/               # 前端工程（本目录），独立依赖与构建
   ├─ index.html  package.json  vite.config.ts  tailwind.config.js  postcss.config.js
   ├─ .env  .env.example  .env.mock  .env.http
   ├─ docs/{PRD.md, TECH-PLAN.md, DIVERGENCE.md}
   ├─ scripts/serve-static.md          # AC-6 / AC-9 自检清单
   └─ src/
      ├─ main.tsx  App.tsx  env.ts  styles/index.css
      ├─ api/
      │  ├─ port.ts            ★ ApiPort 接口与全部出入参类型（唯一契约面）
      │  ├─ errors.ts          ApiError + ErrorCode 联合 + 中文映射
      │  ├─ index.ts           按 env.mode 装配单例
      │  ├─ http/{endpoints,client,http-adapter}.ts
      │  └─ mock/{mock-adapter,db,seed,stock,purchase-machine,query,validators}.ts
      ├─ domain/{types,enums,health,purchase,format}.ts   # 纯函数，语义唯一来源
      ├─ state/{session,query-cache,useQuery,useMutation,invalidations,toast}.ts
      ├─ routes/{paths,router,guards}.tsx
      ├─ components/
      │  ├─ layout/{AdminLayout,MobileLayout,PageHeader,RoleSwitch}.tsx
      │  ├─ ui/…（Button/Field/Dialog/Table/Feedback/ToastHost）
      │  ├─ health/{HealthBadge,HealthDistribution}.tsx
      │  ├─ domain/{MaterialCombobox,QtyStepper,StatusStepper,RequestActions,ImageUploadField}.tsx
      │  └─ a11y/Announcer.tsx
      ├─ pages/admin/…（dashboard / materials / stock / alerts / purchase / reports / notifications）
      ├─ pages/mobile/…（home / scan / search / approvals / notifications）
      ├─ hooks/{useBarcodeScanner,useA11y,useDebouncedValue}.ts
      └─ test/setup.ts
```

分层规矩：`pages` 只通过 `state` 的 hooks 访问 `api`；`domain` 不 import React；`components` 不含业务请求；三态渲染只允许 `HealthBadge`。

---

## 3. 路由设计

采用 **HashRouter + `base:'./'`**：`serve dist` 直接可开、深链刷新不 404、可放任意子目录——满足 AC-6 最省心的组合。

| 端 | 路径 | 页面 | 需求 / AC |
| --- | --- | --- | --- |
| Web | `/admin/dashboard` | 看板 | F5 / AC-1,2,4,9 |
| Web | `/admin/materials`、`/new`、`/:sku/edit` | 档案列表 / 表单 | F1 / AC-1,8 |
| Web | `/admin/stock` | 台账 | F2 / AC-1,4,9 |
| Web | `/admin/stock/inbound?type=PURCHASE\|RETURN` | 入库 | F2 / AC-7 |
| Web | `/admin/stock/outbound` | 出库 | F2 / AC-7 |
| Web | `/admin/stock/count` | 盘点 | F2 |
| Web | `/admin/stock/adjust` | 调整 | F2 |
| Web | `/admin/stock/movements` | 流水 | F2 / AC-4 |
| Web | `/admin/alerts` | 预警 | F3 / AC-2,5 |
| Web | `/admin/purchase/requests`、`/new`、`/:id` | 申请 / 审批详情 | F4 / AC-3,5 |
| Web | `/admin/purchase/orders` | 订单与到货 | F4 |
| Web | `/admin/reports/:tab` | 报表 4 Tab | F5 / AC-9 |
| Web | `/admin/notifications` | 站内消息 | AC-5 |
| H5 | `/m` | 首页 4 宫格 | F6 / AC-10 |
| H5 | `/m/scan` | 扫码领用 | F6 / **AC-4**,7,8 |
| H5 | `/m/search` | 库存查询 | F6 |
| H5 | `/m/approvals`、`/:id` | 审批 | F6 / **AC-3** |
| H5 | `/m/notifications` | 消息 | F6 / **AC-5** |

---

## 4. 数据与接口设计

### 4.1 接口清单（全部为后端已存在路径）

```
materials   POST/GET  /api/v1/materials        GET/PUT /api/v1/materials/{sku}
            POST      /api/v1/materials/{sku}/disable
stock       GET  /api/v1/stock                 GET  /api/v1/stock/movements
            POST /api/v1/stock/inbound         POST /api/v1/stock/outbound
            POST /api/v1/stock/count           POST /api/v1/stock/adjust
alerts      GET  /api/v1/alerts                POST /api/v1/alerts/generate-suggestions
purchase    POST/GET /api/v1/purchase/requests POST /api/v1/purchase/requests/{id}/approve|reject|resubmit|close
            POST/GET /api/v1/purchase/orders   POST /api/v1/purchase/orders/{id}/arrive
dashboard   GET  /api/v1/dashboard
reports     GET  /api/v1/reports/movements|consumption-rank|alerts|purchase
notifs      GET  /api/v1/notifications         POST /api/v1/notifications/{id}/read
health      GET  /health                        （根路径，无 /api/v1 前缀）
```

`/api/v1` 是逐条写死在 controller 里的，不存在全局前缀——前端路径常量直接含前缀，不额外拼接。不调用 `/stock/movements/:id/reverse`（超范围）。

### 4.2 请求约束（防 400）

后端 `ValidationPipe` 为 `whitelist + forbidNonWhitelisted`：**多余字段直接 400**。因此：

- 新建物料**不得**传 `status`；编辑物料**不得**传 `sku`（类型层用 `Omit` 禁止）。
- 一律 camelCase（`priceCents`、`safetyStock`、`specModel`、`imageUrl`）。
- 查询参数只发契约确认过的：materials 六个、notifications 四个、stock 两个，其余仅 `page/pageSize`；**其余筛选一律客户端过滤**。
- `isRead` 为字符串字面量（`'0'|'1'|'true'|'false'`），类型层禁止传 boolean。
- 写请求带 `X-Actor`；仅出库带 `Idempotency-Key`。

### 4.3 响应与错误

- 分页统一 `{items,total,page,pageSize}`；`/purchase/orders` 与 `/alerts/generate-suggestions` 只有 `{items,total}`，类型层用 `ItemsOnly<T>` 区分。
- 错误体 `{code,message,details?}`，**无 statusCode**，分支判断只用 `code`。

| code | HTTP | 前端处置 |
| --- | --- | --- |
| `DUPLICATE_SKU` | 409 | SKU 字段错误 |
| `MATERIAL_NOT_FOUND` / `MATERIAL_DISABLED` | 404/409 | 字段错误 + 引导查看档案 |
| `STOCK_INSUFFICIENT` | 409 | 数量字段错误，显示可用量，不清空物料 |
| `REJECT_REASON_REQUIRED` | 400 | 原因字段错误（前端已拦，双保险） |
| `ILLEGAL_STATE_TRANSITION` | 409 | toast「状态已变化」+ 强制重拉 |
| `DUPLICATE_ORDER` / `ORDER_NOT_OPEN` | 409 | toast + 重拉订单列表 |
| `IDEMPOTENCY_CONFLICT` | 409 | toast + 重建幂等键 |
| `VALIDATION_ERROR` | 400 | 映射 `details` 到字段，否则通用提示 |
| 未知 / 网络失败 | — | 归一 `NETWORK_ERROR`，提示「无法连接后端，请通过代理访问」 |

### 4.4 mock 数据模型

`localStorage['axparts.mock.v1']`：`schemaVersion`、`revision`（每次提交 +1，供跨标签页脏检测）、`materials[]`、`cells[]`（SKU×库位，含 `locked`）、`movements[]`（append-only）、`requests[]`、`orders[]`、`notifications[]`、`idempotency{}`、`seq{}`、`createdAt`（固定基准时间，保证测试确定性）。

复刻要点：库位/合计两级库存计算、三态函数与 UI 共用同一实现、`commit()` 先全量校验再一次性写盘（失败零副作用）、状态机迁移表 + `version++`、一申请一单、`arrive` 事务内到货即完成、盘点差额 0 不产流水、调拨双流水、`pageSize` 上限 200。

**跨端同步（演示）**：`commit()` 后经 `BroadcastChannel` 广播 revision，另一标签页收到即失效重拉；同一标签页内切路由靠失效表。限定「单浏览器双标签页」，页面内注明演示性质。

---

## 5. 关键流程实现思路

### 5.1 入库（≤3 步）

入口 URL 带入类型 → 类型以只读徽标展示（可切换但不增主操作）→ 物料选择器（防抖 250ms 调 `materials.list`，选中自动带出名称/单位/库位/合计库存与三态）→ 数量步进器 → 提交 → 成功 toast + 播报「入库成功，当前库存 N，状态 X」→ 失效 `stock/movements/alerts/dashboard/reports/notifications` → 表单重置但保留类型与库位、焦点回物料选择器。

### 5.2 扫码领用（=2 步）

能力分级：`BarcodeDetector` 支持 `qr_code` → 原生解码；否则异步加载 ZXing；非安全上下文 → **不请求摄像头**，直接给手动输入主路径；权限拒绝/无设备/不可读 → 差异化文案 + 手动输入 + 相册识别。扫码用 `facingMode:'environment'`，节流 ~200ms，命中即停流并播报。

解析优先级：`?sku=xxx` → `SKU:xxx` → 纯 SKU 串（3–32 字符）→ 失败提示「未识别的二维码」。识别后 `materials.get(sku)`：404 / 已停用分别提示；成功显示物料卡 → 数量默认 1 → 确认 → `stock.outbound`（带幂等键，会话内复用，成功后重建）。

### 5.3 审批与跨端一致

无申请详情 GET 接口 → 详情页从 `listRequests({pageSize:200})` 定位；未命中给「申请不存在或已归档」。动作按 `status + role` 显隐；通过走确认框，驳回走必填原因弹窗。成功后失效 `purchase.requests/orders/dashboard/notifications/reports`。

跨端一致三重保障：同一缓存与失效表（单标签页切路由即一致）→ BroadcastChannel revision（双标签页）→ 页面获焦且数据超 15s 自动重拉（覆盖真实后端场景）。

### 5.4 三态统一

`HealthBadge` 为唯一出口，由 `domain/health.ts` 判定：`qty<=0 → 断料`（先判）→ `qty<=safety → 预警` → 正常。台账行用 `skuCurrentStock` 判定，库位库存单列展示，禁止用行内库存重算状态。

---

## 6. 测试要点

| 层 | 覆盖 | 关键断言 |
| --- | --- | --- |
| 纯函数单测 | `health`（0/负/safety=0/等于阈值）、`format`（分↔元）、`purchase`（动作矩阵）、`parseSku`、`query`、`validators`、`purchase-machine`、`idempotency` | 边界值全覆盖 |
| **契约测试（防漂移核心）** | 参数化套件对 mock 必跑、对 http 可选跑（`CONTRACT_HTTP=1`）：分页形状、materials 列表无 `currentStock`、stock 行的 `skuCurrentStock`、错误码表、状态机、幂等回放与冲突、`arrive` 返回 `previousHealth/health`、orders 无 page 字段、count 差额 0 分支 | 同一套用例跑两个适配器 |
| mock 库内部 | 种子完整性（6 物料、3/2/1、PR-SEED-0001、1 张 OPEN 单、3 条未读）、`commit` 失败零副作用、movements append-only、revision 单调、reset 回种子 | 重载 db 后数据仍在 |
| 组件 | `Field`（label/describedby/invalid/alert）、`HealthBadge` 三态文本、`StatusStepper` 5 节点与驳回旁注、`ConfirmDialog` 焦点还原、`HealthDistribution` 等价表、`QtyStepper` 下限 | a11y 属性直接断言 |
| 流程 | AC-1~AC-5、AC-7、AC-10 | 见下表 |
| 手工 | AC-6、AC-9、44px、真实摄像头 | `scripts/serve-static.md` 清单留痕 |

**AC → 用例映射**

| AC | 用例要点 |
| --- | --- |
| AC-1 | 新增 PRT-007 → `skuTotal` 6→7；入库 5 → 台账行 5、流水首条 `IN_PURCHASE`、dashboard 被失效重拉 |
| AC-2 | 看板/预警页 PC-002 含「预警」、HDD-003 含「断料」；列表首项为 HDD-003；`aria-label` 含文字 |
| AC-3 | Web 通过后 `status=APPROVED`；切 `/m/approvals/:id` 显示已审批；`/m` 驳回后 Web 列表 `PENDING` 且详情出现驳回原因；空原因提交 → 字段错误且未发请求 |
| AC-4 | MON-004 领 3 → `currentStock=5`、`health=NORMAL`、新增 `OUT_ISSUE` 流水；同幂等键连点两次仅 1 条流水 |
| AC-5 | 预警消息 → 预警页并定位 HDD-003；审批消息 → 对应详情；点击后 `isRead=true` |
| AC-6 | 构建 → serve → 全路由可导航、点 F1–F6 主操作、刷新不 404、Network 无 `:3000` |
| AC-7 | 入库/出库操作计数 ≤3；扫码领用 =2（扫码与手动输入两路径各验一次） |
| AC-8 | 每页唯一 h1；`getByLabelText` 全字段可取；Tab 序列覆盖主路径；错误/成功有 live 播报；三态文字齐全；移动端按钮含 `tap-target` |
| AC-9 | 双视口清单（截图 + `scrollWidth<=clientWidth`）；图表 `<table>` 存在性单测 |
| AC-10 | `/m` 子树 `a[href*="/admin"]===null`；文本不含「档案管理/盘点/报表」；operator 无审批 Tab；直访 `/m/approvals` 得无权页 |

---

## 7. 部署与风险

### 7.1 构建

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 开发（mock） | `npm run dev` | 默认 mock，零网络 |
| 开发（联调） | `npm run dev:http` | Vite 代理 `/api` → `:3000`，规避 CORS |
| 验收构建 | `npm run build:mock` → `npx serve dist` | AC-6 产物，HashRouter 无需 rewrite，`base:'./'` 支持子目录 |
| 联调构建 | `npm run build:http` | 需同源反代（Nginx `location /api/` 并透传 `X-Actor`、`Idempotency-Key`） |

**CORS 是硬约束**：后端未 `enableCors()` 且要求自定义头 → 浏览器必发预检并失败。前端只能通过代理（dev/preview）或同源反代解决，无法单方面修复；错误文案会直接说明，避免被误判为功能缺陷。

### 7.2 风险

| # | 风险 | 影响 | 缓解 |
| --- | --- | --- | --- |
| R1 | 后端无 CORS + 自定义头 | http 模式直连必失败 | 代理/反代 + 明确文案；首要阻塞项 |
| R2 | 无图片上传接口，data URL 可能超长 | 400 / 配额爆 | 压缩 ≤200KB；`QuotaExceededError` 捕获降级 |
| R3 | 类别/单位枚举写死 | 后端扩枚举则无法录入 | 集中 `enums.ts`；未知值降级显示不崩溃 |
| R4 | `GET /materials` 无库存字段 | 列表不能显示库存，易被当缺陷 | 不放库存列，提供「查看台账」跳转，禁止 N+1 |
| R5 | `/purchase/orders` 无分页 | 大数据量性能 | 前端分页；>500 条再议虚拟化 |
| R6 | `ARRIVED` 不可观察 | 5 态无法完整呈现 | 步骤条标注「瞬时态」，不伪造 |
| R7 | `expectedDate` 无格式校验 | 脏数据 | 强制日期控件 + 必填 |
| R8 | 非 HTTPS 摄像头不可用 | 局域网扫码失效 | 直接给手动输入主路径 |
| R9 | mock 与真实后端漂移 | 验收过、联调炸 | 参数化契约测试 + `DIVERGENCE.md` |
| R10 | 无详情接口，200 条上限 | 深链可能未命中 | 提示并引导列表搜索 |
| R11 | 无鉴权，`X-Actor` 可伪造 | 「权限收敛」只是 UI | 文案与 README 明示非安全边界 |
| R12 | 错误体无 statusCode | 状态码分支必错 | 只用 `code` |
| R13 | 未确认查询参数会被 400 | 筛选失效 | 只发已确认参数，其余客户端过滤 |
| R14 | 盘点单条 vs 需求批量 | 交互折衷 | 逐条串行 + 逐行状态 |
| R15 | 双端同步仅限同浏览器 | 跨设备演示不成立 | 固定演示话术 |
| R16 | localStorage 不可用 | 数据不持久 | 降级内存态 + 顶部提示 |

---

## 8. 实施顺序

| 阶段 | 内容 | 完成标志 |
| --- | --- | --- |
| S0 | 克隆仓库、建 feature 分支、落盘文档、README 骨架 | 分支存在，文档可评审 |
| S1 | Vite+TS+Tailwind+Vitest 配置；双布局 + 全路由；`enums/format/health` | `dev` 可导航全部路径，单测绿 |
| S2 | `port.ts` + `errors.ts`；mock 读侧 | 契约测试读侧绿，种子 6/3/2/1 |
| S3 | mock 写侧（状态机、幂等、采购、消息、报表）+ http 适配器 | 契约测试写侧 + 错误码全覆盖绿 |
| S4 | 状态层 + UI 基座 + a11y 三件套 | 失效表与 a11y 组件测试绿 |
| S5 | 桌面 F1–F5 页面 | AC-1/2/3(Web)/5 流程测试绿 |
| S6 | 移动 F6 + 扫码降级链 + 44px/安全区 | AC-3(移动)/4/7/10 绿 |
| S7 | AC-6 构建自检、AC-9 双视口、README 与 DIVERGENCE | 每条 AC 有证据 |
