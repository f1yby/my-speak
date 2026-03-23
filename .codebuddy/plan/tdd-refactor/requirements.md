# 需求文档：测试驱动重构 (TDD Refactor)

## 引言

My-Speak 是一个基于 React + Node.js 的实时聊天应用（含语音通话），目前项目存在以下核心问题：

### 现有问题分析

1. **零测试覆盖**：整个项目（前端 + 后端）没有任何单元测试、集成测试或端到端测试。CI 流水线仅做 lint 和 build，无测试步骤。
2. **服务端入口文件臃肿**：`server/src/index.ts` 长达 322 行，将 Express 配置、Socket.io 逻辑、语音频道管理、全局状态（`voiceChannels` Map）全部混在一起，既无法测试，也难以维护。
3. **前端巨型组件**：`MainLayout.tsx`（474 行）承担了频道管理、消息收发、Socket 连接、语音通话、UI 渲染等所有职责，违反单一职责原则。
4. **硬耦合依赖**：Service 层直接 import Prisma Client 全局实例，无法注入 mock；Controller 直接 import Service 模块函数，无法隔离测试。
5. **类型安全缺失**：多处使用 `(req as any).user`、`(socket as any).username` 等强制类型断言，缺乏类型保护。
6. **错误处理不统一**：每个 Controller 方法都有重复的 try-catch + JSON 响应模板，缺少全局错误处理中间件。
7. **死代码**：`crypto.ts` 中的 `generateInviteCode` / `hashInviteCode` 未被任何地方使用；`AppError` 类定义后未被采用。`validate.middleware.ts` 虽存在但未被路由使用。
8. **全局可变状态**：`mediasoup.service.ts` 中使用模块级 Map 存储 routers/transports/producers/consumers，且 `voiceChannels` Map 在 `index.ts` 中作为全局变量。
9. **README 与实际实现不一致**：README 声称使用 PostgreSQL，但 Prisma schema 实际配置的是 SQLite。
10. **前端缺乏数据获取层管理**：虽安装了 `@tanstack/react-query`，但未被使用，数据获取散落在组件的 useEffect 中。

### 改造目标

将项目改造为测试驱动（TDD）的架构，引入全面的测试基础设施，重构代码使其可测试，修复所有已知问题，并确保 CI 流水线包含测试步骤。

---

## 需求

### 需求 1：后端测试基础设施搭建

**用户故事：** 作为一名开发者，我希望后端项目具备完整的测试框架和工具链，以便我能快速编写和运行单元测试与集成测试。

#### 验收标准

1. WHEN 开发者运行 `npm test` THEN 系统 SHALL 使用 Vitest 执行所有后端测试，并输出覆盖率报告
2. WHEN 开发者运行 `npm run test:watch` THEN 系统 SHALL 以 watch 模式运行测试，文件变更时自动重新执行
3. WHEN 测试需要数据库操作 THEN 系统 SHALL 提供内存 SQLite 数据库或 mock Prisma Client，确保测试隔离
4. WHEN 测试需要外部依赖（mediasoup、bcrypt 等）THEN 系统 SHALL 提供标准化的 mock/stub 工具和配置
5. IF `server/package.json` 缺少测试相关依赖 THEN 系统 SHALL 添加 vitest、@vitest/coverage-v8、supertest 等开发依赖

### 需求 2：后端架构重构——依赖注入与可测试性

**用户故事：** 作为一名开发者，我希望后端代码采用依赖注入模式，以便我能在测试中轻松替换依赖，独立测试每个模块。

#### 验收标准

1. WHEN Service 层需要访问数据库 THEN 系统 SHALL 通过构造函数或工厂函数注入 Prisma Client，而非直接 import 全局实例
2. WHEN Controller 需要调用 Service THEN 系统 SHALL 通过依赖注入获取 Service 实例，而非直接 import 模块级函数
3. WHEN `index.ts` 初始化应用 THEN 系统 SHALL 将 Express app 创建、中间件配置、路由注册抽取为独立的 `createApp()` 工厂函数，使其可被测试文件直接引用
4. WHEN Socket.io 事件处理逻辑执行 THEN 系统 SHALL 将所有 socket 事件处理器从 `index.ts` 抽取到独立的 handler 模块中
5. WHEN 语音频道状态需要管理 THEN 系统 SHALL 将 `voiceChannels` Map 封装为独立的 `VoiceChannelManager` 类，具有可测试的方法接口
6. IF 存在 `(req as any).user` 或 `(socket as any).username` 等类型断言 THEN 系统 SHALL 使用正确的 TypeScript 类型扩展替代

