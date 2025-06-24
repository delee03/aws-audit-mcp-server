import json
import os
import sys
from src.server_aws import mcp

def lambda_handler(event, context):
    """
    AWS Lambda handler for MCP server
    """
    try:
        # Set up environment for MCP
        os.environ['FASTMCP_LOG_LEVEL'] = 'INFO'
        
        # Handle different event types
        if 'body' in event:
            # API Gateway event
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'message': 'MCP Server is running',
                    'tools': ['read_documentation', 'search_documentation', 'recommend']
                })
            }
        else:
            # Direct Lambda invocation
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'MCP Server is running',
                    'tools': ['read_documentation', 'search_documentation', 'recommend']
                })
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

# For local testing
if __name__ == "__main__":
    # Simulate Lambda event
    event = {'body': '{}'}
    result = lambda_handler(event, None)
    print(json.dumps(result, indent=2)) 