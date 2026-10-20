import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import DOMPurify from 'dompurify';
import { isSafeUrl, sanitizeHref, isExternalUrl } from '../utils/urlSanitizer';
import { SafeLink } from '../components/SafeLink';

describe('SEC-SAFE-LINK: Safe Link & Dangerous Protocol Sanitizer', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    (globalThis as any).window = {
      location: {
        origin: 'https://talnova.io',
        host: 'talnova.io',
        hostname: 'talnova.io',
      },
    };
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  // =========================================================================
  // 1. PROTOCOL VALIDATION & REJECTION OF DANGEROUS SCHEMES
  // =========================================================================
  describe('isSafeUrl & Dangerous Scheme Defense', () => {
    it('rejects javascript: pseudo-protocol vectors', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl(' javascript:alert(1) ')).toBe(false);
    });

    it('rejects data: text/html and executable MIME vectors', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
    });

    it('rejects vbscript:, blob:, and file: schemes', () => {
      expect(isSafeUrl('vbscript:msgbox("XSS")')).toBe(false);
      expect(isSafeUrl('blob:https://talnova.io/uuid-blob')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
    });

    it('rejects protocol-relative URL redirects (//attacker.com)', () => {
      expect(isSafeUrl('//attacker.com/malicious')).toBe(false);
      expect(isSafeUrl('//evil.org')).toBe(false);
    });

    it('accepts legitimate https: and http: URLs', () => {
      expect(isSafeUrl('https://google.com')).toBe(true);
      expect(isSafeUrl('https://talnova.io/dashboard')).toBe(true);
      expect(isSafeUrl('http://localhost:3000/api')).toBe(true);
    });

    it('accepts legitimate mailto: and tel: contact protocols', () => {
      expect(isSafeUrl('mailto:security@talnova.io')).toBe(true);
      expect(isSafeUrl('mailto:support@talnova.io?subject=Inquiry')).toBe(true);
      expect(isSafeUrl('tel:+18005550199')).toBe(true);
    });

    it('accepts internal relative paths and hash anchors', () => {
      expect(isSafeUrl('/dashboard')).toBe(true);
      expect(isSafeUrl('/journeys/new')).toBe(true);
      expect(isSafeUrl('/settings?tab=security')).toBe(true);
      expect(isSafeUrl('#')).toBe(true);
      expect(isSafeUrl('#top')).toBe(true);
      expect(isSafeUrl('#section-2')).toBe(true);
    });

    it('handles null, undefined, and non-string values safely', () => {
      expect(isSafeUrl(null)).toBe(false);
      expect(isSafeUrl(undefined)).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });
  });

  // =========================================================================
  // 2. SANITIZE HREF WITH FALLBACK
  // =========================================================================
  describe('sanitizeHref', () => {
    it('returns sanitized safe URL when valid', () => {
      expect(sanitizeHref('https://talnova.io')).toBe('https://talnova.io');
      expect(sanitizeHref('  https://talnova.io  ')).toBe('https://talnova.io');
      expect(sanitizeHref('/dashboard')).toBe('/dashboard');
      expect(sanitizeHref('#section')).toBe('#section');
    });

    it('falls back to "#" when protocol is malicious or invalid', () => {
      expect(sanitizeHref('javascript:alert(1)')).toBe('#');
      expect(sanitizeHref('data:text/html,test')).toBe('#');
      expect(sanitizeHref('vbscript:run()')).toBe('#');
      expect(sanitizeHref(null)).toBe('#');
      expect(sanitizeHref(undefined)).toBe('#');
    });

    it('supports custom fallback href', () => {
      expect(sanitizeHref('javascript:alert(1)', '/safe-fallback')).toBe('/safe-fallback');
    });
  });

  // =========================================================================
  // 3. EXTERNAL URL CLASSIFIER & REVERSE TAB-NABBING
  // =========================================================================
  describe('isExternalUrl', () => {
    it('identifies external domains with different hostnames', () => {
      expect(isExternalUrl('https://google.com')).toBe(true);
      expect(isExternalUrl('https://github.com/talnova')).toBe(true);
      expect(isExternalUrl('http://partner-service.org')).toBe(true);
    });

    it('identifies same-host URLs as internal', () => {
      expect(isExternalUrl('https://talnova.io/profile')).toBe(false);
      expect(isExternalUrl('/dashboard')).toBe(false);
      expect(isExternalUrl('#details')).toBe(false);
    });
  });

  // =========================================================================
  // 4. SAFELINK COMPONENT INTEGRATION
  // =========================================================================
  describe('<SafeLink /> Component', () => {
    it('renders safe internal relative link without target or noopener', () => {
      const html = renderToString(
        React.createElement(SafeLink, { href: '/dashboard', className: 'nav-link' }, 'Dashboard')
      );

      expect(html).toContain('href="/dashboard"');
      expect(html).not.toContain('target="_blank"');
      expect(html).not.toContain('noopener noreferrer');
      expect(html).toContain('Dashboard');
    });

    it('renders external link with strictly enforced target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToString(
        React.createElement(
          SafeLink,
          { href: 'https://google.com', className: 'external-btn' },
          'Google Search'
        )
      );

      expect(html).toContain('href="https://google.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('neutralizes javascript: attack and falls back to safe href="#"', () => {
      const html = renderToString(
        React.createElement(
          SafeLink,
          { href: 'javascript:alert(document.domain)' },
          'Dangerous Link'
        )
      );

      expect(html).toContain('href="#"');
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('target="_blank"');
    });

    it('neutralizes data: URI attack and falls back to custom fallbackHref', () => {
      const html = renderToString(
        React.createElement(
          SafeLink,
          { href: 'data:text/html,<script>alert(1)</script>', fallbackHref: '/error' },
          'Exploit Link'
        )
      );

      expect(html).toContain('href="/error"');
      expect(html).not.toContain('data:');
    });

    it('forces external behavior when forceExternal={true} is set', () => {
      const html = renderToString(
        React.createElement(SafeLink, { href: '/terms-of-service', forceExternal: true }, 'Terms')
      );

      expect(html).toContain('href="/terms-of-service"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });
  });

  // =========================================================================
  // 5. DEMO INBOX STORED XSS DEFENSE
  // =========================================================================
  describe('DemoInbox Email HTML Sanitization', () => {
    it('strips script tags and malicious attributes using configured DOMPurify schema', async () => {
      const { JSDOM } = await import('jsdom');
      const jsdomWindow = new JSDOM('').window;
      const purifyInstance = typeof (DOMPurify as any)?.sanitize === 'function'
        ? DOMPurify
        : (DOMPurify as any)(jsdomWindow);

      const dirtyHtml =
        '<h3>Welcome</h3>' +
        '<script>alert("XSS")</script>' +
        '<p>Click <a href="https://talnova.io">here</a> to start.</p>' +
        '<img src="x" onerror="alert(1)" />' +
        '<div onclick="malicious()">Safe Container</div>';

      const cleaned = purifyInstance.sanitize(dirtyHtml, {
        ALLOWED_TAGS: [
          'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
          'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'blockquote',
          'table', 'tr', 'td', 'th', 'thead', 'tbody', 'div', 'img',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'title', 'src', 'alt', 'width', 'height'],
      });

      expect(cleaned).not.toContain('<script');
      expect(cleaned).not.toContain('onerror');
      expect(cleaned).not.toContain('onclick');
      expect(cleaned).toContain('<h3>Welcome</h3>');
      expect(cleaned).toContain('<p>Click <a href="https://talnova.io">here</a> to start.</p>');
      expect(cleaned).toContain('<img src="x">');
      expect(cleaned).toContain('<div>Safe Container</div>');
    });
  });
});
