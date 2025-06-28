/**
 * Utility functions for AWS Documentation MCP Server
 * Compatible with both Cloudflare Workers and Node.js
 */

import { RecommendationResult } from './models';

// Try to import jsdom and turndown, fallback to regex if not available
let JSDOM: any = null;
let TurndownService: any = null;

try {
  // These only work in Node.js environment
  const jsdomModule = await import('jsdom');
  const turndownModule = await import('turndown');
  JSDOM = jsdomModule.JSDOM;
  TurndownService = turndownModule.default;
} catch (error) {
  console.log('jsdom/turndown not available, using regex fallback for Cloudflare Workers');
}

/**
 * Extract and convert HTML content to markdown format
 * Auto-detects environment and uses appropriate parsing method
 */
export function extractContentFromHtml(html: string): string {
  if (!html) {
    return '<e>Empty HTML content</e>';
  }

  // Try advanced parsing if libraries are available (Node.js)
  if (JSDOM && TurndownService) {
    return extractWithJSDOM(html);
  }
  
  // Fallback to regex-based parsing for Cloudflare Workers
  return extractWithRegex(html);
}

/**
 * Advanced HTML parsing using jsdom + turndown (Node.js only)
 */
function extractWithJSDOM(html: string): string {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'meta', 'link', 
      'footer', 'nav', 'aside', 'header',
      '[class*="feedback"]', '[class*="breadcrumb"]', '[class*="cookie"]',
      '[class*="copyright"]', '[class*="prev-next"]', '[class*="page-utilities"]',
      '#tools-panel', '.awsdocs-page-utilities', '.awsdocs-footer'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el: Element) => el.remove());
    });

    // Find main content
    let mainContent = document.querySelector('main') ||
                      document.querySelector('article') ||
                      document.querySelector('#main-content') ||
                      document.querySelector('.main-content') ||
                      document.querySelector('#awsdocs-content') ||
                      document.querySelector('.awsui-article') ||
                      document.body;

    if (!mainContent) {
      return '<e>No main content found</e>';
    }

    // Convert to markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    const markdown = turndownService.turndown(mainContent.innerHTML);
    return markdown.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  } catch (error) {
    console.log('jsdom parsing failed, falling back to regex');
    return extractWithRegex(html);
  }
}

/**
 * Regex-based HTML parsing (Cloudflare Workers compatible)
 */
function extractWithRegex(html: string): string {
  try {
    // Remove script and style elements
    let content = html
      .replace(/<script[^>]*>.*?<\/script>/gsi, '')
      .replace(/<style[^>]*>.*?<\/style>/gsi, '')
      .replace(/<noscript[^>]*>.*?<\/noscript>/gsi, '');

    // Try to extract main content area
    const contentSelectors = [
      /<main[^>]*>(.*?)<\/main>/si,
      /<article[^>]*>(.*?)<\/article>/si,
      /<div[^>]*id=["']main-content["'][^>]*>(.*?)<\/div>/si,
      /<div[^>]*class=["'][^"']*main-content[^"']*["'][^>]*>(.*?)<\/div>/si,
      /<div[^>]*id=["']awsdocs-content["'][^>]*>(.*?)<\/div>/si,
      /<div[^>]*class=["'][^"']*awsui-article[^"']*["'][^>]*>(.*?)<\/div>/si,
      /<body[^>]*>(.*?)<\/body>/si
    ];

    let mainContent = '';
    for (const regex of contentSelectors) {
      const match = content.match(regex);
      if (match && match[1].trim()) {
        mainContent = match[1];
        break;
      }
    }

    if (!mainContent) {
      mainContent = content; // Use full content as fallback
    }

    // Remove navigation and unwanted elements
    const unwantedPatterns = [
      /<nav[^>]*>.*?<\/nav>/gsi,
      /<header[^>]*>.*?<\/header>/gsi,
      /<footer[^>]*>.*?<\/footer>/gsi,
      /<aside[^>]*>.*?<\/aside>/gsi,
      /<div[^>]*class=["'][^"']*(?:feedback|breadcrumb|cookie|copyright|prev-next|page-utilities)[^"']*["'][^>]*>.*?<\/div>/gsi,
      /<div[^>]*id=["'][^"']*(?:tools-panel|feedback)[^"']*["'][^>]*>.*?<\/div>/gsi,
    ];

    for (const pattern of unwantedPatterns) {
      mainContent = mainContent.replace(pattern, '');
    }

    // Convert to simple markdown-like format
    mainContent = mainContent
      // Convert headings
      .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, text) => {
        const hashes = '#'.repeat(parseInt(level));
        const cleanText = text.replace(/<[^>]*>/g, '').trim();
        return `\n${hashes} ${cleanText}\n`;
      })
      // Convert paragraphs
      .replace(/<p[^>]*>(.*?)<\/p>/gsi, '\n\n$1\n')
      // Convert lists
      .replace(/<li[^>]*>(.*?)<\/li>/gsi, (_, content) => {
        const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `- ${cleanContent}\n`;
      })
      .replace(/<[uo]l[^>]*>/gi, '\n').replace(/<\/[uo]l>/gi, '\n')
      // Convert code blocks
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gsi, (_, code) => {
        const cleanCode = code.replace(/<[^>]*>/g, '').trim();
        return `\n\`\`\`\n${cleanCode}\n\`\`\`\n`;
      })
      .replace(/<code[^>]*>(.*?)<\/code>/gsi, (_, code) => {
        return `\`${code.replace(/<[^>]*>/g, '')}\``;
      })
      // Convert links
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gsi, (_, href, text) => {
        const cleanText = text.replace(/<[^>]*>/g, '').trim();
        return cleanText ? `[${cleanText}](${href})` : href;
      })
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Convert strong/bold
      .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gsi, '**$2**')
      // Convert em/italic
      .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gsi, '*$2*')
      // Remove remaining HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    if (!mainContent || mainContent.length < 10) {
      return '<e>Page failed to be simplified from HTML</e>';
    }

    return mainContent;

  } catch (error) {
    return `<e>Error converting HTML to text: ${error instanceof Error ? error.message : 'Unknown error'}</e>`;
  }
}

