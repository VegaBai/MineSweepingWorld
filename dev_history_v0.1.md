# MineSweepingWorld — Dev History v0.1

## 原始设计

无限边界世界地图，每个格子按坐标哈希确定难度，玩家点击格子进入对应扫雷游戏。

| 难度 | 颜色名 | 格子大小 | 地雷率 | 出现频率 |
|---|---|---|---|---|
| EASY | 奶白 | 10×10 | 12% | 40% |
| NORMAL | 薄荷绿 | 10×20 | 14% | 25% |
| MEDIUM | 天蓝 | 20×20 | 15% | 18% |
| HARD | 薰衣草 | 20×30 | 16% | 10% |
| EXPERT | 蜜桃 | 30×30 | 17% | 5% |
| MASTER | 玫瑰 | 30×50 | 18% | 2% |

---

## 变更记录

---

### v0.1.1 — 有限世界 + 单人并行游戏 + 重开按钮

**需求：**
- 改为 100×100 有限边界世界
- 移除多人锁定逻辑，玩家可随时离开返回世界地图
- 离开时当前游戏暂停，可随时回来继续
- 扫雷失败后显示"↺ Restart"按钮重新开始该格子

**实现：**
- 新增 `WORLD_W = 100, WORLD_H = 100` 常量，格子坐标限制在 0–99
- 移除 `activeKey` 单游戏锁定，改为 `lastActiveKey`（记录最近访问的活跃游戏）
- 多个游戏可同时处于 `active` 状态，切换时自动暂停计时器
- `goWorld()` 时隐藏结果弹窗，保留游戏状态
- 新增 `restartCurrentGrid()`：重置当前格子所有数组，状态归 `idle→active`
- 结果弹窗（输）和游戏顶栏均增加 Restart 按钮；胜利时顶栏 Restart 隐藏
- `pauseTimer` 加守卫，只有计时器实际运行时才更新 `elapsed`
- 底部 banner 改为"Last game at (x,y) — click to resume"
- HUD 提示改为显示当前活跃游戏数量

---

### v0.1.2 — 相机边界锁定 + 实色格子 + 悬停提示

**需求：**
- 世界地图无法拖到 100×100 边界之外
- 每个格子改为实色纯色，去掉文字和描边
- 鼠标悬停格子满 1 秒后显示难度名称和大小

**实现：**

**相机边界：**
- 新增 `clampCam()`，在拖拽、缩放、resize 后均调用
- 若世界小于屏幕则居中；否则将 `cam.x/y` 限制在 `[halfScreen, WORLD − halfScreen]`

**格子颜色（去文字去描边）：**

| 状态 | 颜色 |
|---|---|
| idle | `tier.dot`（马卡龙配色） |
| active | `tier.dot` + 白色透明脉冲叠加 + 白色内边框脉冲 |
| won | `#2a7a3a`（暗绿） |
| lost | `#7a2a2a`（暗红） |

**悬停 Tooltip：**
- 追踪鼠标所在格子，进入新格子后启动 1 秒 `setTimeout`
- 触发后在鼠标旁显示浮层：难度名称（带颜色）+ `列×行 · xx% mines`
- 拖拽时不触发；移出格子立即隐藏并重置计时器
- 浮层自动检测屏幕边缘，防止溢出

---

### v0.1.3 — 世界改为 50×50，缩放默认 1×，地雷率调整

**需求：**
- 世界地图改为 50×50
- 初始缩放设为 zoom = 1×
- MEDIUM 地雷率不变，更简单的减少，更难的增加

**实现：**
- `WORLD_W = 50, WORLD_H = 50`
- `cam.zoom = 1`（初始以 tile 原始尺寸打开，显示局部，可拖拽探索）

**地雷率调整：**

| 难度 | 旧地雷率 | 新地雷率 |
|---|---|---|
| EASY | 12% | **10%** |
| NORMAL | 14% | **13%** |
| MEDIUM | 15% | 15%（不变） |
| HARD | 16% | **18%** |
| EXPERT | 17% | **20%** |
| MASTER | 18% | **22%** |

---

### v0.1.4 — 扫雷游戏界面浅蓝配色

