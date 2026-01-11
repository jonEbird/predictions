#!/bin/bash

# Deployment script for Predictions App
# Run this on your Linode server

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Pull latest code
echo "📥 Pulling latest code from git..."
git pull origin master  # or your branch name

# Stop existing container
echo "🛑 Stopping existing container..."
docker-compose down

# Rebuild and start
echo "🔨 Building new container..."
docker-compose build --no-cache

echo "▶️  Starting container..."
docker-compose up -d

# Wait for healthcheck
echo "⏳ Waiting for app to be healthy..."
sleep 10

# Check if container is running
if [ "$(docker ps -q -f name=predictions-app)" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Container status:"
    docker-compose ps
    echo ""
    echo "📝 Recent logs:"
    docker-compose logs --tail=20
else
    echo "❌ Deployment failed - container not running"
    echo "📝 Logs:"
    docker-compose logs
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo "✨ Deployment complete!"
