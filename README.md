# My-Speak

简洁的实时聊天服务器。

## 功能特性

- 🔐 单密码登录 - 只需一个共享密码即可进入
- 👤 自选用户名 - 无需注册，进入时选择用户名
- 💬 文字频道实时消息 - Socket.io 实时通信
- 📁 频道管理 - 创建、删除频道
- 💾 历史消息保存 - PostgreSQL 持久化存储
- 🔄 浏览器记住用户名 - 下次登录自动填充

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS v4
- Socket.io Client
- Zustand（状态管理）

### 后端
- Node.js 20 + Express
- Socket.io
- PostgreSQL + Prisma ORM
- bcrypt（密码加密）

## 快速开始

### 环境要求
- Docker & Docker Compose
- Git

### 启动步骤

```bash
# 克隆项目
git clone https://github.com/f1yby/my-speak.git
cd my-speak

# 启动所有服务
docker-compose up -d

# 访问应用
open http://localhost:5173
```

### 首次使用

1. 首次访问会跳转到设置页面
2. 输入服务器密码（至少 6 位）
3. 确认密码后完成设置
4. 使用密码和自选用户名登录

## 项目结构

```
my-speak/
├── client/              # React 前端
│   └── src/
│       ├── components/
│       │   ├── auth/    # 登录、设置组件
│       │   └── layout/  # 主布局、消息组件
│       ├── services/    # API 服务
│       └── stores/      # Zustand 状态管理
├── server/              # Node.js 后端
│   └── src/
│       ├── api/         # 路由、控制器
│       ├── services/    # 业务逻辑
│       └── db/          # Prisma 客户端
├── docs/                # 项目文档
└── docker-compose.yml   # Docker 编排
```

## 数据模型

```prisma
// 服务器配置（密码）
ServerConfig {
  id           String   @id @default("default")
  passwordHash String
}

// 会话
Session {
  id        String   @id
  token     String   // 会话令牌
  username  String   // 用户名
  expiresAt DateTime // 过期时间（24小时）
}

// 频道
Channel {
  id        String
  name      String   // 频道名称
  type      String   // TEXT 或 VOICE
  messages  Message[]
}

// 消息
Message {
  id         String
  channelId  String
  authorName String   // 作者用户名
  content    String   // 消息内容
  createdAt  DateTime
}
```

## API 端点

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/setup` | 检查是否已设置密码 |
| POST | `/api/auth/setup` | 首次设置密码 |
| POST | `/api/auth/login` | 登录（密码 + 用户名） |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前会话信息 |

### 频道
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/channels` | 获取所有频道 |
| GET | `/api/channels/:id` | 获取单个频道 |
| POST | `/api/channels` | 创建频道 |
| DELETE | `/api/channels/:id` | 删除频道 |

### 消息
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/channels/:id/messages` | 获取频道消息 |
| POST | `/api/channels/:id/messages` | 发送消息（备用） |

## Socket.io 事件

### 客户端 → 服务端
| 事件 | 数据 | 说明 |
|------|------|------|
| `channel:join` | `{ channelId }` | 加入频道 |
| `channel:leave` | - | 离开频道 |
| `message:send` | `{ channelId, content }` | 发送消息 |
| `voice:join` | `channelId` | 加入语音频道 |
| `voice:leave` | - | 离开语音频道 |
| `voice:get-router-rtp-capabilities` | `channelId` | 获取路由 RTP 能力 |
| `voice:create-transport` | `channelId` | 创建 WebRTC 传输通道 |
| `voice:connect-transport` | `{ channelId, dtlsParameters }` | 连接传输通道 |
| `voice:produce` | `{ channelId, kind, rtpParameters }` | 发送音频流 |
| `voice:consume` | `{ channelId, producerSocketId, rtpCapabilities }` | 接收音频流 |
| `voice:mute` | `isMuted` | 静音/取消静音 |
| `voice:deafen` | `isDeafened` | 耳聋/取消耳聋 |

### 服务端 → 客户端
| 事件 | 数据 | 说明 |
|------|------|------|
| `channel:messages` | `Message[]` | 频道历史消息 |
| `message:new` | `Message` | 新消息广播 |

## 语音通话

本项目使用 **Mediasoup SFU** 实现中心化语音转发，所有音频流经服务器转发。

### 架构

```
客户端A → 服务器(SFU) → 客户端B
                        ↘ 客户端C
```

### 配置

生产环境需要配置公网 IP：

```env
MEDIASOUP_ANNOUNCED_ADDRESS=yourdomain.com
```

### 端口

- `3001` - HTTP/WebSocket
- `10000-10100/udp` - WebRTC 媒体传输

---

## 开发命令

```bash
# 启动开发环境
docker-compose up -d

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 数据库迁移
docker-compose exec backend npx prisma migrate dev

# 重启服务
docker-compose restart backend
docker-compose restart frontend

# 停止所有服务
docker-compose down
```

## 文档

- [API 接口文档](docs/API.md)
- [数据库设计](docs/DATABASE.md)
- [开发规范](docs/DEVELOPMENT.md)
- [部署文档](docs/DEPLOYMENT.md)

---

## 功能实现状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 单密码登录 | ✅ 已实现 | 首次启动设置密码 |
| 自选用户名 | ✅ 已实现 | 浏览器记住用户名 |
| 创建/删除频道 | ✅ 已实现 | 所有人都能管理 |
| 实时消息 | ✅ 已实现 | Socket.io 实时通信 |
| 历史消息保存 | ✅ 已实现 | PostgreSQL 持久化 |
| 消息实时显示 | ✅ 已实现 | Socket.io 广播 |
| | | |
| 语音通话 | ✅ 已实现 | Mediasoup SFU 中心化转发 |
| 用户头像 | ❌ 未实现 | 无用户账号系统 |
| 私聊 | ❌ 未实现 | 只有公开频道 |
| 消息编辑/删除 | ❌ 未实现 | 发送后不可修改 |
| 消息分页 | ⚠️ 部分 | 只加载最近 50 条 |
| 消息搜索 | ❌ 未实现 | 无搜索功能 |
| 在线用户列表 | ❌ 未实现 | 无状态显示 |
| 频道权限 | ❌ 未实现 | 所有人可管理 |

---

## 后续优化建议

1. **消息分页** - 支持滚动加载历史消息
2. **在线用户** - 显示当前在线用户列表
3. **消息删除** - 允许删除自己的消息
4. **Markdown 支持** - 消息支持基本格式化
5. **文件上传** - 支持图片和文件分享
6. **消息通知** - 浏览器通知新消息
7. **语音消息** - 录音发送（可选）

---

## License

MIT
