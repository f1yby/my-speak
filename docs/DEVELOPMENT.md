# My-Speak 开发规范文档

## 1. 项目结构规范

### 1.1 整体目录结构

```
my-speak/
├── .github/                    # GitHub配置
│   └── workflows/              # CI/CD工作流
├── docker/                     # Docker配置
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── docker-compose.yml
├── docs/                       # 项目文档
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md          # 本文件
│   └── DEPLOYMENT.md
├── client/                     # 前端项目
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                     # 后端项目
│   ├── prisma/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── nginx/                      # Nginx配置
│   └── nginx.conf
├── scripts/                    # 脚本文件
│   ├── setup.sh
│   └── migrate.sh
├── .env.example               # 环境变量示例
├── .gitignore
├── docker-compose.yml
└── README.md
```

### 1.2 前端目录结构 (client/src/)

```
src/
├── components/                 # 纯展示组件
│   ├── ui/                     # 基础UI组件
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── Avatar.tsx
│   ├── layout/                 # 布局组件
│   │   ├── MainLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── auth/                   # 认证相关
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── server/                 # 服务器相关
│   │   ├── ServerList.tsx
│   │   ├── ServerItem.tsx
│   │   └── CreateServerModal.tsx
│   └── channel/                # 频道相关
│       ├── ChannelList.tsx
│       ├── TextChannel.tsx
│       ├── VoiceChannel.tsx
│       └── MessageList.tsx
├── features/                   # 功能模块（组件+逻辑）
│   ├── auth/                   # 认证功能
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   └── services/
│   │       └── auth-api.ts
│   ├── voice-chat/             # 语音聊天
│   │   ├── components/
│   │   ├── hooks/
│   │   │   ├── useVoiceChat.ts
│   │   │   └── useMediasoup.ts
│   │   └── services/
│   │       └── voice-service.ts
│   └── messaging/              # 消息功能
│       ├── components/
│       ├── hooks/
│       └── services/
├── hooks/                      # 全局自定义Hooks
│   ├── useSocket.ts
│   ├── useUser.ts
│   └── useChannel.ts
├── services/                   # API服务
│   ├── api-client.ts           # Axios实例
│   ├── socket-client.ts        # Socket.io实例
│   └── mediasoup-client.ts     # WebRTC客户端
├── stores/                     # 状态管理 (Zustand)
│   ├── auth-store.ts
│   ├── channel-store.ts
│   ├── server-store.ts
│   └── voice-store.ts
├── utils/                      # 工具函数
│   ├── validators.ts
│   ├── formatters.ts
│   └── storage.ts
├── types/                      # TypeScript类型
│   ├── api.ts
│   ├── socket.ts
│   ├── user.ts
│   └── webrtc.ts
├── constants/                  # 常量
│   └── index.ts
├── styles/                     # 全局样式
│   └── globals.css
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

### 1.3 后端目录结构 (server/src/)

```
src/
├── config/                     # 配置文件
│   ├── index.ts                # 主配置
│   ├── database.ts             # 数据库配置
│   ├── redis.ts                # Redis配置
│   └── mediasoup.ts            # mediasoup配置
├── api/                        # REST API
│   ├── routes/                 # 路由定义
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── server.routes.ts
│   │   ├── channel.routes.ts
│   │   ├── invite.routes.ts
│   │   └── message.routes.ts
│   ├── controllers/            # 控制器
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── server.controller.ts
│   │   ├── channel.controller.ts
│   │   ├── invite.controller.ts
│   │   └── message.controller.ts
│   ├── validators/             # 请求验证
│   │   ├── auth.validator.ts
│   │   ├── user.validator.ts
│   │   └── common.validator.ts
│   └── middleware/             # 中间件
│       ├── auth.middleware.ts
│       ├── error.middleware.ts
│       └── rate-limit.middleware.ts
├── signaling/                  # Socket.io信令
│   ├── socket-server.ts        # Socket服务器初始化
│   ├── handlers/               # 事件处理器
│   │   ├── connection.handler.ts
│   │   ├── server.handler.ts
│   │   ├── channel.handler.ts
│   │   ├── message.handler.ts
│   │   └── webrtc.handler.ts
│   ├── middleware/             # Socket中间件
│   │   └── auth.middleware.ts
│   └── rooms/                  # 房间管理
│       └── room-manager.ts
├── media/                      # mediasoup媒体
│   ├── worker-manager.ts       # Worker管理
│   ├── router-manager.ts       # Router管理
│   └── transport-manager.ts    # Transport管理
├── services/                   # 业务服务
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── server.service.ts
│   ├── channel.service.ts
│   ├── invite.service.ts
│   ├── message.service.ts
│   └── voice-chat.service.ts
├── models/                     # 数据模型 (Prisma)
│   └── index.ts
├── db/                         # 数据库连接
│   └── prisma-client.ts
├── redis/                      # Redis连接
│   └── redis-client.ts
├── utils/                      # 工具函数
│   ├── jwt.ts
│   ├── password.ts
│   ├── logger.ts
│   └── validators.ts
├── types/                      # TypeScript类型
│   ├── express.d.ts
│   ├── socket.d.ts
│   └── mediasoup.d.ts
├── constants/                  # 常量
│   └── index.ts
└── index.ts                    # 入口文件
```

---

## 2. 代码规范

### 2.1 命名规范

#### TypeScript/JavaScript

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 类/接口/类型 | PascalCase | `UserService`, `AuthState` |
| 变量/函数 | camelCase | `getUserById`, `isAuthenticated` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| 文件/文件夹 | kebab-case | `auth-service.ts`, `user-list.tsx` |
| 私有属性 | _camelCase | `_internalCache` |
| React组件 | PascalCase | `VoiceChannel`, `UserAvatar` |
| Hooks | camelCase, use前缀 | `useVoiceChat`, `useAuth` |

#### 数据库

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 表名 | snake_case, 复数 | `users`, `server_members` |
| 列名 | snake_case | `user_id`, `created_at` |
| 索引 | idx_表名_列名 | `idx_users_email` |
| 外键 | fk_表名_引用表 | `fk_sm_server` |
| 约束 | chk/uk_描述 | `chk_username_format` |

### 2.2 文件组织规范

#### 组件文件结构

```typescript
// 文件: components/channel/VoiceChannel.tsx

