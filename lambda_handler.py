#!/usr/bin/env python3
"""
AWS Lambda handler for AWS Documentation MCP Server
Supports multiple transports and endpoints for Lambda deployment
Based on AWS Lambda MCP Server examples: https://github.com/awslabs/run-model-context-protocol-servers-with-aws-lambda
"""

import json
import os
import sys
import logging
from typing import Dict, Any, List
import asyncio

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import MCP server
from server_aws import mcp

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for MCP server with multiple endpoints
    
    Supports:
    - /mcp/ → Streamable HTTP MCP transport  
    - /sse/ → SSE MCP transport
    - /fetch → Direct documentation fetch
    - / → Root endpoint with service info
    
    Based on AWS Lambda MCP Server pattern
    """
    try:
        logger.info(f"Lambda event: {json.dumps(event, default=str)}")
        
        # Handle API Gateway events (HTTP requests)
        if 'httpMethod' in event:
            return handle_api_gateway_event(event, context)
        
        # Handle direct Lambda invocation (MCP client)
        elif 'method' in event or 'jsonrpc' in event:
            return handle_mcp_protocol(event, context)
        
        # Handle unknown event types
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Unknown event type',
                    'event_keys': list(event.keys())
                })
            }
            
    except Exception as e:
        logger.error(f"Lambda handler error: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'type': type(e).__name__
            })
        }

def handle_api_gateway_event(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle API Gateway HTTP events"""
    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    
    logger.info(f"API Gateway: {method} {path}")
    
    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*'
            },
            'body': ''
        }
    
    # Route based on path
    if path == '/' or path == '':
        return handle_root_endpoint(event, context)
    elif path.startswith('/fetch'):
        return handle_fetch_endpoint(event, context)
    elif path.startswith('/mcp'):
        return handle_mcp_endpoint(event, context, 'streamable-http')
    elif path.startswith('/sse'):
        return handle_mcp_endpoint(event, context, 'sse')
    else:
        return {
            'statusCode': 404,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': f'Path not found: {path}',
                'available_paths': ['/', '/fetch', '/mcp/', '/sse/']
            })
        }

def handle_root_endpoint(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle root endpoint - service information"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'name': 'AWS Documentation MCP Server',
            'version': '1.0.0',
            'description': 'MCP server for AWS documentation access',
            'endpoints': {
                '/': 'Service information',
                '/fetch': 'Direct documentation fetch (GET ?url=<aws_docs_url>)',
                '/mcp/': 'MCP Streamable HTTP transport',
                '/sse/': 'MCP SSE transport'
            },
            'tools': ['read_documentation', 'search_documentation', 'recommend'],
            'example_usage': {
                'fetch': '/fetch?url=https://docs.aws.amazon.com/lambda/latest/dg/welcome.html',
                'mcp_client': 'Use /mcp/ endpoint for MCP clients with Streamable HTTP'
            }
        })
    }

def handle_fetch_endpoint(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle direct fetch endpoint like TypeScript example"""
    try:
        # Extract URL from query parameters
        query_params = event.get('queryStringParameters') or {}
        url = query_params.get('url', '')
        
        if not url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'URL parameter is required',
                    'usage': '/fetch?url=https://docs.aws.amazon.com/...'
                })
            }
        
        # Call the MCP tool directly
        result = asyncio.run(call_read_documentation_tool(url))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'url': url,
                'content': result,
                'timestamp': context.aws_request_id if context else None
            })
        }
        
    except Exception as e:
        logger.error(f"Fetch endpoint error: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'url': query_params.get('url', '')
            })
        }

def handle_mcp_endpoint(event: Dict[str, Any], context: Any, transport_type: str) -> Dict[str, Any]:
    """Handle MCP protocol endpoints"""
    try:
        # Extract request body
        if 'body' in event and event['body']:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            # For GET requests, return transport info
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'transport': transport_type,
                    'protocol': 'MCP',
                    'version': '2024-11-05',
                    'description': f'MCP server endpoint using {transport_type} transport',
                    'usage': 'Send JSON-RPC 2.0 requests to this endpoint'
                })
            }
        
        # Handle MCP protocol request
        return handle_mcp_protocol(body, context)
        
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Invalid JSON in request body',
                'details': str(e)
            })
        }

def handle_mcp_protocol(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle MCP JSON-RPC protocol requests"""
    try:
        method = event.get('method', '')
        request_id = event.get('id')
        params = event.get('params', {})
        
        logger.info(f"MCP method: {method}")
        
        if method == 'initialize':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'protocolVersion': '2024-11-05',
                        'capabilities': {
                            'tools': {},
                            'logging': {}
                        },
                        'serverInfo': {
                            'name': 'AWS Documentation MCP Server',
                            'version': '1.0.0'
                        }
                    }
                })
            }
        
        elif method == 'tools/list':
            tools = [
                {
                    'name': 'read_documentation',
                    'description': 'Fetch and convert an AWS documentation page to markdown format',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'url': {
                                'type': 'string',
                                'description': 'URL of the AWS documentation page to read'
                            },
                            'max_length': {
                                'type': 'integer',
                                'description': 'Maximum number of characters to return',
                                'default': 5000
                            },
                            'start_index': {
                                'type': 'integer', 
                                'description': 'Starting character index for pagination',
                                'default': 0
                            }
                        },
                        'required': ['url']
                    }
                },
                {
                    'name': 'search_documentation',
                    'description': 'Search AWS documentation using the official AWS Documentation Search API',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'search_phrase': {
                                'type': 'string',
                                'description': 'Search phrase to use'
                            },
                            'limit': {
                                'type': 'integer',
                                'description': 'Maximum number of results to return',
                                'default': 10
                            }
                        },
                        'required': ['search_phrase']
                    }
                },
                {
                    'name': 'recommend',
                    'description': 'Get recommendations for AWS documentation and best practices for a specific topic',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'url': {
                                'type': 'string',
                                'description': 'URL of the AWS documentation page to get recommendations for'
                            }
                        },
                        'required': ['url']
                    }
                }
            ]
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'tools': tools
                    }
                })
            }
        
        elif method == 'tools/call':
            # Handle tool execution
            tool_name = params.get('name', '')
            arguments = params.get('arguments', {})
            
            result = asyncio.run(execute_tool(tool_name, arguments))
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': result
                            }
                        ]
                    }
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'error': {
                        'code': -32601,
                        'message': f'Method not found: {method}'
                    }
                })
            }
            
    except Exception as e:
        logger.error(f"MCP protocol error: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'jsonrpc': '2.0',
                'id': event.get('id'),
                'error': {
                    'code': -32603,
                    'message': f'Internal error: {str(e)}'
                }
            })
        }

