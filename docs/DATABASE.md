# My-Speak 数据库设计文档

## 1. 数据库概述

### 1.1 数据库选型
- **主数据库**: PostgreSQL 15
- **缓存/会话**: Redis 7
- **文件存储**: 本地文件系统 / MinIO (未来扩展)

### 1.2 设计原则
- 使用 UUID 作为主键 (v4)
- 所有表包含 `created_at` 和 `updated_at` 时间戳
- 使用外键约束保证数据完整性
- 软删除暂不实现，使用级联删除
- 适当的索引优化查询性能

---

## 2. PostgreSQL 数据库设计

### 2.1 数据库架构

```sql
-- 创建数据库
CREATE DATABASE myspeak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建Schema
CREATE SCHEMA IF NOT EXISTS myspeak;
SET search_path TO myspeak;

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2.2 表结构定义

#### 2.2.1 用户表 (users)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT chk_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,32}$'),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 注释
COMMENT ON TABLE users IS '用户基础信息表';
COMMENT ON COLUMN users.username IS '用户名，唯一，3-32字符，只允许字母数字下划线';
COMMENT ON COLUMN users.email IS '邮箱地址，唯一';
COMMENT ON COLUMN users.password_hash IS 'bcrypt加密后的密码';
COMMENT ON COLUMN users.display_name IS '显示名称，用于展示';
COMMENT ON COLUMN users.avatar_url IS '头像URL';
COMMENT ON COLUMN users.is_active IS '账号是否激活';
COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
```

#### 2.2.2 服务器表 (servers)

```sql
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT fk_servers_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_server_name CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100)
);

-- 索引
CREATE INDEX idx_servers_owner ON servers(owner_id);
CREATE INDEX idx_servers_created_at ON servers(created_at);

-- 注释
COMMENT ON TABLE servers IS '服务器/社区表';
COMMENT ON COLUMN servers.name IS '服务器名称，1-100字符';
COMMENT ON COLUMN servers.description IS '服务器描述，最多500字符';
COMMENT ON COLUMN servers.owner_id IS '服务器所有者用户ID';
COMMENT ON COLUMN servers.icon_url IS '服务器图标URL';
```

#### 2.2.3 服务器成员表 (server_members)

```sql
CREATE TABLE server_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT fk_sm_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_sm_server_user UNIQUE (server_id, user_id),
    CONSTRAINT chk_sm_role CHECK (role IN ('owner', 'admin', 'member'))
);

-- 索引
CREATE INDEX idx_sm_server ON server_members(server_id);
CREATE INDEX idx_sm_user ON server_members(user_id);
CREATE INDEX idx_sm_joined_at ON server_members(joined_at);

-- 注释
COMMENT ON TABLE server_members IS '服务器成员关系表';
COMMENT ON COLUMN server_members.role IS '角色: owner(所有者), admin(管理员), member(成员)';
```

#### 2.2.4 频道表 (channels)

```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'text',
    position INTEGER DEFAULT 0,
    -- 语音频道特有字段
    bitrate INTEGER DEFAULT 64000,
    user_limit INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT fk_channels_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    CONSTRAINT chk_channels_name CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100),
    CONSTRAINT chk_channels_type CHECK (type IN ('text', 'voice')),
    CONSTRAINT chk_channels_bitrate CHECK (bitrate >= 16000 AND bitrate <= 128000),
    CONSTRAINT chk_channels_user_limit CHECK (user_limit >= 1 AND user_limit <= 20)
);

-- 索引
CREATE INDEX idx_channels_server ON channels(server_id);
CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_position ON channels(server_id, position);

-- 注释
COMMENT ON TABLE channels IS '频道表，支持文字和语音频道';
COMMENT ON COLUMN channels.type IS '频道类型: text(文字), voice(语音)';
COMMENT ON COLUMN channels.bitrate IS '语音频道比特率(bps)，默认64000，范围16000-128000';
COMMENT ON COLUMN channels.user_limit IS '语音频道用户限制，默认20，范围1-20';
COMMENT ON COLUMN channels.position IS '频道排序位置';
```

#### 2.2.5 消息表 (messages)

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL,
    author_id UUID,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT fk_messages_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_messages_content CHECK (LENGTH(TRIM(content)) >= 1 AND LENGTH(content) <= 2000)
);

-- 索引
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_author ON messages(author_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);

-- 注释
COMMENT ON TABLE messages IS '文字频道消息表';
COMMENT ON COLUMN messages.content IS '消息内容，1-2000字符';
COMMENT ON COLUMN messages.author_id IS '发送者ID，用户删除时设为NULL';
```

#### 2.2.6 邀请码表 (invites)

```sql
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL,
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    
    -- 约束
    CONSTRAINT fk_invites_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_invites_code UNIQUE (code),
    CONSTRAINT chk_invites_max_uses CHECK (max_uses >= 1 AND max_uses <= 100),
    CONSTRAINT chk_invites_used_count CHECK (used_count <= max_uses),
    CONSTRAINT chk_invites_code_format CHECK (code ~ '^[A-Z0-9]{8}$')
);

