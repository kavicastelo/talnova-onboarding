import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';

// Phase 2: Code Obfuscation & Binary Hardening Plugin (ADR-004)
function demoCodeObfuscationPlugin(): Plugin {
  return {
    name: 'demo-code-obfuscation',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      // Skip large external vendor chunks to optimize build speed while securing all app code
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

// Standalone Vite configuration for Talnova Demo Deployment (ADR-001)
export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), demoCodeObfuscationPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.VITE_IS_DEMO_BUILD': JSON.stringify('true'),
    __DEMO_BUILD__: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'demo/index.html'),
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
        },
      },
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
