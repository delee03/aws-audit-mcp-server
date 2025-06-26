# AWS Documentation MCP Server

AWS Documentation MCP Server provides tools to access, search, and get recommendations from public AWS documentation. This version supports deployment to AWS Lambda.

## Quick Start

### Local Development

#### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 2. Run the Server Locally

##### SSE Transport (for Amazon Q, Claude, etc.)

```bash
python src/server_sse.py
```

##### Streamable HTTP

```bash
python src/server_http.py
```

##### STDIO (for Claude Desktop/VS Code)

```bash
python src/server.py
```

### AWS Lambda Deployment

#### 1. Build the Lambda Package

```bash
./build.sh
```

This creates a `aws-audit-mcp-server.zip` file with all dependencies.

#### 2. Deploy with Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply
```
### 2.1. Create Lambda Layer and Publish  (OPTIONAL)

mkdir -p layer/python
cd layer/python
pip install pydantic mcp httpx beautifulsoup4 loguru -t .
cd ..
zip -r lambda-layer.zip python/

```bash
aws lambda publish-layer-version \
    --layer-name mcp-pydantic-layer \
    --description "MCP and Pydantic dependencies" \
    --zip-file fileb://lambda-layer.zip \
    --compatible-runtimes python3.11
```

#### 3. One-Step Deployment

For convenience, you can use the deploy script:

```bash
./deploy.sh
```

## MCP Client Configuration

### For Local Development

#### SSE Transport (Amazon Q, Claude)

```json
{
    "mcpServers": {
        "aws-docs": {
            "url": "http://127.0.0.1:8000/sse/"
        }
    }
}
```

#### Streamable HTTP

```json
{
    "mcpServers": {
        "aws-docs": {
            "url": "http://127.0.0.1:8000/mcp/"
        }
    }
}
```

#### STDIO (VS Code/Claude Desktop)

```json
{
    "mcpServers": {
        "aws-docs": {
            "command": "python",
            "args": ["path/to/aws-audit-mcp-server/src/server.py"]
        }
    }
}
```

### For AWS Lambda Deployment

After deployment, use the Lambda Function URL:

```json
{
    "mcpServers": {
        "aws-docs": {
            "url": "https://your-lambda-url.lambda-url.region.on.aws/sse/"
        }
    }
}
```

## Available Tools

1. **search_documentation** - Search AWS documentation
2. **read_documentation** - Read specific AWS documentation pages
3. **recommend** - Get recommendations for related documentation

## Lambda Function Endpoints

The Lambda function provides multiple endpoints:

- `/sse/` - SSE MCP transport (for Amazon Q, Claude)
- `/mcp/` - Streamable HTTP MCP transport
- `/fetch` - Direct documentation fetch API
- `/` - Service information

## Troubleshooting

### Connection Issues

If you get connection errors:

1. **Check URL format**: Must include trailing slash (`/sse/` or `/mcp/`)
2. **Verify server is running**: Check logs
3. **Test endpoint**: Use curl to test the endpoint

### Common Errors

- **Without trailing slash**: Connection fails
- **With trailing slash**: Works correctly

This is due to FastAPI/Starlette routing behavior in the official Python MCP SDK.
