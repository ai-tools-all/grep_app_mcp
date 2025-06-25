/**
 * Interfaces for the grep.app API response and our internal data structures.
 */

// FastMCP tool context interface
export interface ToolContext {
    log: {
        info: (message: string, data?: any) => void;
        error: (message: string, data?: any) => void;
        warn: (message: string, data?: any) => void;
        debug: (message: string, data?: any) => void;
    };
    reportProgress: (progress: { progress: number; total: number }) => Promise<void>;
}

// grep.app API response interfaces
export interface HitData {
    repo: { raw: string };
    path: { raw: string };
    content: { snippet: string };
}

export interface GrepAppResponse {
    facets: {
        count: number;
        page: number;
        pages: number;
    };
    hits: {
        hits: HitData[];
    };
}

// Search result interface
export interface SearchResult {
    [repo: string]: {
        [path: string]: {
            [lineNum: string]: string;
        };
    };
}

// FastMCP session event interfaces
export interface FastMCPSession {
    on(event: string, listener: (event: any) => void): void;
}

export interface ConnectEvent {
    session: FastMCPSession;
}

export interface DisconnectEvent {
    session: FastMCPSession;
}

import { z } from 'zod';

/**
 * Zod schema for search parameters with comprehensive validation and documentation
 */
export const SearchParamsSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .describe('The search query string'),

  jsonOutput: z
    .boolean()
    .optional()
    .describe('Output results in JSON format'),

  numberedOutput: z
    .boolean()
    .optional()
    .describe('Add line numbers to output'),

  caseSensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Enable case-sensitive search (default: false)'),

  useRegex: z
    .boolean()
    .optional()
    .default(false)
    .describe('Enable regex pattern matching (default: false). Example: useRegex: true, query: "function\\s+\\w+\\s*\\(.*\\)"'),

  wholeWords: z
    .boolean()
    .optional()
    .default(false)
    .describe('Match whole words only (default: false)'),

  repoFilter: z
    .string()
    .optional()
    .describe('Filter repositories by regex pattern. Example: "github\\.com/microsoft/.*"'),

  pathFilter: z
    .string()
    .optional()
    .describe('Filter file paths by regex pattern. Example: ".*\\.tsx?$" to match .ts or .tsx files'),

  langFilter: z
    .string()
    .optional()
    .describe('Filter by programming languages (comma-separated). Example: "typescript,javascript,python"')
}).describe('Search parameters for code search functionality');

// Extract TypeScript type
export type SearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * Advanced schema with additional validation for regex patterns
 */
