# Grep App MCP Server

A Model Context Protocol (MCP) server that provides powerful code search capabilities across public GitHub repositories using the grep.app API. Perfect for code discovery, learning from open source projects, and finding implementation examples.

## 🚀 Features

- **🔍 Advanced Code Search**: Search across millions of public repositories on GitHub
- **📁 File Retrieval**: Fetch specific files or batches of files from GitHub
- **🎯 Flexible Filtering**: Filter by language, repository, file path, and more  
- **📊 Multiple Output Formats**: JSON, numbered lists, or formatted text
- **⚡ Batch Operations**: Retrieve multiple files efficiently in parallel
- **🔄 Result Caching**: Cache search results for quick file retrieval
- **📝 Comprehensive Logging**: Built-in logging with daily rotation

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Claude Code CLI

### Quick Start

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/ai-tools-all/grep_app_mcp.git
   cd grep_app_mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Test the server**
   ```bash
   # HTTP mode (recommended for development)
   ./run.sh http dev
   
   # or STDIO mode
   ./run.sh stdio dev
   ```

## 🔧 Adding to Claude Code

### Method 1: Using MCP Configuration

Add this server to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "grep_app": {
      "command": "node",
      "args": ["/path/to/grep_app_mcp/dist/server-stdio.js"],
      "env": {}
    }
  }
}
```

### Method 2: Using HTTP Transport

For HTTP mode, add to your configuration:

```json
{
  "mcpServers": {
    "grep_app": {
      "url": "http://localhost:8603/mcp"
    }
  }
}
```

Then start the server:
```bash
./run.sh http prod
```

## 📖 run.sh Usage

The `run.sh` script provides convenient ways to start the server:

### Basic Usage
```bash
./run.sh [mode] [environment]
```

### Modes
- **`http`** - HTTP server with streaming support (default)
- **`stdio`** - STDIO server for direct MCP integration

### Environments  
- **`dev`** - Development mode with hot reload (default)
- **`prod`** - Production mode (requires build step)

### Examples
```bash
# Development (default) - HTTP server with hot reload
./run.sh

# Development - HTTP server  
./run.sh http dev

# Production - HTTP server
./run.sh http prod

# Development - STDIO server
./run.sh stdio dev

# Production - STDIO server  
./run.sh stdio prod

# Show help
./run.sh help
```

### HTTP Endpoints (when using HTTP mode)
- **HTTP Streaming**: `http://localhost:8603/mcp`
- **Server-Sent Events**: `http://localhost:8603/sse`

## 🔨 Available Tools

### 1. searchCode
Search for code across public GitHub repositories.

**Parameters:**
- `query` (required) - Search query string
- `jsonOutput` - Return JSON format (default: false)
- `numberedOutput` - Return numbered list format (default: false)  
- `caseSensitive` - Case-sensitive search
- `useRegex` - Treat query as regex pattern
- `wholeWords` - Search whole words only
- `repoFilter` - Filter by repository name pattern
- `pathFilter` - Filter by file path pattern
- `langFilter` - Filter by programming language(s)

**Example:**
```json
{
  "query": "async function fetchData",
  "langFilter": "TypeScript,JavaScript",
  "numberedOutput": true
}
```

### 2. github_file
Fetch a single file from a GitHub repository.

**Parameters:**
- `owner` (required) - Repository owner
- `repo` (required) - Repository name
- `path` (required) - File path
- `ref` (optional) - Branch/commit/tag reference

**Example:**
```json
{
  "owner": "microsoft",
  "repo": "vscode", 
  "path": "src/vs/editor/editor.api.ts"
}
```

### 3. github_batch_files
Fetch multiple files from GitHub repositories in parallel.

**Parameters:**
- `files` (required) - Array of file objects with owner, repo, path, and optional ref

**Example:**
```json
{
  "files": [
    {"owner": "facebook", "repo": "react", "path": "packages/react/index.js"},
    {"owner": "microsoft", "repo": "TypeScript", "path": "src/compiler/types.ts"}
  ]
}
```

### 4. batch_retrieve_files
Retrieve files from previously cached search results.

**Parameters:**
- `query` (required) - Original search query
- `resultNumbers` (optional) - Array of result indices to retrieve

**Example:**
```json
{
  "query": "tower_governor",
  "resultNumbers": [1, 2, 3]
}
```

## 🎯 Common Workflows

### 1. Code Discovery
```bash
# Search for React hooks examples
searchCode("useEffect cleanup", langFilter: "JavaScript,TypeScript")

# Retrieve specific files from results  
batch_retrieve_files(query: "useEffect cleanup", resultNumbers: [1, 3, 5])
```

### 2. Learning Patterns
```bash
# Find authentication implementations
searchCode("JWT authentication middleware", repoFilter: "*express*")

# Get specific implementation details
github_file(owner: "auth0", repo: "express-jwt", path: "lib/index.js")
```

### 3. API Research  
```bash
# Discover API patterns
searchCode("GraphQL resolver", pathFilter: "*/resolvers/*")

# Compare multiple implementations
github_batch_files([
  {owner: "apollographql", repo: "apollo-server", path: "packages/apollo-server-core/src/resolvers.ts"},
  {owner: "graphql", repo: "graphql-js", path: "src/execution/execute.js"}
])
```

## 📋 Development

### Available Scripts
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production HTTP server
- `npm run start-stdio` - Start production STDIO server  
- `npm run dev` - Start development HTTP server with hot reload
- `npm run dev-stdio` - Start development STDIO server with hot reload
- `npm run test-client` - Run test client

### Project Structure
```
src/
├── core/           # Core utilities (logger, types)
├── tools/          # MCP tool implementations
├── server.ts       # HTTP server entry point
└── server-stdio.ts # STDIO server entry point
```

## 📝 Logging

The server includes comprehensive logging with daily rotation:
- **Location**: `logs/` directory
- **Rotation**: Daily with date-based filenames
- **Levels**: error, warn, info, debug
- **Format**: JSON with timestamps

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

ISC License - see package.json for details

## 🔗 Related

- [grep.app](https://grep.app) - The search service powering this tool
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Claude Code](https://claude.ai/code) - Claude's official CLI