# Grep App MCP Server Task

## Task: Add structured logging to grep-app-server.ts

**Goal:** Implement structured logging for the grep-app-server.ts and store logs in a logs directory.

## Tasks

## Diagnosing JSON parameter parsing error
[X] Check how the tool is being called
[X] Verify implementation against FastMCP documentation
[X] Fix the issue by updating server instructions to include example usage

## Add structured logging to grep-app-server.ts
[X] Research and select a logging library (Winston)
[X] Create a logs directory
[X] Configure the logger with JSON formatting and file rotation
[X] Integrate structured logging throughout the server code
[ ] Install required dependencies
[ ] Test logging functionality

# Implementation Details

## Structured Logging Implementation
1. **Logging Library**: Winston with winston-daily-rotate-file for log rotation
2. **Log Directory**: Created a `logs` directory in the project root
3. **Log Format**: JSON format with timestamp, log level, and structured metadata
4. **Log Files**:
   - `application-%DATE%.log` - All logs
   - `error-%DATE%.log` - Error logs only
5. **Log Rotation**: Daily rotation with 14-day retention and 20MB max file size
6. **Log Levels**: Uses environment variable LOG_LEVEL or defaults to 'info'

## Required Dependencies
Before running the server, the following dependencies need to be installed:
```
npm install winston winston-daily-rotate-file @types/winston
```

# Lessons

1. When using FastMCP, tool parameters must be passed as a single JSON object string, not as separate arguments.
   - Incorrect: `call searchCode query="tower governor create"`
   - Correct: `call searchCode '{"query": "tower governor create"}'`

2. FastMCP server instructions should include clear examples of how to call tools with the correct parameter format.

3. When implementing structured logging:
   - Use proper TypeScript interfaces for logger types to avoid lint errors
   - Log at different severity levels (debug, info, warn, error) appropriately
   - Include relevant contextual data as structured metadata
   - Handle both synchronous and asynchronous errors with proper logging
