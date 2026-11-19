# 车间辅料管理平台 · 前端

覆盖 **Web 后台（桌面）** 与 **手机 H5** 两类形态的辅料管理前端：档案 → 库存 → 预警 → 采购审批 → 看板。

> 本工程位于仓库 **`web/`** 子目录；仓库根目录由后端服务（`feature/requirement-2`）占用。
> 两个工程各自持有独立的 `package.json` / `tsconfig.json` / `.gitignore`，互不干扰。

- 需求文档：[`docs/PRD.md`](docs/PRD.md)
- 技术方案：[`docs/TECH-PLAN.md`](docs/TECH-PLAN.md)
- 与后端的已知差异：[`docs/DIVERGENCE.md`](docs/DIVERGENCE.md)
- 验收自检清单：[`scripts/serve-static.md`](scripts/serve-static.md)

## 技术栈

React 18 + Vite 5 + TypeScript + Tailwind CSS；Zustand 管理会话/缓存；Vitest + Testing Library 测试。

## 快速开始

```bash
npm install
npm run dev            # mock 模式（默认），无需后端
npm run dev:http       # 联调模式，经 Vite 代理访问 http://localhost:3000
npm run test           # 单元/组件/契约测试
npm run typecheck      # 类型检查

npm run build:mock     # 验收产物（静态、零后端依赖）
npm run build:http     # 联调产物（需同源反代或后端启用 CORS）
npx serve dist         # 直接打开构建产物
```

## 两种数据模式

| 模式 | 数据来源 | 用途 |
| --- | --- | --- |
| `mock`（默认） | 浏览器 localStorage，内置与后端一致的种子与状态机 | 静态点选验收（AC-6）、无后端演示 |
| `http` | 真实后端 `/api/v1` | 联调、契约校验 |

两种模式实现同一个 `ApiPort` 接口，页面代码不感知差异。mock 的行为（分页结构、错误码、状态机、append-only 流水、幂等）刻意复刻后端，差异集中在 [`docs/DIVERGENCE.md`](docs/DIVERGENCE.md)。

## 页面

**Web 后台** `/admin/*`：看板、辅料档案、库存台账、入库、出库、盘点、库存调整、流水明细、低库存预警、采购申请/审批详情、采购订单、报表中心、站内消息。

**手机 H5** `/m/*`：首页、扫码领用、库存查询、审批、站内消息。移动端导航**结构上不含任何 `/admin` 路径**。

## 演示脚本（对应验收标准）

前置：`npm run build:mock && npx serve dist`，打开首页。

| AC | 操作 | 预期 |
| --- | --- | --- |
| AC-2 | 首页看板 / 预警页 | `PC-002` 显示「预警」，`HDD-003` 显示「断料」，断料置顶；三态均有图标+文字 |
| AC-1 | 档案 → 新增 `PRT-007` → 自动跳入库 → 入库 5 | 看板 SKU 总数 6→7；台账出现该物料库存 5；流水新增采购入库 |
| AC-4 | 角色切「领用人员」→ `/m/scan` → 手动输入 `MON-004` → 数量 3 → 确认 | 扣减后库存 5；台账显示 5；流水新增领用出库 -3（四个指标卡数字不变属正常，见 PRD §6.6） |
| AC-3 | 角色切「车间主管」→ 采购申请 → `PR-SEED-0002` 通过；`PR-SEED-0003` 在手机端驳回并填原因 | Web 显示已审批；驳回项状态回「待审批」且保留原因 |
| AC-5 | 站内消息 → 点预警消息 / 审批消息 | 分别直达预警页与申请详情；消息转为已读 |
| AC-7 | 入库/出库表单；扫码领用 | 入库/出库各 3 步；扫码领用 2 步 |
| AC-10 | 角色切「领用人员」，查看手机端 | 无档案/盘点/报表入口，且无任何 `/admin` 链接 |

顶栏「重置演示数据」可恢复初始种子，便于反复验收。

## 重要限制（如实声明）

1. **无鉴权**：后端无用户体系，身份仅靠 `X-Actor` 头记录，可伪造。角色切换只是**界面视角收敛**，不构成安全边界。
2. **CORS**：后端未启用 CORS 且要求自定义头，浏览器直连 3000 端口必然失败；请使用 `npm run dev` / `npm run preview` 的代理，或同源反向代理。
3. **跨端同步仅限同一浏览器双标签页**：mock 数据存于 localStorage，跨设备/跨浏览器不共享。页面内已注明演示性质。
4. **图片不上传**：后端无上传接口，图片仅本地压缩后作为字符串提交。
5. **「已到货」为瞬时态**：后端在到货事务内直接完成，前端步骤条已标注。

## 目录结构

```
src/
├─ api/           ApiPort 契约 + mock 适配器 + http 适配器
├─ domain/        类型、枚举、三态判定、金额/日期格式化、采购状态机
├─ state/         会话、查询缓存、失效表、toast
├─ routes/        路径常量、路由表、角色守卫
├─ components/    布局、UI 基座、三态徽标、业务组件、a11y
├─ pages/         admin/*（桌面）、mobile/*（H5）
├─ hooks/         扫码、防抖、文档标题与焦点管理
└─ test/          测试环境与既有用例
```
