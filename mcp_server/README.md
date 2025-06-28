# AWS Documentation MCP Server

AWS Documentation MCP Server provides tools to access, search, and get recommendations from public AWS documentation. This version supports deployment to AWS Lambda.

## 🌟 **Why Cloudflare Workers?**

### **Perfect Solution:**
- ✅ **0ms Cold Starts**: Instant response worldwide
- ✅ **100k Requests/Day FREE**: No cost for most use cases  
- ✅ **Global Edge Network**: 275+ locations worldwide
- ✅ **Perfect SSE Support**: Native EventSource compatibility
- ✅ **Free HTTPS Domain**: `*.workers.dev` included
- ✅ **GitHub Auto-Deploy**: Push to deploy

### **Comparison:**

| Feature | Cloudflare Workers | AWS Lambda | EC2 |
|---------|-------------------|------------|-----|
| **Cost** | **FREE** (100k/day) | $0-6/month | $16-24/month |
| **Cold Starts** | **0ms** | 100-500ms | N/A |
| **MCP Support** | ✅ Perfect | ⚠️ Timeout issues | ✅ Good |
| **n8n Compatible** | ✅ Yes | ❌ No | ✅ Yes |
| **Domain** | ✅ Free | ❌ AWS only | ❌ Need custom |
| **Setup Time** | **5 minutes** | 10 minutes | 30 minutes |

## 🚀 **Quick Start**

### **Prerequisites:**
- [Cloudflare account](https://www.cloudflare.com) (free)
- [Node.js](https://nodejs.org) >= 18
- [Git](https://git-scm.com)

### **Deploy in 5 minutes:**

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/aws-audit-mcp-server
cd aws-audit-mcp-server

# 2. Install Wrangler CLI
npm install -g wrangler

# 3. Login to Cloudflare  
wrangler login

# 4. Deploy to Workers
./deploy_workers.sh
```

**🎉 Done! Your server is live at `https://aws-docs-mcp-server.workers.dev`**

## 📱 **Client Configuration**

### **n8n MCP Tool**
```
URL: https://aws-docs-mcp-server.workers.dev/sse
```

### **GitHub Copilot**
Add to `.vscode/settings.json`:
```json
{
  "mcpServers": {
    "aws-docs": {
      "url": "https://aws-docs-mcp-server.workers.dev/sse"
    }
  }
}
```

### **Local MCP Client**
```bash
npx @modelcontextprotocol/inspector https://aws-docs-mcp-server.workers.dev/sse
```

## 🛠️ **Available Tools**

### **1. Search Documentation**
Search AWS documentation using official search API:
```bash
curl -X POST https://aws-docs-mcp-server.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call", 
    "params": {
      "name": "search_documentation",
      "arguments": {
        "search_phrase": "S3 bucket policy",
        "limit": 5
      }
    }
  }'
```

### **2. Read Documentation**
Fetch and convert AWS docs to markdown:
```bash
curl -X POST https://aws-docs-mcp-server.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/call",
    "params": {
      "name": "read_documentation", 
      "arguments": {
        "url": "https://docs.aws.amazon.com/s3/latest/userguide/bucket-policies.html",
        "max_length": 5000
      }
    }
  }'
```

### **3. Get Recommendations**
Find related content for documentation pages:
```bash
curl -X POST https://aws-docs-mcp-server.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3", 
    "method": "tools/call",
    "params": {
      "name": "recommend",
      "arguments": {
        "url": "https://docs.aws.amazon.com/s3/latest/userguide/bucket-policies.html"
      }
    }
  }'
```

## 🔧 **Development**

### **Local Development**
```bash
# Install dependencies
npm install

# Start local development server
wrangler dev
# Access at: http://localhost:8787

# View logs
wrangler tail
```

### **Deploy Updates**
```bash
# Deploy changes
wrangler publish

# Or use the script
./deploy_workers.sh
```

## 📊 **GitHub Integration**

### **Auto-Deploy Setup:**

1. **Get Cloudflare credentials:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Create API Token with `Workers:Edit` permissions

2. **Add GitHub Secrets:**
   - Repository → Settings → Secrets and variables → Actions
   - Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

3. **Push to auto-deploy:**
   ```bash
   git add .
   git commit -m "Update MCP server"
   git push origin main
   # Auto-deploys via GitHub Actions
   ```

## 💰 **Cost Analysis**

### **Cloudflare Workers (Recommended):**
- **Free Tier**: 100,000 requests/day = **$0/month**
- **Paid Plan**: $5/month + $0.50/million requests

### **Alternative Options:**

#### **AWS Lambda:**
- **Cost**: $0-6/month
- **Issues**: Timeout problems with MCP clients
- **Setup**: Use `./deploy.sh` script

#### **AWS EC2:**
- **Cost**: $16-24/month  
- **Benefits**: Full compatibility
- **Issues**: Need custom domain for HTTPS

## 📚 **Documentation**

- **[Cloudflare Workers Deployment](./README-Workers.md)** - Complete Workers guide
- **[AWS Lambda Alternative](./README.md)** - Lambda deployment option
- **[MCP Protocol](https://modelcontextprotocol.io/)** - Official MCP docs

## 🧪 **Testing**

### **Health Check**
```bash
curl https://aws-docs-mcp-server.workers.dev/health
```

### **MCP Protocol Test**
```bash
curl -X POST https://aws-docs-mcp-server.workers.dev/sse \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"test","method":"initialize"}'
```

## 🎯 **Success Checklist**

- [ ] Worker deployed successfully  
- [ ] Health endpoint responding: `/health`
- [ ] SSE endpoint working: `/sse`
- [ ] MCP protocol tests pass
- [ ] n8n MCP Tool connects
- [ ] GitHub Copilot connects
- [ ] Local MCP client works
- [ ] GitHub auto-deploy configured

## 🔄 **Migration from Lambda/EC2**

### **From AWS Lambda:**
```bash
# 1. Deploy Workers
./deploy_workers.sh

# 2. Update MCP clients to use:
# https://aws-docs-mcp-server.workers.dev/sse

# 3. Optionally destroy Lambda:
cd terraform && terraform destroy
```

### **From EC2:**
```bash
# 1. Deploy Workers (no domain needed!)
./deploy_workers.sh

# 2. Update MCP clients
# 3. Destroy EC2 infrastructure
# 4. Save $16-24/month!
```

## 🌍 **Global Performance**

Cloudflare Workers runs on [275+ edge locations](https://www.cloudflare.com/network/) worldwide:

- **North America**: 100+ locations
- **Europe**: 80+ locations  
- **Asia Pacific**: 60+ locations
- **Africa**: 15+ locations
- **South America**: 20+ locations

**→ Your MCP server is milliseconds away from every user globally!**

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/aws-audit-mcp-server/issues)
- **Cloudflare Workers**: [Documentation](https://developers.cloudflare.com/workers/)
- **MCP Protocol**: [Specification](https://modelcontextprotocol.io/)

---

**🚀 Deploy globally in 5 minutes with 0ms cold starts and 100k free requests/day!**
