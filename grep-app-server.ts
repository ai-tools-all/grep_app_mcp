import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
// These imports are commented out until the packages are installed
// To install the required packages, run:
// npm install winston winston-daily-rotate-file @types/winston
import * as winston from 'winston';
import 'winston-daily-rotate-file';

//================================================================================
// Logger Configuration
//================================================================================

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define Winston logger types to fix TypeScript errors
interface LoggerMeta {
    [key: string]: any;
}

interface TransformableInfo {
    timestamp: string;
    level: string;
    message: string;
    [key: string]: any;
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'grep-app-server' },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf((info: TransformableInfo) => {
                    const { timestamp, level, message, ...meta } = info;
                    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
                })
            ),
        }),
        // File transport with daily rotation
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: logFormat
        }),
        // Separate error log file
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: logFormat
        })
    ],
});

// Log unhandled exceptions and rejections
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
});

logger.info('Logger initialized');


//================================================================================
// Part 1: TypeScript Conversion of the grep.app client logic
//================================================================================

/**
 * Interfaces for the grep.app API response and our internal data structures.
 */
interface HitData {
    repo: { raw: string };
    path: { raw: string };
    content: { snippet: string };
}

interface GrepAppResponse {
    facets: {
        count: number;
    };
    hits: {
        hits: HitData[];
    };
}

export interface SearchResult {
    [repo: string]: {
        [path: string]: {
            [lineNum: string]: string;
        };
    };
}

/**
 * The Hits class processes and stores search results, mirroring the Python version's functionality.
 */
export class Hits {
    public hits: SearchResult = {};

    /**
     * Parses an HTML snippet from the API response to extract line numbers and code.
     * It uses cheerio to parse the HTML table structure.
     * @param snippet The HTML string snippet.
     * @returns A dictionary mapping line numbers to the corresponding line of code.
     */
    private _parseSnippet(snippet: string): { [lineNum: string]: string } {
        const matches: { [lineNum: string]: string } = {};
        const $ = cheerio.load(snippet);

        $('tr').each((_, trElement) => {
            const tr = $(trElement);
            const lineNum = tr.find('div.lineno').text().trim();
            const lineHtml = tr.find('pre').html();

            if (lineHtml && lineHtml.includes('<mark')) {
                // Extracts the text content, which includes the content of <mark> tags naturally.
                const lineText = tr.find('pre').text().replace(/\n/g, '').trim();
                matches[lineNum] = lineText;
            }
        });
        return matches;
    }

    /**
     * Adds a new search hit to our results.
     * @param repo The repository where the hit was found.
     * @param path The file path of the hit.
     * @param snippet The HTML snippet containing the matched lines.
     */
    public addHit(repo: string, path: string, snippet: string): void {
        if (!this.hits[repo]) {
            this.hits[repo] = {};
        }
        if (!this.hits[repo][path]) {
            this.hits[repo][path] = {};
        }

        const parsedSnippet = this._parseSnippet(snippet);
        for (const [lineNum, line] of Object.entries(parsedSnippet)) {
            this.hits[repo][path][lineNum] = line;
        }
    }

    /**
     * Merges results from another Hits object into this one.
     * @param otherHits The other Hits object to merge.
     */
    public merge(otherHits: Hits): void {
        for (const [repo, pathData] of Object.entries(otherHits.hits)) {
            if (!this.hits[repo]) {
                this.hits[repo] = {};
            }
            for (const [path, lines] of Object.entries(pathData)) {
                if (!this.hits[repo][path]) {
                    this.hits[repo][path] = {};
                }
                Object.assign(this.hits[repo][path], lines);
            }
        }
    }
}

/**
 * Fetches a single page of results from the grep.app API.
 * @param page The page number to fetch.
 * @param args The search arguments.
 * @returns An object containing the next page number, the hits found, and the total count.
 */
async function fetchGrepApp(page: number, args: any): Promise<{ nextPage: number | null, hits: Hits, count: number }> {
    const params: any = { q: args.query, page };
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
        const hits = new Hits();

        logger.debug('Received response from grep.app API', { count, hitsCount: data.hits.hits.length });

        for (const hitData of data.hits.hits) {
            hits.addHit(hitData.repo.raw, hitData.path.raw, hitData.content.snippet);
        }

        const hasMorePages = count > 10 * page;
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
interface ToolContext {
    log: {
        info: (message: string, data?: any) => void;
        error: (message: string, data?: any) => void;
        warn: (message: string, data?: any) => void;
        debug: (message: string, data?: any) => void;
    };
    reportProgress: (progress: { progress: number; total: number }) => Promise<void>;
}

export async function searchCode(args: any, { log, reportProgress }: ToolContext): Promise<Hits> {
    // Log to both FastMCP's log and our Winston logger
    logger.info(`Starting code search for query: "${args.query}"`, { query: args.query });
    log.info(`Starting code search for query: "${args.query}"`);
    
    let page = 1;
    let { nextPage, hits: totalHits, count } = await fetchGrepApp(page, args);
    const totalResultCount = Math.min(count, 1000); // API is limited to 100 pages.

    logger.info(`Found ${count} total results, will fetch up to ${totalResultCount}`, { count, totalResultCount });
    await reportProgress({ progress: 10, total: totalResultCount });

    while (nextPage && nextPage <= 100) { // Paginate up to 100 pages
        logger.info(`Fetching page ${nextPage} of ${Math.ceil(count / 10)}...`, { page: nextPage, totalPages: Math.ceil(count / 10) });
        log.info(`Fetching page ${nextPage} of ${Math.ceil(count / 10)}...`);
        
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));

        const pageResult = await fetchGrepApp(nextPage, args);
        nextPage = pageResult.nextPage;
        totalHits.merge(pageResult.hits);

        await reportProgress({ progress: (nextPage ? nextPage - 1 : 100) * 10, total: totalResultCount });
    }

    const repoCount = Object.keys(totalHits.hits).length;
    logger.info(`Search complete. Found matches in ${repoCount} repositories.`, { repoCount });
    log.info(`Search complete. Found matches in ${repoCount} repositories.`);
    
    await reportProgress({ progress: totalResultCount, total: totalResultCount });

    return totalHits;
}