/**
 * Determine if content is HTML
 * (TypeScript version of Python's is_html_content)
 */
export function isHtmlContent(pageRaw: string, contentType: string): boolean {
  return pageRaw.slice(0, 100).includes('<html') || 
         contentType.includes('text/html') || 
         !contentType;
}

/**
 * Format documentation result with pagination information
 * (TypeScript version of Python's format_documentation_result)
 */
export function formatDocumentationResult(
  url: string, 
  content: string, 
  startIndex: number, 
  maxLength: number
): string {
  const originalLength = content.length;

  if (startIndex >= originalLength) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }

  // Calculate the end index, ensuring we don't go beyond the content length
  const endIndex = Math.min(startIndex + maxLength, originalLength);
  const truncatedContent = content.slice(startIndex, endIndex);

  if (!truncatedContent) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }

  const actualContentLength = truncatedContent.length;
  const remainingContent = originalLength - (startIndex + actualContentLength);

  let result = `AWS Documentation from ${url}:\n\n${truncatedContent}`;

  // Only add the prompt to continue fetching if there is still remaining content
  if (remainingContent > 0) {
    const nextStart = startIndex + actualContentLength;
    result += `\n\n<e>Content truncated. Call the read_documentation tool with start_index=${nextStart} to get more content.</e>`;
  }

  return result;
}

/**
 * Parse recommendation API response into RecommendationResult objects
 * (TypeScript version of Python's parse_recommendation_results)
 */
export function parseRecommendationResults(data: any): RecommendationResult[] {
  const results: RecommendationResult[] = [];

  // Process highly rated recommendations
  if (data.highlyRated?.items) {
    for (const item of data.highlyRated.items) {
      const context = item.abstract || undefined;
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context,
      });
    }
  }

  // Process journey recommendations (organized by intent)
  if (data.journey?.items) {
    for (const intentGroup of data.journey.items) {
      const intent = intentGroup.intent || '';
      if (intentGroup.urls) {
        for (const urlItem of intentGroup.urls) {
          // Add intent as part of the context
          const context = intent ? `Intent: ${intent}` : undefined;
          results.push({
            url: urlItem.url || '',
            title: urlItem.assetTitle || '',
            context,
          });
        }
      }
    }
  }

  // Process new content recommendations
  if (data.new?.items) {
    for (const item of data.new.items) {
      // Add "New content" label to context
      const dateCreated = item.dateCreated || '';
      const context = dateCreated ? `New content added on ${dateCreated}` : 'New content';
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context,
      });
    }
  }

  // Process similar recommendations
  if (data.similar?.items) {
    for (const item of data.similar.items) {
      const context = item.abstract || 'Similar content';
      results.push({
        url: item.url || '',
        title: item.assetTitle || '',
        context,
      });
    }
  }

  return results;
} 