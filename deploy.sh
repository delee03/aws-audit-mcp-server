#!/bin/bash

set -e

echo "Starting deployment process..."

echo "Building Lambda package..."
./build.sh

if [ ! -f "aws-audit-mcp-server.zip" ]; then
    echo "❌ Build failed! Package not created."
    exit 1
fi

echo "Deploying with Terraform..."
cd terraform

if [ ! -d ".terraform" ]; then
    echo "Init Terraform..."
    terraform init
fi

echo "Planning deployment..."
terraform plan -out=tfplan

echo "Applying deployment..."
terraform apply tfplan

# Get the function URL
FUNCTION_URL=$(terraform output -raw mcp_server_function_url)

echo "Deployment complete!"
echo "MCP Server Function URL: $FUNCTION_URL"
echo "Example configuration:"
echo '{
  "mcpServers": {
    "aws-docs": {
      "url": "'$FUNCTION_URL'sse"
    }
  }
}'