//================================================================================
// Part 2: FastMCP Server Implementation
//================================================================================

/**
 * Formats the search results into a human-readable string.
 * @param results The search results.
 * @returns A formatted string.
 */
function formatResultsAsText(results: SearchResult): string {
    let output = '';
    const separator = "─".repeat(80) + "\n";
    let repoCt = 0, fileCt = 0, lineCt = 0;

    for (const [repo, pathData] of Object.entries(results)) {
        repoCt++;
        output += separator;
        output += `Repository: ${repo}\n`;
        for (const [path, lines] of Object.entries(pathData)) {
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

// Initialize the FastMCP server
const server = new FastMCP({
    name: "GrepApp Search Server",
    version: "1.0.0",
    instructions: `This server provides a tool to search for code snippets across public repositories using the grep.app API.

Usage Example:
call searchCode '{"query": "your search query", "langFilter": "TypeScript"}'`
});

// Define the 'searchCode' tool
server.addTool({
    name: "searchCode",
    description: "Searches public code on GitHub using the grep.app API.",
    parameters: z.object({
        query: z.string().describe("The search query string."),
        jsonOutput: z.boolean().optional().default(false).describe("If true, return results as a JSON object. Otherwise, return formatted text."),
        caseSensitive: z.boolean().optional().describe("Perform a case-sensitive search."),
        useRegex: z.boolean().optional().describe("Treat the query as a regular expression. Cannot be used with wholeWords."),
        wholeWords: z.boolean().optional().describe("Search for whole words only. Cannot be used with useRegex."),
        repoFilter: z.string().optional().describe("Filter by repository name pattern (e.g., 'facebook/react')."),
        pathFilter: z.string().optional().describe("Filter by file path pattern (e.g., 'src/components/')."),
        langFilter: z.string().optional().describe("Filter by language, comma-separated (e.g., 'TypeScript,Python')."),
    }),
    annotations: {
        title: "Code Search (grep.app)",
        readOnlyHint: true,
        openWorldHint: true,
    },
    execute: async (args, { log, reportProgress }) => {
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
            
            const hits: Hits = await searchCode(args, { log, reportProgress });

            if (Object.keys(hits.hits).length === 0) {
                logger.info("No search results found", { query: args.query });
                return "No results found for your query.";
            }

            const repoCount = Object.keys(hits.hits).length;
            logger.info("Search results ready to return", { repoCount, format: args.jsonOutput ? 'json' : 'text' });
            
            if (args.jsonOutput) {
                return JSON.stringify(hits.hits, null, 2);
            } else {
                return formatResultsAsText(hits.hits);
            }
        } catch (error: any) {
            logger.error("Search execution failed", { error: error.message, stack: error.stack });
            log.error(`An error occurred during search: ${error.message}`);
            throw new UserError(`Search failed. Reason: ${error.message}`);
        }
    }
});

// Define FastMCP session event types
interface FastMCPSession {
    on(event: string, listener: (event: any) => void): void;
    // The session doesn't actually have an id property in the type definition,
    // but we can use a unique identifier from the session object for logging
}

interface ConnectEvent {
    session: FastMCPSession;
}

interface DisconnectEvent {
    session: FastMCPSession;
}

// Register server event handlers for logging
server.on('connect', (event: ConnectEvent) => {
    // Use a more generic identifier for logging since id may not be available
    const sessionIdentifier = Math.random().toString(36).substring(2, 10);
    logger.info('Client connected', { sessionIdentifier });
    
    // Log when roots change
    event.session.on('rootsChanged', (rootsEvent: any) => {
        logger.debug('Roots changed', { roots: rootsEvent.roots });
    });
    
    // Log session errors
    event.session.on('error', (errorEvent: any) => {
        logger.error('Session error', { error: errorEvent.error });
    });
});

server.on('disconnect', (event: DisconnectEvent) => {
    // Use a more generic approach since id may not be available
    logger.info('Client disconnected');
});

// Start the server.
// Using "httpStream" transport enables both HTTP Streaming (/mcp) and SSE (/sse) endpoints.
logger.info('Starting FastMCP server', { port: 8602 });

server.start({
    transportType: "httpStream",
    httpStream: {
        port: 8602,
    },
    // health: {
    //     enabled: true,
    // }
}).then(() => {
    logger.info('FastMCP server started successfully', {
        port: 8602,
        endpoints: {
            http: 'http://localhost:8602/mcp',
            sse: 'http://localhost:8602/sse'
        }
    });
}).catch(error => {
    logger.error('Failed to start FastMCP server', { error });
    process.exit(1);
});

// Also log to console for visibility
console.log(`FastMCP server for grep.app is running on port 8602.`);
console.log(`- HTTP Streaming endpoint: http://localhost:8602/mcp`);
console.log(`- SSE endpoint: http://localhost:8602/sse`);