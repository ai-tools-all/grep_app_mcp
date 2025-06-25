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
    server.addTool(tool as any);
}

// Register server event handlers for logging
server.on('connect', (event: ConnectEvent) => {
    const sessionIdentifier = Math.random().toString(36).substring(2, 10);
    logger.info('Client connected via stdio', { sessionIdentifier });
    
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
    logger.info('Client disconnected from stdio');
});

// Start the server in stdio mode
logger.info('Starting FastMCP server in stdio mode');

server.start({
    transportType: "stdio"
}).then(() => {
    logger.info('FastMCP server started successfully in stdio mode');
}).catch(error => {
    logger.error('Failed to start FastMCP server in stdio mode', { error });
    process.exit(1);
});