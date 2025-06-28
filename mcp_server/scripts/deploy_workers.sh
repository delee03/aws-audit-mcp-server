#!/bin/bash

set -e

echo "🚀 AWS MCP Server - Cloudflare Workers Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_header "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
if [ "$MAJOR_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION detected. Please install Node.js 18 or higher."
    exit 1
fi

print_status "✅ Node.js found: v$NODE_VERSION"

# Check if wrangler is installed globally or locally
if command -v wrangler &> /dev/null; then
    print_status "✅ Wrangler CLI found globally: $(wrangler --version)"
    WRANGLER_CMD="wrangler"
elif [ -f "node_modules/.bin/wrangler" ]; then
    print_status "✅ Wrangler CLI found locally"
    WRANGLER_CMD="npx wrangler"
else
    print_warning "Wrangler CLI not found. Installing..."
    npm install -g wrangler
    WRANGLER_CMD="wrangler"
fi

WRANGLER_CMD=${WRANGLER_CMD:-"wrangler"}

# Install dependencies
print_header "Installing dependencies..."

if [ ! -f "package.json" ]; then
    print_error "package.json not found. Make sure you're in the project root."
    exit 1
fi

npm install
print_status "✅ Dependencies installed"

# Check if user is logged in to Cloudflare
print_header "Checking Cloudflare authentication..."

if ! $WRANGLER_CMD whoami &> /dev/null; then
    print_warning "Not logged in to Cloudflare. Please authenticate:"
    echo ""
    echo "Run: $WRANGLER_CMD login"
    echo ""
    echo "This will open your browser to authenticate with Cloudflare."
    echo "After login, run this script again."
    exit 1
fi

CLOUDFLARE_USER=$($WRANGLER_CMD whoami 2>/dev/null || echo "Unknown")
print_status "✅ Logged in to Cloudflare as: $CLOUDFLARE_USER"

# Validate wrangler.toml
print_header "Validating configuration..."

if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found!"
    exit 1
fi

# Check if worker name is unique
WORKER_NAME=$(grep "^name" wrangler.toml | cut -d'"' -f2 | cut -d"'" -f2 | head -1)
if [ -z "$WORKER_NAME" ]; then
    print_error "Worker name not found in wrangler.toml"
    exit 1
fi

print_status "✅ Worker name: $WORKER_NAME"

# Deploy to Cloudflare Workers
print_header "Deploying to Cloudflare Workers..."

print_status "Running deployment..."
$WRANGLER_CMD deploy

# Get the worker URL
WORKER_URL="https://$WORKER_NAME.workers.dev"
print_status "✅ Deployment completed!"

# Test the deployment
print_header "Testing deployment..."

print_status "Testing health endpoint..."
if timeout 10 curl -s "$WORKER_URL/health" > /dev/null; then
    print_status "✅ Health endpoint responding"
else
    print_warning "⚠️  Health endpoint not responding yet (may take a moment)"
fi

print_status "Testing SSE endpoint..."
if timeout 10 curl -s "$WORKER_URL/sse" > /dev/null; then
    print_status "✅ SSE endpoint responding"
else
    print_warning "⚠️  SSE endpoint not responding yet"
fi

print_header "🎉 Cloudflare Workers Deployment Complete!"

echo ""
echo "📋 Deployment Information:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🌟 CLOUDFLARE WORKERS DEPLOYMENT"
echo "  🌍 Worker URL: $WORKER_URL"
echo "  📡 SSE Endpoint: $WORKER_URL/sse"
echo "  🏥 Health Check: $WORKER_URL/health"
echo "  🆔 Worker Name: $WORKER_NAME"
echo "  👤 Account: $CLOUDFLARE_USER"
echo "  💰 Cost: 100,000 requests/day FREE"
echo "  ⚡ Cold Starts: 0ms worldwide"
echo "  🌐 Global Edge: 275+ locations"
echo ""

echo "📱 CLIENT CONFIGURATION"
echo ""
echo "For GitHub Copilot (.vscode/settings.json):"
echo '{'
echo '  "mcpServers": {'
echo '    "aws-docs-workers": {'
echo "      \"url\": \"$WORKER_URL/sse\""
echo '    }'
echo '  }'
echo '}'
echo ""

echo "For n8n MCP Tool:"
echo "  URL: $WORKER_URL/sse"
echo ""

echo "For local MCP client testing:"
echo "  npx @modelcontextprotocol/inspector $WORKER_URL/sse"
echo ""

echo "🔧 MANAGEMENT COMMANDS"
echo ""
echo "View logs:"
echo "  $WRANGLER_CMD tail"
echo ""
echo "Update deployment:"
echo "  $WRANGLER_CMD deploy"
echo ""
echo "Development mode:"
echo "  $WRANGLER_CMD dev"
echo ""
echo "Delete worker:"
echo "  $WRANGLER_CMD delete"
echo ""

echo "🧪 QUICK TESTS"
echo ""
echo "Test health endpoint:"
echo "  curl $WORKER_URL/health"
echo ""
echo "Test MCP protocol:"
echo "  curl -X POST $WORKER_URL/sse \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Accept: text/event-stream' \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"initialize\",\"params\":{\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}'"
echo ""

# Save deployment info
cat > workers_deployment_info.txt << EOF
# Cloudflare Workers MCP Server Deployment Information
# Generated: $(date)

Worker URL: $WORKER_URL
SSE Endpoint: $WORKER_URL/sse
Health Check: $WORKER_URL/health
Worker Name: $WORKER_NAME
Account: $CLOUDFLARE_USER

# Test Commands
curl $WORKER_URL/health
curl $WORKER_URL/sse

# MCP Protocol Test
curl -X POST $WORKER_URL/sse \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":"test","method":"initialize","params":{"clientInfo":{"name":"test","version":"1.0"}}}'

# Management Commands
$WRANGLER_CMD tail          # View logs
$WRANGLER_CMD deploy        # Update deployment  
$WRANGLER_CMD dev           # Development mode
$WRANGLER_CMD delete        # Delete worker

# Cost: 100,000 requests/day FREE
# Global edge deployment with 0ms cold starts
EOF

print_status "📄 Deployment info saved to: workers_deployment_info.txt"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_header "🎯 NEXT STEPS:"
echo "1️⃣  Test your worker: $WORKER_URL"
echo "2️⃣  Configure MCP clients with: $WORKER_URL/sse"
echo "3️⃣  Monitor logs: $WRANGLER_CMD tail"
echo "4️⃣  Setup GitHub integration for auto-deploy (optional)"
echo ""
print_status "🚀 MCP Server deployed globally on Cloudflare's edge network! 🎉" 