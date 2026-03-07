# My-Speak API接口文档

## 1. 概述

### 1.1 接口协议
- **REST API**: HTTP/HTTPS，JSON格式
- **实时通信**: WebSocket (Socket.io)
- **认证方式**: JWT Bearer Token
- **字符编码**: UTF-8

### 1.2 基础URL
```
开发环境: http://localhost:3001/api
生产环境: https://api.my-speak.com/api
```

### 1.3 通用响应格式

**成功响应:**
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  }
}
```

### 1.4 HTTP状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 成功但无返回内容 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或Token无效 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复）|
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |

### 1.5 错误码定义

| 错误码 | 说明 | HTTP状态 |
|--------|------|----------|
| AUTH_INVALID_CREDENTIALS | 用户名或密码错误 | 401 |
| AUTH_TOKEN_EXPIRED | Token已过期 | 401 |
| AUTH_TOKEN_INVALID | Token无效 | 401 |
| AUTH_UNAUTHORIZED | 未提供Token | 401 |
| USER_NOT_FOUND | 用户不存在 | 404 |
| USER_ALREADY_EXISTS | 用户已存在 | 409 |
| SERVER_NOT_FOUND | 服务器不存在 | 404 |
| SERVER_ALREADY_MEMBER | 已是服务器成员 | 409 |
| CHANNEL_NOT_FOUND | 频道不存在 | 404 |
| CHANNEL_FULL | 频道已满 | 403 |
| INVITE_INVALID | 邀请码无效 | 400 |
| INVITE_EXPIRED | 邀请码已过期 | 400 |
| INVITE_USED_UP | 邀请码使用次数已达上限 | 400 |
| PERMISSION_DENIED | 权限不足 | 403 |
| VALIDATION_ERROR | 参数验证失败 | 400 |
| RATE_LIMITED | 请求过于频繁 | 429 |

---

## 2. 认证接口

### 2.1 用户注册

**POST** `/auth/register`

**请求体:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "displayName": "John Doe"
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| username | string | 是 | 3-32字符，仅允许a-zA-Z0-9_ |
| email | string | 是 | 有效邮箱格式 |
| password | string | 是 | 8-128字符，需含大小写字母和数字 |
| displayName | string | 否 | 1-64字符 |

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatarUrl": null,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  },
  "message": "注册成功"
}
```

**错误响应:**
- 400: 参数验证失败
- 409: 用户名或邮箱已存在

---

### 2.2 用户登录

**POST** `/auth/login`

**请求体:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "rememberMe": false
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 注册邮箱 |
| password | string | 是 | 密码 |
| rememberMe | boolean | 否 | 延长Token有效期至30天，默认false |

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "avatarUrl": "https://..."
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  },
  "message": "登录成功"
}
```

**错误响应:**
- 401: 邮箱或密码错误
- 429: 登录尝试次数过多，请15分钟后重试

---

### 2.3 Token刷新

**POST** `/auth/refresh`

**请求头:**
```
Authorization: Bearer {refreshToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**错误响应:**
- 401: Refresh Token无效或过期

---

### 2.4 用户登出

**POST** `/auth/logout`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "message": "登出成功"
}
```

**说明:** 会将Token加入黑名单，使其失效

---

### 2.5 获取当前用户

**GET** `/auth/me`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "avatarUrl": "https://...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 3. 用户接口

### 3.1 获取用户信息

**GET** `/users/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "displayName": "John Doe",
    "avatarUrl": "https://...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 3.2 更新用户信息

**PATCH** `/users/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "displayName": "New Name",
  "avatarUrl": "https://..."
}
```

**说明:** 只能更新自己的信息（id必须匹配当前用户）

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "displayName": "New Name",
    "avatarUrl": "https://...",
    "updatedAt": "2024-01-02T00:00:00Z"
  }
}
```

---

### 3.3 修改密码

**POST** `/users/:id/change-password`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| currentPassword | string | 是 | 当前密码 |
| newPassword | string | 是 | 8-128字符，需含大小写字母和数字，不能与旧密码相同 |

**成功响应 (200):**
```json
{
  "success": true,
  "message": "密码修改成功，请重新登录"
}
```

**错误响应:**
- 400: 新密码与旧密码相同
- 401: 当前密码错误

---

### 3.4 上传头像

**POST** `/users/:id/avatar`

**请求头:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**请求体:**
```
file: <二进制文件>
```

**文件限制:**
- 格式: JPG, PNG
- 大小: 最大 5MB
- 尺寸: 建议 256x256 像素

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://api.my-speak.com/uploads/avatars/uuid.jpg"
  }
}
```

