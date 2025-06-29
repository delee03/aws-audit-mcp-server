# AWS Documentation MCP Server

Model Context Protocol (MCP) server providing access to AWS documentation.

## 🚀 Quick Start

### Local Development
```bash
./scripts/run-docker.sh
curl http://localhost:8000/sse
```

### Production Deployment
Follow the step-by-step guide: **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)**

## 🔧 Features

- **3 MCP Tools:**
  - `search_documentation` - Search AWS docs
  - `read_documentation` - Read specific pages  
  - `recommend` - Get related content

- **SSE Transport** - Compatible with n8n, GitHub Copilot, and other MCP clients

## 📖 MCP Client Configuration

### n8n MCP Tool
```json
{
  "url": "https://mcp-server.fuderrpham.io.vn/sse",
  "transport": "SSE"
}
```

### GitHub Copilot
```json
{
  "mcpServers": {
    "aws-docs": {
      "url": "https://mcp-server.fuderrpham.io.vn/sse"
    }
  }
}
```

## 🛠️ Available Scripts

- `./scripts/run-docker.sh` - Run locally for testing
- `./scripts/get-aws-info.sh` - Get AWS account info for deployment
- `./scripts/build_lambda.sh` - Build Lambda package (optional)

## 📝 Architecture

```
Internet → Nginx (SSL) → Docker Container (Port 8000)
                      ↓
                 MCP Server (SSE Transport)
                      ↓
              AWS Documentation APIs
```

```
┌─────────────┐    HTTPS    ┌─────────────┐    HTTP    ┌─────────────┐
│   MCP       │ ──────────► │   Nginx     │ ─────────► │   Docker    │
│   Client    │             │   Proxy     │            │   Container │
│  (n8n/VSC)  │             │   + SSL     │            │ (MCP Server)│
└─────────────┘             └─────────────┘            └─────────────┘
                                   │
                            ┌─────────────┐
                            │ Let's       │
                            │ Encrypt     │
                            │ SSL Cert    │
                            └─────────────┘
```

## 📚 Documentation
- **MCP Server Deployment Guide:** [Deployment Guide Blog](https://dev.to/fuderrpham03/do-you-want-to-have-your-own-mcp-server-can-be-used-anywhere-from-vscode-copilot-n8n--59n4)
- **Deployment Guide:** [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)
- **Local Testing:** Run `./scripts/run-docker.sh` and test `http://localhost:8000/sse`
- **AWS Documentation API:** [AWS Docs API](https://docs.aws.amazon.com/documentation-api/latest/reference/)
- **MCP Protocol:** [Model Context Protocol](https://modelcontextprotocol.org/)


---

**Production URL:** https://mcp-server.fuderrpham.io.vn/sse
