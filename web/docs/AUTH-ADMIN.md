# 登录与后台管理（变更说明）

本文记录一次**需求范围变更**：原 `PRD.md` 把「生产级鉴权体系」列为范围外，后端也确实没有鉴权（身份靠可伪造的 `X-Actor` 请求头）。现按要求补齐登录与后台管理。

## 1. 变更后的能力

| 能力 | 说明 |
| --- | --- |
| 登录 | 用户名 + 密码，服务端校验，签发 JWT（HS256，默认 12 小时） |
| 会话 | 前端保存令牌并随请求携带 `Authorization: Bearer <token>`；401 自动清除并回登录页 |
| 角色 | 沿用 4 个业务角色：库管员 / 车间主管 / 采购员 / 领用人员 |
| 用户管理 | 列表、新增、改角色、启停、重置密码；仅车间主管可见 |
| 审计日志 | 物料、库存、采购、用户、字典操作留痕，可按操作人/动作/时间筛选；仅车间主管可见 |
| 数据字典 | 类别与单位由数据库驱动，可增改停用；被物料引用的项不能停用 |
| CORS | 后端已开启，前端可独立部署 |

## 2. 关键设计决定

1. **没有单独设「管理员」角色**。用户管理/审计/字典挂在**车间主管**下，理由是它是现有角色中权限最高者。若后续要分离，只需改后端 `@Roles('supervisor')` 与前端菜单的角色常量各一处。
2. **`X-Actor` 保留但不生效**。有令牌时操作人一律取自令牌载荷；仅在无令牌的测试场景下回退。已有 e2e 用例特意保留该请求头，用于证明不可伪造。
3. **密码哈希用 Node 内置 scrypt**，不引入 `bcrypt` 等原生依赖（此前 `better-sqlite3` 的原生模块已带来安装问题）。
4. **JWT 自行实现 HS256**（`node:crypto` + `timingSafeEqual`），避免额外依赖；`JWT_SECRET` 通过环境变量注入，缺省值仅用于本地演示。
5. **数据字典去掉了数据库层的 `CHECK` 约束**。旧库会自动迁移重建 `materials` 表（事务内完成），校验改由 `dictionaries` 表负责。
6. **不改动既有业务契约**：物料/库存/采购的字段与错误码保持不变，只在成功后追加审计写入。审计失败不影响业务返回。

## 3. 演示账号

密码统一为 `axparts123`（可用 `SEED_PASSWORD` 覆盖），登录页可一键填入。

| 用户名 | 姓名 | 角色 | 可见菜单 |
| --- | --- | --- | --- |
| `supervisor` | 车间主管 | supervisor | 全部 + 用户管理/审计日志/数据字典 |
| `warehouse` | 库管员 | warehouse | 档案、库存、预警、采购、报表、消息 |
| `purchaser` | 采购员 | buyer | 同上（无用户管理） |
| `operator` | 领用人员 | operator | 仅手机端：领用、查询、消息 |

## 4. 新增接口

```
POST /api/v1/auth/login        { username, password } → { token, user, expiresIn }
GET  /api/v1/auth/me
POST /api/v1/auth/logout       （无状态，前端清令牌）

GET   /api/v1/users            ?keyword=&role=&status=&page=&pageSize=
POST  /api/v1/users            { username, displayName, password, role }
PATCH /api/v1/users/:id        { displayName?, role?, status? }
POST  /api/v1/users/:id/reset-password   { password }
POST  /api/v1/users/me/password          { password }

GET   /api/v1/audit-logs       ?actor=&action=&resource=&from=&to=&page=&pageSize=
GET   /api/v1/dictionaries     ?type=CATEGORY|UNIT&includeDisabled=0|1
POST  /api/v1/dictionaries     { type, value, label, sortOrder? }
PATCH /api/v1/dictionaries/:id { label?, sortOrder?, enabled? }
```

新增错误码：`UNAUTHORIZED(401)`、`INVALID_CREDENTIALS(401)`、`FORBIDDEN(403)`、`USER_NOT_FOUND(404)`、`DUPLICATE_USER(409)`、`USER_DISABLED(409)`、`DICTIONARY_NOT_FOUND(404)`、`DUPLICATE_DICTIONARY(409)`、`DICTIONARY_IN_USE(409)`。

## 5. 保护规则

- 至少保留一名**启用状态的车间主管**，否则无人可管理用户（停用/降级最后一名会被拒绝）。
- 被物料引用的字典项不能停用。
- 停用账号后立即无法登录（已签发的令牌在有效期内仍可用，最长 12 小时；生产应加令牌吊销）。

## 6. 已知限制

1. **无令牌吊销**：JWT 无状态，停用账号或改密码后，旧令牌在过期前仍有效。生产建议加 `tokenVersion` 或引入短期令牌 + 刷新令牌。
2. **无登录失败次数限制**：未做防爆破、验证码、锁定策略。
3. **审计只记录成功操作**：失败请求不留痕（避免噪声），如需追查失败需另加请求日志。
4. **mock 模式不做 401 校验**：本地演示的登录校验在前端完成，接口层不拦截；真实鉴权只在 http 模式生效。
5. **默认密码需改**：种子账号密码为演示用途，正式使用前应逐个改密或删除。

## 7. 验证记录

- 后端：`nest build` 0 错误；`npm test` 16 项；`test:e2e` 26 项（新增 14 项鉴权/管理端用例）
- 前端：`tsc --noEmit` 0 错误；`vitest` 37 项；`build:http` 成功
- 浏览器实测：未登录访问 `/admin/users` → 跳转 `/login`；登录后按角色显示菜单；用户列表 4 条；字典 5 个类别；执行一次入库后审计日志出现 `STOCK_INBOUND / supervisor`