---

## 4. 服务器接口

### 4.1 获取用户的服务器列表

**GET** `/servers`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20，最大50 |

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "uuid",
        "name": "My Gaming Server",
        "description": "A place for gamers",
        "iconUrl": "https://...",
        "ownerId": "uuid",
        "role": "owner",
        "memberCount": 15,
        "joinedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### 4.2 创建服务器

**POST** `/servers`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "name": "My Gaming Server",
  "description": "A place for gamers",
  "iconUrl": "https://..."
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| name | string | 是 | 1-100字符 |
| description | string | 否 | 最多500字符 |
| iconUrl | string | 否 | URL格式，自动创建general文字频道和General语音频道 |

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Gaming Server",
    "description": "A place for gamers",
    "iconUrl": "https://...",
    "ownerId": "current-user-uuid",
    "createdAt": "2024-01-01T00:00:00Z",
    "defaultChannels": {
      "text": { "id": "uuid", "name": "general" },
      "voice": { "id": "uuid", "name": "General" }
    }
  },
  "message": "服务器创建成功"
}
```

---

### 4.3 获取服务器详情

**GET** `/servers/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Gaming Server",
    "description": "A place for gamers",
    "iconUrl": "https://...",
    "ownerId": "uuid",
    "createdAt": "2024-01-01T00:00:00Z",
    "myRole": "owner",
    "memberCount": 15,
    "onlineCount": 8
  }
}
```

---

### 4.4 更新服务器信息

**PATCH** `/servers/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "name": "Updated Server Name",
  "description": "New description",
  "iconUrl": "https://..."
}
```

**权限:** 仅Owner可修改

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Server Name",
    "description": "New description",
    "iconUrl": "https://...",
    "updatedAt": "2024-01-02T00:00:00Z"
  }
}
```

---

### 4.5 删除服务器

**DELETE** `/servers/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:** 仅Owner可删除

**成功响应 (204):**
```
(No Content)
```

**说明:** 级联删除所有频道、消息、邀请码

---

### 4.6 离开服务器

**POST** `/servers/:id/leave`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:** Member和Admin可离开，Owner不能离开

**成功响应 (200):**
```json
{
  "success": true,
  "message": "已离开服务器"
}
```

---

### 4.7 转让服务器所有权

**POST** `/servers/:id/transfer-ownership`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "newOwnerId": "uuid"
}
```

**权限:** 仅Owner可操作

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "newOwnerId": "uuid"
  },
  "message": "所有权转让成功"
}
```

---

## 5. 服务器成员接口

### 5.1 获取服务器成员列表

**GET** `/servers/:id/members`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认50，最大100 |

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "user": {
          "id": "uuid",
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "https://..."
        },
        "role": "owner",
        "joinedAt": "2024-01-01T00:00:00Z",
        "isOnline": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

---

### 5.2 更新成员角色

**PATCH** `/servers/:id/members/:userId`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "role": "admin"
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| role | string | 是 | 可选值: admin, member |

**权限:**
- Owner可将Member提升为Admin，或将Admin降为Member
- Admin只能移除Member
- 不能修改Owner的角色

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "role": "admin"
  }
}
```

---

### 5.3 移除成员

**DELETE** `/servers/:id/members/:userId`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:**
- Owner可移除Admin和Member
- Admin只能移除Member
- 不能移除Owner

**成功响应 (200):**
```json
{
  "success": true,
  "message": "成员已移除"
}
```

---

## 6. 频道接口

### 6.1 获取频道列表

