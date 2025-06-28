/**
 * AWS Documentation MCP Server for Cloudflare Workers
 * 
 * Based on Cloudflare Workers Runtime APIs:
 * https://developers.cloudflare.com/workers/runtime-apis/
 */

// Import MCP and AWS integration
import { McpServer } from './mcp-server.js';

// Environment configuration
const DEFAULT_CONFIG = {
  SEARCH_API_URL: 'https://proxy.search.docs.aws.amazon.com/search',
  RECOMMENDATIONS_API_URL: 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations',
  DEFAULT_USER_AGENT: 'CloudflareWorkers-MCP/1.0'
};

/**
 * Main Worker entry point
 * https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
 */
export default {
  async fetch(request, env, ctx) {
    // Get URL and method
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control, Authorization, Last-Event-ID',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    try {
      // Route requests
      switch (url.pathname) {
        case '/':
          return handleRoot(corsHeaders);
        
        case '/health':
          return handleHealth(corsHeaders);
        
        case '/sse':
        case '/sse/message':
          return await handleSSE(request, env, ctx, corsHeaders);
        
        default:
          return new Response('Not Found', { 
            status: 404, 
            headers: corsHeaders 
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Internal Server Error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};

/**
 * Handle root endpoint
 */
function handleRoot(corsHeaders) {
  const response = {
    message: 'AWS Documentation MCP Server',
    version: '1.0.0',
    runtime: 'Cloudflare Workers',
    endpoints: {
      health: '/health',
      sse: '/sse'
    },
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handle health check endpoint
 */
function handleHealth(corsHeaders) {
  const health = {
    status: 'healthy',
    service: 'aws-docs-mcp-server',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
    uptime: 'N/A (serverless)',
    memory: 'N/A (edge runtime)'
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handle SSE endpoint for MCP protocol
 * Implements bidirectional SSE pattern với session support
 */
async function handleSSE(request, env, ctx, corsHeaders) {
  const url = new URL(request.url);
  const method = request.method;

  // Handle session-based messaging endpoint
  if (url.pathname === '/sse/message') {
    const sessionId = url.searchParams.get('sessionId');
    
    if (method === 'POST' && sessionId) {
      try {
        const body = await request.text();
        const mcpRequest = JSON.parse(body);
        
        // Initialize MCP server
        const mcpServer = new McpServer(DEFAULT_CONFIG);
        
        // Process MCP request
        const response = await mcpServer.handleRequest(mcpRequest);
        
        // Return SSE formatted response
        return new Response(
          `data: ${JSON.stringify(response)}\n\n`,
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache'
            }
          }
        );
      } catch (error) {
        console.error('SSE message error:', error);
        return new Response(
          `data: ${JSON.stringify({ error: `Processing error: ${error.message}` })}\n\n`,
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream'
            }
          }
        );
      }
    }
    
    return new Response('Invalid message request', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Main SSE endpoint - establish connection
  if (method === 'GET') {
    // Generate session ID
    const sessionId = generateSessionId();
    
    // Send immediate endpoint announcement
    const sseResponse = `event: endpoint\ndata: /sse/message?sessionId=${sessionId}\n\n`;
    
    return new Response(sseResponse, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  }

  return new Response('Method not allowed', { 
    status: 405, 
    headers: corsHeaders 
  });
}

/**
 * Generate session ID for SSE connections
 */
function generateSessionId() {
  // Simple session ID generation
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
} 
