import * as cheerio from 'cheerio';
import { SearchResult } from './types.js';

/**
 * Interface representing search results
 */
export interface IHits {
    hits: SearchResult;
}

/**
 * Creates a new IHits instance
 */
export function createHits(): IHits {
    return { hits: {} };
}

/**
 * Parses an HTML snippet from the API response to extract line numbers and code.
 * It uses cheerio to parse the HTML table structure.
 * @param snippet The HTML string snippet.
 * @returns A dictionary mapping line numbers to the corresponding line of code.
 */
function parseSnippet(snippet: string): { [lineNum: string]: string } {
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
 * Adds a new search hit to the results.
 * @param hits The IHits instance to add the hit to
 * @param repo The repository where the hit was found.
 * @param path The file path of the hit.
 * @param snippet The HTML snippet containing the matched lines.
 */
export function addHit(hits: IHits, repo: string, path: string, snippet: string): void {
    if (!hits.hits[repo]) {
        hits.hits[repo] = {};
    }
    if (!hits.hits[repo][path]) {
        hits.hits[repo][path] = {};
    }

    const parsedSnippet = parseSnippet(snippet);
    for (const [lineNum, line] of Object.entries(parsedSnippet)) {
        hits.hits[repo][path][lineNum] = line;
    }
}

/**
 * Merges results from one IHits instance into another.
 * @param target The target IHits instance
 * @param source The source IHits instance to merge from
 */
export function mergeHits(target: IHits, source: IHits): void {
    for (const [repo, pathData] of Object.entries(source.hits)) {
        if (!target.hits[repo]) {
            target.hits[repo] = {};
        }
        for (const [path, lines] of Object.entries(pathData as Record<string, any>)) {
            if (!target.hits[repo][path]) {
                target.hits[repo][path] = {};
            }
            Object.assign(target.hits[repo][path], lines);
        }
    }
}
