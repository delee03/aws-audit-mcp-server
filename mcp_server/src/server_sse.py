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
    # Get port from environment variable, default to 8000
    # When running in Lambda, this port doesn't matter as it uses the Lambda URL
    port = int(os.getenv('MCP_SERVER_PORT', 8000))
    main_sse(port)

if __name__ == '__main__':
    main() 