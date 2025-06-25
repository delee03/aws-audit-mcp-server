"""AWS Documentation MCP Server - Streamable HTTP Transport only."""

import os
import sys
from loguru import logger
from server_aws import main_streamable

# Set up logging
logger.remove()
logger.add(sys.stderr, level=os.getenv('FASTMCP_LOG_LEVEL', 'INFO'))

def main():
    """Run the MCP server with Streamable HTTP transport only."""
    port = int(os.getenv('MCP_SERVER_PORT', 8000))
    main_streamable(port)

if __name__ == '__main__':
    main() 