**需求：**
- 游戏背景改为浅蓝色
- 已翻开格子与未翻开格子颜色差异更明显，避免误操作

**实现：**

游戏画布与背景均改为深海蓝系，未翻开用深板岩蓝，已翻开用浅天蓝，形成强烈明暗对比：

| 元素 | 旧颜色 | 新颜色 |
|---|---|---|
| 画布背景 / 间隙 | `#0d0d1a` 近黑 | `#0e2640` 深海蓝 |
| **未翻开**（normal） | `#20203a` 深紫 | `#1e4868` 板岩蓝 |
| **未翻开**（hover） | `#28284a` 深蓝紫 | `#2a5a82` 亮蓝 |
| **未翻开**（flag） | `#1c1830` 深紫 | `#183a58` 深蓝 |
| **已翻开**（空/数字） | `#15151f` 近黑 | `#b8d4ec` **浅天蓝** |
| 踩雷格子背景 | `#4a0000` 深红 | `#c03030` 亮红 |
| 立体高光（上左边） | `#2a2a4e` | `#2a5878` |
| 立体阴影（下右边） | `#121220` | `#0c2236` |

数字颜色改为经典扫雷配色（适配浅色背景）：

| 数字 | 旧色 | 新色 |
|---|---|---|
| 1 | `#5ab4f5` | `#0033cc` 蓝 |
| 2 | `#5ef55e` | `#007700` 绿 |
| 3 | `#f56060` | `#cc0000` 红 |
| 4 | `#6060f5` | `#00008b` 深蓝 |
| 5 | `#f5a060` | `#880000` 深红 |
| 6 | `#60f5f5` | `#008888` 青 |
| 7 | `#f560f5` | `#333333` 深灰 |
| 8 | `#aaaaaa` | `#888888` 灰 |

---

### v0.1.5 — 世界地图格子三档配色（像素拼图点亮效果）

**需求：**
- 未开始格子颜色更浅淡（褪色感）
- 通关后颜色变为同色系更饱和的鲜艳色（点亮像素拼图感）
- 失败后颜色变为同色系更灰暗的颜色

**实现：**

每个难度新增三个颜色字段 `idle` / `won` / `lost`，`active` 沿用原 `dot` 颜色加脉冲：

| 难度 | idle（浅淡） | dot/active（中） | won（鲜艳） | lost（灰暗） |
|---|---|---|---|---|
| EASY 奶白 | `#f5ede0` | `#ede0c4` | `#bc8a20` 金琥珀 | `#aaa090` 暖灰 |
| NORMAL 薄荷 | `#cef5dc` | `#a8e0b8` | `#30a050` 鲜绿 | `#809080` 灰绿 |
| MEDIUM 天蓝 | `#cce4fc` | `#a8cef5` | `#3070cc` 鲜蓝 | `#7c90a4` 灰蓝 |
| HARD 薰衣草 | `#e8d0fc` | `#d0aaf5` | `#7038c4` 鲜紫 | `#8c80a4` 灰紫 |
| EXPERT 蜜桃 | `#fce0b8` | `#f5c888` | `#c07828` 鲜橙 | `#a49078` 灰棕 |
| MASTER 玫瑰 | `#fcc8c8` | `#f5a8a8` | `#b83030` 鲜红 | `#9c7878` 灰玫瑰 |

视觉层级：`idle`（淡）→ `active`（中，脉冲）→ `won`（亮）/ `lost`（灰）

---

### v0.1.6 — Won/Lost 饱和度小幅降低

**需求：**
- 赢了和输了以后的色彩饱和度稍微低一些

**调整（从 v0.1.5 基础上各色向灰色小幅靠拢）：**

| 难度 | Won 旧 | Won 新 | Lost 旧 | Lost 新 |
|---|---|---|---|---|
| EASY | `#c8920a` | `#bc8a20` | `#aaa090` | `#aaa090` |
| NORMAL | `#18a83c` | `#30a050` | `#7a9080` | `#809080` |
| MEDIUM | `#1a72e0` | `#3070cc` | `#7890a8` | `#7c90a4` |
| HARD | `#8020d8` | `#7038c4` | `#9080a8` | `#8c80a4` |
| EXPERT | `#d07010` | `#c07828` | `#a89070` | `#a49078` |
| MASTER | `#c81818` | `#b83030` | `#a07878` | `#9c7878` |