// 1. 导入 (按类型分组)
import React, { useState, useEffect } from 'react';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { Button } from '@/components/ui/Button';
import type { VoiceChannelProps } from '@/types/channel';

// 2. 类型定义（如果是组件独有）
interface VoiceUser {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

// 3. 组件定义
export const VoiceChannel: React.FC<VoiceChannelProps> = ({ channelId }) => {
  // 3.1 Hooks
  const { connect, disconnect, isConnected } = useVoiceChat();
  const [users, setUsers] = useState<VoiceUser[]>([]);
  
  // 3.2 副作用
  useEffect(() => {
    connect(channelId);
    return () => disconnect();
  }, [channelId]);
  
  // 3.3 事件处理
  const handleToggleMute = () => {
    // ...
  };
  
  // 3.4 渲染
  return (
    <div className="voice-channel">
      {/* JSX */}
    </div>
  );
};

// 4. 默认导出（可选）
export default VoiceChannel;
```

#### 服务文件结构

```typescript
// 文件: services/auth.service.ts

// 1. 导入
import { prisma } from '@/db/prisma-client';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateTokens } from '@/utils/jwt';
import type { RegisterInput, LoginInput } from '@/types/auth';

// 2. 错误类（如果需要）
export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// 3. 服务函数
export async function registerUser(input: RegisterInput) {
  // 实现...
}

export async function loginUser(input: LoginInput) {
  // 实现...
}

export async function logoutUser(userId: string) {
  // 实现...
}

// 4. 导出
export const AuthService = {
  registerUser,
  loginUser,
  logoutUser,
};
```

### 2.3 代码风格

#### ESLint + Prettier 配置

**前端 (.eslintrc.js):**
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

**后端 (.eslintrc.js):**
```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

**Prettier (.prettierrc):**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

#### TypeScript 规范

```typescript
// ✅ 好的示例

// 1. 明确的类型定义
interface User {
  id: string;
  name: string;
  email: string;
}

// 2. 函数返回类型
async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// 3. 使用类型守卫
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// 4. 使用联合类型
 type ChannelType = 'text' | 'voice';

// 5. 使用枚举
enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// ❌ 避免

// 1. 不使用any
function badFunction(data: any) { } // 避免

// 2. 不明确类型
const user = { id: '1', name: 'John' }; // 应该定义为User类型

// 3. 不使用非空断言
const name = user!.name; // 避免使用!
```

---

## 3. Git 工作流

### 3.1 分支策略

```
main                    # 生产分支
├── develop             # 开发分支
│   ├── feature/auth    # 功能分支
│   ├── feature/voice
│   └── feature/ui
├── hotfix/bug-123      # 热修复分支
└── release/v1.0.0      # 发布分支
```

### 3.2 分支命名

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 功能分支 | feature/功能描述 | `feature/user-authentication` |
| 修复分支 | fix/问题描述 | `fix/login-redirect-bug` |
| 热修复 | hotfix/问题描述 | `hotfix/security-patch` |
| 发布分支 | release/版本号 | `release/v1.0.0` |
| 文档分支 | docs/描述 | `docs/api-documentation` |

