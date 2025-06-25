import axios from 'axios';
import { GrepAppResponse, SearchParams } from './types.js';
import { IHits, createHits, addHit, mergeHits } from './hits.js';
import { logger } from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB in bytes
const CACHE_DIR = path.join(process.cwd(), 'cache');

/**
 * Fetches a single page of results from the grep.app API.
 * @param page The page number to fetch.
 * @param args The search arguments.
 * @returns An object containing the next page number, the hits found, and the total count.
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    size: number;
}

function getCacheKey(page: number, args: SearchParams): string {
    const key = JSON.stringify({ page, ...args });
    return crypto.createHash('md5').update(key).digest('hex');
}

async function getCachedResults(cacheKey: string): Promise<{ nextPage: number | null, hits: IHits, count: number } | null> {
    try {
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        const data = await fs.readFile(cacheFile, 'utf-8');
        const entry = JSON.parse(data) as CacheEntry<{ nextPage: number | null, hits: IHits, count: number }>;
        
        // Check if cache entry has expired
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            logger.debug('Cache expired, deleting file', { cacheKey });
            await fs.unlink(cacheFile).catch(() => {}); // Delete expired cache
            return null;
        }
        
        const ageInMinutes = Math.round((Date.now() - entry.timestamp) / (60 * 1000));
        logger.info('Cache hit! Serving results from cache', { 
            cacheKey, 
            ageInMinutes,
            expiresInMinutes: Math.round((CACHE_TTL - (Date.now() - entry.timestamp)) / (60 * 1000))
        });
        
        return entry.data;
    } catch (error) {
        return null;
    }
}

async function cleanupCache(): Promise<void> {
    logger.debug('Starting cache cleanup');
    try {
        const files = await fs.readdir(CACHE_DIR);
        let totalSize = 0;
        const cacheFiles: { file: string; stats: Awaited<ReturnType<typeof fs.stat>> }[] = [];

        // Get file stats and calculate total size
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(CACHE_DIR, file);
            const stats = await fs.stat(filePath);
            totalSize += Number(stats.size);
            cacheFiles.push({ file: filePath, stats });
        }

        // If total size exceeds limit, delete oldest files
        if (totalSize > MAX_CACHE_SIZE) {
            cacheFiles.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());
            
            logger.info('Cache size exceeds limit, cleaning up', {
                currentSize: totalSize,
                maxSize: MAX_CACHE_SIZE,
                filesToClean: cacheFiles.length
            });
            
            while (totalSize > MAX_CACHE_SIZE && cacheFiles.length > 0) {
                const oldestFile = cacheFiles.shift();
                if (oldestFile) {
                    await fs.unlink(oldestFile.file);
                    totalSize -= Number(oldestFile.stats.size);
                    logger.debug('Deleted old cache file', { file: oldestFile.file });
                }
            }
        }
    } catch (error) {
        logger.error('Cache cleanup failed', { error });
    }
}

async function cacheResults(cacheKey: string, results: { nextPage: number | null, hits: IHits, count: number }): Promise<void> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        
        const entry: CacheEntry<typeof results> = {
            data: results,
            timestamp: Date.now(),
            size: Buffer.from(JSON.stringify(results)).length
        };
        
        await fs.writeFile(cacheFile, JSON.stringify(entry), 'utf-8');
        logger.debug('Cached results saved', { cacheKey });
        
        // Run cleanup in the background
        cleanupCache().catch(error => {
            logger.error('Background cache cleanup failed', { error });
        });
    } catch (error) {
        logger.error('Failed to cache results', { error, cacheKey });
    }
}

export async function fetchGrepApp(page: number, args: SearchParams): Promise<{ nextPage: number | null, hits: IHits, count: number }> {
    const cacheKey = getCacheKey(page, args);
    const cachedResults = await getCachedResults(cacheKey);
    
    if (cachedResults) {
        return cachedResults;
    }
    
    logger.info('Cache miss! Fetching fresh results from API', { 
        cacheKey, 
        page,
        query: args.query
    });

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
        const results = { nextPage, hits, count };
        await cacheResults(cacheKey, results);
        logger.info('Results cached successfully', { 
            cacheKey,
            page,
            size: Buffer.from(JSON.stringify(results)).length
        });
        return results;
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
