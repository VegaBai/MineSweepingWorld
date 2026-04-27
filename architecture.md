# MineSweepingWorld — 服务端架构方案

## 核心设计原则：本地优先 + 事件同步

游戏逻辑全部保留在客户端（现有实现不变），服务端只在关键事件节点同步状态，
保持零延迟游戏体验，同时支持多端持久化和轻量社交功能。

```
关键同步点：
  进入格子游戏  →  GET 拉取该格子存档（若有）
  离开/暂停    →  PUT 上传当前格子状态快照
  通关/失败    →  PUT 上传最终状态 + 触发排行榜更新
  打开世界地图  →  WebSocket 接收其他玩家实时状态（在线人数、刚通关的格子）
```

---

## 系统组件图

```
┌─────────────────────────────────────────────┐
│               Browser Client                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Game     │  │ Auth UI  │  │ Social   │  │
│  │ Canvas   │  │ Modal    │  │ Overlay  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       └─────────────┴─────────────┘         │
│              JS API Layer                   │
│        (fetch + WebSocket client)           │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / WSS
┌──────────────────▼──────────────────────────┐
│              API Server                     │
│         Node.js + Fastify                   │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐  │
│  │ REST API   │  │ WS Hub   │  │ Auth    │  │
│  │ /progress  │  │ presence │  │ JWT     │  │
│  │ /leaderbd  │  │ events   │  │         │  │
│  └─────┬──────┘  └────┬─────┘  └────┬────┘  │
└────────┼──────────────┼─────────────┼───────┘
         │              │             │
    ┌────▼────┐    ┌────▼────┐        │
    │Postgres │    │  Redis  │        │
    │(进度/   │    │(在线人数/│        │
    │ 排行榜) │    │ pub/sub)│        │
    └─────────┘    └─────────┘        │
                              ┌───────▼──────┐
                              │  Auth (JWT)  │
                              │  本地签发     │
                              └──────────────┘
```

---

## 数据模型

### users
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
username      TEXT UNIQUE NOT NULL
email         TEXT UNIQUE
password_hash TEXT
created_at    TIMESTAMPTZ DEFAULT NOW()
last_seen     TIMESTAMPTZ DEFAULT NOW()
```

### grid_states（核心表，每用户每格子一行）
```sql
user_id        UUID REFERENCES users(id) ON DELETE CASCADE
grid_x         SMALLINT
grid_y         SMALLINT
status         TEXT   -- 'active' | 'won' | 'lost'
mines          BYTEA  -- Uint8Array 二进制，最大 30×50 = 1500 bytes
revealed       BYTEA
flagged        BYTEA
flag_count     SMALLINT DEFAULT 0
revealed_count SMALLINT DEFAULT 0
first_click    BOOLEAN  DEFAULT TRUE
hit_idx        SMALLINT DEFAULT -1
elapsed_sec    INT      DEFAULT 0
updated_at     TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (user_id, grid_x, grid_y)
```

### refresh_tokens
```sql
token_hash  TEXT PRIMARY KEY  -- SHA-256(token)
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
expires_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ DEFAULT NOW()
```

---

## REST API

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
DELETE /auth/logout

GET    /progress               拉取该用户所有格子状态（登录后初始化）
PUT    /progress/:x/:y         保存/更新单格子状态
DELETE /progress/:x/:y         重置单格子（Restart 时调用）

GET    /leaderboard            通关数 Top 20
GET    /world/presence         各区域在线人数快照

WS     /ws                     实时推送（presence、grid_won 事件）
```

---

## WebSocket 事件协议

**服务端 → 客户端：**
```json
{ "type": "presence",  "count": 142 }
{ "type": "grid_won",  "gx": 12, "gy": 7, "username": "xxx" }
{ "type": "grid_active", "gx": 5, "gy": 3, "count": 3 }
```

**客户端 → 服务端：**
```json
{ "type": "enter_grid", "gx": 5, "gy": 3 }
{ "type": "leave_grid", "gx": 5, "gy": 3 }
```

---

## 前端新增模块（不改动现有游戏逻辑）

```
index.html 内追加：
  ├── Auth Modal HTML        登录/注册弹窗
  └── <script> 追加模块：
        api.js   (内联)      fetch 封装 + token 管理
        sync.js  (内联)      挂钩 openGrid / goWorld / handleWin / handleLose
        auth-ui.js (内联)    登录/注册表单逻辑
        social-ui.js (内联)  在线人数、排行榜面板、通关 feed
```

---

## 部署方案

### 开发 / 起步
```yaml
docker-compose:
  app:   Node.js Fastify（服务静态文件 + API）
  db:    PostgreSQL 16
  cache: Redis 7
  proxy: Nginx（HTTPS 终止）
```

### 扩展路径
1. 静态资源 → CDN
2. DB → 托管 PostgreSQL（Supabase / Neon）
3. 多实例 → WS Hub 改用 Redis pub/sub 跨实例广播
4. 排行榜 → 定时 Job 聚合

---

## 开发优先级

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **P1** | Auth（注册/登录）+ 进度存档/读档 | Postgres + JWT |
| **P2** | 世界地图持久化（格子颜色跨会话保留） | P1 |
| **P3** | 通关数排行榜（静态，定时刷新） | P2 |
| **P4** | 在线人数 + 通关实时 feed | Redis + WebSocket |
| **P5** | 各格子在线人数角标、最速记录排行 | P3+P4 |