#!/bin/bash

# Binary build script for grep_app_mcp
# Creates standalone executable binaries using TypeScript + NCC

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🏗️  Building binary distribution..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist-binary/
mkdir -p dist-binary/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript first
echo "🔨 Building TypeScript..."
npm run build

# Use NCC to create truly standalone binaries
echo "📦 Creating standalone binaries with NCC..."

# Build HTTP server binary
echo "  Building HTTP server binary..."
npx ncc build dist/server.js -o dist-binary/server-bundle --minify

# Build STDIO server binary  
echo "  Building STDIO server binary..."
npx ncc build dist/server-stdio.js -o dist-binary/stdio-bundle --minify

# Create executable wrapper scripts
echo "🚀 Creating executable wrappers..."

# HTTP server wrapper
cat > dist-binary/grep-app-server << 'EOF'
#!/usr/bin/env node
import('./server-bundle/index.js');
EOF

# STDIO server wrapper
cat > dist-binary/grep-app-stdio << 'EOF'
#!/usr/bin/env node
import('./stdio-bundle/index.js');
EOF

# Make executables
chmod +x dist-binary/grep-app-server
chmod +x dist-binary/grep-app-stdio

# Create package.json for binary distribution
cat > dist-binary/package.json << 'EOF'
{
  "name": "grep_app_mcp_binary",
  "version": "1.0.0",
  "description": "Standalone binary distribution of grep_app_mcp",
  "type": "module",
  "main": "server-bundle/index.js",
  "bin": {
    "grep-app-server": "./grep-app-server",
    "grep-app-stdio": "./grep-app-stdio"
  }
}
EOF

# Create usage instructions
cat > dist-binary/README.md << 'EOF'
# Grep App MCP Server - Binary Distribution

This directory contains standalone executable binaries for the MCP server.

## Files:
- `grep-app-server` - HTTP server executable (no dependencies needed)
- `grep-app-stdio` - STDIO server executable (no dependencies needed)
- `server-bundle/` - HTTP server bundle
- `stdio-bundle/` - STDIO server bundle

## Usage:

```bash
# HTTP mode (standalone executable)
./grep-app-server

# STDIO mode (standalone executable)
./grep-app-stdio

# Or with node directly
node server-bundle/index.js
node stdio-bundle/index.js
```

## Installation:
No installation required! Just run the executables directly.

## Notes:
- These binaries include all dependencies bundled
- No need to run `npm install`
- Node.js runtime still required on the system
EOF

# Clean up intermediate files (none needed for NCC approach)

echo "✅ Binary build complete!"
echo ""
echo "📁 Built binaries in dist-binary/:"
ls -la dist-binary/

echo ""
echo "🚀 To run the standalone binaries:"
echo "   ./dist-binary/grep-app-server     # HTTP server"
echo "   ./dist-binary/grep-app-stdio      # STDIO server"
echo ""
echo "📦 Or install globally:"
echo "   npm install -g ./dist-binary"
echo "   grep-app-server                   # Available system-wide"