**GET** `/servers/:id/channels`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "textChannels": [
      {
        "id": "uuid",
        "name": "general",
        "type": "text",
        "position": 0,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "voiceChannels": [
      {
        "id": "uuid",
        "name": "General",
        "type": "voice",
        "position": 0,
        "bitrate": 64000,
        "userLimit": 20,
        "memberCount": 5,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

### 6.2 创建频道

**POST** `/servers/:id/channels`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "name": "Gaming Chat",
  "type": "voice",
  "bitrate": 64000,
  "userLimit": 20
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 1-100字符 |
| type | string | 是 | text或voice |
| bitrate | number | 否 | 语音频道比特率，默认64000，范围16000-128000 |
| userLimit | number | 否 | 语音频道用户限制，默认20，范围1-20 |

**权限:** Owner/Admin

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "serverId": "uuid",
    "name": "Gaming Chat",
    "type": "voice",
    "position": 2,
    "bitrate": 64000,
    "userLimit": 20,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 6.3 更新频道

**PATCH** `/channels/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "name": "Updated Name",
  "position": 1,
  "bitrate": 96000,
  "userLimit": 15
}
```

**权限:** Owner/Admin

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Name",
    "position": 1,
    "bitrate": 96000,
    "userLimit": 15,
    "updatedAt": "2024-01-02T00:00:00Z"
  }
}
```

---

### 6.4 删除频道

**DELETE** `/channels/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:** Owner/Admin

**成功响应 (204):**
```
(No Content)
```

---

## 7. 邀请码接口

### 7.1 创建邀请码

**POST** `/servers/:id/invites`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "maxUses": 1,
  "expiresInHours": 24
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| maxUses | number | 否 | 最大使用次数，默认1，范围1-100 |
| expiresInHours | number | 否 | 过期时间（小时），默认24，最大168（7天） |

**权限:** Owner/Admin

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "A1B2C3D4",
    "serverId": "uuid",
    "maxUses": 1,
    "usedCount": 0,
    "expiresAt": "2024-01-02T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "uuid"
  }
}
```

---

### 7.2 获取邀请码列表

**GET** `/servers/:id/invites`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| active | boolean | 否 | 仅显示有效邀请码，默认true |

**权限:** Owner/Admin

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "invites": [
      {
        "id": "uuid",
        "code": "A1B2C3D4",
        "maxUses": 5,
        "usedCount": 2,
        "expiresAt": "2024-01-02T00:00:00Z",
        "isValid": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": {
          "id": "uuid",
          "username": "johndoe",
          "displayName": "John Doe"
        }
      }
    ]
  }
}
```

---

### 7.3 撤销邀请码

**DELETE** `/invites/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:** Owner/Admin（只能撤销自己服务器的邀请码）

**成功响应 (200):**
```json
{
  "success": true,
  "message": "邀请码已撤销"
}
```

---

### 7.4 使用邀请码加入服务器

**POST** `/invites/use`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "code": "A1B2C3D4"
}
```

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "server": {
      "id": "uuid",
      "name": "My Gaming Server",
      "iconUrl": "https://..."
    },
    "role": "member"
  },
  "message": "成功加入服务器"
}
```

**错误响应:**
- 400: 邀请码无效、已过期或已达使用上限
- 409: 已是服务器成员

---

## 8. 消息接口

### 8.1 获取消息列表

**GET** `/channels/:id/messages`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| before | string | 否 | 消息ID，获取该消息之前的消息（用于向上翻页） |
| after | string | 否 | 消息ID，获取该消息之后的消息（用于实时更新） |
| limit | number | 否 | 每页数量，默认50，最大100 |

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "channelId": "uuid",
        "author": {
          "id": "uuid",
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "https://..."
        },
        "content": "Hello everyone!",
        "createdAt": "2024-01-01T12:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "hasMore": true
    }
  }
}
```

**注意:** 消息按时间倒序返回（最新的在前）

---

### 8.2 发送消息

**POST** `/channels/:id/messages`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "content": "Hello everyone!"
}
```

**字段说明:**
| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| content | string | 是 | 1-2000字符，不允许纯空白 |

**成功响应 (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "channelId": "uuid",
    "author": {
      "id": "uuid",
      "username": "johndoe",
      "displayName": "John Doe",
      "avatarUrl": "https://..."
    },
    "content": "Hello everyone!",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

**说明:** 实际推荐使用Socket.io实时发送消息，此API用于非实时场景或重试

---

### 8.3 编辑消息

**PATCH** `/messages/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**请求体:**
```json
{
  "content": "Updated message content"
}
```

**权限:** 只能编辑自己的消息

