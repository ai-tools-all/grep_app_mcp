import { FastMCP } from "fastmcp";
import { logger } from './core/logger.js';
import { ConnectEvent, DisconnectEvent } from './core/types.js';
import { allTools } from './tools/index.js';

// Initialize the FastMCP server
const server = new FastMCP({
    name: "GrepApp Search Server",
    version: "1.0.0",
    instructions: `This server provides a tool to search for code snippets across public repositories using the grep.app API.

Usage Example:
call searchCode '{"query": "your search query", "langFilter": "TypeScript"}'`
});

// Register all tools
for (const tool of allTools) {
    server.addTool(tool);
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
