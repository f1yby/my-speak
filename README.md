# My-Speak

类似 Discord/TeamSpeak 的语音和文字交流软件。

## 功能特性

- 🔊 多人实时语音通话（WebRTC + mediasoup）
- 💬 文字频道实时消息
- 🏢 服务器/社区管理
- 🔐 一次性邀请码系统
- 👥 三级权限管理（Owner/Admin/Member）
- 🔒 端到端加密通信

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Socket.io Client
- mediasoup-client
- Zustand（状态管理）

### 后端
- Node.js 20 + Express
- Socket.io
- mediasoup（SFU）
- PostgreSQL + Prisma ORM
- Redis
- JWT 认证

## 快速开始

### 环境要求
- Node.js >= 20.0.0
- Docker & Docker Compose
- Git

### 1. 克隆项目

```bash
git clone <repository-url>
cd my-speak
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 3. 启动基础设施

```bash
docker-compose up -d postgres redis
```

### 4. 数据库迁移

```bash
cd server
npx prisma migrate dev
```

### 5. 启动后端

```bash
npm run dev
```

### 6. 启动前端

```bash
cd ../client
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
my-speak/
├── client/          # React 前端
├── server/          # Node.js 后端
├── docs/            # 项目文档
├── nginx/           # Nginx 配置
├── scripts/         # 脚本文件
└── docker-compose.yml
```

## 文档

- [产品需求文档](docs/PRD.md)
- [技术架构文档](docs/ARCHITECTURE.md)
- [API接口文档](docs/API.md)
- [数据库设计文档](docs/DATABASE.md)
- [开发规范文档](docs/DEVELOPMENT.md)
- [部署文档](docs/DEPLOYMENT.md)

## 开发指南

详见 [开发规范文档](docs/DEVELOPMENT.md)

## 部署

详见 [部署文档](docs/DEPLOYMENT.md)

## License

MIT
