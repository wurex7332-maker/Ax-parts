# mock 与真实后端的已知差异（DIVERGENCE）

本文件记录 mock 适配器与后端 `feature/requirement-2-20261118-0936` 的**每一处有意偏差**，
用于 http 联调时快速定位「验收通过但接后端不一致」的问题。

| # | 项目 | 后端实际 | mock 实现 | 原因 / 影响 |
| --- | --- | --- | --- | --- |
| D1 | 初始待采购数 | 种子仅 `PR-SEED-0001`（PURCHASING），`pendingPurchaseCount = 1` | 额外补 `PR-SEED-0002`、`PR-SEED-0003`（PENDING），`pendingPurchaseCount = 3` | 需求 §8.1 要求提供「待审批样本」以验收 AC-3（Web 通过 + 手机驳回各需一条）。后端种子无待审批单。接后端后该数字会回到 1，需手工建申请演示 AC-3 |
| D2 | 期初流水条数 | 说明为 6 条 `MOV-SEED-0001..0006`，但 HDD-003 无流水 | 5 条（HDD-003 期初库存为 0，按「不写 0 数量流水」处理） | 逻辑一致性优先；流水号前缀用 `MVT-SEED-xxxx` |
| D3 | 停用物料是否计入统计 | 未在契约中明确 | **不过滤**：`skuTotal` 与健康度分布按全部物料计算 | 与「前端不做业务过滤」一致；若后端实际按 ENABLED 过滤，仅统计数字不同 |
| D4 | 台账 `availableStock` | 库位 `currentStock` − SKU 级 `lockedStock`（多库位时不自洽） | 完全复刻该口径 | 保持与后端一致的「不自洽」，避免前端悄悄改口径 |
| D5 | 采购建议量 | `max(2 × 安全库存 − 当前, 1)` | 同一公式（`domain/health.ts`） | 无偏差，此处仅备注公式来源 |
| D6 | 待审批通知 | 通知类型枚举无 `PENDING` | 新建申请时生成 `type = ALERT` 的「待审批」消息给 supervisor | 类型枚举受限；标题与内容明确写「待审批」 |
| D7 | 申请/订单详情 | 无 GET 详情接口 | mock 直接返回；http 适配器按 200 条/页扫描定位 | 见 PRD O-11；超过 200 条时可能未命中 |
| D8 | 盘点 | 单条 SKU + 库位 | 同契约；前端串行逐条提交 | 批量体验由前端队列实现，非新增接口 |
| D9 | 流水冲正 | 有 `POST /stock/movements/{id}/reverse` | 未实现（也不暴露入口） | 需求未要求；流水列表仍正确显示 `REVERSAL` 标签 |
| D10 | 图片上传 | 无上传接口，`imageUrl` 仅字符串 | 本地压缩为 data URL 字符串存储 | 图片体积大时可能触发 400 或配额问题（PRD O-2） |
| D11 | `GET /materials` 列表 | 不含 `currentStock` | 同样不含（`MaterialListItem` 类型上就没有该字段） | 类型层面阻止误用 |
| D12 | 正常态出现在 `/alerts` | 只返回 LOW/STOCKOUT | 同样只返回 LOW/STOCKOUT，STOCKOUT 优先 | 无偏差 |
| D13 | 扫码解码 | 不涉及 | `BarcodeDetector` 优先；不支持时按需加载 ZXing（独立 chunk，约 118 KB gzip） | 仅在扫码页加载，不进首屏 |
| D14 | 幂等键 | 后端支持出库 `Idempotency-Key` | 同 key 同 payload 回放，异 payload 抛 `IDEMPOTENCY_CONFLICT` | 无偏差 |

## 联调前置条件

1. 后端需启用 CORS，或前端通过同源反向代理访问（后端当前未 `enableCors()`，且要求 `X-Actor` 自定义头，浏览器直连必被预检拦截）。
2. 后端默认端口 3000；`/api/v1` 前缀已硬编码在 controller 上，`/health` 在根路径。
3. 后端 `ValidationPipe` 为 `whitelist + forbidNonWhitelisted`，任何多余字段都会 400 —— 前端已按此约束构造请求体。