---

## v0.2 — Vercel 全栈部署

---

### v0.2.1 — 后端架构设计与初次实现

将纯静态单页游戏改造为支持用户登录、进度持久化、多人轻交互的网页游戏。

**技术选型：**
- 后端：Node.js + Fastify 4（ESM），用于 Docker/VPS 部署
- 数据库：PostgreSQL（Supabase 托管）
- 认证：自签 JWT（15 min access token + 7 天 refresh token，SHA-256 哈希存库）
- 实时：WebSocket hub（presence 计数 + grid_active 通知）
- 静态资源：Fastify 直接 serve `index.html`

**新增文件：**

| 文件 | 说明 |
|---|---|
| `server/src/app.js` | Fastify 入口，注册插件、路由、migration |
| `server/src/db.js` | pg Pool 单例 |
| `server/src/redis.js` | ioredis（可选，降级不影响核心功能） |
| `server/src/routes/auth.js` | `/auth/register` `/login` `/refresh` `/logout` |
| `server/src/routes/progress.js` | `/progress` GET/PUT/DELETE，Uint8Array ↔ base64 ↔ BYTEA |
| `server/src/routes/leaderboard.js` | `/leaderboard` top 20 |
| `server/src/routes/world.js` | `/world/presence` 返回在线人数 |
| `server/src/plugins/ws.js` | WebSocket hub：presence + grid_active 广播 |
| `server/migrations/001_init.sql` | users / refresh_tokens / grid_states / leaderboard view |
| `server/Dockerfile` | 多阶段构建，复制 `index.html` 到 `/srv/public/` |
| `docker-compose.yml` | app + postgres:16-alpine + redis:7-alpine |

**前端新增（index.html）：**
- Auth 模块（localStorage token 管理，auto-refresh）
- `apiFetch()` 封装（自动携带 Bearer token）
- `syncLoadAll / syncSave / syncDelete`（本地 ↔ 服务端进度同步）
- WebSocket 客户端（presence 计数 + grid_won feed 通知）
- 登录/注册弹窗、排行榜面板

---

### v0.2.2 — 改造为 Vercel Serverless Functions

Vercel 不支持持久 WebSocket，将 Fastify 服务重写为 Vercel Serverless Functions。

**新增文件：**

| 文件 | 说明 |
|---|---|
| `vercel.json` | 路由配置（`/api/*` → functions，其余 → `index.html`） |
| `package.json`（根目录） | 声明 `bcryptjs` / `jose` / `pg` 依赖 |
| `lib/db.js` | serverless 安全的 pg Pool 单例（warm 复用） |
| `lib/auth.js` | `jose` JWT 签发/验证，`authenticate()` 中间件 |
| `api/auth/register.js` | POST — 注册 |
| `api/auth/login.js` | POST — 登录 |
| `api/auth/refresh.js` | POST — 刷新 access token |
| `api/auth/logout.js` | POST — 注销 |
| `api/progress/index.js` | GET — 加载所有存档 |
| `api/progress/[x]/[y].js` | PUT / DELETE — 保存或删除单格进度 |
| `api/leaderboard/index.js` | GET — 排行榜 top 20 |
| `api/world/presence.js` | GET — 活跃玩家数（DB 轮询替代 WebSocket） |
| `api/migrate.js` | POST — 执行建表 SQL（受 `MIGRATE_SECRET` 保护） |
| `api/config.js` | GET — 返回前端所需公开配置（Supabase URL / anon key） |

**WebSocket 降级：**
前端 `wsClient` 改为先尝试连接 `/ws`，3 秒内无响应则降级为每 15 秒轮询 `/api/world/presence`。

**环境变量（Vercel 项目设置）：**

