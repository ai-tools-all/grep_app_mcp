import { z } from 'zod';
import { UserError } from 'fastmcp';
import { logger, searchCode, SearchParams } from '../core/index.js';
import { formatResultsAsText, formatResultsAsNumberedList } from '../utils/formatters.js';

/**
 * Schema for the searchCode tool parameters
 */
export const searchCodeSchema = z.object({
    query: z.string().describe("The search query string."),
    jsonOutput: z.boolean().optional().default(false).describe("If true, return results as a JSON object. Otherwise, return formatted text."),
    numberedOutput: z.boolean().optional().default(false).describe("If true, return results as a numbered list for model selection."),
    caseSensitive: z.boolean().optional().describe("Perform a case-sensitive search."),
    useRegex: z.boolean().optional().describe("Treat the query as a regular expression. Cannot be used with wholeWords."),
    wholeWords: z.boolean().optional().describe("Search for whole words only. Cannot be used with useRegex."),
    repoFilter: z.string().optional().describe("Filter by repository name pattern (e.g., 'facebook/react')."),
    pathFilter: z.string().optional().describe("Filter by file path pattern (e.g., 'src/components/')."),
    langFilter: z.string().optional().describe("Filter by language, comma-separated (e.g., 'TypeScript,Python')."),
});

/**
 * Implementation of the searchCode tool
 */
export const searchCodeTool = {
    name: "searchCode",
    description: "Searches public code on GitHub using the grep.app API.",
    parameters: searchCodeSchema,
    annotations: {
        title: "Code Search (grep.app)",
        readOnlyHint: true,
        openWorldHint: true,
    },
    execute: async (args: SearchParams, { log, reportProgress }: any) => {
        if (args.useRegex && args.wholeWords) {
            logger.warn("Invalid search parameters", { reason: "Cannot use both 'useRegex' and 'wholeWords'" });
            throw new UserError("Cannot use both 'useRegex' and 'wholeWords' at the same time.");
        }

        try {
            logger.info("Executing searchCode tool", { 
                query: args.query,
                options: { 
                    jsonOutput: args.jsonOutput, 
                    caseSensitive: args.caseSensitive,
                    useRegex: args.useRegex,
                    wholeWords: args.wholeWords,
                    repoFilter: args.repoFilter,
                    pathFilter: args.pathFilter,
                    langFilter: args.langFilter
                } 
            });
            
            const hits = await searchCode(args, { log, reportProgress });

            if (Object.keys(hits.hits).length === 0) {
                logger.info("No search results found", { query: args.query });
                return "No results found for your query.";
            }

            const repoCount = Object.keys(hits.hits).length;
            logger.info("Search results ready to return", { repoCount, format: args.jsonOutput ? 'json' : 'text' });
            
            if (args.jsonOutput) {
                return JSON.stringify(hits.hits, null, 2);
            } else if (args.numberedOutput) {
                return formatResultsAsNumberedList(hits.hits);
            } else {
                return formatResultsAsText(hits.hits);
            }
        } catch (error: any) {
            logger.error("Search execution failed", { error: error.message, stack: error.stack });
            log.error(`An error occurred during search: ${error.message}`);
            throw new UserError(`Search failed. Reason: ${error.message}`);
        }
    }
};
