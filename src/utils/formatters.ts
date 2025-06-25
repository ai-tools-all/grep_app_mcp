import { SearchResult } from '../core/types.js';

/**
 * Formats the search results into a numbered list for model selection.
 * @param results The search results.
 * @returns A numbered list of results.
 */
export function formatResultsAsNumberedList(results: SearchResult): string {
    let output = '';
    let counter = 1;
    
    // Group results by file path
    const fileGroups: Record<string, { lineNum: string; line: string }[]> = {};
    
    for (const [repo, pathData] of Object.entries(results as Record<string, any>)) {
        for (const [path, lines] of Object.entries(pathData as Record<string, any>)) {
            const fullPath = `${repo}/${path}`;
            if (!fileGroups[fullPath]) {
                fileGroups[fullPath] = [];
            }
            
            // Collect all lines from this file
            for (const [lineNum, line] of Object.entries(lines)) {
                if (typeof line === 'string') {
                    fileGroups[fullPath].push({ lineNum, line });
                }
            }
        }
    }

    // Output grouped results
    for (const [fullPath, matches] of Object.entries(fileGroups)) {
        // Sort matches by line number
        matches.sort((a, b) => Number(a.lineNum) - Number(b.lineNum));
        
        // Output file header with first match
        output += `${counter}. [${fullPath}:${matches[0].lineNum}] ${matches[0].line}\n`;
        
        // Output additional matches indented
        if (matches.length > 1) {
            for (let i = 1; i < matches.length; i++) {
                output += `   L${matches[i].lineNum}: ${matches[i].line}\n`;
            }
        }
        counter++;
    }

    return output;
}

/**
 * Formats the search results into a human-readable string.
 * @param results The search results.
 * @returns A formatted string.
 */
export function formatResultsAsText(results: SearchResult): string {
    let output = '';
    const separator = "─".repeat(80) + "\n";
    let repoCt = 0, fileCt = 0, lineCt = 0;

    for (const [repo, pathData] of Object.entries(results as Record<string, any>)) {
        repoCt++;
        output += separator;
        output += `Repository: ${repo}\n`;
        for (const [path, lines] of Object.entries(pathData as Record<string, any>)) {
            fileCt++;
            output += `  /${path}\n`;
            for (const [lineNum, line] of Object.entries(lines)) {
                lineCt++;
                const numFmt = String(lineNum).padStart(5, ' ');
                output += `    ${numFmt}: ${line}\n`;
            }
        }
    }

    output += separator;
    output += `Summary: Found ${lineCt} matched lines in ${fileCt} files across ${repoCt} repositories.\n`;
    return output;
}