| 变量名 | 说明 |
|---|---|
| `MSW_POSTGRES_URL` | Supabase pgbouncer 连接池 URL（API 函数用） |
| `MSW_POSTGRES_URL_NON_POOLING` | Supabase 直连 URL（migration DDL 用） |
| `MSW_SUPABASE_JWT_SECRET` | JWT 签名密钥 |
| `MSW_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_MSW_SUPABASE_ANON_KEY` | Supabase anon key（前端初始化 Supabase 客户端用） |
| `MIGRATE_SECRET` | 保护 `/api/migrate` 端点的自定义密钥 |

---

### v0.2.3 — 部署 Bug 修复记录

#### Bug 1：页面 404

**现象：** 部署后所有页面返回 404。

**原因：** `vercel.json` 使用了 legacy `builds` + `routes` 格式。Vercel v2 看到 `builds` 字段后不再自动处理静态文件，`index.html` 从未被部署。

**修复：** 删除 `builds` 和 `routes`，改用现代 `rewrites`：
```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

---

#### Bug 2：Migration 报 SSL 证书错误

**现象：** `POST /api/migrate` 返回 `FUNCTION_INVOCATION_FAILED`，日志显示 `Error: self-signed certificate in certificate chain`。

**原因：** pg v8 将连接字符串中的 `sslmode=require` 升级为 `verify-full`（完整证书链校验），Supabase 使用自签名中间 CA，被 pg 拒绝。显式设置 `ssl: { rejectUnauthorized: false }` 不生效，因为连接字符串中的 `sslmode` 会覆盖它。

**修复：** 建立连接前用 `URL` 解析去掉连接字符串中的 `sslmode` 参数，再传入显式 `ssl` 对象：
```js
function stripSslMode(url) {
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return u.toString();
}
new Pool({ connectionString: stripSslMode(connStr), ssl: { rejectUnauthorized: false } });
```

---

#### Bug 3：Migration SQL 文件找不到

**现象：** `api/migrate.js` 用 `readFileSync` 读取 `../server/migrations/001_init.sql`，Vercel Lambda 运行时路径解析失败。

**修复：** 将 SQL 直接内联到 `api/migrate.js` 中，消除文件路径依赖。

---

#### Bug 4：DB 列名不一致

**现象：** 进度保存/加载接口报错。

**原因：** SQL schema 使用 `grid_x` / `grid_y`，但 Vercel API 函数写的是 `gx` / `gy`。

**修复：** 统一 `api/progress/index.js` 和 `api/progress/[x]/[y].js` 使用 `grid_x` / `grid_y`。

---

#### Bug 5：leaderboard 响应结构不匹配

**现象：** 排行榜打开后空白。

**原因：** API 返回 `{ leaderboard: [...] }`，前端直接把返回值当数组遍历。

**修复：** 前端改为解构 `const { leaderboard: rows } = await apiFetch('/leaderboard')`。

---

#### Bug 6：Login/Register 按钮无法点击

**现象：** 左上角 HUD 里的登录按钮无法点击，鼠标始终是 grab 状态。

**原因：** `#world-hud` 设置了 `pointer-events: none`（防止遮挡 canvas 交互），内部所有子元素包括登录按钮均无法接收点击。

**修复：** 将登录按钮移出 HUD，改为右上角独立固定定位的 `<button id="login-btn">`，自带 `pointer-events: auto`。

---

#### Bug 7：logout method 错误

**现象：** 点击 logout 无效。

**原因：** 前端调用 `apiFetch('/auth/logout', { method: 'DELETE' })`，但 `api/auth/logout.js` 只处理 `POST`。

**修复：** 改为 `method: 'POST'`。

---

### v0.2.4 — Google OAuth 登录

新增「Continue with Google」登录方式，使用 Supabase Auth 作为 OAuth 代理。

**流程：**
1. 前端调用 `supabase.auth.signInWithOAuth({ provider: 'google' })`
2. 用户完成 Google 授权，Supabase 将 `access_token` 放在回调 URL 的 hash fragment 中（implicit flow）
3. 前端解析 hash，将 Supabase access_token 发送至 `POST /api/auth/google`
4. 后端调用 Supabase `/auth/v1/user` API 验证 token，获取 email
5. 按 email 查找或创建用户记录（无密码），签发我们自己的 JWT
6. 前端拿到 JWT，走正常登录流程

