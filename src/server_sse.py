"""AWS Documentation MCP Server - SSE Transport only."""

import os
import sys
from loguru import logger
from server_aws import main_sse

# Set up logging
logger.remove()
logger.add(sys.stderr, level=os.getenv('FASTMCP_LOG_LEVEL', 'INFO'))

def main():
    """Run the MCP server with SSE transport only."""
    port = int(os.getenv('MCP_SERVER_PORT', 8001))
    main_sse(port)

if __name__ == '__main__':
    main() 