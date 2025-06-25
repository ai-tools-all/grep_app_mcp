import { BatchRetrievalParams, BatchRetrievalResult, ToolContext } from './types.js';
import { logger } from './logger.js';
import { fetchGitHubFiles, GitHubFileRequest } from './github-utils.js';
import { findCacheFiles, getCachedData } from './cache.js';
import { IHits } from './hits.js';

/**
 * Flattens the nested hits structure into a numbered list of files.
 * Each unique file is considered one result.
 */
interface NumberedHit {
    number: number;
    repo: string;
    path: string;
}

function flattenHits(hits: IHits): NumberedHit[] {
    const flattened: NumberedHit[] = [];
    let i = 1;
    if (hits && hits.hits) {
        for (const repo in hits.hits) {
            for (const path in hits.hits[repo]) {
                flattened.push({
                    number: i++,
                    repo: repo,
                    path: path,
                });
            }
        }
    }
    return flattened;
}

/**
 * Get cached IHits object for a query from the file system cache.
 */
async function getQueryResults(query: string): Promise<IHits | null> {
    try {
        // Find all cache files for this query, sorted by most recent
        const queryFiles = await findCacheFiles(query);
        
        if (queryFiles.length === 0) {
            logger.warn('No cache files found for query', { query });
            return null;
        }

        // Get the most recent cache file
        const latestFile = queryFiles[0];
        const cacheKey = latestFile.split('.')[0];
        
        // Correctly type the cached data structure
        const entry = await getCachedData<{ nextPage: number | null, hits: IHits, count: number }>(cacheKey);

        if (!entry) {
            logger.warn('Failed to parse cache entry', { cacheKey });
            return null;
        }

        return entry.data.hits;
    } catch (error) {
        logger.error('Failed to get cached query results', { error, query });
        return null;
    }
}

/**
 * Extract owner and repo from a GitHub repository string.
 */
function parseGitHubRepo(repoString: string): { owner: string; repo: string } | null {
    const match = repoString.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\.git)?$/);
    if (!match) {
        return null;
    }
    return {
        owner: match[1],
        repo: match[2]
    };
}

/**
 * Retrieve file contents from GitHub for specified search results.
 */
export async function batchRetrieveFiles(
    params: BatchRetrievalParams,
    context: ToolContext
): Promise<BatchRetrievalResult> {
    try {
        const { log } = context;
        const { query, resultNumbers, page = 1, pageSize = 10 } = params;
        log.info(`Starting batch retrieval for query: "${query}"`);

        // Get cached hits
        const cachedHits = await getQueryResults(query);
        if (!cachedHits) {
            return {
                success: false,
                files: [],
                error: `No cached results found for query: ${query}`
            };
        }

        // Flatten hits
        const allNumberedHits = flattenHits(cachedHits);
        
        // Determine which hits to process
        let hitsToProcess = allNumberedHits;
        if (resultNumbers && resultNumbers.length > 0) {
            log.info(`Filtering for result numbers: ${resultNumbers.join(', ')}`);
            const resultSet = new Set(resultNumbers);
            hitsToProcess = allNumberedHits.filter(h => resultSet.has(h.number));
        }

        if (hitsToProcess.length === 0) {
            return {
                success: false,
                files: [],
                error: 'No results found for the given query or result numbers.'
            };
        }

        // Paginate the results
        const totalResults = hitsToProcess.length;
        const totalPages = Math.ceil(totalResults / pageSize);
        const startIndex = (page - 1) * pageSize;
        const pageHits = hitsToProcess.slice(startIndex, startIndex + pageSize);

        if (pageHits.length === 0) {
            return {
                success: true,
                files: [],
                page,
                pageSize,
                totalPages,
                totalResults,
            };
        }

        // Build file requests for the current page
        const fileRequests: GitHubFileRequest[] = [];
        for (const hit of pageHits) {
            const repoInfo = parseGitHubRepo(hit.repo);
            if (!repoInfo) {
                logger.warn(`Invalid GitHub repo format: ${hit.repo}`);
                continue;
            }
            fileRequests.push({ ...repoInfo, path: hit.path });
        }
        
        if (fileRequests.length === 0) {
            return {
                success: false,
                files: [],
                error: 'No valid files found for the specified result numbers on this page.',
                page,
                pageSize,
                totalPages,
                totalResults,
            };
        }

        // Fetch files from GitHub
        log.info(`Fetching ${fileRequests.length} files from GitHub for page ${page}...`);
        const githubResults = await fetchGitHubFiles(fileRequests);

        // Map GitHub results back to our format
        const files = pageHits.map(hit => {
            const repoInfo = parseGitHubRepo(hit.repo);
            const githubResult = githubResults.find(
                r => r.repo === repoInfo?.repo && r.path === hit.path
            );

            if (!githubResult || githubResult.error) {
                return {
                    number: hit.number,
                    repo: hit.repo,
                    path: hit.path,
                    content: '',
                    error: githubResult?.error || 'File not found in GitHub batch response.'
                };
            }

            return {
                number: hit.number,
                repo: hit.repo,
                path: hit.path,
                content: githubResult.content,
            };
        });

        log.info(`Successfully retrieved ${files.filter(f => !f.error).length} files for page ${page}.`);
        return {
            success: true,
            files,
            page,
            pageSize,
            totalPages,
            totalResults,
        };
    } catch (err) {
        context.log.error('Batch retrieval failed with an unexpected error.', { error: err });
        return {
            success: false,
            files: [],
            error: err instanceof Error ? err.message : 'Unknown error occurred'
        };
    }
}