-- 索引
CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_server ON invites(server_id);
CREATE INDEX idx_invites_expires ON invites(expires_at);
CREATE INDEX idx_invites_active ON invites(server_id, revoked_at, expires_at) 
    WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

-- 注释
COMMENT ON TABLE invites IS '一次性邀请码表';
COMMENT ON COLUMN invites.code IS '8位邀请码，大写字母和数字';
COMMENT ON COLUMN invites.max_uses IS '最大使用次数，默认1，范围1-100';
COMMENT ON COLUMN invites.used_count IS '已使用次数';
COMMENT ON COLUMN invites.expires_at IS '过期时间，NULL表示永不过期';
COMMENT ON COLUMN invites.revoked_at IS '撤销时间，NULL表示未撤销';
```

### 2.3 视图定义

#### 2.3.1 用户服务器列表视图

```sql
CREATE VIEW user_servers AS
SELECT 
    u.id AS user_id,
    s.id AS server_id,
    s.name AS server_name,
    s.description,
    s.icon_url,
    sm.role,
    sm.joined_at,
    (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) AS member_count
FROM users u
JOIN server_members sm ON u.id = sm.user_id
JOIN servers s ON sm.server_id = s.id
WHERE s.is_active = TRUE;

COMMENT ON VIEW user_servers IS '用户加入的服务器列表视图';
```

#### 2.3.2 频道成员统计视图

```sql
CREATE VIEW channel_stats AS
SELECT 
    c.id AS channel_id,
    c.name AS channel_name,
    c.type,
    c.server_id,
    CASE 
        WHEN c.type = 'text' THEN (SELECT COUNT(*) FROM messages WHERE channel_id = c.id)
        ELSE NULL 
    END AS message_count,
    c.created_at
FROM channels c;

COMMENT ON VIEW channel_stats IS '频道统计信息视图';
```

### 2.4 函数和触发器

#### 2.4.1 自动更新 updated_at

```sql
-- 创建更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加触发器
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at 
    BEFORE UPDATE ON servers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at 
    BEFORE UPDATE ON channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.4.2 邀请码验证函数

```sql
-- 验证邀请码是否有效
CREATE OR REPLACE FUNCTION is_invite_valid(invite_code VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_invite RECORD;
BEGIN
    SELECT * INTO v_invite FROM invites WHERE code = invite_code;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 检查是否已撤销
    IF v_invite.revoked_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 检查是否过期
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= CURRENT_TIMESTAMP THEN
        RETURN FALSE;
    END IF;
    
    -- 检查使用次数
    IF v_invite.used_count >= v_invite.max_uses THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_invite_valid IS '验证邀请码是否有效';
```

#### 2.4.3 使用邀请码函数

```sql
-- 使用邀请码，自动增加使用次数
CREATE OR REPLACE FUNCTION use_invite(invite_code VARCHAR, user_uuid UUID)
RETURNS TABLE (
    server_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_invite RECORD;
BEGIN
    -- 获取邀请码信息
    SELECT * INTO v_invite FROM invites WHERE code = invite_code;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, '邀请码不存在'::TEXT;
        RETURN;
    END IF;
    
    -- 验证有效性
    IF NOT is_invite_valid(invite_code) THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, '邀请码已失效'::TEXT;
        RETURN;
    END IF;
    
    -- 检查是否已是成员
    IF EXISTS (
        SELECT 1 FROM server_members 
        WHERE server_id = v_invite.server_id AND user_id = user_uuid
    ) THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, '您已是该服务器成员'::TEXT;
        RETURN;
    END IF;
    
    -- 增加使用次数
    UPDATE invites 
    SET used_count = used_count + 1 
    WHERE code = invite_code;
    
    RETURN QUERY SELECT v_invite.server_id, TRUE, '使用成功'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION use_invite IS '使用邀请码加入服务器';
```

### 2.5 初始化数据

```sql
-- 创建默认系统用户（用于系统消息）
INSERT INTO users (id, username, email, password_hash, display_name)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'system@my-speak.local',
    '$2b$12$...', -- 无效密码hash
    '系统'
);
```

---

## 3. Redis 数据设计

### 3.1 Key 命名规范

采用 `命名空间:对象类型:标识符[:子标识符]` 格式，使用冒号分隔。

### 3.2 数据结构定义

#### 3.2.1 用户会话

