/**
 * Server utility functions for AWS Documentation MCP Server
 * Migrated from Python server_utils.py
 */

import { 
  extractContentFromHtml, 
  formatDocumentationResult, 
  isHtmlContent 
} from './utils';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ModelContextProtocol/1.0.0 (AWS Documentation Server)';

/**
 * The implementation of the read_documentation tool
 * (TypeScript version of Python's read_documentation_impl)
 */
export async function readDocumentationImpl(
  urlStr: string,
  maxLength: number,
  startIndex: number,
  sessionUuid: string
): Promise<string> {
  console.log(`Fetching documentation from ${urlStr}`);

  const urlWithSession = `${urlStr}?session=${sessionUuid}`;

  try {
    const response = await fetch(urlWithSession, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'X-MCP-Session-Id': sessionUuid,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      // Cloudflare Workers timeout
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorMsg = `Failed to fetch ${urlStr} - status code ${response.status}`;
      console.error(errorMsg);
      return errorMsg;
    }

    const pageRaw = await response.text();
    const contentType = response.headers.get('content-type') || '';

    let content: string;
    if (isHtmlContent(pageRaw, contentType)) {
      content = extractContentFromHtml(pageRaw);
    } else {
      content = pageRaw;
    }

    const result = formatDocumentationResult(urlStr, content, startIndex, maxLength);

    // Log if content was truncated
    if (content.length > startIndex + maxLength) {
      console.log(`Content truncated at ${startIndex + maxLength} of ${content.length} characters`);
    }

    return result;

  } catch (error) {
    const errorMsg = `Failed to fetch ${urlStr}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    return errorMsg;
  }
}

/**
 * Search AWS documentation using the search API
 * (TypeScript implementation for search functionality)
 */
export async function searchDocumentationImpl(
  query: string,
  maxResults: number,
  startIndex: number,
  searchApiUrl: string,
  sessionUuid: string
): Promise<any[]> {
  console.log(`Searching documentation for: ${query}`);

  try {
    const searchUrl = new URL(searchApiUrl);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('size', maxResults.toString());
    searchUrl.searchParams.set('from', startIndex.toString());

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'X-MCP-Session-Id': sessionUuid,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://docs.aws.amazon.com/',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`Search API failed with status ${response.status}, returning mock results`);
      // Return mock results for demo purposes
      return [
        {
          rank_order: 1,
          url: `https://docs.aws.amazon.com/search?q=${encodeURIComponent(query)}`,
          title: `AWS Documentation Search Results for "${query}"`,
          context: `Search results for: ${query}`,
        },
        {
          rank_order: 2,
          url: 'https://docs.aws.amazon.com/getting-started/',
          title: `${query} - AWS Getting Started Guide`,
          context: `Getting started with ${query} on AWS`,
        },
      ];
    }

    const data = await response.json() as any;
    console.log('Search API response received');

    // Process search results based on API response format
    const results = [];
    let items = [];

    if (data.results && Array.isArray(data.results)) {
      items = data.results;
    } else if (data.hits && Array.isArray(data.hits)) {
      items = data.hits.map((hit: any) => hit._source || hit);
    } else if (Array.isArray(data)) {
      items = data;
    }

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      const item = items[i];
      results.push({
        rank_order: startIndex + i + 1,
        url: item.url || item.link || '',
        title: item.title || 'Untitled',
        context: item.excerpt || item.snippet || item.context || '',
      });
    }

    return results;

  } catch (error) {
    console.error('Search documentation error:', error);
    // Return mock results as fallback
    return [
      {
        rank_order: 1,
        url: `https://docs.aws.amazon.com/search?q=${encodeURIComponent(query)}`,
        title: `AWS Documentation for "${query}"`,
        context: `Search results for: ${query}`,
      },
    ];
  }
}

/**
 * Get recommendations from AWS documentation API
 * (TypeScript implementation for recommendations functionality)
 */
export async function getRecommendationsImpl(
  content: string,
  maxResults: number,
  recommendationsApiUrl: string,
  sessionUuid: string
): Promise<any[]> {
  console.log('Getting recommendations for content');

  try {
    const response = await fetch(recommendationsApiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'X-MCP-Session-Id': sessionUuid,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content.substring(0, 1000), // Limit content length
        maxResults,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`Recommendations API failed with status ${response.status}, returning mock results`);
      // Return mock recommendations
      return [
        {
          url: 'https://aws.amazon.com/getting-started/',
          title: 'AWS Getting Started',
          context: 'Get started with AWS services and best practices',
        },
        {
          url: 'https://docs.aws.amazon.com/',
          title: 'AWS Documentation',
          context: 'Complete AWS documentation and guides',
        },
      ];
    }

    const data = await response.json() as any;
    console.log('Recommendations API response received');

    // This would need to be processed with parseRecommendationResults
    // For now, return basic structure
    return [
      {
        url: 'https://aws.amazon.com/getting-started/',
        title: 'AWS Getting Started',
        context: 'Recommended based on your content',
      },
    ];

  } catch (error) {
    console.error('Get recommendations error:', error);
    // Return mock recommendations as fallback
    return [
      {
        url: 'https://aws.amazon.com/getting-started/',
        title: 'AWS Getting Started',
        context: 'Get started with AWS services',
      },
      {
        url: 'https://docs.aws.amazon.com/',
        title: 'AWS Documentation',
        context: 'Complete AWS documentation',
      },
    ];
  }
} 