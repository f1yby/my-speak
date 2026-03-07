# My-Speak 生产部署指南

## 架构

```
Headscale:   yourdomain.com (80, 443) - 已有
My-Speak:    yourdomain.com:8443 (8443) - 新增
```

## 快速部署

### 1. 上传代码到服务器

```bash
# 本地执行 (在 my-speak 目录)
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ user@your-server:/opt/my-speak/
```

### 2. 配置环境变量

```bash
# 服务器执行
cd /opt/my-speak
cp .env.example .env
vim .env

# 修改以下配置:
# - DATABASE_URL 中的密码
# - CORS_ORIGIN 改为你的域名: https://yourdomain.com:8443
```

### 3. 配置前端环境变量

```bash
cd client
cp .env.production.example .env.production
vim .env.production

# 修改:
# VITE_API_URL=https://yourdomain.com:8443
```

### 4. 执行部署

```bash
cd /opt/my-speak
chmod +x deploy.sh
./deploy.sh
```

### 5. 配置 Nginx

```bash
# 复制配置
sudo cp nginx/my-speak.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/my-speak.conf /etc/nginx/sites-enabled/

# 编辑配置，修改域名
sudo vim /etc/nginx/sites-available/my-speak.conf
# 替换 yourdomain.com 为你的实际域名

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL 证书

如果 headscale 已有证书：
```bash
# 确保证书路径正确
ls -la /etc/letsencrypt/live/yourdomain.com/
```

如果需要单独申请：
```bash
# 使用 standalone 模式（需要临时停止 Nginx）
sudo systemctl stop nginx
sudo certbot certonly --standalone -d yourdomain.com
sudo systemctl start nginx

# 或使用 DNS 验证
sudo certbot certonly --manual --preferred-challenges dns -d yourdomain.com
```

### 7. 防火墙

```bash
sudo ufw allow 8443/tcp
sudo ufw reload
sudo ufw status
```

### 8. 访问

```
https://yourdomain.com:8443
```

首次访问会要求设置服务器密码。

---

## 常用命令

### 查看日志

```bash
# 后端日志
docker-compose -f docker-compose.prod.yml logs -f backend

# PostgreSQL 日志
docker-compose -f docker-compose.prod.yml logs -f postgres

# Nginx 日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 重启服务

```bash
# 重启后端
docker-compose -f docker-compose.prod.yml restart backend

# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 重载 Nginx
sudo systemctl reload nginx
```

### 更新部署

```bash
cd /opt/my-speak

# 拉取最新代码 (如果使用 git)
git pull

# 重新部署
./deploy.sh
```

### 停止服务

```bash
docker-compose -f docker-compose.prod.yml down
```

---

## 故障排查

### 1. 无法访问

```bash
# 检查服务是否运行
docker-compose -f docker-compose.prod.yml ps

# 检查端口
sudo netstat -tulpn | grep 3001
sudo netstat -tulpn | grep 8443

# 检查防火墙
sudo ufw status
```

### 2. WebSocket 连接失败

```bash
# 检查 Nginx 配置
sudo nginx -t

# 检查后端日志
docker-compose -f docker-compose.prod.yml logs backend | grep socket
```

### 3. 数据库连接失败

```bash
# 检查 PostgreSQL 容器
docker-compose -f docker-compose.prod.yml ps postgres

# 进入数据库
docker-compose -f docker-compose.prod.yml exec postgres psql -U myspeak -d myspeak

# 检查连接
docker-compose -f docker-compose.prod.yml exec backend sh -c "nc -zv postgres 5432"
```

### 4. SSL 证书问题

```bash
# 检查证书
sudo certbot certificates

# 更新证书
sudo certbot renew

# 测试续期
sudo certbot renew --dry-run
```

---

## 数据备份

### 手动备份

```bash
# 备份数据库
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U myspeak myspeak > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U myspeak myspeak < backup_20240101.sql
```

### 自动备份

```bash
# 创建备份脚本
cat > /opt/my-speak/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker-compose -f /opt/my-speak/docker-compose.prod.yml exec -T postgres \
  pg_dump -U myspeak myspeak | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 保留最近7天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/my-speak/backup.sh

# 添加到 crontab (每天凌晨2点备份)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/my-speak/backup.sh") | crontab -
```

---

## 性能优化

### 1. 开启 HTTP/2

已默认开启（Nginx 配置中的 `http2`）

### 2. 开启 Gzip

已在 Nginx 配置中开启

### 3. 静态文件缓存

已配置 1 天缓存

### 4. 数据库连接池

Prisma 默认管理连接池

---

## 安全建议

1. **修改默认密码** - 修改 .env 中的数据库密码
2. **定期更新证书** - Let's Encrypt 证书 90 天过期
3. **开启防火墙** - 只开放必要端口
4. **定期备份** - 设置自动备份
5. **更新依赖** - 定期更新 Docker 镜像和依赖

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `docker-compose.prod.yml` | 生产环境 Docker Compose 配置 |
| `server/Dockerfile.prod` | 后端生产 Dockerfile |
| `client/Dockerfile.prod` | 前端生产 Dockerfile |
| `deploy.sh` | 自动部署脚本 |
| `nginx/my-speak.conf` | Nginx 配置 |
| `.env.example` | 后端环境变量示例 |
| `client/.env.production.example` | 前端环境变量示例 |

---

**部署完成后，访问 `https://yourdomain.com:8443` 开始使用！**