### 需求 3：后端 Service 层单元测试

**用户故事：** 作为一名开发者，我希望所有后端 Service 模块都有完整的单元测试覆盖，以便我能确信业务逻辑的正确性。

#### 验收标准

1. WHEN `auth.service.ts` 的所有公开方法被测试 THEN 系统 SHALL 覆盖 `isServerSetup`、`setupServer`（正常和重复设置）、`login`（正确密码、错误密码、未设置）、`validateSession`（有效、过期、不存在）、`logout`、`cleanupExpiredSessions` 全部场景
2. WHEN `channel.service.ts` 的所有公开方法被测试 THEN 系统 SHALL 覆盖 `getChannels`、`getChannelById`、`createChannel`（正常和重名）、`deleteChannel`（正常和不存在）全部场景
3. WHEN `message.service.ts` 的所有公开方法被测试 THEN 系统 SHALL 覆盖 `getMessages`（含分页参数）、`createMessage`（正常和频道不存在）、`deleteOldMessages` 全部场景
4. WHEN `mediasoup.service.ts` 的核心功能被测试 THEN 系统 SHALL 覆盖 `initWorker`、`getOrCreateRouter`、`createWebRtcTransport`、`connectTransport`、`produce`、`consume`、`closeProducer`、`closeTransport`、`closeRouter` 的关键路径，使用 mock mediasoup 对象
5. WHEN 任何 Service 测试运行 THEN 系统 SHALL 确保每个测试文件独立运行，不依赖其他测试的执行顺序或副作用

### 需求 4：后端 Controller 与中间件测试

**用户故事：** 作为一名开发者，我希望 API 层有集成测试验证 HTTP 请求/响应的正确性，以便我能确保 API 契约的稳定性。

#### 验收标准

1. WHEN 使用 supertest 测试 auth 相关路由 THEN 系统 SHALL 验证 `/api/auth/setup` GET/POST、`/api/auth/login` POST、`/api/auth/me` GET、`/api/auth/logout` POST 的正确响应状态码和 body 结构
2. WHEN 使用 supertest 测试 channel 相关路由 THEN 系统 SHALL 验证 CRUD 操作的正确响应
3. WHEN 使用 supertest 测试 message 相关路由 THEN 系统 SHALL 验证消息获取和创建的正确响应
4. WHEN `authenticate` 中间件处理缺少/无效/过期 token THEN 系统 SHALL 返回 401 状态码和标准错误格式
5. WHEN 请求触发未处理异常 THEN 系统 SHALL 通过全局错误处理中间件返回 500 状态码和标准错误格式，而非崩溃

### 需求 5：后端代码质量修复

**用户故事：** 作为一名开发者，我希望后端代码干净、一致且无死代码，以便降低维护成本和认知负担。

#### 验收标准

1. WHEN 项目编译 THEN 系统 SHALL 不包含未使用的死代码文件（`crypto.ts` 中未被使用的函数应删除或重新利用）
2. WHEN 项目中存在 `AppError` 类 THEN 系统 SHALL 要么在全局错误处理中间件中使用它，要么将其删除
3. WHEN Controller 处理错误 THEN 系统 SHALL 通过全局错误处理中间件统一处理，消除 Controller 中重复的 try-catch 模板代码
4. WHEN `validate.middleware.ts` 存在 THEN 系统 SHALL 将其应用到需要请求体验证的路由上，或删除该文件
5. WHEN README 描述技术栈 THEN 系统 SHALL 与实际实现一致（将 PostgreSQL 描述更正为 SQLite，或按需迁移数据库）

### 需求 6：前端测试基础设施搭建

**用户故事：** 作为一名开发者，我希望前端项目具备测试框架和工具链，以便我能编写组件测试和逻辑测试。

#### 验收标准