**新增：**
- `api/auth/google.js` — token 验证 + 用户查找/创建 + 签发 JWT
- `api/config.js` — 返回前端初始化 Supabase 客户端所需的公开 key
- 前端：Supabase JS CDN、Google 按钮 UI、`handleOAuthCallback()` 回调处理

**Supabase Dashboard 配置（手动）：**
- Authentication → Providers → Google → 填入 Google OAuth Client ID / Secret
- Authentication → URL Configuration → 添加 Vercel 域名到 Redirect URLs

**Google Cloud Console 配置（手动）：**
- 已授权重定向 URI：`https://<project-ref>.supabase.co/auth/v1/callback`

**关键 Bug 修复：**

| 问题 | 原因 | 修复 |
|---|---|---|
| OAuth 回调后仍显示未登录 | `detectSessionInUrl: true`（默认）与手动 `exchangeCodeForSession` 竞争消费一次性 PKCE code，胜者不确定 | Supabase 客户端加 `{ auth: { detectSessionInUrl: false } }`，只保留手动调用路径 |
| 修复后仍不生效 | Supabase 实际走的是 implicit flow，token 在 URL hash（`#access_token=...`）中，而非 query string `?code=`，回调函数检测条件永远不满足 | 改为优先解析 `window.location.hash`，直接取 `access_token` 使用，保留 `?code=` 作为 PKCE fallback |

---

## v0.3 — 权限系统 + 多环境部署（2026-05-01）

---

### v0.3.1 — 用户角色系统

新增四个用户组，并添加管理后台页面。

**用户组定义：**

| 角色 | 说明 |
|---|---|
| `user` | 默认角色，所有新注册用户 |
| `subscriber` | 订阅用户 |
| `premium` | 高级用户 |
| `admin` | 管理员，白名单：`vegabaixuan@gmail.com` |

**数据库变更（Migration 002）：**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'subscriber', 'premium', 'admin'));
UPDATE users SET role = 'admin' WHERE email = 'vegabaixuan@gmail.com';
```

**后端变更：**
- 所有 auth 路由（register / login / refresh / google）查询 `role` 并写入 JWT payload
- `api/auth/refresh.js` 响应新增 `role` 字段（之前只返回 `accessToken`）
- `api/admin/users.js` 新增：GET 全部用户列表 + PATCH 修改角色（admin only，403 保护）
- Google OAuth 注册时按 email 白名单自动分配 `admin` 角色

**前端变更（index.html）：**
- `Auth` 对象新增 `role` 字段（读写 `localStorage.msw_role`）
- `Auth.isAdmin()` 方法
- `setTokens()` 存储 role；token 自动刷新时若 role 有变化同步更新 localStorage
- 右上角新增紫色 `⬡ Admin` 入口链接，仅 admin 可见

**新增文件：**
- `api/admin/users.js` — 用户管理 API
- `admin_management.html` — 管理后台页面（独立页面，暗色主题，含用户表格、角色下拉修改、统计卡片、搜索/筛选）

**路由：**
- `vercel.json` 新增 `/admin_management` → `admin_management.html` rewrite

---

### v0.3.2 — Admin 入口不可见 Bug 修复

**现象：** vegabaixuan@gmail.com 注册后未看到 Admin 入口。

**排查与修复：**

| 问题 | 原因 | 修复 |
|---|---|---|
| Admin 入口不显示 | migration 002 未运行，`role` 列不存在；或用户在角色系统上线前已登录，localStorage `msw_role` 缓存了旧值 `null` | 重跑 migration → 退出重新登录 |
| 重新登录后仍丢失 role | `api/auth/refresh.js` 原本只返回 `accessToken`，不含 `role`；前端 token 自动刷新后不更新 `msw_role` | refresh 接口响应加 `role`；前端刷新时检测 role 变化并同步 localStorage + 调用 `updateAuthHUD()` |

---

### v0.3.3 — Google OAuth 重定向到 localhost 修复

**现象：** Google 登录完成后跳转到 `http://localhost:3000` 而非游戏页面。

