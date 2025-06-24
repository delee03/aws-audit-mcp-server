"""AWS Documentation MCP Server implementation."""

import os
import sys
from loguru import logger


# Set up logging
logger.remove()
logger.add(sys.stderr, level=os.getenv('FASTMCP_LOG_LEVEL', 'WARNING'))


def main():
    """Run the MCP server with CLI argument support."""
    from server_aws import main as aws_main
    aws_main()


if __name__ == '__main__':
    main()