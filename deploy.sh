#!/bin/bash
set -e

echo "🚀 Starting deployment..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Pulling latest code..."
git pull

echo "📦 Building and starting services..."
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo "✅ Deployment complete!"