**原因：** Supabase 项目的 **Site URL** 仍为初始默认值 `http://localhost:3000`。当 `redirectTo` 参数不在 Supabase 白名单时，Supabase 忽略该参数并回退到 Site URL。

**修复（Supabase Dashboard 手动配置）：**
- Authentication → URL Configuration → Site URL 改为生产域名
- Redirect URLs 添加：
  - `https://你的域名.vercel.app`
  - `https://*-项目名.vercel.app`（通配符覆盖所有 Preview URL）
  - `http://localhost:3000`（本地开发保留）

---

### v0.3.4 — Preview / Production 双环境搭建

**目标：** develop branch 对应独立 Preview 环境，使用独立数据库，避免测试数据污染生产库。

**Vercel 配置（手动）：**
- 项目新建 Preview 部署，关联 `develop` branch
- Settings → Environment Variables：同一变量名分别配置 Production 和 Preview 两套值：

| 变量名 | Production | Preview |
|---|---|---|
| `MSW_POSTGRES_URL` | 生产 Supabase 连接池 URL | 独立 preview DB 连接池 URL |
| `MSW_POSTGRES_URL_NON_POOLING` | 生产直连 URL | preview 直连 URL |
| 其余变量 | 生产值 | preview 值或复用 |

**Vercel Preview 保护：**
- Preview 部署默认开启 **Vercel Authentication**（访问需登录 Vercel 账号）
- curl 测试 Preview 接口时被拦截，报 "This page requires Vercel authentication."
- 修复：Settings → Deployment Protection → 关闭 Vercel Authentication，或使用 `x-vercel-protection-bypass` header

**环境变量未生效 Bug：**
- 现象：Preview 下新注册用户仍存入生产数据库
- 原因：Vercel 环境变量只对**变量修改后触发的新部署**生效，已存在的 Preview 部署使用旧变量值
- 修复：修改环境变量后需手动触发重新部署（push 新 commit 或 Vercel Dashboard 手动 Redeploy）
- 诊断工具：新增 `api/debug/env.js`（受 `MIGRATE_SECRET` 保护，返回当前 `VERCEL_ENV` 和 DB hostname，用于验证环境变量是否正确注入，调试完毕后删除）

---

## v0.4 — 世界地图生成系统（2026-05-03）

---

### v0.4.1 — World Map Generation 功能

Admin 可上传图片生成像素风格世界地图，并将其激活为全局世界地图。

**新增页面 `world_map_generation.html`：**

- 图片上传（点击或拖拽），设置最长边格子数，点击生成
- K-means（k=7）色彩量化：用 k-means++ 初始化 + 最多 30 轮迭代
- 颜色→难度映射：按像素数量排序，最多的簇 → 背景（黑色/不可玩），其余 6 簇由多到少依次对应 EASY → MASTER
- 量化后颜色展示在调色板中，可单击选色、在格子 canvas 上绘制修改
- TXT 导出（每行一行格子，0=背景 1-6=难度，带注释头）/ 导入（解析后恢复编辑状态）
- 填写名称后保存到数据库，已保存地图列表可 Activate / Deactivate / Load 回编辑 / Delete
- 背景格子（值 0）在世界地图中显示为黑色，不可点击进入游戏

**新增 API：**

| 端点 | 说明 |
|---|---|
| `api/admin/worldmap.js` → 合并后 `api/admin.js` | GET 列表/GET by id / POST 创建 / PATCH 激活切换 / DELETE 删除（admin only） |
| `api/world/map.js` | GET 当前激活的世界地图数据（公开） |

