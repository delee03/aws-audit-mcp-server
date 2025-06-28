#!/bin/bash

set -e

echo "Starting deployment process..."

echo "Building Lambda package..."
./scripts/build.sh

if [ ! -f "terraform/aws-audit-mcp-server.zip" ]; then
    echo "❌ Build failed! Package not created."
    exit 1
fi

echo "Deploying with Terraform..."
cd terraform

# Clean up old plan files
rm -f tfplan

if [ ! -d ".terraform" ]; then
    echo "Init Terraform..."
    terraform init
else
    echo "Re-initializing Terraform (in case of provider changes)..."
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
echo ""
echo "🔗 Use this URL in your MCP clients:"
echo "   ${FUNCTION_URL}sse"
echo ""
echo "📋 Example configuration for GitHub Copilot:"
echo '{
  "mcpServers": {
    "aws-docs": {
      "url": "'$FUNCTION_URL'sse"
    }
  }
}'
echo ""
echo "📋 Example configuration for n8n MCP Tool:"
echo "   URL: ${FUNCTION_URL}sse"

