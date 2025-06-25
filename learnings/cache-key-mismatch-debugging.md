# Cache Key Mismatch Issue & Resolution

## Problem
Test client was failing with "No cached results found for query: import React" when trying to batch retrieve search results after a successful search operation.

## Root Cause Analysis

### Issue #1: Cache Key Generation Inconsistency
- **Search flow**: Generated cache keys like `{"query": "import React", "page": 1}` for individual pages
- **Batch retrieval flow**: Expected cache keys like `{"query": "import React"}` (query only)
- **Result**: Cache keys didn't match, so batch retrieval couldn't find cached search results

### Issue #2: Broken Cache Key Parsing
- `parseCacheKey()` function attempted to reverse MD5 hash: `JSON.parse(Buffer.from(key, 'hex').toString())`
- **Problem**: MD5 is a one-way hash - you cannot reverse it to get original data
- **Result**: `findCacheFiles()` always returned empty array

## Solutions Implemented

### 1. Unified Cache Key Generation
```typescript
// Before: Used full keyObj with page numbers
export function generateCacheKey(keyObj: CacheKey): string {
    const key = JSON.stringify(keyObj);
    return crypto.createHash('md5').update(key).digest('hex');
}

// After: Only use query for consistent keys
export function generateCacheKey(keyObj: CacheKey): string {
    const key = JSON.stringify({ query: keyObj.query });
    return crypto.createHash('md5').update(key).digest('hex');
}
```

### 2. Store Query Metadata in Cache
```typescript
// Added query field to cache entries
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    size: number;
    query?: string; // <- Added this
}

// Updated cacheData function signature
export async function cacheData<T>(cacheKey: string, data: T, query?: string): Promise<void>
```

### 3. Fixed Cache File Discovery
```typescript
// Before: Tried to parse MD5 hash (impossible)
export async function findCacheFiles(query: string): Promise<string[]> {
    const files = await fs.readdir(CACHE_DIR);
    return files.filter(file => {
        const key = parseCacheKey(file); // This never worked
        return key?.query === query && file.endsWith('.json');
    });
}

// After: Read cache entries and check stored query
export async function findCacheFiles(query: string): Promise<string[]> {
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
            continue; // Skip invalid files
        }
    }
    
    return matchingFiles;
}
```

## Key Learnings

1. **MD5 Hash is One-Way**: Never try to reverse MD5 hashes to get original data
2. **Cache Key Consistency**: Ensure all parts of the system use identical cache key generation logic
3. **Store Metadata**: When using hashed keys, store searchable metadata in the cached data itself
4. **Test End-to-End**: Unit tests might pass but integration between components can still fail
5. **Debug with Real Data**: Check actual cache files to understand what's being stored vs. what's expected

## Flow Verification
✅ Search "import React" → Caches with query metadata  
✅ Batch retrieve [1,5,10] → Finds cache by query → Returns file contents  
✅ Test passes: `success: true`