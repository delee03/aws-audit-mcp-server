# MCP Client for testing connectivity with MCP Server
# This client is designed to test the MCP Server's SSE transport and ensure compatibility with various MCP clients like n8n and GitHub Copilot.

# Configure the MCP Server URL
```
const url = `https://mcp-server.fuderrpham.io.vn/sse`;
```
# Run the client
```bash
  npm run start
```

# Make sure the access and secret aws key have been exported in the evironment variables:
```bash
export AWS_ACCESS_KEY_ID=<your_access_key_id>
export AWS_SECRET_ACCESS_KEY=<your_secret_access_key>
export AWS_DEFAULT_REGION=us-east-1
```