import axios from 'axios';
import { GrepAppResponse, SearchParams } from './types.js';
import { IHits, createHits, addHit, mergeHits } from './hits.js';
import { logger } from './logger.js';

/**
 * Fetches a single page of results from the grep.app API.
 * @param page The page number to fetch.
 * @param args The search arguments.
 * @returns An object containing the next page number, the hits found, and the total count.
 */
export async function fetchGrepApp(page: number, args: SearchParams): Promise<{ nextPage: number | null, hits: IHits, count: number }> {
    const params: any = { q: args.query, page, per_page: 20 };
    const url = "https://grep.app/api/search";

    logger.debug('Preparing grep.app API request', { page, query: args.query });

    if (args.useRegex) params.regexp = 'true';
    else if (args.wholeWords) params.words = 'true';
    if (args.caseSensitive) params.case = 'true';
    if (args.repoFilter) params['f.repo.pattern'] = args.repoFilter;
    if (args.pathFilter) params['f.path.pattern'] = args.pathFilter;
    if (args.langFilter) params['f.lang'] = args.langFilter.split(',');

    try {
        logger.debug('Sending request to grep.app API', { url, params });
        const response = await axios.get<GrepAppResponse>(url, { params });
        const data = response.data;
        const count = data.facets.count;
        const hits = createHits();

        logger.debug('Received response from grep.app API', { count, hitsCount: data.hits.hits.length });

        for (const hitData of data.hits.hits) {
            addHit(hits, hitData.repo.raw, hitData.path.raw, hitData.content.snippet);
        }

        const hasMorePages = count > 20 * page;
        const nextPage = hasMorePages ? page + 1 : null;
        return { nextPage, hits, count };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = `API request failed: ${error.response?.statusText || error.message}`;
            logger.error('grep.app API request failed', { 
                error: error.message, 
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            throw new Error(errorMessage);
        }
        logger.error('Unknown error during API request', { error });
        throw error;
    }
}

/**
 * The main search function that handles pagination and orchestrates the API calls.
 * @param args The search arguments.
 * @param context The FastMCP tool context for logging and progress reporting.
 * @returns A Hits object containing all the found results.
 */
export async function searchCode(args: SearchParams, { log, reportProgress }: any): Promise<IHits> {
    // Log to both FastMCP's log and our Winston logger
    logger.info(`Starting code search for query: "${args.query}"`, { query: args.query });
    log.info(`Starting code search for query: "${args.query}"`);
    
    let page = 1;
    let { nextPage, hits: totalHits, count } = await fetchGrepApp(page, args);
    const totalResultCount = Math.min(count, 1000); // API is limited to 100 pages.

    logger.info(`Found ${count} total results, will fetch up to ${totalResultCount}`, { count, totalResultCount });
    await reportProgress({ progress: 10, total: totalResultCount });

    while (nextPage && nextPage <= 100) { // Paginate up to 100 pages
        logger.info(`Fetching page ${nextPage} of ${Math.ceil(count / 20)}...`, { page: nextPage, totalPages: Math.ceil(count / 20) });
        log.info(`Fetching page ${nextPage} of ${Math.ceil(count / 20)}...`);
        
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));

        const pageResult = await fetchGrepApp(nextPage, args);
        nextPage = pageResult.nextPage;
        mergeHits(totalHits, pageResult.hits);

        await reportProgress({ progress: (nextPage ? nextPage - 1 : 100) * 20, total: totalResultCount });
    }

    const repoCount = Object.keys(totalHits.hits).length;
    logger.info(`Search complete. Found matches in ${repoCount} repositories.`, { repoCount });
    log.info(`Search complete. Found matches in ${repoCount} repositories.`);
    
    await reportProgress({ progress: totalResultCount, total: totalResultCount });

    return totalHits;
}
