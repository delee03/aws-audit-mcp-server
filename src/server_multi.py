"""AWS Documentation MCP Server - Multi Transport (SSE + Streamable HTTP)."""

import asyncio
import os
import sys
from loguru import logger
from server_aws import get_sse_app, get_streamable_app
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse

# Set up logging
logger.remove()
logger.add(sys.stderr, level=os.getenv('FASTMCP_LOG_LEVEL', 'INFO'))

def create_multi_transport_app():
    """Create FastAPI app that handles both SSE and Streamable HTTP transports."""
    
    # Get the MCP apps
    sse_app = get_sse_app()
    streamable_app = get_streamable_app()
    
    # Create main FastAPI app
    main_app = FastAPI(
        title="AWS Documentation MCP Server",
        description="Multi-transport MCP server supporting both SSE and Streamable HTTP",
        version="1.0.0"
    )
    
    @main_app.get("/")
    async def root():
        return {
            "message": "AWS Documentation MCP Server",
            "transports": {
                "sse": "/sse",
                "streamable_http": "/mcp"
            },
            "health": "/health"
        }
    
    @main_app.get("/health")
    async def health():
        return {"status": "healthy", "transports": ["sse", "streamable_http"]}
    
    # Mount SSE transport on /sse path
    main_app.mount("/sse", sse_app)
    
    # Mount Streamable HTTP transport on /mcp path  
    main_app.mount("/mcp", streamable_app)
    
    return main_app

async def run_multi_transport_server(
    sse_port: int = 8000,
    streamable_port: int = 8000,
    combined_port: int = 8002
):
    """Run multiple transport servers."""
    
    # Import server functions
    from server_aws import main_sse, main_streamable
    
    logger.info("Starting AWS Documentation MCP Server with multiple transports")
    
    # Create tasks for each transport
    tasks = []
    
    # SSE transport task
    sse_task = asyncio.create_task(
        asyncio.to_thread(main_sse, sse_port)
    )
    tasks.append(sse_task)
    logger.info(f"SSE transport will run on port {sse_port}")
    
    # Streamable HTTP transport task
    streamable_task = asyncio.create_task(
        asyncio.to_thread(main_streamable, streamable_port)
    )
    tasks.append(streamable_task)
    logger.info(f"Streamable HTTP transport will run on port {streamable_port}")
    
    # Combined transport task
    app = create_multi_transport_app()
    combined_task = asyncio.create_task(
        asyncio.to_thread(
            uvicorn.run,
            app,
            host="127.0.0.1",
            port=combined_port,
            log_level="info"
        )
    )
    tasks.append(combined_task)
    logger.info(f"Combined transport will run on port {combined_port}")
    
    try:
        # Wait for all tasks
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        logger.info("Shutting down servers...")
        for task in tasks:
            task.cancel()

def main():
    """Run the multi-transport MCP server."""
    try:
        asyncio.run(run_multi_transport_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")

if __name__ == '__main__':
    main() 