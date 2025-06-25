/**
 * Interfaces for the grep.app API response and our internal data structures.
 */

// FastMCP tool context interface
export interface ToolContext {
    log: {
        info: (message: string, data?: any) => void;
        error: (message: string, data?: any) => void;
        warn: (message: string, data?: any) => void;
        debug: (message: string, data?: any) => void;
    };
    reportProgress: (progress: { progress: number; total: number }) => Promise<void>;
}

// grep.app API response interfaces
export interface HitData {
    repo: { raw: string };
    path: { raw: string };
    content: { snippet: string };
}

export interface GrepAppResponse {
    facets: {
        count: number;
    };
    hits: {
        hits: HitData[];
    };
}

// Search result interface
export interface SearchResult {
    [repo: string]: {
        [path: string]: {
            [lineNum: string]: string;
        };
    };
}

// FastMCP session event interfaces
export interface FastMCPSession {
    on(event: string, listener: (event: any) => void): void;
}

export interface ConnectEvent {
    session: FastMCPSession;
}

export interface DisconnectEvent {
    session: FastMCPSession;
}

// Search parameters interface
export interface SearchParams {
    query: string;
    jsonOutput?: boolean;
    numberedOutput?: boolean;
    caseSensitive?: boolean;
    useRegex?: boolean;
    wholeWords?: boolean;
    repoFilter?: string;
    pathFilter?: string;
    langFilter?: string;
}
