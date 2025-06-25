"""Test script for different MCP transports."""

import asyncio
import httpx
import json
from loguru import logger

# Test endpoints
STREAMABLE_HTTP_URL = "http://localhost:8000"
SSE_URL = "http://localhost:8001" 
COMBINED_URL = "http://localhost:8002"

async def test_streamable_http():
    """Test Streamable HTTP transport."""
    logger.info("Testing Streamable HTTP transport...")
    
    async with httpx.AsyncClient() as client:
        try:
            # Test initialize request
            init_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test-client", "version": "1.0.0"}
                }
            }
            
            response = await client.post(
                f"{STREAMABLE_HTTP_URL}/mcp",
                json=init_request,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json,text/event-stream"
                }
            )
            
            logger.info(f"Streamable HTTP response status: {response.status_code}")
            logger.info(f"Streamable HTTP response: {response.text[:200]}...")
            
        except Exception as e:
            logger.error(f"Streamable HTTP test failed: {e}")

async def test_sse():
    """Test SSE transport."""
    logger.info("Testing SSE transport...")
    
    async with httpx.AsyncClient() as client:
        try:
            # Test health endpoint
            response = await client.get(f"{SSE_URL}/health")
            logger.info(f"SSE health check status: {response.status_code}")
            logger.info(f"SSE health response: {response.text}")
            
        except Exception as e:
            logger.error(f"SSE test failed: {e}")

async def test_combined():
    """Test combined transport."""
    logger.info("Testing combined transport...")
    
    async with httpx.AsyncClient() as client:
        try:
            # Test root endpoint
            response = await client.get(f"{COMBINED_URL}/")
            logger.info(f"Combined transport status: {response.status_code}")
            logger.info(f"Combined transport response: {response.json()}")
            
            # Test health endpoint
            health_response = await client.get(f"{COMBINED_URL}/health")
            logger.info(f"Combined health response: {health_response.json()}")
            
        except Exception as e:
            logger.error(f"Combined transport test failed: {e}")

async def main():
    """Run all transport tests."""
    logger.info("Starting MCP transport tests...")
    
    await asyncio.gather(
        test_streamable_http(),
        test_sse(),
        test_combined(),
        return_exceptions=True
    )
    
    logger.info("Transport tests completed!")

if __name__ == "__main__":
    asyncio.run(main()) 