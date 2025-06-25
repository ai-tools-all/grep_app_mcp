import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger.js';

export const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const MAX_CACHE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB in bytes
export const CACHE_DIR = path.join(process.cwd(), 'cache');

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    size: number;
    query?: string;
}

export interface CacheKey {
    query: string;
    page?: number;
    [key: string]: any;
}

/**
 * Generate a cache key from a key object
 */
export function generateCacheKey(keyObj: CacheKey): string {
    const key = JSON.stringify({ query: keyObj.query });
    return crypto.createHash('md5').update(key).digest('hex');
}

/**
 * Parse a cache key from a filename
 */
export function parseCacheKey(filename: string): CacheKey | null {
    try {
        const key = filename.split('.')[0]; // Get the MD5 hash part
        const data = JSON.parse(Buffer.from(key, 'hex').toString());
        return data;
    } catch {
        return null;
    }
}

/**
 * Get cached data for a specific key
 */
export async function getCachedData<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
    try {
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        const data = await fs.readFile(cacheFile, 'utf-8');
        const entry = JSON.parse(data) as CacheEntry<T>;
        
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
        
        return entry;
    } catch (error) {
        return null;
    }
}

/**
 * Save data to cache
 */
export async function cacheData<T>(cacheKey: string, data: T, query?: string): Promise<void> {
    try {
        await fs.mkdir(CACHE_DIR).catch(() => {}); // Ensure cache directory exists

        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            size: Buffer.from(JSON.stringify(data)).length,
            query
        };

        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        await fs.writeFile(cacheFile, JSON.stringify(entry));
        
        // Trigger cleanup after write
        await cleanupCache();
    } catch (error) {
        logger.error('Failed to cache results', { error, cacheKey });
    }
}

/**
 * Find all cache files matching a specific query
 */
export async function findCacheFiles(query: string): Promise<string[]> {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const matchingFiles: string[] = [];
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const filePath = path.join(CACHE_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const entry = JSON.parse(content) as CacheEntry<any>;
                
                if (entry.query === query) {
                    matchingFiles.push(file);
                }
            } catch {
                // Skip files we can't read/parse
                continue;
            }
        }
        
        return matchingFiles;
    } catch (error) {
        logger.error('Failed to find cache files', { error, query });
        return [];
    }
}

/**
 * Clean up old cache files if total size exceeds MAX_CACHE_SIZE
 */
export async function cleanupCache(): Promise<void> {
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
