"""
AWS Lambda handler for AWS Documentation MCP Server with SSE transport
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import json
import logging
import asyncio
import base64
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from server_aws import mcp, read_documentation, search_documentation, recommend

# Import AWS Lambda streamifyResponse if available (deprecated we will remove this soon)
try:
    import awslambda
    HAS_STREAMIFY = True
except ImportError:
    HAS_STREAMIFY = False
    logger.warning("awslambda module not available, falling back to standard response")

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for MCP server with SSE transport
    """
    try:
        # Log the entire event for debugging
        logger.info(f"Lambda event: {json.dumps(event, default=str)}")
        
        # Handle Lambda Function URL events
        if isinstance(event, dict) and 'requestContext' in event and 'http' in event.get('requestContext', {}):
            http_context = event['requestContext']['http']
            method = http_context.get('method', 'GET')
            path = http_context.get('path', '/')
            
            logger.info(f"Lambda Function URL request: {method} {path}")
            
            # CORS preflight
            if method == 'OPTIONS':
                return {
                    'statusCode': 200,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                    },
                    'body': ''
                }
            
            # Root endpoint redirects to /sse
            if path == '/' or path == '':
                return {
                    'statusCode': 302,
                    'headers': {
                        'Location': '/sse',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': ''
                }
            
            # Handle SSE endpoint - both /sse and /sse/
            elif path.startswith('/sse'):
                if method == 'POST':
                    # Parse request body
                    body = parse_request_body(event)
                    if not body:
                        return error_response(400, "Invalid request body")
                    
                    logger.info(f"SSE POST request: {json.dumps(body, default=str)}")
                    
                    # Process MCP request
                    try:
                        # Extract method and ID
                        method = body.get('method', '')
                        request_id = body.get('id')
                        
                        logger.info(f"Processing MCP request: {method} with ID: {request_id}")
                        
                        if method == 'initialize':
                            # Handle initialize request
                            response = {
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
                            }
                            
                            # Return SSE formatted response
                            return {
                                'statusCode': 200,
                                'headers': {
                                    'Content-Type': 'text/event-stream',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                    'X-Accel-Buffering': 'no',  # Important for nginx
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': f"data: {json.dumps(response)}\n\n",
                                'isBase64Encoded': False
                            }
                            
                        elif method == 'tools/list':
                            # Get tools list
                            tools = get_tools_list()
                            response = {
                                'jsonrpc': '2.0',
                                'id': request_id,
                                'result': {
                                    'tools': tools
                                }
                            }
                            
                            # Return SSE formatted response
                            return {
                                'statusCode': 200,
                                'headers': {
                                    'Content-Type': 'text/event-stream',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                    'X-Accel-Buffering': 'no',  # Important for nginx
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': f"data: {json.dumps(response)}\n\n",
                                'isBase64Encoded': False
                            }
                            
                        elif method == 'tools/call':
                            # Handle tool call
                            params = body.get('params', {})
                            tool_name = params.get('name', '')
                            arguments = params.get('arguments', {})
                            
                            logger.info(f"Tool call: {tool_name} with arguments: {json.dumps(arguments, default=str)}")
                            
                            # Create a mock context
                            class MockContext:
                                async def error(self, message: str):
                                    logger.error(message)
                            
                            ctx = MockContext()
                            
                            # Call the appropriate tool
                            if tool_name == 'read_documentation':
                                result = asyncio.run(read_documentation(
                                    ctx, 
                                    arguments.get('url', ''),
                                    arguments.get('max_length', 5000),
                                    arguments.get('start_index', 0)
                                ))
                                tool_result = {
                                    'content': [
                                        {
                                            'type': 'text',
                                            'text': result
                                        }
                                    ]
                                }
                            elif tool_name == 'search_documentation':
                                results = asyncio.run(search_documentation(
                                    ctx,
                                    arguments.get('search_phrase', ''),
                                    arguments.get('limit', 10)
                                ))
                                
                                formatted_results = format_search_results(results)
                                tool_result = {
                                    'content': [
                                        {
                                            'type': 'text',
                                            'text': formatted_results
                                        }
                                    ]
                                }
                            elif tool_name == 'recommend':
                                results = asyncio.run(recommend(
                                    ctx, 
                                    arguments.get('url', '')
                                ))
                                
                                formatted_results = format_recommendation_results(results)
                                tool_result = {
                                    'content': [
                                        {
                                            'type': 'text',
                                            'text': formatted_results
                                        }
                                    ]
                                }
                            else:
                                tool_result = {
                                    'content': [
                                        {
                                            'type': 'text',
                                            'text': f"Unknown tool: {tool_name}"
                                        }
                                    ]
                                }
                            
                            response = {
                                'jsonrpc': '2.0',
                                'id': request_id,
                                'result': tool_result
                            }
                            
                            # Return SSE formatted response
                            return {
                                'statusCode': 200,
                                'headers': {
                                    'Content-Type': 'text/event-stream',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                    'X-Accel-Buffering': 'no',  # Important for nginx
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': f"data: {json.dumps(response)}\n\n",
                                'isBase64Encoded': False
                            }
                        
                        else:
                            # Handle unknown method
                            response = {
                                'jsonrpc': '2.0',
                                'id': request_id,
                                'error': {
                                    'code': -32601,
                                    'message': f'Method not found: {method}'
                                }
                            }
                            
                            # Return SSE formatted response
                            return {
                                'statusCode': 200,
                                'headers': {
                                    'Content-Type': 'text/event-stream',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                    'X-Accel-Buffering': 'no',  # Important for nginx
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': f"data: {json.dumps(response)}\n\n",
                                'isBase64Encoded': False
                            }
                    
                    except Exception as e:
                        logger.error(f"Error processing MCP request: {e}", exc_info=True)
                        response = {
                            'jsonrpc': '2.0',
                            'id': body.get('id'),
                            'error': {
                                'code': -32603,
                                'message': f'Internal error: {str(e)}'
                            }
                        }
                        
                        # Return SSE formatted response
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'text/event-stream',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                                'X-Accel-Buffering': 'no',  # Important for nginx
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': f"data: {json.dumps(response)}\n\n",
                            'isBase64Encoded': False
                        }
                
                else:
                    # GET request to SSE endpoint - return SSE info
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'X-Accel-Buffering': 'no',  # Important for nginx
                            'Access-Control-Allow-Origin': '*'
                        },
                        'body': 'data: {"transport": "sse", "protocol": "MCP", "version": "2024-11-05", "description": "MCP server endpoint using SSE transport"}\n\n',
                        'isBase64Encoded': False
                    }
            
            else:
                return error_response(404, f"Path not found: {path}", {'available_paths': ['/', '/sse']})
        
        # Handle API Gateway events
        elif isinstance(event, dict) and 'httpMethod' in event:
            path = event.get('path', '/')
            method = event.get('httpMethod', 'GET')
            
            logger.info(f"API Gateway request: {method} {path}")
            
            # Process similar to Lambda Function URL
            # (Code similar to above, omitted for brevity)
            
            return error_response(501, "API Gateway support not implemented")
        
        # Handle direct Lambda invocation (MCP client)
        elif isinstance(event, dict) and ('method' in event or 'jsonrpc' in event):
            logger.info(f"Direct MCP request: {json.dumps(event, default=str)}")
            
            # Extract method and ID
            method = event.get('method', '')
            request_id = event.get('id')
            
            logger.info(f"Processing direct MCP request: {method} with ID: {request_id}")
            
            # Process similar to SSE POST request
            # (Code similar to above, omitted for brevity)
            
            return error_response(501, "Direct invocation not supported")
        
        else:
            return error_response(400, "Unknown event type", {'event_keys': list(event.keys()) if isinstance(event, dict) else 'not a dict'})
            
    except Exception as e:
        logger.error(f"Lambda handler error: {e}", exc_info=True)
        return error_response(500, f"Internal server error: {str(e)}")

def parse_request_body(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse request body from event"""
    if 'body' not in event:
        return None
        
    body = event['body']
    if not body:
        return {}
    
    if event.get('isBase64Encoded', False):
        try:
            body = base64.b64decode(body).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to decode base64 body: {e}")
            return None
        
    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            logger.error("Failed to parse request body as JSON")
            return None
    elif isinstance(body, dict):
        return body
    else:
        logger.error(f"Unexpected body type: {type(body)}")
        return None

def error_response(status_code: int, message: str, extra: Dict[str, Any] = None) -> Dict[str, Any]:
    """Create error response"""
    body = {'error': message}
    if extra:
        body.update(extra)
        
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }

def get_tools_list():
    """Get list of available tools"""
    return [
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

def format_search_results(results):
    """Format search results as text"""
    if not results:
        return "No results found"
    
    formatted_text = "Search results:\n\n"
    for i, result in enumerate(results, 1):
        formatted_text += f"{i}. {result.title}\n"
        formatted_text += f"   URL: {result.url}\n"
        if hasattr(result, 'context') and result.context:
            formatted_text += f"   Context: {result.context}\n"
        formatted_text += "\n"
    
    return formatted_text

def format_recommendation_results(results):
    """Format recommendation results as text"""
    if not results:
        return "No recommendations found"
    
    formatted_text = "Recommendations:\n\n"
    for i, result in enumerate(results, 1):
        formatted_text += f"{i}. {result.title}\n"
        formatted_text += f"   URL: {result.url}\n"
        if hasattr(result, 'context') and result.context:
            formatted_text += f"   Context: {result.context}\n"
        formatted_text += "\n"
    
    return formatted_text

if __name__ == "__main__":
    # Test with a mock event
    mock_event = {
        'requestContext': {
            'http': {
                'method': 'POST',
                'path': '/sse'
            }
        },
        'body': json.dumps({
            'jsonrpc': '2.0',
            'id': '1',
            'method': 'initialize'
        }),
        'isBase64Encoded': False
    }
    
    result = lambda_handler(mock_event, None)
    print(json.dumps(result, indent=2))
