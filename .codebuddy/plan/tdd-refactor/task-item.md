# 实施计划

- [ ] 1. 后端测试基础设施搭建与 Vitest 配置
   - 在 `server/package.json` 中添加开发依赖：`vitest`、`@vitest/coverage-v8`、`supertest`、`@types/supertest`
   - 创建 `server/vitest.config.ts`，配置 TypeScript 路径别名、coverage 阈值（60%）、测试文件匹配规则（`**/*.test.ts`）
   - 在 `server/package.json` 的 scripts 中添加 `"test": "vitest run --coverage"`、`"test:watch": "vitest"`
   - 创建 `server/src/__mocks__/prisma-client.ts`，提供 mock Prisma Client 工厂函数，供所有 Service 测试复用
   - 创建 `server/src/__mocks__/mediasoup.ts`，提供 mock Worker/Router/Transport/Producer/Consumer 工厂
   - _需求：1.1、1.2、1.3、1.4、1.5_

- [ ] 2. 后端架构重构——Service 层依赖注入
   - 重构 `server/src/services/auth.service.ts`：将模块级函数改为 `AuthService` 类，构造函数接收 `PrismaClient` 参数
   - 重构 `server/src/services/channel.service.ts`：改为 `ChannelService` 类，构造函数注入 `PrismaClient`
   - 重构 `server/src/services/message.service.ts`：改为 `MessageService` 类，构造函数注入 `PrismaClient`
   - 重构 `server/src/services/mediasoup.service.ts`：改为 `MediasoupService` 类，将模块级 Map 改为实例属性，构造函数可注入 mediasoup Worker 工厂
   - _需求：2.1_

- [ ] 3. 后端架构重构——Controller 层依赖注入与类型安全
   - 重构 `server/src/api/controllers/auth.controller.ts`：改为 `AuthController` 类，构造函数接收 `AuthService` 实例
   - 重构 `server/src/api/controllers/channel.controller.ts`：改为 `ChannelController` 类，构造函数接收 `ChannelService`
   - 重构 `server/src/api/controllers/message.controller.ts`：改为 `MessageController` 类，构造函数接收 `MessageService`
   - 在 `server/src/types/` 目录下创建 Express Request 类型扩展文件，定义 `AuthenticatedRequest` 接口替代 `(req as any).user`
   - 在 `server/src/types/` 目录下创建 Socket 类型扩展文件，定义扩展 Socket 接口替代 `(socket as any).username`
   - 更新路由文件（`auth.routes.ts`、`channel.routes.ts`、`message.routes.ts`）以使用新的 Controller 实例
   - _需求：2.2、2.6_

- [ ] 4. 后端架构重构——入口拆分与 Socket 事件处理器抽取
   - 将 `server/src/index.ts` 中 Express app 创建逻辑抽取为 `server/src/app.ts` 中的 `createApp()` 工厂函数（含中间件注册、路由挂载、全局错误处理）
   - 将 Socket.io 事件处理逻辑从 `index.ts` 抽取到 `server/src/socket/chat.handler.ts`（聊天消息、typing 事件）
   - 将语音频道相关 Socket 逻辑抽取到 `server/src/socket/voice.handler.ts`（joinVoice、leaveVoice 等事件）
   - 将 `voiceChannels` Map 封装为 `server/src/services/voice-channel-manager.ts` 中的 `VoiceChannelManager` 类
   - 精简 `server/src/index.ts` 仅负责组装依赖、创建 HTTP Server、启动监听
   - _需求：2.3、2.4、2.5_

- [ ] 5. 后端代码质量修复——错误处理统一与死代码清理
   - 在 `server/src/api/middleware/error.middleware.ts` 中实现全局错误处理中间件，使用已有的 `AppError` 类（`utils/errors.ts`）处理已知错误，通用 500 处理未知错误
   - 将 `validate.middleware.ts` 应用到 `auth.routes.ts`（setup、login）和 `channel.routes.ts`（create）等需要请求体验证的路由上
   - 重构所有 Controller 方法：移除重复的 try-catch 模板，改用 async wrapper + 全局错误处理
   - 删除 `server/src/utils/crypto.ts` 中未使用的 `generateInviteCode` 和 `hashInviteCode` 函数（若整个文件无用则删除文件）
   - _需求：5.1、5.2、5.3、5.4_

