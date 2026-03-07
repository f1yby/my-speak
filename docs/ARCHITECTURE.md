# My-Speak 技术架构文档

## 1. 系统架构概述

### 1.1 架构选择
采用**三层架构模式**:
- **前端层**: React + TypeScript 单页应用
- **API网关层**: Nginx 反向代理和静态资源服务
- **后端服务层**: Node.js + Express 微服务
- **数据层**: PostgreSQL + Redis

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端层                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Web浏览器 (Chrome/Firefox/Safari/Edge)                 │   │
│  │  • WebRTC支持                                           │   │
│  │  • WebSocket支持                                        │   │
│  │  • LocalStorage/IndexedDB                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/WSS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API网关层 (Nginx)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • SSL/TLS终止 (HTTPS 443端口)                          │   │
│  │  • WebSocket代理 (/socket.io/)                          │   │
│  │  • API路由转发 (/api/* → 后端服务)                       │   │
│  │  • 静态资源服务 (前端构建产物)                            │   │
│  │  • 负载均衡 (未来扩展)                                   │   │
│  │  • Gzip压缩                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      后端服务层 (Node.js)                        │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │   信令服务 (Express)  │  │    SFU媒体服务器 (mediasoup)  │    │
│  │                      │  │                              │    │
│  │  REST API端点        │  │  • Worker进程管理             │    │
│  │  • /api/auth/*       │  │  • Router/Transport管理       │    │
│  │  • /api/users/*      │  │  • Producer/Consumer管理      │    │
│  │  • /api/servers/*    │  │  • RTP参数协商                │    │
│  │  • /api/channels/*   │  │  • 带宽估计和适配             │    │
│  │                      │  │                              │    │
│  │  Socket.io事件       │  │  WebRTC传输                   │    │
│  │  • 连接认证           │  │  • UDP: 10000-10100端口       │    │
│  │  • 服务器/频道管理    │  │  • DTLS加密                   │    │
│  │  • 消息收发          │  │  • SRTP媒体传输               │    │
│  │  • WebRTC信令        │  │                              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                              │                                 │
│  ┌──────────────────────┐  │  ┌──────────────────────────────┐│
│  │   业务逻辑层         │  │  │     音频处理层               ││
│  │                      │◄─┘  │                              ││
│  │  • 用户管理          │     │  • VAD语音检测               ││
│  │  • 服务器管理        │     │  • 降噪处理 (可选)           ││
│  │  • 频道管理          │     │  • 自动增益控制              ││
│  │  • 消息服务          │     │  • 音量标准化               ││
│  │  • 邀请码服务        │     │                              ││
│  └──────────────────────┘     └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL / Redis Protocol
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据层                                    │
│                                                                 │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │    PostgreSQL 15         │  │       Redis 7              │  │
│  │                          │  │                            │  │
│  │  持久化数据存储:          │  │  临时/实时数据:            │  │
│  │  • 用户表                 │  │  • Socket会话              │  │
│  │  • 服务器表               │  │  • 在线状态                │  │
│  │  • 频道表                 │  │  • 频道成员列表            │  │
│  │  • 消息表                 │  │  • WebRTC传输状态          │  │
│  │  • 邀请码表               │  │  • 消息缓存 (可选)         │  │
│  │  • 成员关系表             │  │  • 限流计数器              │  │
│  │                          │  │                            │  │
│  │  端口: 5432              │  │  端口: 6379                │  │
│  └──────────────────────────┘  └────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           文件存储 (本地/MinIO)                          │   │
│  │  • 用户头像 (/uploads/avatars/)                         │   │
│  │  • 服务器图标 (/uploads/server-icons/)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈详细说明

### 2.1 前端技术栈

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| **React** | 18.x | UI框架 | 组件化、生态丰富、Hooks支持 |
| **TypeScript** | 5.x | 类型系统 | 编译时类型检查、IDE支持、减少运行时错误 |
| **Vite** | 5.x | 构建工具 | 快速HMR、优化构建输出、现代ESM支持 |
| **Socket.io-client** | 4.x | 实时通信 | 自动重连、事件驱动、兼容性好 |
| **mediasoup-client** | 3.x | WebRTC客户端 | 专为SFU设计、TypeScript支持、稳定 |
| **Zustand** | 4.x | 状态管理 | 轻量、TypeScript友好、无样板代码 |
| **React Query** | 5.x | 服务端状态管理 | 缓存、自动重取、乐观更新 |
| **Tailwind CSS** | 3.x | CSS框架 | 原子化CSS、开发效率高、Tree-shaking |
| **Lucide React** | 0.x | 图标库 | 现代化、Tree-shaking支持 |
| **date-fns** | 3.x | 日期处理 | 轻量、模块化、TypeScript支持 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| **Node.js** | 20.x LTS | 运行环境 | 长期支持、性能优秀、生态丰富 |
| **Express** | 4.x | Web框架 | 轻量、中间件丰富、文档完善 |
| **Socket.io** | 4.x | WebSocket服务 | 房间支持、自动回退、扩展性强 |
| **mediasoup** | 3.x | SFU服务器 | C++核心性能、Node.js API友好 |
| **TypeScript** | 5.x | 类型系统 | 类型安全、重构友好 |
| **Prisma** | 5.x | ORM | 类型安全查询、迁移管理、性能好 |
| **bcrypt** | 5.x | 密码加密 | 行业标准、安全 |
| **jsonwebtoken** | 9.x | JWT实现 | 标准实现、签名验证 |
| **express-validator** | 7.x | 输入验证 | 声明式验证、错误格式化 |
| **helmet** | 7.x | 安全中间件 | 安全头设置、防护常见攻击 |
| **cors** | 2.x | 跨域处理 | 标准实现、配置灵活 |
| **multer** | 1.x | 文件上传 | 流式处理、内存友好 |

### 2.3 数据库和存储

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| **PostgreSQL** | 15.x | 主数据库 | ACID、复杂查询、JSON支持、扩展性 |
| **Redis** | 7.x | 缓存/会话 | 高性能、数据结构丰富、Pub/Sub |
| **ioredis** | 5.x | Redis客户端 | Promise支持、集群支持、性能好 |

### 2.4 运维和部署

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| **Docker** | 24.x | 容器化 | 环境一致性、隔离性、可移植 |
| **Docker Compose** | 2.x | 本地编排 | 开发环境一键启动、配置简单 |
| **Nginx** | 1.25 | 反向代理 | 高性能、WebSocket支持、SSL |
| **Certbot** | - | SSL证书 | Let's Encrypt自动续期 |
| **PM2** | 5.x | 进程管理 | 负载均衡、自动重启、日志管理 |

---

## 3. 核心组件设计

### 3.1 前端架构

#### 3.1.1 组件分层

```
src/
├── components/           # 纯展示组件
│   ├── ui/              # 通用UI组件（按钮、输入框等）
│   ├── layout/          # 布局组件
│   ├── auth/            # 认证相关
│   ├── server/          # 服务器相关
│   └── channel/         # 频道相关
├── features/            # 功能模块（包含组件+逻辑）
│   ├── auth/            # 认证功能
│   ├── voice-chat/      # 语音聊天功能
│   └── messaging/       # 消息功能
├── hooks/               # 自定义Hooks
├── services/            # API服务
├── stores/              # 状态管理
├── utils/               # 工具函数
└── types/               # 类型定义
```

#### 3.1.2 状态管理策略

**Zustand Store结构:**
```typescript
// auth-store.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials) => Promise<void>;
  logout: () => void;
}

// channel-store.ts
interface ChannelState {
  currentChannel: Channel | null;
  joinedChannels: Channel[];
  joinChannel: (channelId) => Promise<void>;
  leaveChannel: () => void;
}

// voice-store.ts
interface VoiceState {
  isConnected: boolean;
  isMuted: boolean;
  remoteUsers: RemoteUser[];
  localAudioTrack: MediaStreamTrack | null;
  connect: (channelId) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}
```

#### 3.1.3 WebRTC客户端架构

```
VoiceChatService
├── mediasoup-client Device
│   ├── Router (RTP能力)
│   ├── SendTransport (发送音频)
│   │   └── Producer (音频轨道)
│   └── RecvTransport (接收音频)
│       └── Consumers (其他用户的音频)
├── Socket.io信令
│   ├── 连接管理
│   ├── 事件处理
│   └── 重连逻辑
└── 音频处理
    ├── getUserMedia()
    ├── VAD检测
    └── 增益控制
```

### 3.2 后端架构

#### 3.2.1 服务分层

```
src/
├── api/                 # REST API路由
│   ├── routes/          # 路由定义
│   ├── controllers/     # 请求处理器
│   └── validators/      # 请求验证
├── signaling/           # Socket.io信令
│   ├── handlers/        # 事件处理器
│   ├── middleware/      # 认证中间件
│   └── rooms/           # 房间管理
├── media/               # mediasoup媒体
│   ├── workers/         # Worker管理
│   ├── routers/         # Router管理
│   └── transports/      # Transport管理
├── services/            # 业务逻辑
│   ├── auth-service.ts
│   ├── user-service.ts
│   ├── server-service.ts
│   ├── channel-service.ts
│   └── message-service.ts
├── models/              # 数据模型 (Prisma)
├── db/                  # 数据库连接
├── redis/               # Redis连接
├── utils/               # 工具函数
└── config/              # 配置文件
```

#### 3.2.2 业务服务职责

**AuthService:**
- 用户注册/登录/登出
- JWT生成和验证
- Token刷新和黑名单
- 密码加密验证

**ServerService:**
- 服务器CRUD操作
- 成员关系管理
- 权限检查
- 邀请码生成验证

**ChannelService:**
- 频道CRUD操作
- 用户加入/离开管理
- 权限检查

**MessageService:**
- 消息存储查询
- 消息历史分页
- 实时消息分发

**VoiceChatService:**
- mediasoup Worker/Router管理
- WebRTC信令协调
- 用户连接状态跟踪

### 3.3 数据库架构

#### 3.3.1 实体关系图

```
┌──────────────┐       ┌────────────────┐       ┌──────────────┐
│    users     │       │ server_members │       │   servers    │
├──────────────┤       ├────────────────┤       ├──────────────┤
│ id (PK)      │◄──────┤ user_id (FK)   │   ┌───┤ id (PK)      │
│ username     │       │ server_id (FK) │◄──┘   │ name         │
│ email        │       │ role           │       │ owner_id(FK) │
│ password_hash│       │ joined_at      │       └──────────────┘
│ display_name │       └────────────────┘              │
│ avatar_url   │                                       │
└──────────────┘                                       │
        │                                              │
        │          ┌──────────────┐                    │
        │          │   messages   │                    │
        │          ├──────────────┤                    │
        └─────────►│ author_id(FK)│                    │
                   │ channel_id   │◄───────────────────┤
                   │ content      │                    │
                   │ created_at   │                    │
                   └──────────────┘                    │
                                                       │
        ┌──────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐       ┌────────────────┐
│   channels   │       │    invites     │
├──────────────┤       ├────────────────┤
│ id (PK)      │       │ id (PK)        │
│ server_id(FK)│       │ server_id (FK) │
│ name         │       │ code           │
│ type         │       │ max_uses       │
│ bitrate      │       │ used_count     │
│ user_limit   │       │ expires_at     │
└──────────────┘       └────────────────┘
```

#### 3.3.2 索引设计

```sql
-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 服务器成员表索引
CREATE INDEX idx_server_members_server ON server_members(server_id);
CREATE INDEX idx_server_members_user ON server_members(user_id);

-- 频道表索引
CREATE INDEX idx_channels_server ON channels(server_id);
CREATE INDEX idx_channels_type ON channels(type);

-- 消息表索引
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- 邀请码表索引
CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_server ON invites(server_id);
```

### 3.4 Redis数据结构

```redis
# 用户会话
sessions:{userId} → Hash {
  socketId: string,
  serverId: string | null,
  channelId: string | null,
  joinedAt: timestamp
}

# 在线用户集合 (按服务器)
server:{serverId}:online → Set[userId1, userId2, ...]

# 频道成员 (语音频道)
channel:{channelId}:members → Set[userId1, userId2, ...]

# WebRTC传输状态
webrtc:{userId}:producer → String(producerId)
webrtc:{userId}:consumers → Set[consumerId1, consumerId2, ...]

# Token黑名单 (登出时使用)
token:blacklist:{jti} → String(expiration)

# API限流
rate_limit:{ip}:{route} → String(count)
```

---

## 4. 数据流设计

### 4.1 用户登录流程

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   用户   │     │   前端   │     │   后端   │     │   数据库  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  1.输入凭证     │                │                │
     │────────────────►│                │                │
     │                │                │                │
     │                │ 2.POST /api/auth/login          │
     │                │────────────────►│                │
     │                │                │                │
     │                │                │ 3.验证用户      │
     │                │                ├───────►│
     │                │                │◄───────│
     │                │                │                │
     │                │                │ 4.生成JWT      │
     │                │                │                │
     │                │◄───────────────│                │
     │                │                │                │
     │ 5.存储Token    │                │                │
     │◄───────────────│                │                │
     │                │                │                │
     │ 6.建立Socket   │                │                │
     │                │ 7.Socket认证    │                │
     │                │────────────────►│                │
     │                │                │ 8.存储会话      │
     │                │                ├───────►Redis   │
     │                │                │                │
     │ 9.进入应用     │◄───────────────│                │
     │◄───────────────│                │                │
```

### 4.2 加入语音频道流程

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   用户   │     │   前端   │     │   后端   │     │  mediasoup│
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1.点击语音频道  │                │                │
     │────────────────►│                │                │
     │                │                │                │
     │                │ 2.请求麦克风权限│                │
     │                │├───────────────┤                │
     │                │                │                │
     │                │ 3.获取音频流    │                │
     │                │◄───────────────┤                │
     │                │                │                │
     │                │ 4.socket:channel:join           │
     │                │────────────────►│                │
     │                │                │                │
     │                │                │ 5.创建Transport│
     │                │                ├───────►│
     │                │                │◄───────│
     │                │                │                │
     │                │ 6.返回参数     │                │
     │                │◄───────────────│                │
     │                │                │                │
     │                │ 7.连接Transport│                │
     │                │├───────────────┤                │
     │                │                │                │
     │                │ 8.创建Producer │                │
     │                │                ├───────►│
     │                │                │                │
     │                │ 9.获取其他用户列表              │
     │                │                │                │
     │                │ 10.创建Consumers               │
     │                │                │ (为每个用户)    │
     │                │                │                │
     │ 11.开始通话    │◄───────────────│                │
     │◄───────────────│                │                │
```

### 4.3 发送文字消息流程

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   用户   │     │   前端   │     │   后端   │     │  其他用户 │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1.输入消息      │                │                │
     │────────────────►│                │                │
     │                │                │                │
     │                │ 2.乐观更新(本地显示)              │
     │                │├───────────────┤                │
     │                │                │                │
     │                │ 3.socket:message:send             │
     │                │────────────────►│                │
     │                │                │                │
     │                │                │ 4.保存数据库    │
     │                │                │├───────────────►│
     │                │                │                │
     │                │                │ 5.广播给频道成员 │
     │                │                │────────────────►│
     │                │                │ (所有在线成员)  │
     │                │                │                │
     │                │ 6.确认/错误处理 │                │
     │                │◄───────────────│                │
     │                │                │                │
```

---

## 5. 安全设计

### 5.1 认证安全

**JWT Token策略:**
```typescript
// Access Token
{
  "sub": "user_id",
  "username": "username",
  "iat": 1234567890,
  "exp": 1234568790,  // 15分钟后过期
  "type": "access",
  "jti": "unique_token_id"  // 用于黑名单
}

// Refresh Token
{
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1235172690,  // 7天后过期
  "type": "refresh",
  "jti": "unique_token_id"
}
```

**安全措施:**
- Token使用HS256签名，密钥定期轮换
- Access Token短期有效(15分钟)，减少泄露风险
- Refresh Token存储HttpOnly Cookie，防止XSS
- 登出时将Token加入Redis黑名单
- 密码使用bcrypt(cost=12)加密

### 5.2 传输安全

**WebRTC安全:**
- DTLS 1.2加密信令通道
- SRTP加密音频流
- ICE候选过滤，防止IP泄露

**HTTPS/WSS:**
- TLS 1.3优先
- 证书使用Let's Encrypt
- HSTS头设置

### 5.3 应用安全

**输入验证:**
- 所有API参数使用express-validator验证
- SQL注入防护（使用Prisma ORM参数化查询）
- XSS防护（前端转义输出）

**限流策略:**
```typescript
// API限流
login: 5 attempts / 5 minutes / IP
api: 100 requests / minute / IP

// WebSocket限流
connection: 5 concurrent / IP
message: 30 messages / minute / user
```

---

## 6. 性能设计

### 6.1 前端性能

**优化策略:**
- 路由懒加载 (React.lazy)
- 组件级代码分割
- 图片懒加载和WebP格式
- 虚拟滚动（长消息列表）
- 防抖/节流（搜索、输入）

**目标指标:**
- 首屏加载 < 2s (4G网络)
- Time to Interactive < 3s
- Lighthouse性能评分 > 90

### 6.2 后端性能

**优化策略:**
- 数据库连接池 (Prisma默认管理)
- Redis缓存热点数据
- Nginx静态资源缓存
- Gzip压缩响应
- 消息分页加载

**目标指标:**
- API响应时间 P99 < 200ms
- WebSocket消息延迟 < 50ms
- 单服务器支持20人并发语音

### 6.3 数据库性能

**优化策略:**
- 合理索引（见3.3.2）
- 消息表按月分表（未来扩展）
- 连接池大小: 10-20
- 查询优化（EXPLAIN分析）

---

## 7. 扩展性设计

### 7.1 水平扩展能力

**当前架构:**
- 单实例部署，支持20人并发
- 适合小型社区

**未来扩展路径:**

**阶段1 - 多Worker（单服务器）:**
```
┌──────────────────────────────────────┐
│              Node.js                 │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Worker1 │ │ Worker2 │ │Worker3 │ │  (多核利用)
│  │ Router1 │ │ Router2 │ │Router3 │ │
│  └─────────┘ └─────────┘ └────────┘ │
│           (按ServerId哈希分配)       │
└──────────────────────────────────────┘
```

**阶段2 - 多服务器（负载均衡）:**
```
        ┌─────────┐
        │  Nginx  │ (负载均衡)
        └────┬────┘
    ┌────────┼────────┐
┌───▼───┐ ┌──▼──┐ ┌──▼───┐
│Node.js│ │Node.│ │Node. │  (多实例)
│  +    │ │ js  │ │  js  │
│mediaso│ │     │ │      │
│  up   │ │     │ │      │
└───┬───┘ └──┬──┘ └───┬──┘
    └────────┼────────┘
             │
        ┌────▼────┐
        │  Redis  │ (共享状态)
        │ Cluster │
        └────┬────┘
             │
        ┌────▼────┐
        │PostgreSQL│
        │  Master  │
        └─────────┘
```

### 7.2 数据库扩展

**当前:**
- 单PostgreSQL实例
- 适合1万用户以内

**未来扩展:**
- 读写分离（主从复制）
- 消息表分片（按时间或server_id）
- 使用连接池中间件（PgBouncer）

---

## 8. 监控和日志

### 8.1 日志策略

**日志级别:**
- ERROR: 系统错误，需要立即处理
- WARN: 警告，需要注意但不影响服务
- INFO: 关键业务流程记录
- DEBUG: 开发调试信息

**日志内容:**
- 时间戳
- 日志级别
- 请求ID（链路追踪）
- 用户ID（如果已认证）
- 消息内容

**日志存储:**
- 本地文件（开发环境）
- 日志收集服务（生产环境，如ELK/Loki）

### 8.2 监控指标

**应用指标:**
- API请求QPS和延迟
- WebSocket连接数
- 错误率
- 内存和CPU使用率

**业务指标:**
- 在线用户数
- 活跃语音频道数
- 消息发送量
- 用户注册/登录数

**WebRTC指标:**
- 音频延迟
- 丢包率
- 比特率
- 连接建立时间

---

## 9. 部署架构

### 9.1 开发环境

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: myspeak_dev
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build: ./server
    volumes:
      - ./server:/app
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
  
  frontend:
    build: ./client
    volumes:
      - ./client:/app
    ports:
      - "5173:5173"
```

### 9.2 生产环境

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./client/dist:/usr/share/nginx/html
  
  backend:
    build: ./server
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '2'
          memory: 2G
    environment:
      NODE_ENV: production
  
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: myspeak_prod
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

---

## 10. 技术风险和对策

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| WebRTC连接失败 | 高 | 中 | ICE服务器配置，支持TURN中继 |
| 音频质量问题 | 高 | 中 | VAD、降噪、比特率自适应 |
| 内存泄漏 | 中 | 中 | 定期压力测试，监控内存使用 |
| 数据库性能瓶颈 | 中 | 低 | 索引优化，查询优化，缓存 |
| 安全漏洞 | 高 | 低 | 代码审查，依赖扫描，渗透测试 |
| 浏览器兼容性 | 中 | 中 | adapter.js，特性检测，降级方案 |

---

## 文档历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | - | 初始版本 |

---

**文档结束**
