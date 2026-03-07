#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /opt/my-speak

echo "📦 Building frontend..."
docker-compose -f docker-compose.prod.yml build frontend

echo "📂 Running frontend build..."
docker-compose -f docker-compose.prod.yml run --rm frontend

echo "📋 Copying frontend files..."
sudo rm -rf /var/www/my-speak/*
sudo mkdir -p /var/www/my-speak
sudo cp -r client/dist/* /var/www/my-speak/

echo "📦 Building backend..."
docker-compose -f docker-compose.prod.yml build backend

echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d backend

echo "⏳ Waiting for services to start..."
sleep 5

echo "🔍 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 Visit: https://yourdomain.com:8443"