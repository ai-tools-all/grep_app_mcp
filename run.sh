#!/bin/bash

# MCP Server Runner Script
# Usage: ./run.sh [mode] [environment]
# Modes: http, stdio
# Environment: dev, prod

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the project directory
cd "$SCRIPT_DIR"

MODE=${1:-http}
ENV=${2:-dev}

case "$MODE" in
    "build")
        echo "🏗️  Building standalone distribution..."
        ./build.sh
        echo "✅ Build complete! Files available in dist/"
        ;;
    "binary")
        echo "🔧 Building standalone binary executables..."
        ./build-binary.sh
        echo "✅ Binary build complete! Executables available in dist-binary/"
        ;;
    "http")
        case "$ENV" in
            "dev")
                echo "🚀 Starting HTTP server in development mode..."
                echo "📡 Server will be available at: http://localhost:8603"
                npm run dev
                ;;
            "prod")
                echo "🏗️  Building and starting HTTP server in production mode..."
                npm run build
                echo "🚀 Starting production HTTP server..."
                npm run start
                ;;
            *)
                echo "❌ Invalid environment. Use 'dev' or 'prod'"
                exit 1
                ;;
        esac
        ;;
    "stdio")
        case "$ENV" in
            "dev")
                echo "🚀 Starting STDIO server in development mode..."
                npm run dev-stdio
                ;;
            "prod")
                echo "🏗️  Building and starting STDIO server in production mode..."
                npm run build
                echo "🚀 Starting production STDIO server..."
                npm run start-stdio
                ;;
            *)
                echo "❌ Invalid environment. Use 'dev' or 'prod'"
                exit 1
                ;;
        esac
        ;;
    "help"|"-h"|"--help")
        echo "MCP Server Runner"
        echo ""
        echo "Usage: ./run.sh [mode] [environment]"
        echo ""
        echo "Modes:"
        echo "  build   - Build standalone distribution"
        echo "  binary  - Build standalone binary executables"
        echo "  http    - Run HTTP server (default)"
        echo "  stdio   - Run STDIO server"
        echo ""
        echo "Environments:"
        echo "  dev     - Development mode with hot reload (default)"
        echo "  prod    - Production mode (requires build)"
        echo ""
        echo "Examples:"
        echo "  ./run.sh                  # HTTP dev (default)"
        echo "  ./run.sh build            # Build standalone files"
        echo "  ./run.sh binary           # Build binary executables"
        echo "  ./run.sh http dev         # HTTP dev"
        echo "  ./run.sh http prod        # HTTP prod"
        echo "  ./run.sh stdio dev        # STDIO dev"
        echo "  ./run.sh stdio prod       # STDIO prod"
        echo ""
        echo "HTTP endpoints when running in http mode:"
        echo "  - HTTP Streaming: http://localhost:8603/mcp"
        echo "  - SSE: http://localhost:8603/sse"
        ;;
    *)
        echo "❌ Invalid mode. Use 'build', 'binary', 'http', or 'stdio'"
        echo "Run './run.sh help' for usage information"
        exit 1
        ;;
esac