```
Key: sessions:{userId}
Type: Hash
TTL: 7天（与Refresh Token一致）
Fields:
  - socketId: string    // Socket连接ID
  - serverId: string?   // 当前所在服务器ID，可为null
  - channelId: string?  // 当前所在频道ID，可为null
  - joinedAt: number    // 加入时间戳（毫秒）
  - lastActiveAt: number // 最后活跃时间戳

示例:
HSET sessions:uuid socketId "socket123" serverId "server456" joinedAt "1704067200000"
```

#### 3.2.2 服务器在线成员

```
Key: server:{serverId}:online
Type: Set
Members: userId1, userId2, ...
TTL: 无（由会话TTL控制）

示例:
SADD server:server456:online user1 user2 user3
```

#### 3.2.3 频道成员（语音频道）

```
Key: channel:{channelId}:members
Type: Set
Members: userId1, userId2, ...
TTL: 无

示例:
SADD channel:channel789:members user1 user2
```

#### 3.2.4 WebRTC传输状态

```
Key: webrtc:{userId}:producer
Type: String
Value: producerId
TTL: 1小时

Key: webrtc:{userId}:consumers
Type: Set
Members: consumerId1, consumerId2, ...
TTL: 1小时

示例:
SET webrtc:user1:producer "producer123"
SADD webrtc:user1:consumers "consumer1" "consumer2"
```

#### 3.2.5 Token黑名单

```
Key: token:blacklist:{jti}
Type: String
Value: expiration_timestamp
TTL: Token剩余有效期

示例:
SET token:blacklist:abc123 "1704153600"
EXPIRE token:blacklist:abc123 86400
```

#### 3.2.6 API限流计数器

```
Key: rate_limit:{ip}:{route}
Type: String
Value: count
TTL: 时间窗口（如1分钟）

示例:
SET rate_limit:192.168.1.1:/api/auth/login 1
EXPIRE rate_limit:192.168.1.1:/api/auth/login 300
```

#### 3.2.7 消息缓存（可选）

```
Key: messages:channel:{channelId}
Type: List
Value: JSON字符串数组（最近N条消息）
TTL: 1小时
Max Length: 100

示例:
LPUSH messages:channel:channel789 '{"id":"...","content":"Hello"}'
LTRIM messages:channel:channel789 0 99
```

### 3.3 Redis 使用模式

#### 3.3.1 用户上线流程

```redis
-- 1. 设置用户会话
HSET sessions:user123 socketId "socket456" serverId "server789" joinedAt "1704067200000"
EXPIRE sessions:user123 604800  -- 7天

-- 2. 添加到服务器在线集合
SADD server:server789:online user123

-- 3. 发布上线通知（Pub/Sub）
PUBLISH server:server789:user-online '{"userId":"user123","timestamp":"..."}'
```

#### 3.3.2 用户下线流程

```redis
-- 1. 从服务器在线集合移除
SREM server:server789:online user123

-- 2. 清理频道成员（如果在语音频道）
SREM channel:channel999:members user123

-- 3. 清理WebRTC状态
DEL webrtc:user123:producer
DEL webrtc:user123:consumers

-- 4. 删除用户会话
DEL sessions:user123

-- 5. 发布下线通知
PUBLISH server:server789:user-offline '{"userId":"user123","timestamp":"..."}'
```

#### 3.3.3 加入语音频道

```redis
-- 1. 更新用户会话
HSET sessions:user123 channelId "channel999"

-- 2. 添加到频道成员集合
SADD channel:channel999:members user123

-- 3. 更新最后活跃时间
HSET sessions:user123 lastActiveAt "1704067260000"
```

---

