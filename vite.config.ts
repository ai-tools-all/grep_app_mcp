import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist-binary',
    lib: {
      entry: {
        'server': resolve(__dirname, 'src/server.ts'),
        'server-stdio': resolve(__dirname, 'src/server-stdio.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        // Keep Node.js built-ins external
        'fs', 'path', 'url', 'crypto', 'os', 'util', 'events', 'stream', 'buffer',
        'child_process', 'cluster', 'dgram', 'dns', 'http', 'https', 'net', 'tls',
        'querystring', 'readline', 'repl', 'string_decoder', 'sys', 'timers',
        'tty', 'vm', 'zlib', 'assert', 'constants', 'punycode', 'domain',
        'http2', 'perf_hooks', 'async_hooks', 'inspector', 'worker_threads'
      ],
      output: {
        format: 'es',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name]-[hash].mjs'
      }
    },
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: (id) => {
        // Keep Node.js built-ins and some problematic packages external
        if (id.startsWith('node:') || 
            ['fs', 'path', 'url', 'crypto', 'os', 'util', 'events', 'stream', 'buffer'].includes(id)) {
          return true;
        }
        return false;
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});