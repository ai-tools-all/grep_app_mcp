# Search Results Grouping Implementation Decisions

## Task Overview
Modify the numbered output format in the code search tool to group results by file path and show only one snippet per file.

## Key Decisions Made

1. **Result Grouping Strategy**
   - Decision: Group results by full file path (repo + path) instead of just path
   - Rationale: Ensures unique identification of files across different repositories
   - Implementation: Created a `fileGroups` object with full path as key

2. **Snippet Selection**
   - Decision: Show only the first matching line from each file
   - Rationale: Keeps output concise while maintaining file-level granularity
   - Implementation: Used `Object.entries(lines)[0]` to get first match

3. **Type Safety**
   - Decision: Added explicit type check for line content
   - Rationale: Fix TypeScript error about unknown type assignment
   - Implementation: Added `typeof line === 'string'` check

## Code Paths Explored

### 1. Initial Implementation Path
**File**: `/home/abhishek/Downloads/experiments/ai-tools/mcp_servers/grep_app_mcp/src/utils/formatters.ts`
```typescript
export function formatResultsAsNumberedList(results: SearchResult): string {
    let output = '';
    let counter = 1;

    for (const [repo, pathData] of Object.entries(results as Record<string, any>)) {
        for (const [path, lines] of Object.entries(pathData as Record<string, any>)) {
            for (const [lineNum, line] of Object.entries(lines)) {
                output += `${counter}. [${repo}/${path}:${lineNum}] ${line}\n`;
                counter++;
            }
        }
    }

    return output;
}
```
This initial implementation showed all matching lines from all files, leading to verbose output.

### 2. Final Implementation Path
**File**: `/home/abhishek/Downloads/experiments/ai-tools/mcp_servers/grep_app_mcp/src/utils/formatters.ts`
```typescript
export function formatResultsAsNumberedList(results: SearchResult): string {
    // Group results by file path
    const fileGroups: Record<string, { repo: string; lineNum: string; line: string }[]> = {};
    
    for (const [repo, pathData] of Object.entries(results as Record<string, any>)) {
        for (const [path, lines] of Object.entries(pathData as Record<string, any>)) {
            const fullPath = `${repo}/${path}`;
            if (!fileGroups[fullPath]) {
                fileGroups[fullPath] = [];
            }
            
            // Take only the first match from each file
            const [lineNum, line] = Object.entries(lines)[0];
            if (typeof line === 'string') {
                fileGroups[fullPath].push({ repo, lineNum, line });
            }
        }
    }

    // Output one result per file
    let output = '';
    let counter = 1;
    for (const [fullPath, matches] of Object.entries(fileGroups)) {
        const { lineNum, line } = matches[0];
        output += `${counter}. [${fullPath}:${lineNum}] ${line}\n`;
        counter++;
    }

    return output;
}
```

## Issues Encountered and Solutions

1. **TypeScript Type Safety**
   - Issue: Type 'unknown' not assignable to type 'string'
   - File: `/home/abhishek/Downloads/experiments/ai-tools/mcp_servers/grep_app_mcp/src/utils/formatters.ts`
   - Solution: Added runtime type check before using the line value

## Related Files Examined

1. `/home/abhishek/Downloads/experiments/ai-tools/mcp_servers/grep_app_mcp/src/tools/search-code.ts`
   - Purpose: Understand the tool's parameters and execution flow
   - Relevant section: `searchCodeSchema` and `searchCodeTool` implementation

2. `/home/abhishek/Downloads/experiments/ai-tools/mcp_servers/grep_app_mcp/src/utils/formatters.ts`
   - Purpose: Main implementation file for output formatting
   - Modified: `formatResultsAsNumberedList` function
