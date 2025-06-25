import { SearchResult } from '../core/types.js';

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