- [ ] 6. 后端 Service 层与 Controller 层测试编写
   - 编写 `server/src/services/__tests__/auth.service.test.ts`：覆盖 `isServerSetup`、`setupServer`、`login`、`validateSession`、`logout`、`cleanupExpiredSessions` 全场景，使用 mock PrismaClient
   - 编写 `server/src/services/__tests__/channel.service.test.ts`：覆盖 CRUD 及边界场景
   - 编写 `server/src/services/__tests__/message.service.test.ts`：覆盖消息获取（分页）、创建、旧消息删除
   - 编写 `server/src/services/__tests__/mediasoup.service.test.ts`：使用 mock mediasoup 覆盖关键路径
   - 编写 `server/src/services/__tests__/voice-channel-manager.test.ts`：覆盖加入/离开/查询语音频道
   - 编写 `server/src/api/__tests__/auth.routes.test.ts`：使用 supertest + `createApp()` 测试 auth 路由
   - 编写 `server/src/api/__tests__/channel.routes.test.ts`：测试 channel 路由
   - 编写 `server/src/api/__tests__/message.routes.test.ts`：测试 message 路由
   - 编写 `server/src/api/__tests__/auth.middleware.test.ts`：测试认证中间件（无 token、无效 token、过期 token、有效 token）
   - _需求：3.1、3.2、3.3、3.4、3.5、4.1、4.2、4.3、4.4、4.5_

- [ ] 7. 前端测试基础设施搭建与 Vitest 配置
   - 在 `client/package.json` 中添加开发依赖：`vitest`、`@vitest/coverage-v8`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`、`msw`
   - 创建 `client/vitest.config.ts`，配置 jsdom 环境、路径别名、coverage
   - 创建 `client/src/test/setup.ts` 测试设置文件（import `@testing-library/jest-dom`、配置 MSW 全局 handler）
   - 在 `client/package.json` 的 scripts 中添加 `"test": "vitest run --coverage"`、`"test:watch": "vitest"`
   - _需求：6.1、6.2、6.3、6.4_

- [ ] 8. 前端架构重构——MainLayout 组件拆分与 Hooks 抽取
   - 将 `MainLayout.tsx` 中频道侧边栏逻辑拆分为 `client/src/components/layout/ChannelSidebar.tsx`
   - 将消息区域逻辑拆分为 `client/src/components/layout/MessageArea.tsx`
   - 将创建频道弹窗拆分为 `client/src/components/layout/CreateChannelModal.tsx`
   - 抽取 `client/src/hooks/useSocket.ts` 自定义 Hook，封装 Socket.io 连接管理
   - 抽取 `client/src/hooks/useMessages.ts`，使用 `@tanstack/react-query` 封装消息获取和发送
   - 抽取 `client/src/hooks/useChannels.ts`，使用 `@tanstack/react-query` 封装频道 CRUD
   - 重写 `MainLayout.tsx` 为组合组件，仅做布局编排
   - 在 `client/src/main.tsx` 或 `App.tsx` 中添加 `QueryClientProvider`
   - _需求：7.1、7.2、7.3、7.4、7.5_

- [ ] 9. 前端 Store、Service 与组件测试编写
   - 编写 `client/src/stores/__tests__/auth-store.test.ts`：覆盖 `checkSetup`、`setup`、`login`、`logout`、`clearError`
   - 编写 `client/src/services/__tests__/api-client.test.ts`：验证 token 附加、401 拦截器行为
   - 编写 `client/src/services/__tests__/auth-api.test.ts`、`channel-api.test.ts`、`message-api.test.ts`：验证 API 调用
   - 编写 `client/src/components/__tests__/ChannelSidebar.test.tsx`、`MessageArea.test.tsx`、`CreateChannelModal.test.tsx` 等组件测试
   - 编写 `client/src/hooks/__tests__/useMessages.test.ts`、`useChannels.test.ts`、`useSocket.test.ts` Hook 测试
   - 编写 `client/src/components/auth/__tests__/LoginForm.test.tsx`、`SetupForm.test.tsx` 认证组件测试
   - _需求：7.6、8.1、8.2、8.3、8.4_

- [ ] 10. CI 流水线更新与文档同步
   - 修改 `.github/workflows/ci.yml`：在 server job 中 build 之后添加 `npm test` 步骤，测试失败阻断流水线
   - 修改 `.github/workflows/ci.yml`：在 client job 中 build 之后添加 `npm test` 步骤
   - 更新 `README.md`：将数据库描述从 PostgreSQL 改为 SQLite，添加 `npm test`、`npm run test:watch` 等测试命令说明
   - 确保 `.env.example` 包含所有必要环境变量说明
   - 检查 `server/tsconfig.json` 和 `client/tsconfig.json` 中的路径别名配置，确保与代码实际使用一致
   - _需求：9.1、9.2、9.3、9.4、10.1、10.2、10.3、10.4_
