# AWS Documentation MCP Server

AWS Documentation MCP Server provides tools to access, search, and get recommendations from public AWS documentation.

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the Server

#### STDIO (for Claude Desktop/VS Code)

```bash
python src/server.py
```

#### Streamable HTTP

```bash
python src/server_http.py
```

#### SSE (deprecated)

```bash
python src/server_sse.py
```

## MCP Client Configuration

### For VS Code/Claude Desktop (STDIO)

```json
{
    "mcpServers": {
        "aws-docs": {
            "command": "python",
            "args": ["path/to/mcp-aws-docs-server/src/server.py"]
        }
    }
}
```

### For HTTP Clients (Streamable HTTP)

```json
{
    "mcpServers": {
        "aws-docs-streamable-http": {
            "url": "http://127.0.0.1:8000/mcp/"
        }
    }
}
```

**⚠️ Important**: URL must end with `/` (trailing slash) for HTTP connections to work properly.

## Available Tools

1. **search_documentation** - Search AWS documentation
2. **read_documentation** - Read specific AWS documentation pages
3. **recommend** - Get recommendations for related documentation

## Transport Options

-   **STDIO**: Default, best for local development and desktop clients
-   **Streamable HTTP**: Modern HTTP transport, runs on port 8000 at `/mcp/`
-   **SSE**: Legacy transport (deprecated, use Streamable HTTP instead)

## Troubleshooting

### Connection Issues

If you get `TypeError: fetch failed` or connection errors:

1. **Check URL format**: Must use `http://127.0.0.1:8000/mcp/` (with trailing slash)
2. **Verify server is running**: Should see "Uvicorn running on http://127.0.0.1:8000"
3. **Test endpoint**: `curl http://127.0.0.1:8000/mcp/` should return MCP error (not 404)

### Common Errors

-   **Without trailing slash**: `http://127.0.0.1:8000/mcp` → Connection fails
-   **With trailing slash**: `http://127.0.0.1:8000/mcp/` → Works correctly

This is due to FastAPI/Starlette routing behavior in the official Python MCP SDK.
