/**
 * AWS Documentation MCP Server Implementation
 * 
 * Provides 3 main tools:
 * - read_documentation: Fetch and convert AWS docs to markdown
 * - search_documentation: Search AWS documentation
 * - recommend: Get content recommendations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { 
  searchDocumentation, 
  readDocumentation, 
  getRecommendations,
  type SearchResult,
  type DocumentContent,
  type Recommendation
} from './tools/aws-docs';

// Server configuration schema
const ServerConfigSchema = z.object({
  SEARCH_API_URL: z.string().default('https://proxy.search.docs.aws.amazon.com/search'),
  RECOMMENDATIONS_API_URL: z.string().default('https://contentrecs-api.docs.aws.amazon.com/v1/recommendations'),
  DEFAULT_USER_AGENT: z.string().default('CloudflareWorkers-MCP-TS/1.0'),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// Tool argument schemas
const SearchArgumentsSchema = z.object({
  query: z.string().describe('Search query for AWS documentation'),
  max_results: z.number().optional().default(10).describe('Maximum number of results to return'),
  start_index: z.number().optional().default(0).describe('Starting index for pagination'),
});

const ReadArgumentsSchema = z.object({
  url: z.string().url().describe('AWS documentation URL to read'),
  max_length: z.number().optional().default(50000).describe('Maximum content length'),
});

const RecommendArgumentsSchema = z.object({
  content: z.string().describe('Content or topic to get recommendations for'),
  max_results: z.number().optional().default(5).describe('Maximum number of recommendations'),
});

export class AWSSServerMCP {
  private server: Server;
  private config: ServerConfig;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = ServerConfigSchema.parse(config);
    this.server = new Server(
      {
        name: 'aws-documentation-mcp-server',
        version: '1.0.0-typescript',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documentation',
            description: 'Search AWS documentation using the official search API. Use specific technical terms for best results.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for AWS documentation (e.g., "Lambda functions", "S3 bucket policy")',
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
                start_index: {
                  type: 'number', 
                  description: 'Starting index for pagination (default: 0)',
                  default: 0,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'read_documentation',
            description: 'Fetch and convert AWS documentation pages to markdown format. Provide the full AWS docs URL.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'AWS documentation URL to read (e.g., "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html")',
                },
                max_length: {
                  type: 'number',
                  description: 'Maximum content length to return (default: 50000)',
                  default: 50000,
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'recommend',
            description: 'Get related AWS documentation recommendations based on content or topic.',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Content or topic to get recommendations for (e.g., "serverless computing", "database migration")',
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of recommendations to return (default: 5)',
                  default: 5,
                },
              },
              required: ['content'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_documentation': {
            const validatedArgs = SearchArgumentsSchema.parse(args);
            const results = await searchDocumentation(
              validatedArgs.query,
              validatedArgs.max_results,
              validatedArgs.start_index,
              this.config
            );

            return {
              content: [
                {
                  type: 'text',
                  text: this.formatSearchResults(results),
                },
              ],
            };
          }

          case 'read_documentation': {
            const validatedArgs = ReadArgumentsSchema.parse(args);
            const content = await readDocumentation(
              validatedArgs.url,
              validatedArgs.max_length,
              this.config
            );

            return {
              content: [
                {
                  type: 'text',
                  text: this.formatDocumentContent(content),
                },
              ],
            };
          }

          case 'recommend': {
            const validatedArgs = RecommendArgumentsSchema.parse(args);
            const recommendations = await getRecommendations(
              validatedArgs.content,
              validatedArgs.max_results,
              this.config
            );

            return {
              content: [
                {
                  type: 'text',
                  text: this.formatRecommendations(recommendations),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        console.error(`Error in tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No results found for your search query.';
    }

    let formatted = `Found ${results.length} results:\n\n`;
    
    results.forEach((result, index) => {
      formatted += `## ${index + 1}. ${result.title}\n\n`;
      formatted += `**URL**: ${result.url}\n\n`;
      if (result.excerpt) {
        formatted += `**Summary**: ${result.excerpt}\n\n`;
      }
      if (result.lastModified) {
        formatted += `**Last Modified**: ${result.lastModified}\n\n`;
      }
      formatted += '---\n\n';
    });

    return formatted;
  }

  private formatDocumentContent(content: DocumentContent): string {
    let formatted = `# ${content.title}\n\n`;
    formatted += `**Source**: [${content.url}](${content.url})\n\n`;
    
    if (content.lastModified) {
      formatted += `**Last Modified**: ${content.lastModified}\n\n`;
    }
    
    formatted += '---\n\n';
    formatted += content.content;
    
    return formatted;
  }

  private formatRecommendations(recommendations: Recommendation[]): string {
    if (recommendations.length === 0) {
      return 'No recommendations found.';
    }

    let formatted = `Found ${recommendations.length} recommendations:\n\n`;
    
    recommendations.forEach((rec, index) => {
      formatted += `## ${index + 1}. ${rec.title}\n\n`;
      formatted += `**URL**: [${rec.title}](${rec.url})\n\n`;
      if (rec.description) {
        formatted += `**Description**: ${rec.description}\n\n`;
      }
      if (rec.category) {
        formatted += `**Category**: ${rec.category}\n\n`;
      }
      formatted += '---\n\n';
    });

    return formatted;
  }

  public getServer(): Server {
    return this.server;
  }
} 