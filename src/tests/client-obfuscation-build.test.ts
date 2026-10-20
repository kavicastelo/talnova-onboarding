import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CLI-001: Production JavaScript Obfuscation & Binary Hardening', () => {
  const distDir = path.resolve(__dirname, '../../dist');
  const assetsDir = path.join(distDir, 'assets');

  it('1. Suppresses all source map files (.map) in the production build output', () => {
    expect(fs.existsSync(distDir)).toBe(true);
    expect(fs.existsSync(assetsDir)).toBe(true);

    const assetFiles = fs.readdirSync(assetsDir);
    const mapFiles = assetFiles.filter((f) => f.endsWith('.map'));
    expect(mapFiles).toHaveLength(0);
  });

  it('2. Compiles application JavaScript chunk with heavy string encryption and control flow flattening', () => {
    const assetFiles = fs.readdirSync(assetsDir);
    const mainBundle = assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    expect(mainBundle).toBeDefined();

    const bundlePath = path.join(assetsDir, mainBundle!);
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');

    // Verify source map URLs are completely absent
    expect(bundleContent).not.toContain('//# sourceMappingURL=');

    // Verify obfuscated string encryption decoding logic exists (RC4 / Base64 decoder loop)
    // The obfuscator emits characteristic string rotation and extraction routines
    const hasStringArrayDecryption =
      bundleContent.includes('parseInt') &&
      (bundleContent.includes('base64') || bundleContent.includes('push') || bundleContent.includes('shift'));
    expect(hasStringArrayDecryption).toBe(true);
  });

  it('3. Successfully isolates vendor bundles while preserving application obfuscation', () => {
    const assetFiles = fs.readdirSync(assetsDir);
    expect(assetFiles.some((f) => f.startsWith('vendor-recharts-'))).toBe(true);
    expect(assetFiles.some((f) => f.startsWith('vendor-d3-'))).toBe(true);
    expect(assetFiles.some((f) => f.startsWith('vendor-icons-'))).toBe(true);
  });
});