async def execute_tool(tool_name: str, arguments: Dict[str, Any]) -> str:
    """Execute MCP tools"""
    try:
        if tool_name == 'read_documentation':
            return await call_read_documentation_tool(
                arguments.get('url', ''),
                arguments.get('max_length', 5000),
                arguments.get('start_index', 0)
            )
        elif tool_name == 'search_documentation':
            return await call_search_documentation_tool(
                arguments.get('search_phrase', ''),
                arguments.get('limit', 10)
            )
        elif tool_name == 'recommend':
            return await call_recommend_tool(arguments.get('url', ''))
        else:
            return f"Unknown tool: {tool_name}"
            
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return f"Error executing {tool_name}: {str(e)}"

async def call_read_documentation_tool(url: str, max_length: int = 5000, start_index: int = 0) -> str:
    """Call read_documentation tool"""
    # Import the specific function from server_aws
    from server_aws import read_documentation
    
    # Create a mock context
    class MockContext:
        async def error(self, message: str):
            logger.error(message)
    
    ctx = MockContext()
    result = await read_documentation(ctx, url, max_length, start_index)
    return result

async def call_search_documentation_tool(search_phrase: str, limit: int = 10) -> str:
    """Call search_documentation tool"""
    from server_aws import search_documentation
    
    class MockContext:
        async def error(self, message: str):
            logger.error(message)
    
    ctx = MockContext()
    results = await search_documentation(ctx, search_phrase, limit)
    
    # Format results as string
    if not results:
        return f"No results found for: {search_phrase}"
    
    formatted_results = f"Search results for '{search_phrase}':\n\n"
    for i, result in enumerate(results, 1):
        formatted_results += f"{i}. {result.title}\n"
        formatted_results += f"   URL: {result.url}\n"
        if hasattr(result, 'context') and result.context:
            formatted_results += f"   Context: {result.context}\n"
        formatted_results += "\n"
    
    return formatted_results

async def call_recommend_tool(url: str) -> str:
    """Call recommend tool"""
    from server_aws import recommend
    
    class MockContext:
        async def error(self, message: str):
            logger.error(message)
    
    ctx = MockContext()
    results = await recommend(ctx, url)
    
    # Format results as string
    if not results:
        return f"No recommendations found for: {url}"
    
    formatted_results = f"Recommendations for {url}:\n\n"
    for i, result in enumerate(results, 1):
        formatted_results += f"{i}. {result.title}\n"
        formatted_results += f"   URL: {result.url}\n"
        if hasattr(result, 'description') and result.description:
            formatted_results += f"   Description: {result.description}\n"
        formatted_results += "\n"
    
    return formatted_results

# For local testing
if __name__ == "__main__":
    # Test with different event types
    
    # Test 1: Root endpoint
    print("=== Testing Root Endpoint ===")
    root_event = {
        'httpMethod': 'GET',
        'path': '/',
        'queryStringParameters': None
    }
    result = lambda_handler(root_event, None)
    print(json.dumps(result, indent=2))
    
    print("\n=== Testing Fetch Endpoint ===")
    # Test 2: Fetch endpoint
    fetch_event = {
        'httpMethod': 'GET', 
        'path': '/fetch',
        'queryStringParameters': {
            'url': 'https://docs.aws.amazon.com/lambda/latest/dg/welcome.html'
        }
    }
    result = lambda_handler(fetch_event, None)
    print(json.dumps(result, indent=2))
    
    print("\n=== Testing MCP Initialize ===")
    # Test 3: MCP initialize
    mcp_event = {
        'method': 'initialize',
        'id': 1,
        'jsonrpc': '2.0',
        'params': {
            'protocolVersion': '2024-11-05',
            'capabilities': {}
        }
    }
    result = lambda_handler(mcp_event, None)
    print(json.dumps(result, indent=2))