**成功响应 (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "Updated message content",
    "updatedAt": "2024-01-01T12:05:00Z"
  }
}
```

---

### 8.4 删除消息

**DELETE** `/messages/:id`

**请求头:**
```
Authorization: Bearer {accessToken}
```

**权限:** 可删除自己的消息，Owner/Admin可删除任何消息

**成功响应 (204):**
```
(No Content)
```

---

## 9. Socket.io 实时事件

### 9.1 连接认证

**连接时:**
```javascript
const socket = io('wss://api.my-speak.com', {
  auth: {
    token: 'Bearer {accessToken}'
  }
});
```

**认证失败事件:**
```javascript
socket.on('connect_error', (error) => {
  // error.message: "Authentication failed"
});
```

---

### 9.2 服务器事件

#### 9.2.1 加入服务器
**发送:**
```javascript
socket.emit('server:join', { serverId: 'uuid' });
```

**成功响应:**
```javascript
socket.on('server:joined', (data) => {
  // data: { serverId, channels: [...], members: [...] }
});
```

**错误响应:**
```javascript
socket.on('server:error', (error) => {
  // error: { code, message }
});
```

---

#### 9.2.2 离开服务器
**发送:**
```javascript
socket.emit('server:leave', { serverId: 'uuid' });
```

---

#### 9.2.3 服务器用户加入通知
```javascript
socket.on('server:user-joined', (data) => {
  // data: { user: { id, username, displayName, avatarUrl }, joinedAt }
});
```

---

#### 9.2.4 服务器用户离开通知
```javascript
socket.on('server:user-left', (data) => {
  // data: { userId }
});
```

---

#### 9.2.5 服务器用户在线状态更新
```javascript
socket.on('server:user-status', (data) => {
  // data: { userId, isOnline }
});
```

---

### 9.3 频道事件

#### 9.3.1 加入文字频道
**发送:**
```javascript
socket.emit('channel:join', { channelId: 'uuid', type: 'text' });
```

**成功响应:**
```javascript
socket.on('channel:joined', (data) => {
  // data: { channelId, type, messages: [...] }
});
```

---

#### 9.3.2 加入语音频道
**发送:**
```javascript
socket.emit('channel:join', { channelId: 'uuid', type: 'voice' });
```

**成功响应:**
```javascript
socket.on('channel:joined', (data) => {
  // data: { 
  //   channelId, 
  //   type: 'voice',
  //   members: [...], // 当前在频道的用户
  //   rtpCapabilities: {...} // mediasoup RTP能力
  // }
});
```

**错误响应:**
```javascript
socket.on('channel:error', (error) => {
  // error: { code: 'CHANNEL_FULL', message: '频道已满' }
});
```

---

#### 9.3.3 离开频道
**发送:**
```javascript
socket.emit('channel:leave', { channelId: 'uuid' });
```

---

#### 9.3.4 语音频道用户加入通知
```javascript
socket.on('channel:user-joined', (data) => {
  // data: { 
  //   userId, 
  //   username, 
  //   displayName,
  //   avatarUrl,
  //   producerId // mediasoup producer ID
  // }
});
```

---

#### 9.3.5 语音频道用户离开通知
```javascript
socket.on('channel:user-left', (data) => {
  // data: { userId }
});
```

---

#### 9.3.6 用户开始说话
```javascript
socket.on('channel:user-speaking', (data) => {
  // data: { userId, speaking: true }
});
```

---

#### 9.3.7 用户停止说话
```javascript
socket.on('channel:user-speaking', (data) => {
  // data: { userId, speaking: false }
});
```

---

#### 9.3.8 用户静音状态变更
```javascript
socket.on('channel:user-muted', (data) => {
  // data: { userId, muted: true/false }
});
```

---

### 9.4 消息事件

#### 9.4.1 发送消息
**发送:**
```javascript
socket.emit('message:send', { 
  channelId: 'uuid',
  content: 'Hello!' 
});
```

**确认响应:**
```javascript
socket.on('message:sent', (data) => {
  // data: { 
  //   tempId, // 客户端临时ID
  //   message: { id, author, content, createdAt }
  // }
});
```

**错误响应:**
```javascript
socket.on('message:error', (error) => {
  // error: { code, message, tempId }
});
```

---

#### 9.4.2 接收新消息
```javascript
socket.on('message:new', (data) => {
  // data: {
  //   id,
  //   channelId,
  //   author: { id, username, displayName, avatarUrl },
  //   content,
  //   createdAt
  // }
});
```

---

#### 9.4.3 消息编辑通知
```javascript
socket.on('message:updated', (data) => {
  // data: { id, content, updatedAt }
});
```

---

#### 9.4.4 消息删除通知
```javascript
socket.on('message:deleted', (data) => {
  // data: { id, channelId }
});
```

---

### 9.5 WebRTC信令事件

#### 9.5.1 创建传输层
**发送:**
```javascript
socket.emit('webrtc:create-transport', { 
  channelId: 'uuid',
  direction: 'send' // 或 'recv'
});
```

**成功响应:**
```javascript
socket.on('webrtc:transport-created', (data) => {
  // data: {
  //   transportId,
  //   iceParameters,
  //   iceCandidates,
  //   dtlsParameters
  // }
});
```

---

#### 9.5.2 连接传输层
**发送:**
```javascript
socket.emit('webrtc:connect-transport', {
  transportId: 'uuid',
  dtlsParameters: { ... }
});
```

**成功响应:**
```javascript
socket.on('webrtc:transport-connected', (data) => {
  // data: { transportId }
});
```

---

#### 9.5.3 创建生产者（发送音频）
**发送:**
```javascript
socket.emit('webrtc:produce', {
  transportId: 'uuid',
  kind: 'audio',
  rtpParameters: { ... }
});
```

**成功响应:**
```javascript
socket.on('webrtc:producer-created', (data) => {
  // data: { producerId }
});
```

---

#### 9.5.4 创建消费者（接收音频）
**发送:**
```javascript
socket.emit('webrtc:consume', {
  transportId: 'uuid',
  producerId: 'uuid',
  rtpCapabilities: { ... }
});
```

**成功响应:**
```javascript
socket.on('webrtc:consumer-created', (data) => {
  // data: {
  //   consumerId,
  //   producerId,
  //   kind: 'audio',
  //   rtpParameters,
  //   producerPaused: false
  // }
});
```

---

#### 9.5.5 恢复消费者
**发送:**
```javascript
socket.emit('webrtc:resume-consumer', {
  consumerId: 'uuid'
});
```

---

#### 9.5.6 关闭生产者
**发送:**
```javascript
socket.emit('webrtc:close-producer', {
  producerId: 'uuid'
});
```

---

#### 9.5.7 关闭消费者
**发送:**
```javascript
socket.emit('webrtc:close-consumer', {
  consumerId: 'uuid'
});
```

---

#### 9.5.8 生产者暂停/恢复
**发送:**
```javascript
socket.emit('webrtc:pause-producer', { producerId: 'uuid' });
socket.emit('webrtc:resume-producer', { producerId: 'uuid' });
```

---

### 9.6 用户状态事件

#### 9.6.1 静音状态变更
**发送:**
```javascript
socket.emit('user:mute', { muted: true });
socket.emit('user:mute', { muted: false });
```

---

#### 9.6.2 免打扰状态变更
**发送:**
```javascript
socket.emit('user:deafen', { deafened: true });
socket.emit('user:deafen', { deafened: false });
```

---

### 9.7 系统事件

#### 9.7.1 连接断开
```javascript
socket.on('disconnect', (reason) => {
  // reason: 'io server disconnect' | 'io client disconnect' | 'transport error' | 'ping timeout' | ...
});
```

---

#### 9.7.2 重新连接
```javascript
socket.on('reconnect', (attemptNumber) => {
  // 自动重连成功
});

