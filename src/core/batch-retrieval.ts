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
        log.info(`Starting batch retrieval for query: "${params.query}"`);

        // Get cached hits
        const cachedHits = await getQueryResults(params.query);
        if (!cachedHits) {
            return {
                success: false,
                files: [],
                error: `No cached results found for query: ${params.query}`
            };
        }

        // If no result numbers specified, return error
        if (!params.resultNumbers || params.resultNumbers.length === 0) {
            return {
                success: false,
                files: [],
                error: 'No result numbers specified'
            };
        }
        log.info(`Retrieving result numbers: ${params.resultNumbers.join(', ')}`);

        // Flatten hits and find the requested files
        const numberedHits = flattenHits(cachedHits);
        const fileRequests: GitHubFileRequest[] = [];
        const selectedHits = new Map<number, NumberedHit>();

        for (const num of params.resultNumbers) {
            const hit = numberedHits.find(h => h.number === num);
            if (!hit) {
                logger.warn(`Result number ${num} not found in cached hits.`);
                continue;
            }

            const repoInfo = parseGitHubRepo(hit.repo);
            if (!repoInfo) {
                logger.warn(`Invalid GitHub repo format: ${hit.repo}`);
                continue;
            }

            fileRequests.push({ ...repoInfo, path: hit.path });
            selectedHits.set(num, hit);
        }
        
        if (fileRequests.length === 0) {
            return {
                success: false,
                files: [],
                error: 'No valid files found for the specified result numbers.'
            };
        }

        // Fetch files from GitHub
        log.info(`Fetching ${fileRequests.length} files from GitHub...`);
        const githubResults = await fetchGitHubFiles(fileRequests);

        // Map GitHub results back to our format
        const files = params.resultNumbers.map(num => {
            const hit = selectedHits.get(num);
            if (!hit) {
                return {
                    number: num,
                    repo: '',
                    path: '',
                    content: '',
                    error: 'Result number not found or invalid.'
                };
            }

            const repoInfo = parseGitHubRepo(hit.repo);
            const githubResult = githubResults.find(
                r => r.repo === repoInfo?.repo && r.path === hit.path
            );

            if (!githubResult) {
                return {
                    number: num,
                    repo: hit.repo,
                    path: hit.path,
                    content: '',
                    error: 'File not found in GitHub batch response.'
                };
            }

            return {
                number: num,
                repo: hit.repo,
                path: hit.path,
                content: githubResult.content,
                error: githubResult.error
            };
        });

        log.info(`Successfully retrieved ${files.filter(f => !f.error).length} files.`);
        return {
            success: true,
            files
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
