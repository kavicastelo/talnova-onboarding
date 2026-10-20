import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

describe('SEC-HTML-001: HTML Document Hardening, Frame-Busting & Fallback CSP Suite', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const headersPath = path.join(rootDir, 'public/_headers');
  const vercelJsonPath = path.join(rootDir, 'vercel.json');

  let indexHtmlContent: string;

  beforeEach(() => {
    indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  });

  // =========================================================================
  // 1. HTML5 Document Validity & Metadata Directives
  // =========================================================================
  describe('1. HTML Document Metadata & Security Directives', () => {
    it('is a valid HTML document containing required security meta tags', () => {
      const dom = new JSDOM(indexHtmlContent);
      const doc = dom.window.document;

      // Verify DOCTYPE
      expect(indexHtmlContent.trim().toLowerCase()).toMatch(/^<!doctype html>/);

      // Verify X-Content-Type-Options
      const nosniffMeta = doc.querySelector('meta[http-equiv="X-Content-Type-Options"]');
      expect(nosniffMeta).toBeTruthy();
      expect(nosniffMeta?.getAttribute('content')).toBe('nosniff');

      // Verify Referrer-Policy
      const referrerMeta = doc.querySelector('meta[name="referrer"]');
      expect(referrerMeta).toBeTruthy();
      expect(referrerMeta?.getAttribute('content')).toBe('strict-origin-when-cross-origin');

      // Verify Content-Security-Policy
      const cspMeta = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
      expect(cspMeta).toBeTruthy();
      const cspContent = cspMeta?.getAttribute('content') || '';

      expect(cspContent).toContain("default-src 'self'");
      expect(cspContent).toContain("script-src 'self' 'unsafe-inline'");
      expect(cspContent).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
      expect(cspContent).toContain("font-src 'self' https://fonts.gstatic.com data:");
      expect(cspContent).toContain("img-src 'self' data: https: blob:");
      expect(cspContent).toContain("object-src 'none'");
      expect(cspContent).toContain("base-uri 'self'");
    });
  });

  // =========================================================================
  // 2. Client-Side Frame-Busting Execution & Logic
  // =========================================================================
  describe('2. Client-Side Frame-Busting Script Protection', () => {
    it('contains inline frame-busting snippet in head before external scripts', () => {
      const dom = new JSDOM(indexHtmlContent);
      const doc = dom.window.document;

      const scripts = Array.from(doc.head.querySelectorAll('script'));
      expect(scripts.length).toBeGreaterThan(0);

      const frameBustScript = scripts.find((s) => s.textContent?.includes('window.top !== window.self'));
      expect(frameBustScript).toBeTruthy();
      expect(frameBustScript?.textContent).toContain('window.top.location = window.self.location');
    });

    it('simulates breakout when app is framed by a malicious cross-origin parent', () => {
      // Create mock window objects
      const mockSelf = {
        location: {
          hostname: 'talnova.io',
          href: 'https://talnova.io/employee'
        }
      };

      const mockTop = {
        location: {
          hostname: 'attacker-evil-site.com',
          href: 'https://attacker-evil-site.com'
        }
      };

      // Execute frame-busting logic
      const runFrameBusting = (selfWin: any, topWin: any) => {
        if (topWin !== selfWin) {
          try {
            if (topWin.location.hostname !== selfWin.location.hostname) {
              topWin.location = selfWin.location;
            }
          } catch {
            topWin.location = selfWin.location;
          }
        }
      };

      runFrameBusting(mockSelf, mockTop);
      expect(mockTop.location).toBe(mockSelf.location);
    });

    it('handles cross-origin DOMException on accessing top.location.hostname and breaks out', () => {
      const mockSelf = {
        location: {
          hostname: 'talnova.io',
          href: 'https://talnova.io'
        }
      };

      let assignedLocation: any = null;
      const mockTop = {
        get location() {
          throw new Error('Blocked a frame with origin "https://talnova.io" from accessing a cross-origin frame.');
        },
        set location(val: any) {
          assignedLocation = val;
        }
      };

      const runFrameBusting = (selfWin: any, topWin: any) => {
        if (topWin !== selfWin) {
          try {
            if (topWin.location.hostname !== selfWin.location.hostname) {
              topWin.location = selfWin.location;
            }
          } catch {
            topWin.location = selfWin.location;
          }
        }
      };

      runFrameBusting(mockSelf, mockTop);
      expect(assignedLocation).toBe(mockSelf.location);
    });

    it('does not alter location when running in standard top window context (unframed)', () => {
      const mockSelf = {
        location: {
          hostname: 'talnova.io',
          href: 'https://talnova.io'
        }
      };

      const runFrameBusting = (selfWin: any, topWin: any) => {
        if (topWin !== selfWin) {
          try {
            if (topWin.location.hostname !== selfWin.location.hostname) {
              topWin.location = selfWin.location;
            }
          } catch {
            topWin.location = selfWin.location;
          }
        }
      };

      runFrameBusting(mockSelf, mockSelf);
      expect(mockSelf.location.href).toBe('https://talnova.io');
    });
  });

  // =========================================================================
  // 3. Static Deployment Headers Hardening (_headers & vercel.json)
  // =========================================================================
  describe('3. Static Host Deployment Security Headers', () => {
    it('verifies public/_headers contains strict CSP, SAMEORIGIN, nosniff and referrer headers', () => {
      expect(fs.existsSync(headersPath)).toBe(true);
      const headersContent = fs.readFileSync(headersPath, 'utf8');

      expect(headersContent).toContain('X-Frame-Options: SAMEORIGIN');
      expect(headersContent).toContain('X-Content-Type-Options: nosniff');
      expect(headersContent).toContain('Referrer-Policy: strict-origin-when-cross-origin');
      expect(headersContent).toContain('Content-Security-Policy:');
      expect(headersContent).toContain("default-src 'self'");
      expect(headersContent).toContain("object-src 'none'");
    });

    it('verifies vercel.json contains CSP, SAMEORIGIN, nosniff and referrer headers', () => {
      expect(fs.existsSync(vercelJsonPath)).toBe(true);
      const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

      const globalHeaderConfig = vercelJson.headers?.find((h: any) => h.source === '/(.*)');
      expect(globalHeaderConfig).toBeTruthy();

      const headerKeys = globalHeaderConfig.headers.map((h: any) => h.key);
      expect(headerKeys).toContain('X-Frame-Options');
      expect(headerKeys).toContain('X-Content-Type-Options');
      expect(headerKeys).toContain('Referrer-Policy');
      expect(headerKeys).toContain('Content-Security-Policy');

      const cspHeader = globalHeaderConfig.headers.find((h: any) => h.key === 'Content-Security-Policy');
      expect(cspHeader.value).toContain("default-src 'self'");
      expect(cspHeader.value).toContain("object-src 'none'");
    });
  });
});
