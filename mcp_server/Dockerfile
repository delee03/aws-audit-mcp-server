FROM python:3.11-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY lambda_handler_sse.py ./

# Setup
RUN mkdir -p /app/logs
EXPOSE 8000
ENV MCP_SERVER_PORT=8000 FASTMCP_LOG_LEVEL=INFO PYTHONPATH=/app

# Health check - test SSE endpoint instead of health
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/sse || exit 1

CMD ["python", "/app/src/server_sse.py"] 