**数据库变更（Migration 003）：**
```sql
CREATE TABLE IF NOT EXISTS world_maps (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT     NOT NULL,
  data       TEXT     NOT NULL,   -- JSON 序列化的 flat Uint8Array，值 0=背景 1-6=难度
  width      SMALLINT NOT NULL DEFAULT 20,
  height     SMALLINT NOT NULL DEFAULT 16,
  is_active  BOOLEAN  NOT NULL DEFAULT FALSE,
  created_by UUID     REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**前端变更（index.html）：**
- `WORLD_W` / `WORLD_H` 从 `const` 改为 `let`，由激活地图尺寸动态决定
- 新增 `fetchActiveWorldMap()`：启动时拉取激活地图，更新 `customWorldMap` 状态
- 新增 `applyWorldDimensions(w, h)`：更新世界尺寸并自动重算相机缩放与位置（自适应显示全图）
- `gridTier(gx, gy)` 优先读取 `customWorldMap.data`；值为 0 时返回 `null`（背景）
- `drawWorld()` 背景格子跳过，填黑色
- `openGrid()` 背景格子直接 return，不可进入游戏
- `showTT()` 背景格子不显示 tooltip

**路由：**
- `vercel.json` 新增 `/world_map_generation` → `world_map_generation.html`
- `admin_management.html` 顶栏新增「🗺 World Map Generation」跳转按钮

---

### v0.4.2 — Vercel Serverless Function 数量超限

**现象：** Vercel 构建报错，超过 Hobby 计划 12 个 Serverless Function 上限（当时共 14 个）。

**原因：** 5 个 auth 子路由 + 2 个 admin 子路由各自独立成文件。

**修复：** 合并同类 API 文件，通过 query 参数路由：

| 合并前（7 个文件） | 合并后（1 个文件） | 路由方式 |
|---|---|---|
| `api/auth/login.js` `register.js` `logout.js` `refresh.js` `google.js` | `api/auth.js` | `?action=login\|register\|logout\|refresh\|google` |
| `api/admin/users.js` `api/admin/worldmap.js` | `api/admin.js` | `?resource=users\|worldmap` |

合并后共 **9 个** Serverless Functions，低于 12 的上限。同时清理了遗留的空目录 `api/auth/` `api/admin/` `api/debug/`。

所有前端调用 URL 同步更新（如 `/api/auth/login` → `/api/auth?action=login`）。

---

### v0.4.3 — Admin 页面空白 / Access Denied

**现象：** 点进 admin_management 页面显示空白；点进 World Map Generation 显示"Access Denied"。

**原因：** `admin_management.html` 和 `world_map_generation.html` 中的 `getAccessToken()` 只检查 `localStorage.msw_access` 是否存在，不验证 JWT 是否过期。Access token 15 分钟有效期过后仍原样发给 API，后端返回 401，前端判断为 Access Denied。

**修复（两个 HTML 页面）：**

1. `getAccessToken()` 新增 JWT expiry 解码检查：
```js
if (Auth.token) {
  const exp = JSON.parse(atob(Auth.token.split('.')[1])).exp;
  if (exp * 1000 > Date.now() + 10_000) return Auth.token; // 还有 10 秒以上有效期才使用
  localStorage.removeItem('msw_access');
}
// 自动用 refresh token 换新的 access token
```

2. `apiFetch()` 新增 401 自动重试：收到 401 时清除旧 access token、重新 refresh、用新 token 再试一次。

---

### v0.4.4 — 自定义世界地图仅显示左上角

**现象：** 激活 40×40 的像素猫地图后，游戏世界只显示左上角一小块，40×40 的内容被裁剪到 20×16 范围内。

**原因：** `WORLD_W = 20, WORLD_H = 16` 为硬编码常量，用于：
- `clampCam()`：相机位置锁定范围
- `drawWorld()`：渲染的格子范围
- 世界边框绘制
- `openGrid()` / hover 的坐标合法性检查

激活任意尺寸的自定义地图后，这些值从未更新，导致超出 20×16 的格子既不渲染也不可交互。

**修复：**
- `WORLD_W` / `WORLD_H` 改为 `let`
- 新增 `applyWorldDimensions(w, h)`：更新 `WORLD_W`/`WORLD_H`，按新尺寸重算 `cam.zoom` 以自适应全屏显示（取宽/高两个方向最小缩放比 × 0.92 留边），并将 `cam.x/y` 重置到世界中心
- `fetchActiveWorldMap()` 加载地图后调用 `applyWorldDimensions(map.width, map.height)`；无激活地图时重置为 `(20, 16)`
- `api/progress/[x]/[y].js` 移除硬编码的 `gx < WORLD_W` 坐标边界校验（改为宽松的 `0–999` 上限），避免拒绝大尺寸地图上的进度保存请求