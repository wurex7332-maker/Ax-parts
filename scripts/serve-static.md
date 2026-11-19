# 静态产物自检清单（AC-6 / AC-9）

> 用途：在**不启动后端**的前提下，验证构建产物可点选、可演示、双视口无溢出。
> 全部项目需人工执行并留痕（截图或勾选）。自动化测试无法覆盖布局与真实摄像头。

## 一、构建与启动

```bash
npm run build:mock
npx serve dist          # 或 npm run preview
```

- [ ] `dist/` 含 `index.html` 与 `assets/`，无对外 CDN 链接
- [ ] 页面可通过静态服务器直接打开（不需要 SPA rewrite，HashRouter 生效）
- [ ] 硬刷新任意路由（如 `#/admin/stock/movements`）不出现 404
- [ ] DevTools → Network，过滤 `:3000`：**0 个请求**
- [ ] Console 无 error（允许 React Router 的 future flag warning）

## 二、F1–F6 可点选（AC-6）

| 功能 | 路径 | 可打开 | 主操作可完成 |
| --- | --- | --- | --- |
| F1 档案 | `#/admin/materials` → 新增/编辑/停用 | ☐ | ☐ |
| F2 库存 | `#/admin/stock`、`inbound`、`outbound`、`count`、`adjust`、`movements` | ☐ | ☐ |
| F3 预警 | `#/admin/alerts` → 生成采购建议 | ☐ | ☐ |
| F4 采购 | `#/admin/purchase/requests` → 详情 → 通过/驳回；`orders` → 到货 | ☐ | ☐ |
| F5 看板报表 | `#/admin/dashboard`、`#/admin/reports/*` 四个 Tab | ☐ | ☐ |
| F6 手机端 | `#/m`、`#/m/scan`、`#/m/search`、`#/m/approvals`、`#/m/notifications` | ☐ | ☐ |

## 三、关键验收点（数据侧）

- [ ] `PC-002` 在两处均显示「预警」，`HDD-003` 显示「断料」，断料置顶
- [ ] 新增辅料 + 入库后，看板 SKU 总数 +1
- [ ] `MON-004` 领用 3 后库存 5，台账与流水一致
- [ ] Web 通过 / 手机驳回后状态双向一致，驳回原因可见
- [ ] 消息点击直达对应页面并转为已读
- [ ] 「重置演示数据」后回到 6 / 2 / 1 / 3 的初始状态

## 四、双视口（AC-9）

在 DevTools 设备模拟下切换 **375×812** 与 **1280×800**，逐页检查：

- [ ] 无横向溢出：Console 执行
      ```js
      (() => {
        const d = document.documentElement;
        return d.scrollWidth <= d.clientWidth;
      })()
      ```
      返回 `true`
- [ ] 移动端底部导航高度 56px，且主操作位于拇指区
- [ ] 台账表格在窄屏可横向滚动，内容不被截断
- [ ] 看板卡片桌面四列、手机两列/单列自适应
- [ ] 健康度分布图有「查看数据表」，展开后表格含 caption

## 五、可访问性（AC-8）

- [ ] 仅用键盘（Tab / Enter / 空格 / Esc）完成：新增辅料 → 入库 → 扫码领用
- [ ] 每页只有一个 `h1`，路由切换后焦点落到 `h1`
- [ ] 表单错误出现时焦点跳到第一个错误字段，且错误为 `role="alert"`
- [ ] 三态不只靠颜色：截图放大可见图标形状差异
- [ ] 移动端按钮实测最小 44×44（DevTools 检查盒模型）
- [ ] 扫码结果通过 `aria-live` 播报（朗读器或 Accessibility 面板确认）

## 六、真实摄像头（扫码）

- [ ] 在 `localhost` 或 HTTPS 下打开 `#/m/scan`，允许摄像头权限，可识别含 SKU 的二维码
- [ ] 拒绝权限后出现差异化提示，且「手动输入 SKU」可用
- [ ] 通过局域网 IP + http 访问时，页面直接提示「非 HTTPS 不可扫码」并给出手动入口

## 七、已知限制复核

- [ ] 页面已声明「角色切换不构成安全边界」
- [ ] 已声明「跨端同步仅限同一浏览器双标签页」
- [ ] 已声明「图片仅本地预览，不上传」