export const SearchParamsSchemaAdvanced = SearchParamsSchema.refine(
  (data) => {
    // If useRegex is true, validate that the query is a valid regex
    if (data.useRegex) {
      try {
        new RegExp(data.query);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Invalid regex pattern in query when useRegex is enabled',
    path: ['query']
  }
).refine(
  (data) => {
    // Validate repoFilter regex if provided
    if (data.repoFilter) {
      try {
        new RegExp(data.repoFilter);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Invalid regex pattern in repoFilter',
    path: ['repoFilter']
  }
).refine(
  (data) => {
    // Validate pathFilter regex if provided
    if (data.pathFilter) {
      try {
        new RegExp(data.pathFilter);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Invalid regex pattern in pathFilter',
    path: ['pathFilter']
  }
);

/**
 * Helper functions for working with search parameters
 */
export const searchParamsHelpers = {
  create: (params: Partial<SearchParams>): SearchParams => {
    return SearchParamsSchema.parse(params);
  },

  validate: (params: unknown): SearchParams => {
    return SearchParamsSchema.parse(params);
  },

  isValid: (params: unknown): params is SearchParams => {
    return SearchParamsSchema.safeParse(params).success;
  },

  validateAdvanced: (params: unknown): SearchParams => {
    return SearchParamsSchemaAdvanced.parse(params);
  }
};

/**
 * Example search parameter configurations
 */
export const SEARCH_EXAMPLES = {
  basic: searchParamsHelpers.create({
    query: 'fetchData'
  }),
  
  advanced: searchParamsHelpers.create({
    query: 'async function',
    useRegex: true,
    caseSensitive: true,
    repoFilter: 'github\.com/org/.*',
    pathFilter: '.*\.ts$',
    langFilter: 'typescript,javascript'
  })
} as const;

// Batch file retrieval interfaces and schemas
export const BatchFileLocationSchema = z.object({
    repo: z.string().min(1, 'Repository name cannot be empty'),
    path: z.string().min(1, 'File path cannot be empty'),
    line: z.string()
});

export const BatchRetrievalParamsSchema = z.object({
    query: z.string().min(1, 'Search query cannot be empty')
        .describe('Original search query'),
    resultNumbers: z.array(z.number().int().positive())
        .optional()
        .describe('List of result numbers to retrieve'),
    page: z.number().int().positive().optional().describe('Page number for pagination'),
    pageSize: z.number().int().positive().optional().describe('Number of results per page')
});

export const BatchFileResultSchema = z.object({
    number: z.number().int().positive()
        .describe('Original result number'),
    repo: z.string().min(1, 'Repository name cannot be empty')
        .describe('Repository name'),
    path: z.string().min(1, 'File path cannot be empty')
        .describe('File path'),
    content: z.string()
        .describe('File content'),
    error: z.string().optional()
        .describe('Error message if retrieval failed')
});

export const BatchRetrievalResultSchema = z.object({
    success: z.boolean()
        .describe('Whether the batch operation succeeded'),
    files: z.array(BatchFileResultSchema)
        .describe('Array of file results'),
    error: z.string().optional()
        .describe('Global error message if entire operation failed'),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    totalPages: z.number().int().positive().optional(),
    totalResults: z.number().int().positive().optional()
});

export const CachedSearchResultSchema = z.object({
    results: z.record(z.record(z.record(z.string())))
        .describe('The actual search results'),
    timestamp: z.number()
        .describe('When the search was performed'),
    query: z.string().min(1, 'Search query cannot be empty')
        .describe('Original search query'),
    numberedResults: z.record(BatchFileLocationSchema).optional()
        .describe('Mapping of result numbers to file locations')
});

// Type exports from schemas
export interface BatchRetrievalParams extends z.infer<typeof BatchRetrievalParamsSchema> {}
export interface BatchFileResult extends z.infer<typeof BatchFileResultSchema> {}
export interface BatchRetrievalResult extends z.infer<typeof BatchRetrievalResultSchema> {}
export interface CachedSearchResult extends z.infer<typeof CachedSearchResultSchema> {}

// Helper functions for batch operations
export const batchHelpers = {
    /**
     * Creates a new BatchRetrievalParams object with validation
     */
    createParams(params: Partial<BatchRetrievalParams>): BatchRetrievalParams {
        return BatchRetrievalParamsSchema.parse(params);
    },

    /**
     * Validates BatchRetrievalParams
     */
    validateParams(params: unknown): BatchRetrievalParams {
        return BatchRetrievalParamsSchema.parse(params);
    },

    /**
     * Type guard for BatchRetrievalParams
     */
    isValidParams(params: unknown): params is BatchRetrievalParams {
        return BatchRetrievalParamsSchema.safeParse(params).success;
    },

    /**
     * Creates a new BatchRetrievalResult object with validation
     */
    createResult(result: Partial<BatchRetrievalResult>): BatchRetrievalResult {
        return BatchRetrievalResultSchema.parse(result);
    }
};

// Helper functions for cache operations
export const cacheHelpers = {
    /**
     * Creates a new CachedSearchResult object with validation
     */
    create(result: Partial<CachedSearchResult>): CachedSearchResult {
        return CachedSearchResultSchema.parse(result);
    },

    /**
     * Validates CachedSearchResult
     */
    validate(result: unknown): CachedSearchResult {
        return CachedSearchResultSchema.parse(result);
    },

    /**
     * Type guard for CachedSearchResult
     */
    isValid(result: unknown): result is CachedSearchResult {
        return CachedSearchResultSchema.safeParse(result).success;
    }
}
