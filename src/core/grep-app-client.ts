import axios from 'axios';
import { GrepAppResponse, SearchParams, SearchParamsSchema } from './types.js';
import { IHits, createHits, addHit, mergeHits } from './hits.js';
import { logger } from './logger.js';
import { generateCacheKey, getCachedData, cacheData } from './cache.js';

/**
 * Fetches a single page of results from the grep.app API.
 * @param page The page number to fetch.
 * @param args The search arguments.
 * @returns An object containing the next page number, the hits found, and the total count.
 */
async function fetchGrepApp(page: number, args: SearchParams): Promise<{ nextPage: number | null, hits: IHits, count: number }> {
    const cacheKey = generateCacheKey({ query: args.query, page });
    
    // Try to get from cache first
    const cached = await getCachedData<{ nextPage: number | null, hits: IHits, count: number }>(cacheKey);
    if (cached) {
        return cached.data;
    }

    // If not in cache, fetch from API
    const response = await axios.get<GrepAppResponse>('https://grep.app/api/search', {
        params: {
            q: args.query,
            page: page.toString(),
            case: args.caseSensitive ? '1' : '0',
            regexp: args.useRegex ? '1' : '0',
            words: args.wholeWords ? '1' : '0',
            repo: args.repoFilter || '',
            path: args.pathFilter || '',
            lang: args.langFilter || ''
        }
    });

    const hits = createHits();
    const hitData = response.data.hits.hits;

    // Process and add hits
    for (const hit of hitData) {
        addHit(hits, hit.repo.raw, hit.path.raw, hit.content.snippet);
    }

    const results = {
        nextPage: page < response.data.facets.pages ? page + 1 : null,
        hits,
        count: response.data.facets.count
    };

    // Cache the results
    await cacheData(cacheKey, results, args.query);

    return results;
}

/**
 * The main search function that handles pagination and orchestrates the API calls.
 * @param args The search arguments.
 * @param context The FastMCP tool context for logging and progress reporting.
 * @returns A Hits object containing all the found results.
 */
export const searchTool = {
    name: 'search',
    description: 'Search code across repositories using grep.app',
    parameters: SearchParamsSchema,
    annotations: {
        title: 'Code Search',
        readOnlyHint: true,
        openWorldHint: true
    },
    execute: async (args: SearchParams, { log, reportProgress }: any) => {
        // Log to both FastMCP's log and our Winston logger
        logger.info(`Starting code search for query: "${args.query}"`, { query: args.query });
        log.info(`Starting code search for query: "${args.query}"`);
        
        let page = 1;
        let allHits = createHits();
        let totalCount = 0;

        while (true) {
            const results = await fetchGrepApp(page, args);
            mergeHits(allHits, results.hits);
            totalCount = results.count;

            // Report progress
            const progress = Math.min(page * 10, totalCount);
            await reportProgress({ progress, total: totalCount });

            if (!results.nextPage || page >= 5) break;
            page = results.nextPage;
        }

        const repoCount = Object.keys(allHits.hits).length;
        logger.info(`Search complete. Found matches in ${repoCount} repositories.`, { repoCount });
        log.info(`Search complete. Found matches in ${repoCount} repositories.`);

        // Cache the complete search results for batch retrieval
        const completeCacheKey = generateCacheKey({ query: args.query });
        const completeResults = {
            nextPage: null,
            hits: allHits,
            count: totalCount
        };
        await cacheData(completeCacheKey, completeResults, args.query);

        return {
            hits: allHits,
            count: totalCount
        };
    }
};