## 4. Prisma Schema 定义

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户模型
model User {
  id            String    @id @default(uuid()) @db.Uuid
  username      String    @unique @db.VarChar(32)
  email         String    @unique @db.VarChar(255)
  passwordHash  String    @map("password_hash") @db.VarChar(255)
  displayName   String?   @map("display_name") @db.VarChar(64)
  avatarUrl     String?   @map("avatar_url") @db.VarChar(500)
  isActive      Boolean   @default(true) @map("is_active")
  lastLoginAt   DateTime? @map("last_login_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // 关系
  ownedServers   Server[]
  memberships    ServerMember[]
  messages       Message[]
  createdInvites Invite[]

  @@map("users")
}

// 服务器模型
model Server {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @db.VarChar(100)
  description String?   @db.Text
  ownerId     String    @map("owner_id") @db.Uuid
  iconUrl     String?   @map("icon_url") @db.VarChar(500)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // 关系
  owner      User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  members    ServerMember[]
  channels   Channel[]
  invites    Invite[]

  @@map("servers")
}

// 服务器成员模型
model ServerMember {
  id        String   @id @default(uuid()) @db.Uuid
  serverId  String   @map("server_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  role      String   @default("member") @db.VarChar(20)
  joinedAt  DateTime @default(now()) @map("joined_at")

  // 关系
  server Server @relation(fields: [serverId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([serverId, userId])
  @@map("server_members")
}

// 频道模型
model Channel {
  id         String   @id @default(uuid()) @db.Uuid
  serverId   String   @map("server_id") @db.Uuid
  name       String   @db.VarChar(100)
  type       String   @default("text") @db.VarChar(20)
  position   Int      @default(0)
  bitrate    Int?     // 仅语音频道
  userLimit  Int?     @map("user_limit") // 仅语音频道
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  // 关系
  server   Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  messages Message[]

  @@map("channels")
}

// 消息模型
model Message {
  id        String    @id @default(uuid()) @db.Uuid
  channelId String    @map("channel_id") @db.Uuid
  authorId  String?   @map("author_id") @db.Uuid
  content   String    @db.Text
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  // 关系
  channel Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  author  User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@index([channelId, createdAt])
  @@map("messages")
}

// 邀请码模型
model Invite {
  id         String    @id @default(uuid()) @db.Uuid
  serverId   String    @map("server_id") @db.Uuid
  code       String    @unique @db.VarChar(20)
  createdBy  String    @map("created_by") @db.Uuid
  maxUses    Int       @default(1) @map("max_uses")
  usedCount  Int       @default(0) @map("used_count")
  expiresAt  DateTime? @map("expires_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  revokedAt  DateTime? @map("revoked_at")

  // 关系
  server    Server @relation(fields: [serverId], references: [id], onDelete: Cascade)
  creator   User   @relation(fields: [createdBy], references: [id], onDelete: Cascade)

  @@index([code])
  @@index([serverId])
  @@map("invites")
}
```

---

## 5. 数据库迁移策略

### 5.1 开发环境迁移

```bash
# 创建迁移
npx prisma migrate dev --name init

# 重置数据库
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status
```

### 5.2 生产环境迁移

```bash
# 部署迁移（不重置数据）
npx prisma migrate deploy

# 验证迁移
npx prisma migrate status

# 生成客户端
npx prisma generate
```

### 5.3 数据备份策略

```bash
# 手动备份
pg_dump -h localhost -U postgres -d myspeak > backup_$(date +%Y%m%d).sql

# 自动备份（cron job）
0 2 * * * pg_dump -h localhost -U postgres -d myspeak | gzip > /backups/myspeak_$(date +\%Y\%m\%d).sql.gz
```

---

## 6. 性能优化

### 6.1 索引策略

```sql
-- 高频查询索引
-- 1. 用户登录（email查询）
CREATE INDEX CONCURRENTLY idx_users_email_lower ON users(LOWER(email));

-- 2. 服务器成员列表（server_id查询）
CREATE INDEX CONCURRENTLY idx_sm_server_joined ON server_members(server_id, joined_at DESC);

-- 3. 频道消息（分页查询）
CREATE INDEX CONCURRENTLY idx_messages_channel_pagination 
ON messages(channel_id, created_at DESC, id);

-- 4. 在线成员（server_id + user_id联合查询）
CREATE INDEX CONCURRENTLY idx_sm_server_user_lookup 
ON server_members(server_id, user_id) INCLUDE (role, joined_at);
```

### 6.2 查询优化

```sql
-- 获取用户服务器列表（使用视图）
SELECT * FROM user_servers WHERE user_id = 'uuid';

-- 获取频道消息（分页）
SELECT m.*, u.username, u.display_name, u.avatar_url
FROM messages m
LEFT JOIN users u ON m.author_id = u.id
WHERE m.channel_id = 'uuid'
  AND m.created_at < '2024-01-01T00:00:00Z'
ORDER BY m.created_at DESC
LIMIT 50;

-- 获取服务器在线成员
SELECT u.id, u.username, u.display_name, u.avatar_url, sm.role
FROM users u
JOIN server_members sm ON u.id = sm.user_id
WHERE sm.server_id = 'uuid'
  AND u.id IN (SELECT value FROM redis.server:{serverId}:online);
```

---

## 7. 数据安全

### 7.1 敏感数据加密

```sql
-- 密码使用bcrypt（应用层处理）
-- 邮箱地址可加密存储（可选）
-- 使用SSL/TLS连接数据库
```

### 7.2 访问控制

```sql
-- 创建应用专用用户
CREATE USER myspeak_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE myspeak TO myspeak_app;
GRANT USAGE ON SCHEMA myspeak TO myspeak_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA myspeak TO myspeak_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA myspeak TO myspeak_app;
```

### 7.3 审计日志（可选）

```sql
-- 创建审计表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审计触发器示例
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

## 文档历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | - | 初始版本 |

---

**文档结束**
