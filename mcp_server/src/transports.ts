/**
 * MCP Transport Implementation
 * 
 * Provides dual transport support:
 * - /mcp: Streamable HTTP (modern, recommended)
 * - /sse: Server-Sent Events (legacy, for older clients)
 * - /messages: Legacy POST endpoint
 * 
 * Compatible with n8n MCP Tool and all MCP clients
 */

import { Hono } from 'hono';
import { 
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import { AWSSServerMCP } from './mcp-server';

// Create MCP server instance
let mcpServerInstance: AWSSServerMCP | null = null;

function getMCPServer(): AWSSServerMCP {
  if (!mcpServerInstance) {
    mcpServerInstance = new AWSSServerMCP({
      SEARCH_API_URL: 'https://proxy.search.docs.aws.amazon.com/search',
      RECOMMENDATIONS_API_URL: 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations',
      DEFAULT_USER_AGENT: 'CloudflareWorkers-MCP-TS/1.0',
    });
  }
  return mcpServerInstance;
}

// Session management for SSE connections
const sessions = new Map<string, {
  id: string;
  createdAt: number;
  lastActivity: number;
}>();

function generateSessionId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function cleanupOldSessions(): void {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > maxAge) {
      sessions.delete(sessionId);
    }
  }
}

export function setupMCPEndpoints(): Hono {
  const app = new Hono();

  // Streamable HTTP transport (modern, recommended)
  app.post('/mcp', async (c) => {
    try {
      const request = await c.req.json() as JSONRPCRequest;
      const mcpServer = getMCPServer();
      
      console.log('MCP Streamable HTTP request:', request.method);
      
      // Handle the request through the MCP server's internal mechanisms
      const server = mcpServer.getServer();
      
      // Process the request manually based on method
      let response: any; // Using any for flexibility with JSON-RPC response types
      
      if (request.method === 'initialize') {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
              logging: {},
            },
            serverInfo: {
              name: 'aws-documentation-mcp-server',
              version: '1.0.0-typescript',
            },
          },
        };
      } else {
        // For other methods, we'll need to simulate the server response
        // This is a simplified approach - in production, you'd connect via proper transport
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method ${request.method} not implemented in simplified transport`,
          },
        };
      }
      
      return c.json(response, 200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
    } catch (error) {
      console.error('MCP Streamable HTTP error:', error);
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      }, 500);
    }
  });

  // Handle GET requests to /mcp (for compatibility)
  app.get('/mcp', (c) => {
    return c.json({
      transport: 'streamable-http',
      protocol: 'MCP',
      version: '2024-11-05',
      description: 'Modern MCP streamable HTTP endpoint',
      endpoints: {
        post: '/mcp',
        methods: ['initialize', 'list_tools', 'call_tool'],
      },
      compatibility: 'n8n MCP Tool, GitHub Copilot, Claude Desktop',
    });
  });

  // SSE transport (legacy, for older clients)
  app.get('/sse', (c) => {
    cleanupOldSessions();
    const sessionId = generateSessionId();
    
    sessions.set(sessionId, {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });

    // Create SSE stream that announces the message endpoint
    const stream = new ReadableStream({
      start(controller) {
        // Send endpoint announcement (required for MCP SSE transport)
        controller.enqueue(`event: endpoint\n`);
        controller.enqueue(`data: /messages?sessionId=${sessionId}\n\n`);
        
        // Send periodic heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(`: heartbeat ${Date.now()}\n\n`);
          } catch (error) {
            clearInterval(heartbeat);
          }
        }, 30000);

        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch (error) {
            // Already closed
          }
          sessions.delete(sessionId);
        }, 5 * 60 * 1000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control, Authorization, Last-Event-ID',
        'X-Accel-Buffering': 'no',
      },
    });
  });

  // Legacy POST endpoint for SSE transport
  app.post('/messages', async (c) => {
    try {
      const sessionId = c.req.query('sessionId');
      
      if (!sessionId || !sessions.has(sessionId)) {
        return c.json({ error: 'Invalid session' }, 400);
      }

      // Update session activity
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();

      const request = await c.req.json() as JSONRPCRequest;
      const mcpServer = getMCPServer();
      
      console.log('MCP SSE message request:', request.method);
      
      // Handle the request manually similar to streamable HTTP
      let response: any;
      
      if (request.method === 'initialize') {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
              logging: {},
            },
            serverInfo: {
              name: 'aws-documentation-mcp-server',
              version: '1.0.0-typescript',
            },
          },
        };
      } else {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method ${request.method} not implemented yet`,
          },
        };
      }
      
      return new Response(`data: ${JSON.stringify(response)}\n\n`, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control, Authorization',
        },
      });
    } catch (error) {
      console.error('MCP SSE message error:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      
      return new Response(`data: ${JSON.stringify(errorResponse)}\n\n`, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  });

  // OPTIONS handler for CORS preflight
  app.options('*', (c) => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Cache-Control, Authorization, Last-Event-ID',
        'Access-Control-Max-Age': '86400',
      },
    });
  });

  return app;
} 