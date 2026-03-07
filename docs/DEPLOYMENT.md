# My-Speak 部署文档

## 1. 部署概述

### 1.1 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTPS (443)
┌─────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  • SSL/TLS 终止                                  │   │
│  │  • 静态资源服务 (React应用)                       │   │
│  │  • API请求转发 (/api/* → Node.js)                │   │
│  │  • WebSocket代理 (/socket.io/* → Node.js)        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────────┐           ┌───────────────────────┐
│    Node.js 后端        │           │   PostgreSQL 15       │
│  ┌─────────────────┐   │           │  ┌─────────────────┐  │
│  │  Express API    │   │◄─────────│  │  用户数据        │  │
│  │  Socket.io      │   │   SQL    │  │  服务器数据      │  │
│  │  mediasoup      │   │          │  │  消息数据        │  │
│  └─────────────────┘   │          │  └─────────────────┘  │
│                        │          └───────────────────────┘
│  ┌─────────────────┐   │                      │
│  │   Redis 7       │◄──┘                      │
│  │  • 会话管理     │                          │
│  │  • 在线状态     │                          │
│  │  • 缓存        │                          │
│  └─────────────────┘                          │
│                                               │
│  ┌─────────────────┐                          │
│  │  本地文件存储    │                          │
│  │  /uploads       │                          │
│  └─────────────────┘                          │
└───────────────────────┘                       │
                                                │
                       ┌────────────────────────┘
                       │ UDP: 10000-10100
                       ▼
              ┌─────────────────┐
              │  mediasoup SFU  │
              │  • 音频流转发    │
              │  • DTLS-SRTP   │
              └─────────────────┘
```

### 1.2 部署要求

**最低配置 (20人并发):**
- CPU: 2核心+
- 内存: 4GB+
- 存储: 20GB SSD
- 带宽: 10Mbps 上行
- 系统: Ubuntu 20.04 LTS / 22.04 LTS

**推荐配置:**
- CPU: 4核心
- 内存: 8GB
- 存储: 50GB SSD
- 带宽: 20Mbps 上行
- 系统: Ubuntu 22.04 LTS

---

## 2. 环境准备

### 2.1 服务器初始化

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装基础工具
sudo apt install -y curl wget git vim htop nginx certbot python3-certbot-nginx

# 3. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 4. 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. 验证安装
docker --version
docker-compose --version
node --version
npm --version
```

### 2.2 域名和DNS配置

```
# DNS记录
Type: A
Name: my-speak.yourdomain.com
Value: 你的服务器IP
TTL: 3600
```

### 2.3 防火墙配置

```bash
# 安装UFW
sudo apt install ufw

# 默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许SSH (修改为你的SSH端口)
sudo ufw allow 22/tcp

# 允许HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许WebRTC UDP端口范围 (mediasoup)
sudo ufw allow 10000:10100/udp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

---

## 3. 生产部署

### 3.1 项目克隆和配置

```bash
# 1. 创建项目目录
mkdir -p /opt/my-speak
cd /opt/my-speak

# 2. 克隆代码 (或使用上传的代码)
git clone https://github.com/yourusername/my-speak.git .
# 或上传代码: scp -r ./my-speak user@server:/opt/

# 3. 创建环境变量文件
cat > .env << 'EOF'
# 数据库
DATABASE_URL="postgresql://myspeak_user:myspeak_password@postgres:5432/myspeak?schema=public"

# Redis
REDIS_URL="redis://redis:6379"

# JWT (使用强密码)
JWT_SECRET="your-super-secret-key-change-this-in-production"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# mediasoup
MEDIASOUP_LISTEN_IP="0.0.0.0"
MEDIASOUP_ANNOUNCED_IP="你的服务器公网IP"
MEDIASOUP_MIN_PORT=10000
MEDIASOUP_MAX_PORT=10100

# 服务器
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://my-speak.yourdomain.com"

# 文件上传
UPLOAD_DIR="/app/uploads"
MAX_FILE_SIZE="5242880"
EOF

# 4. 创建上传目录
mkdir -p uploads/avatars uploads/server-icons
chmod 755 uploads
```

### 3.2 Docker Compose 配置

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: myspeak_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: myspeak_user
      POSTGRES_PASSWORD: myspeak_password
      POSTGRES_DB: myspeak
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/prisma/migrations:/docker-entrypoint-initdb.d
    networks:
      - myspeak_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myspeak_user -d myspeak"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: myspeak_redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - myspeak_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # 后端服务
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile.prod
    container_name: myspeak_backend
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    ports:
      - "3001:3001"
      - "10000-10100:10000-10100/udp"  # WebRTC端口
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - myspeak_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 前端构建 (仅在构建时使用)
  frontend-build:
    build:
      context: ./client
      dockerfile: Dockerfile.build
    volumes:
      - frontend_dist:/app/dist
    networks:
      - myspeak_network
    profiles:
      - build

volumes:
  postgres_data:
  redis_data:
  frontend_dist:

networks:
  myspeak_network:
    driver: bridge
```

### 3.3 Dockerfile 配置

**server/Dockerfile.prod:**

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 编译TypeScript
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache curl

# 复制依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制Prisma文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 创建上传目录
RUN mkdir -p uploads logs

# 暴露端口
EXPOSE 3001 10000-10100/udp

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 启动命令
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && node dist/index.js"]
```

**client/Dockerfile.build:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# 构建生产版本
RUN npm run build

# 保持容器运行以复制dist
CMD ["tail", "-f", "/dev/null"]
```

### 3.4 Nginx 配置

**nginx/my-speak.conf:**

```nginx
upstream backend {
    server localhost:3001;
    keepalive 32;
}

# HTTP -> HTTPS 重定向
server {
    listen 80;
    server_name my-speak.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name my-speak.yourdomain.com;
    
    # SSL 证书 (使用Certbot自动管理)
    ssl_certificate /etc/letsencrypt/live/my-speak.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my-speak.yourdomain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/rss+xml
        application/atom+xml
        image/svg+xml;
    
    # 静态文件 (前端构建产物)
    location / {
        root /var/www/my-speak/client;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    # API请求
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket (Socket.io)
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # 上传文件
    location /uploads/ {
        alias /opt/my-speak/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # 健康检查
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}
```

### 3.5 SSL 证书配置

```bash
# 1. 申请Let's Encrypt证书
sudo certbot --nginx -d my-speak.yourdomain.com

# 2. 自动续期测试
sudo certbot renew --dry-run

# 3. 添加自动续期到crontab
sudo crontab -e
# 添加以下行:
0 2 * * * /usr/bin/certbot renew --quiet --nginx
```

---

## 4. 部署流程

### 4.1 首次部署

```bash
# 1. 进入项目目录
cd /opt/my-speak

# 2. 构建并启动服务
docker-compose up -d postgres redis

# 3. 等待数据库启动
docker-compose exec postgres pg_isready -U myspeak_user -d myspeak

# 4. 构建后端
docker-compose build backend

# 5. 构建前端
docker-compose --profile build run --rm frontend-build

# 6. 复制前端构建产物到Nginx目录
sudo mkdir -p /var/www/my-speak/client
sudo cp -r client/dist/* /var/www/my-speak/client/
sudo chown -R www-data:www-data /var/www/my-speak

# 7. 启动后端
docker-compose up -d backend

# 8. 配置Nginx
sudo cp nginx/my-speak.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/my-speak.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 9. 配置SSL
sudo certbot --nginx -d my-speak.yourdomain.com

# 10. 验证部署
curl https://my-speak.yourdomain.com/health
```

### 4.2 更新部署

```bash
# 1. 拉取最新代码
cd /opt/my-speak
git pull origin main

# 2. 备份数据
docker-compose exec postgres pg_dump -U myspeak_user myspeak > backup_$(date +%Y%m%d).sql

# 3. 重新构建
docker-compose build backend
docker-compose --profile build run --rm frontend-build

# 4. 更新前端文件
sudo rm -rf /var/www/my-speak/client/*
sudo cp -r client/dist/* /var/www/my-speak/client/

# 5. 滚动更新（无停机）
docker-compose up -d backend

# 6. 验证
docker-compose logs -f backend
```

### 4.3 回滚

```bash
# 1. 回滚到上一个版本
cd /opt/my-speak
git log --oneline -5  # 查看历史
git revert HEAD       # 或使用 git reset --hard <commit>

# 2. 重新部署
docker-compose build backend
docker-compose up -d backend

# 3. 如有必要，恢复数据库
# docker-compose exec -T postgres psql -U myspeak_user myspeak < backup_YYYYMMDD.sql
```

---

## 5. 监控和日志

### 5.1 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 日志轮转配置
sudo vim /etc/logrotate.d/my-speak
```

**logrotate配置:**
```
/opt/my-speak/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

### 5.2 健康检查

```bash
# 应用健康检查
curl https://my-speak.yourdomain.com/health

# 数据库健康检查
docker-compose exec postgres pg_isready -U myspeak_user

# Redis健康检查
docker-compose exec redis redis-cli ping

# 系统资源监控
htop
docker stats
```

### 5.3 监控工具（可选）

**使用 Prometheus + Grafana:**

```yaml
# 添加到 docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

---

## 6. 备份策略

### 6.1 自动备份脚本

**scripts/backup.sh:**

```bash
#!/bin/bash

# 配置
BACKUP_DIR="/opt/backups/my-speak"
DB_NAME="myspeak"
DB_USER="myspeak_user"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 数据库备份
docker-compose -f /opt/my-speak/docker-compose.yml exec -T postgres \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 文件备份
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C /opt/my-speak uploads/

# 清理旧备份
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 发送通知（可选）
echo "Backup completed: $DATE" | logger
```

**设置定时任务:**
```bash
chmod +x /opt/my-speak/scripts/backup.sh
sudo crontab -e

# 每天凌晨2点备份
0 2 * * * /opt/my-speak/scripts/backup.sh >> /var/log/my-speak-backup.log 2>&1
```

### 6.2 手动备份

```bash
# 数据库备份
docker-compose exec postgres pg_dump -U myspeak_user myspeak > manual_backup.sql

# 文件备份
tar -czf uploads_backup.tar.gz uploads/

# 下载备份到本地
scp user@server:/opt/backups/my-speak/db_*.sql.gz ./
```

### 6.3 恢复备份

```bash
# 停止应用
docker-compose down

# 恢复数据库
docker-compose up -d postgres
sleep 5
docker-compose exec -T postgres psql -U myspeak_user myspeak < backup.sql

# 恢复文件
tar -xzf uploads_backup.tar.gz

# 重启应用
docker-compose up -d
```

---

## 7. 故障排查

### 7.1 常见问题

**问题1: 后端无法启动**
```bash
# 检查日志
docker-compose logs backend

# 常见原因:
# 1. 数据库连接失败 - 检查DATABASE_URL
# 2. 端口被占用 - 检查3001和10000-10100端口
# 3. 迁移失败 - 检查数据库权限
```

**问题2: WebSocket连接失败**
```bash
# 检查Nginx配置
sudo nginx -t

# 检查防火墙
sudo ufw status

# 常见原因:
# 1. Nginx未正确代理WebSocket
# 2. 防火墙阻止连接
# 3. SSL证书问题
```

**问题3: 语音通话无声**
```bash
# 检查mediasoup端口
docker-compose logs backend | grep mediasoup

# 检查UDP端口是否开放
sudo ufw status | grep 10000

# 检查服务器公网IP设置
docker-compose exec backend env | grep MEDIASOUP_ANNOUNCED_IP
```

### 7.2 调试命令

```bash
# 进入容器
docker-compose exec backend sh
docker-compose exec postgres psql -U myspeak_user -d myspeak

# 查看网络
docker network ls
docker network inspect my-speak_myspeak_network

# 查看端口占用
sudo netstat -tulpn | grep 3001
sudo netstat -tulpn | grep 10000

# 测试API
curl -v http://localhost:3001/api/health
```

---

## 8. 扩展指南

### 8.1 水平扩展（多实例）

```yaml
# 使用Docker Swarm或Kubernetes
services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

### 8.2 CDN集成

```nginx
# Nginx配置中添加CDN支持
location /uploads/ {
    # 使用CDN回源
    alias /opt/my-speak/uploads/;
    add_header Access-Control-Allow-Origin "*";
    expires 1y;
}
```

### 8.3 对象存储（AWS S3/MinIO）

```typescript
// 修改文件上传逻辑
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});
```

---

## 文档历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-XX-XX | - | 初始版本 |

---

**文档结束**
