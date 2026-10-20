import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * Production Code Obfuscation & Binary Hardening Plugin (CLI-001)
 * Enforces Control Flow Flattening, String Array Encryption (RC4/Base64),
 * Dead Code Injection, and Split Strings across all application bundles.
 */
function codeObfuscationPlugin(): Plugin {
  return {
    name: 'production-code-obfuscation',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      // Skip external vendor charting libraries to maintain high build performance
      if (chunk.fileName.includes('vendor-recharts') || chunk.fileName.includes('vendor-d3')) {
        return null;
      }

      const obfuscated = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        stringArray: true,
        stringArrayEncoding: ['rc4', 'base64'],
        stringArrayThreshold: 0.8,
        splitStrings: true,
        splitStringsChunkLength: 10,
        selfDefending: true,
        debugProtection: false, // Let runtime shield handle breakpoints dynamically
        renameGlobals: false,
        sourceMap: false,
        target: 'browser',
      });

      return {
        code: obfuscated.getObfuscatedCode(),
        map: null,
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';

  return {
    plugins: [
      react(),
      ...(isProduction ? [codeObfuscationPlugin()] : []),
    ],
    resolve: {
      dedupe: ['react', 'react-dom']
    },
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['server/**', 'node_modules/**', 'dist/**'],
    },
    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : [],
    },
    build: {
      minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) {
                return 'vendor-recharts';
              }
              if (id.includes('d3')) {
                return 'vendor-d3';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@tanstack') || id.includes('axios')) {
                return 'vendor-query';
              }
            }
          }
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
      allowedHosts: [
        'dfd8-123-231-110-255.ngrok-free.app'
      ]
    }
  };
})
