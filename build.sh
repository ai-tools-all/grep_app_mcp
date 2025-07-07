#!/bin/bash

# Build script for grep_app_mcp
# Creates standalone JavaScript files and updated run script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🏗️  Building grep_app_mcp..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
mkdir -p dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Compiling TypeScript..."
npm run build

# Copy package.json for runtime dependencies
echo "📋 Copying package.json..."
cp package.json dist/

# Create standalone bundle info
echo "📄 Creating bundle info..."
cat > dist/README.md << 'EOF'
# Grep App MCP Server - Built Distribution

This directory contains the compiled JavaScript files for the MCP server.

## Files:
- `server.js` - HTTP server entry point
- `server-stdio.js` - STDIO server entry point
- `package.json` - Runtime dependencies

## Usage:
```bash
# HTTP mode
node server.js

# STDIO mode  
node server-stdio.js
```

## Dependencies:
Run `npm install` in this directory to install runtime dependencies.
EOF

echo "✅ Build complete!"
echo ""
echo "📁 Built files in dist/:"
ls -la dist/

echo ""
echo "🚀 To run the standalone server:"
echo "   cd dist && npm install && node server.js"
echo ""
echo "📜 Use the existing run.sh script for development/production modes"