1. WHEN 开发者运行 `npm test` THEN 系统 SHALL 使用 Vitest + React Testing Library 执行所有前端测试
2. WHEN 测试 React 组件 THEN 系统 SHALL 提供 jsdom 环境和标准化的 render 工具
3. WHEN 测试需要 mock API 调用 THEN 系统 SHALL 提供 MSW (Mock Service Worker) 或等效的 API mock 方案
4. IF `client/package.json` 缺少测试相关依赖 THEN 系统 SHALL 添加 vitest、@testing-library/react、@testing-library/jest-dom、@testing-library/user-event、jsdom 等开发依赖

### 需求 7：前端架构重构——组件拆分与 Hooks 抽取

**用户故事：** 作为一名开发者，我希望前端组件遵循单一职责原则，以便每个组件可以独立测试和维护。

#### 验收标准

1. WHEN `MainLayout.tsx` 被重构 THEN 系统 SHALL 将其拆分为：`ChannelSidebar`（频道列表和管理）、`MessageArea`（消息展示和输入）、`CreateChannelModal`（创建频道弹窗）等独立组件
2. WHEN Socket.io 连接管理分散在组件中 THEN 系统 SHALL 将其抽取为 `useSocket` 自定义 Hook
3. WHEN 消息相关逻辑分散在组件中 THEN 系统 SHALL 将其抽取为 `useMessages` 自定义 Hook（或使用 react-query）
4. WHEN 频道相关逻辑分散在组件中 THEN 系统 SHALL 将其抽取为 `useChannels` 自定义 Hook（或使用 react-query）
5. WHEN 项目已安装 `@tanstack/react-query` THEN 系统 SHALL 将数据获取逻辑迁移到 react-query，替代组件 useEffect 中的手动获取
6. WHEN 重构完成 THEN 系统 SHALL 确保所有拆分后的组件和 Hook 都有对应的单元测试

### 需求 8：前端 Store 和 Service 测试

**用户故事：** 作为一名开发者，我希望前端状态管理和服务层有测试覆盖，以便确保核心数据流逻辑正确。

#### 验收标准

1. WHEN `auth-store.ts` 被测试 THEN 系统 SHALL 覆盖 `checkSetup`、`setup`、`login`、`logout`、`clearError`、hydration 逻辑
2. WHEN `api-client.ts` 被测试 THEN 系统 SHALL 验证 token 自动附加、401 自动跳转等拦截器行为
3. WHEN `auth-api.ts`、`channel-api.ts`、`message-api.ts` 被测试 THEN 系统 SHALL 验证 API 调用的请求参数和响应解析正确性
4. WHEN `VoiceService` 类被测试 THEN 系统 SHALL 覆盖 `joinChannel`、`leaveChannel`、`toggleMute`、`toggleDeafen` 等关键方法（mock 底层 MediaStream 和 mediasoup-client）

### 需求 9：CI/CD 流水线更新

**用户故事：** 作为一名开发者，我希望 CI 流水线在每次提交时自动运行全部测试，以便我能及时发现回归问题。

#### 验收标准

1. WHEN CI 流水线执行 THEN 系统 SHALL 在 lint 和 build 之后运行 `npm test`，测试失败则阻断流水线
2. WHEN 后端 CI job 运行 THEN 系统 SHALL 执行 server 目录下的全部测试并生成覆盖率报告
3. WHEN 前端 CI job 运行 THEN 系统 SHALL 执行 client 目录下的全部测试并生成覆盖率报告
4. IF 测试覆盖率低于设定阈值（建议初期 60%） THEN 系统 SHALL 在 CI 中发出警告（可选阻断）

### 需求 10：文档与配置同步

**用户故事：** 作为一名开发者，我希望项目文档与实际代码保持一致，以便新成员能快速理解和上手项目。

#### 验收标准

1. WHEN README 描述数据库 THEN 系统 SHALL 如实反映使用 SQLite（与 `schema.prisma` 一致）
2. WHEN README 描述开发命令 THEN 系统 SHALL 包含 `npm test`、`npm run test:watch` 等测试相关命令
3. WHEN 项目有 `.env.example` THEN 系统 SHALL 包含所有必要的环境变量示例及说明
4. WHEN tsconfig 中定义了路径别名（如 `@/*`）THEN 系统 SHALL 确保代码中实际使用了这些别名，或移除未使用的别名配置
