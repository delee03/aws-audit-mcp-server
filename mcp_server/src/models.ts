/**
 * Data models for AWS Documentation MCP Server
 * Migrated from Python models.py
 */

export interface SearchResult {
  rank_order: number;
  url: string;
  title: string;
  context?: string;
}

export interface RecommendationResult {
  url: string;
  title: string;
  context?: string;
}

export interface ServerConfig {
  SEARCH_API_URL: string;
  RECOMMENDATIONS_API_URL: string;
  DEFAULT_USER_AGENT: string;
} 