socket.on('reconnect_failed', () => {
  // 重连失败
});
```

---

#### 9.7.3 服务器通知
```javascript
socket.on('server:notification', (data) => {
  // data: { type: 'info'|'warning'|'error', message: '...' }
});
```

---

## 10. 数据类型定义

### 10.1 基础类型

```typescript
// 用户
interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string; // ISO 8601
}

// 服务器
interface Server {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
}

// 服务器成员
interface ServerMember {
  user: User;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isOnline: boolean;
}

// 频道
interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
  bitrate?: number; // 仅语音频道
  userLimit?: number; // 仅语音频道
  createdAt: string;
}

// 消息
interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 邀请码
interface Invite {
  id: string;
  code: string;
  serverId: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  createdBy: User;
}

// JWT Token
interface JWTTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}
```

### 10.2 WebRTC类型

```typescript
// RTP能力
interface RtpCapabilities {
  codecs: RtpCodecCapability[];
  headerExtensions: RtpHeaderExtension[];
}

// 传输层参数
interface TransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

// mediasoup Producer
interface Producer {
  id: string;
  kind: 'audio';
  track: MediaStreamTrack;
}

// mediasoup Consumer
interface Consumer {
  id: string;
  producerId: string;
  kind: 'audio';
  track: MediaStreamTrack;
  paused: boolean;
}
```

---

## 文档历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | - | 初始版本 |

---

**文档结束**
