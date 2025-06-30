#!/bin/bash

# AWS Documentation MCP Server - Docker Run Script
# This script runs the MCP server in a Docker container for local testing

set -e

# Configuration
CONTAINER_NAME="aws-mcp-server"
HOST_PORT="8000"
PLATFORM="linux/amd64"

echo "🐳 Building image for $PLATFORM and starting container"

# Stop existing container if running
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Ensure buildx builder exists
if ! docker buildx ls | grep -q "mcp_builder"; then
  docker buildx create --name mcp_builder --use
fi

docker buildx inspect mcp_builder --bootstrap > /dev/null

# Build multi-arch image (amd64 for EC2 compatibility)
docker buildx build --platform $PLATFORM -t $CONTAINER_NAME --load .

# Run container
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $HOST_PORT:8000 \
  -v $(pwd)/logs:/app/logs \
  -e MCP_SERVER_PORT=8000 \
  -e FASTMCP_LOG_LEVEL=INFO \
  $CONTAINER_NAME

# Wait for container to start
sleep 3

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✅ Container started successfully"
    echo "🔗 URLs:"
    echo "   Health: http://localhost:$HOST_PORT/sse"
    echo "   Logs: docker logs $CONTAINER_NAME -f"
    
    # Test health endpoint (SSE keeps connection open)
    curl -s http://localhost:$HOST_PORT/sse --max-time 3 -o /dev/null
    CODE=$?
    if [[ $CODE -eq 0 || $CODE -eq 28 ]]; then
        echo "✅ Health check passed"
    else
        echo "⚠️  Health check failed (exit code $CODE)"
    fi
else
    echo "❌ Container failed to start"
    docker logs $CONTAINER_NAME
    exit 1
fi 