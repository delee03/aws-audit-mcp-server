/**
 * MCP Server implementation for Cloudflare Workers
 * Adapted from Python FastMCP to JavaScript
 */

export class McpServer {
  constructor(config) {
    this.config = config;
    this.sessionUuid = this.generateUUID();
    
    // MCP server info
    this.serverInfo = {
      name: 'aws-documentation-mcp-server',
      version: '1.0.0',
      runtime: 'cloudflare-workers'
    };

    // MCP capabilities
    this.capabilities = {
      tools: {},
      resources: {},
      prompts: {},
      logging: {}
    };

    // Available tools
    this.tools = {
      read_documentation: {
        name: 'read_documentation',
        description: 'Fetch and convert an AWS documentation page to markdown format',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the AWS documentation page to read'
            },
            max_length: {
              type: 'integer',
              description: 'Maximum number of characters to return',
              default: 5000,
              minimum: 1,
              maximum: 1000000
            },
            start_index: {
              type: 'integer', 
              description: 'Starting character index for pagination',
              default: 0,
              minimum: 0
            }
          },
          required: ['url']
        }
      },
      search_documentation: {
        name: 'search_documentation',
        description: 'Search AWS documentation using the official AWS Documentation Search API',
        inputSchema: {
          type: 'object',
          properties: {
            search_phrase: {
              type: 'string',
              description: 'Search phrase to use'
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of results to return',
              default: 10,
              minimum: 1,
              maximum: 50
            }
          },
          required: ['search_phrase']
        }
      },
      recommend: {
        name: 'recommend',
        description: 'Get content recommendations for an AWS documentation page',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the AWS documentation page to get recommendations for'
            }
          },
          required: ['url']
        }
      }
    };
  }

  /**
   * Generate UUID v4
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Handle MCP request
   */
  async handleRequest(request) {
    const { jsonrpc, id, method, params } = request;

    if (jsonrpc !== '2.0') {
      return this.createErrorResponse(id, -32600, 'Invalid Request: jsonrpc must be 2.0');
    }

    try {
      let result;

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        
        case 'tools/call':
          result = await this.handleToolsCall(params);
          break;
        
        case 'resources/list':
          result = { resources: [] };
          break;
        
        case 'prompts/list':
          result = { prompts: [] };
          break;
        
        default:
          return this.createErrorResponse(id, -32601, `Method not found: ${method}`);
      }

      return this.createSuccessResponse(id, result);
    } catch (error) {
      console.error('MCP request error:', error);
      return this.createErrorResponse(id, -32603, `Internal error: ${error.message}`);
    }
  }

  /**
   * Handle initialize request
   */
  async handleInitialize(params) {
    return {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      instructions: `
# AWS Documentation MCP Server

This server provides tools to access public AWS documentation, search for content, and get recommendations.

## Available Tools

- **read_documentation**: Fetch and convert AWS documentation pages to markdown
- **search_documentation**: Search AWS documentation using the official search API  
- **recommend**: Get related content recommendations for documentation pages

## Best Practices

- Use specific technical terms when searching
- For long documents, use pagination with start_index parameter
- Always cite documentation URLs when providing information
      `.trim()
    };
  }

  /**
   * Handle tools/list request
   */
  async handleToolsList() {
    return {
      tools: Object.values(this.tools)
    };
  }

  /**
   * Handle tools/call request
   */
  async handleToolsCall(params) {
    const { name, arguments: args } = params;

    switch (name) {
      case 'read_documentation':
        return await this.readDocumentation(args);
      
      case 'search_documentation':
        return await this.searchDocumentation(args);
      
      case 'recommend':
        return await this.recommend(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Read documentation tool implementation
   */
  async readDocumentation(args) {
    const { url, max_length = 5000, start_index = 0 } = args;

    // Validate URL
    if (!url.match(/^https?:\/\/docs\.aws\.amazon\.com\//)) {
      throw new Error('URL must be from the docs.aws.amazon.com domain');
    }
    if (!url.endsWith('.html')) {
      throw new Error('URL must end with .html');
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.DEFAULT_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const markdown = this.htmlToMarkdown(html);
      
      // Apply pagination
      let content = start_index > 0 ? markdown.slice(start_index) : markdown;
      
      if (content.length > max_length) {
        content = content.slice(0, max_length);
        content += "\n\n[Content truncated - use start_index parameter to continue reading]";
      }

      return {
        content: [{
          type: 'text',
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to fetch documentation: ${error.message}`);
    }
  }

  /**
   * Search documentation tool implementation
   */
  async searchDocumentation(args) {
    const { search_phrase, limit = 10 } = args;

    const requestBody = {
      textQuery: {
        input: search_phrase,
      },
      contextAttributes: [{ key: 'domain', value: 'docs.aws.amazon.com' }],
      acceptSuggestionBody: 'RawText',
      locales: ['en_us'],
    };

    const searchUrl = `${this.config.SEARCH_API_URL}?session=${this.sessionUuid}`;

    try {
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.config.DEFAULT_USER_AGENT,
          'X-MCP-Session-Id': this.sessionUuid,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }

      const data = await response.json();
      const results = [];

      if (data.suggestions) {
        for (let i = 0; i < Math.min(data.suggestions.length, limit); i++) {
          const suggestion = data.suggestions[i];
          if (suggestion.textExcerptSuggestion) {
            const textSuggestion = suggestion.textExcerptSuggestion;
            results.push({
              rank_order: i + 1,
              url: textSuggestion.link || '',
              title: textSuggestion.title || '',
              context: textSuggestion.summary || textSuggestion.suggestionBody || null
            });
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Recommend tool implementation
   */
  async recommend(args) {
    const { url } = args;

    const recommendationUrl = `${this.config.RECOMMENDATIONS_API_URL}?path=${url}&session=${this.sessionUuid}`;

    try {
      const response = await fetch(recommendationUrl, {
        headers: {
          'User-Agent': this.config.DEFAULT_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`Recommendations API returned ${response.status}`);
      }

      const data = await response.json();
      const results = [];

      if (data.recommendations) {
        for (const rec of data.recommendations) {
          if (rec.url && rec.title) {
            results.push({
              url: rec.url,
              title: rec.title,
              context: rec.description || null
            });
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Recommendations failed: ${error.message}`);
    }
  }

  /**
   * Simple HTML to Markdown conversion
   */
  htmlToMarkdown(html) {
    // Remove script and style elements
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Convert headings
    html = html.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (match, level, content) => {
      const hashes = '#'.repeat(parseInt(level));
      return `\n${hashes} ${content.replace(/<[^>]*>/g, '')}\n`;
    });
    
    // Convert paragraphs
    html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
    
    // Convert links
    html = html.replace(/<a[^>]*href=['"](.*?)['"][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Convert code blocks
    html = html.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    
    // Convert lists
    html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    html = html.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
    
    // Remove remaining HTML tags
    html = html.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
    html = html.trim();
    
    return html;
  }

  /**
   * Create success response
   */
  createSuccessResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(id, code, message) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    };
  }
} 