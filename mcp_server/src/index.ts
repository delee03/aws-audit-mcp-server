/**
 * AWS Documentation MCP Server - Complete TypeScript Implementation
 * Migrated from Python version with Streamable HTTP transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { 
  readDocumentationImpl,
  searchDocumentationImpl, 
  getRecommendationsImpl
} from './server-utils';
import { SearchResult, RecommendationResult, ServerConfig } from './models';

// Server configuration
const config: ServerConfig = {
  SEARCH_API_URL: 'https://proxy.search.docs.aws.amazon.com/search',
  RECOMMENDATIONS_API_URL: 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations',
  DEFAULT_USER_AGENT: 'CloudflareWorkers-MCP/1.0',
};

// Create MCP server instance
const server = new McpServer({
  name: "aws-documentation-mcp-server",
  version: "1.0.0",
});

// Generate session UUID
function generateSessionUuid(): string {
  return crypto.randomUUID();
}

// Helper function for consistent SSE headers
function createSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-session-id, Authorization, User-Agent, Cache-Control',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

// Tool 1: Search Documentation
server.tool(
  "search_documentation",
  "Search AWS documentation using the official search API",
  {
    query: z.string().describe('Search query for AWS documentation'),
    max_results: z.number().optional().default(10).describe('Maximum number of results to return'),
    start_index: z.number().optional().default(0).describe('Starting index for pagination'),
  },
  async ({ query, max_results = 10, start_index = 0 }) => {
    const sessionUuid = generateSessionUuid();
    
    try {
      const results = await searchDocumentationImpl(
        query,
        max_results,
        start_index,
        config.SEARCH_API_URL,
        sessionUuid
      );

      // Format results like Python version
      let formattedText = `Found ${results.length} results for "${query}":\n\n`;
      
      results.forEach((result: any, index: number) => {
        formattedText += `## ${result.rank_order || index + 1}. ${result.title}\n\n`;
        formattedText += `**URL**: [${result.title}](${result.url})\n\n`;
        if (result.context) {
          formattedText += `**Summary**: ${result.context}\n\n`;
        }
        formattedText += '---\n\n';
      });

      return {
        content: [{
          type: "text",
          text: formattedText,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool 2: Read Documentation
server.tool(
  "read_documentation",
  "Fetch and convert AWS documentation pages to markdown format",
  {
    url: z.string().url().describe('AWS documentation URL to read'),
    max_length: z.number().optional().default(50000).describe('Maximum content length to return'),
    start_index: z.number().optional().default(0).describe('Starting index for pagination'),
  },
  async ({ url, max_length = 50000, start_index = 0 }) => {
    // Validate AWS docs URL
    if (!url.includes('docs.aws.amazon.com') && !url.includes('aws.amazon.com/documentation')) {
      return {
        content: [{
          type: "text",
          text: 'Error: URL must be from AWS documentation (docs.aws.amazon.com)',
        }],
        isError: true,
      };
    }

    const sessionUuid = generateSessionUuid();
    
    try {
      const result = await readDocumentationImpl(
        url,
        max_length,
        start_index,
        sessionUuid
      );

      return {
        content: [{
          type: "text",
          text: result,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error reading documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get Recommendations
server.tool(
  "recommend",
  "Get related AWS documentation recommendations based on content or topic",
  {
    content: z.string().describe('Content or topic to get recommendations for'),
    max_results: z.number().optional().default(5).describe('Maximum number of recommendations to return'),
  },
  async ({ content, max_results = 5 }) => {
    const sessionUuid = generateSessionUuid();
    
    try {
      const recommendations = await getRecommendationsImpl(
        content,
        max_results,
        config.RECOMMENDATIONS_API_URL,
        sessionUuid
      );

      // Format recommendations like Python version
      let formattedText = `Found ${recommendations.length} recommendations for your content:\n\n`;
      
      recommendations.forEach((rec: any, index: number) => {
        formattedText += `## ${index + 1}. ${rec.title}\n\n`;
        formattedText += `**URL**: [${rec.title}](${rec.url})\n\n`;
        if (rec.context) {
          formattedText += `**Description**: ${rec.context}\n\n`;
        }
        formattedText += '---\n\n';
      });

      return {
        content: [{
          type: "text",
          text: formattedText,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// Store transports by session ID for Streamable HTTP - Not compatible with Cloudflare Workers
// const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Cloudflare Workers export with SSE transport only
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'aws-docs-mcp-server',
        version: '1.0.0',
        transport: 'sse',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Root endpoint
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'AWS Documentation MCP Server - TypeScript',
        version: '1.0.0',
        transport: 'SSE (Event Stream)',
        endpoints: {
          health: '/health',
          sse: '/sse (SSE Transport)',
        },
        tools: ['search_documentation', 'read_documentation', 'recommend'],
        compatibility: 'MCP clients with SSE support (n8n, Cursor, etc.)',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Streamable HTTP not compatible with Cloudflare Workers
    /*
    if (url.pathname === '/mcp') {
      // Not implemented for Cloudflare Workers
      return new Response('Streamable HTTP transport not supported in Cloudflare Workers', { 
        status: 501,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    */

    // Legacy SSE endpoint for backwards compatibility
    if (url.pathname === '/sse' && request.method === 'GET') {
      const sessionId = crypto.randomUUID();
      return new Response(`event: endpoint\ndata: /sse/message?sessionId=${sessionId}\n\n`, {
        headers: createSSEHeaders(),
      });
    }

    // Legacy SSE message endpoint
    if ((url.pathname === '/sse' || url.pathname === '/sse/message') && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const sessionUuid = generateSessionUuid();
        
        console.log('SSE Request:', body.method);
        
        switch (body.method) {
          case 'initialize':
            return new Response(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'aws-documentation-mcp-server', version: '1.0.0' },
                instructions: 'Use search_documentation to find AWS docs, read_documentation to get content, and recommend for related topics.',
              },
            })}\n\n`, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-session-id, Authorization, User-Agent, Cache-Control',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              },
            });
            
          case 'tools/list':
            return new Response(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                tools: [
                  {
                    name: 'search_documentation',
                    description: 'Search AWS documentation using the official search API',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        query: { type: 'string', description: 'Search query' },
                        max_results: { type: 'number', default: 10 },
                        start_index: { type: 'number', default: 0 },
                      },
                      required: ['query'],
                    },
                  },
                  {
                    name: 'read_documentation',
                    description: 'Read AWS documentation page',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', description: 'AWS docs URL' },
                        max_length: { type: 'number', default: 50000 },
                        start_index: { type: 'number', default: 0 },
                      },
                      required: ['url'],
                    },
                  },
                  {
                    name: 'recommend',
                    description: 'Get AWS documentation recommendations',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'Content for recommendations' },
                        max_results: { type: 'number', default: 5 },
                      },
                      required: ['content'],
                    },
                  },
                ],
              },
            })}\n\n`, {
              headers: createSSEHeaders(),
            });
            
          case 'tools/call':
            const toolName = body.params?.name;
            const args = body.params?.arguments || {};
            
            let toolResult;
            try {
              switch (toolName) {
                case 'search_documentation':
                  const searchResults = await searchDocumentationImpl(
                    args.query || '',
                    args.max_results || 10,
                    args.start_index || 0,
                    config.SEARCH_API_URL,
                    sessionUuid
                  );
                  
                  let searchText = `Found ${searchResults.length} results:\n\n`;
                  searchResults.forEach((result: any, index: number) => {
                    searchText += `${index + 1}. ${result.title}\n${result.url}\n${result.context || ''}\n---\n`;
                  });
                  
                  toolResult = { content: [{ type: 'text', text: searchText }] };
                  break;
                  
                case 'read_documentation':
                  const docResult = await readDocumentationImpl(
                    args.url || '',
                    args.max_length || 50000,
                    args.start_index || 0,
                    sessionUuid
                  );
                  toolResult = { content: [{ type: 'text', text: docResult }] };
                  break;
                  
                case 'recommend':
                  const recommendations = await getRecommendationsImpl(
                    args.content || '',
                    args.max_results || 5,
                    config.RECOMMENDATIONS_API_URL,
                    sessionUuid
                  );
                  
                  let recText = `Found ${recommendations.length} recommendations:\n\n`;
                  recommendations.forEach((rec: any, index: number) => {
                    recText += `${index + 1}. ${rec.title}\n${rec.url}\n${rec.context || ''}\n---\n`;
                  });
                  
                  toolResult = { content: [{ type: 'text', text: recText }] };
                  break;
                  
                default:
                  toolResult = { 
                    content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
                    isError: true 
                  };
              }
            } catch (toolError) {
              toolResult = { 
                content: [{ type: 'text', text: `Tool error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}` }],
                isError: true 
              };
            }
            
            return new Response(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: toolResult,
            })}\n\n`, {
              headers: createSSEHeaders(),
            });
            
          default:
            return new Response(`data: ${JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32601, message: 'Method not found' },
            })}\n\n`, {
              headers: createSSEHeaders(),
            });
        }
      } catch (error) {
        return new Response(`data: ${JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: 'Internal error' },
        })}\n\n`, {
          headers: createSSEHeaders(),
        });
      }
    }

    // OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-session-id, Authorization, User-Agent, Cache-Control',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }

    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    });
  },
}; 