### 3.3 Commit 规范

**格式:** `类型: 简短描述`

**类型:**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

**示例:**
```bash
feat: 添加用户注册功能
fix: 修复登录时Token过期不刷新问题
docs: 更新API文档中的认证接口
refactor: 重构VoiceChannel组件逻辑
style: 格式化所有TypeScript文件
test: 添加auth.service的单元测试
```

### 3.4 PR 规范

**PR模板:**
```markdown
## 描述
简要描述这个PR做了什么

## 变更类型
- [ ] Bug修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化

## 测试
- [ ] 本地测试通过
- [ ] 单元测试通过
- [ ] 手动测试通过

## 截图（如果是UI变更）

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 所有测试通过
- [ ] 文档已更新
```

---

## 4. 环境配置

### 4.1 环境变量

**服务端 .env:**
```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/myspeak?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-key-min-32-characters"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# mediasoup
MEDIASOUP_LISTEN_IP="0.0.0.0"
MEDIASOUP_ANNOUNCED_IP="your-public-ip"
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=10100

# 服务器
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"

# 文件上传
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="5242880"  # 5MB
```

**客户端 .env:**
```bash
VITE_API_URL="http://localhost:3001/api"
VITE_SOCKET_URL="ws://localhost:3001"
VITE_APP_NAME="My-Speak"
```

### 4.2 开发环境启动

```bash
# 1. 启动基础设施
docker-compose up -d postgres redis

# 2. 后端
cd server
npm install
npx prisma migrate dev
npm run dev

# 3. 前端
cd client
npm install
npm run dev

# 4. 访问 http://localhost:5173
```

---

## 5. 测试规范

### 5.1 测试策略

| 类型 | 工具 | 覆盖率目标 |
|------|------|------------|
| 单元测试 | Vitest (前端) / Jest (后端) | 70%+ |
| 集成测试 | Vitest / Jest | 关键流程覆盖 |
| E2E测试 | Playwright | 核心用户场景 |

### 5.2 测试文件结构

```
__tests__/
├── unit/
│   ├── auth.service.test.ts
│   └── user.service.test.ts
├── integration/
│   └── api.test.ts
└── e2e/
    └── voice-chat.spec.ts
```

### 5.3 测试示例

```typescript
// auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerUser } from '@/services/auth.service';
import { prisma } from '@/db/prisma-client';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should create a new user with valid input', async () => {
      const input = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = await registerUser(input);

      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(input.username);
      expect(result.user.email).toBe(input.email);
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should throw error if username already exists', async () => {
      // 测试实现...
    });
  });
});
```

---

## 6. 性能优化指南

### 6.1 前端优化

```typescript
// 1. 使用 React.memo 避免不必要的重渲染
export const UserItem = React.memo(({ user }: UserItemProps) => {
  return <div>{user.name}</div>;
});

// 2. 使用 useMemo/useCallback
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
const memoizedCallback = useCallback(() => doSomething(a, b), [a, b]);

// 3. 代码分割
const VoiceChannel = lazy(() => import('./VoiceChannel'));

// 4. 图片优化
<img src={avatarUrl} loading="lazy" alt={username} />;

// 5. 虚拟列表（长消息列表）
import { VirtualList } from 'react-window';
```

### 6.2 后端优化

```typescript
// 1. 数据库查询优化（使用select）
const users = await prisma.user.findMany({
  select: { id: true, username: true },
  where: { isActive: true },
  take: 20,
});

// 2. 使用Redis缓存
const cached = await redis.get(`user:${userId}`);
if (cached) return JSON.parse(cached);

// 3. 批量操作
await prisma.message.createMany({
  data: messages,
});

// 4. 连接池配置
// 已经在Prisma中自动处理

// 5. Nginx Gzip压缩
gzip on;
gzip_types application/json text/css application/javascript;
```

---

## 7. 安全规范

### 7.1 输入验证

```typescript
// 使用 express-validator
import { body, validationResult } from 'express-validator';

export const registerValidator = [
  body('username')
    .isLength({ min: 3, max: 32 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名格式不正确'),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含大小写字母和数字'),
];

// 处理验证结果
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: errors.array(),
      },
    });
  }
  next();
}
```

### 7.2 XSS防护

```typescript
// 前端：转义HTML
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 后端：Prisma自动参数化查询防止SQL注入
```

### 7.3 CSRF防护

```typescript
// 使用SameSite Cookie和CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
```

---

## 文档历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | - | 初始版本 |

---

**文档结束**
