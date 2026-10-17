import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectBot, enforceBotDefense } from '../../demo/src/utils/botDetection';
import { isShieldedPayload, unpackDemoPayload } from '../../src/utils/payloadShield';

describe('Demo Bot Defense & Headless Crawler Detection', () => {
  let mockWindow: any;
  let mockNavigator: any;

  beforeEach(() => {
    mockWindow = {
      location: {
        pathname: '/demo/admin',
        replace: vi.fn(),
        href: '/demo/admin',
      },
    };

    mockNavigator = {
      webdriver: false,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      languages: ['en-US', 'en'],
    };
  });

  it('identifies normal clean browser environment as non-bot', () => {
    const result = detectBot(mockWindow, mockNavigator);
    expect(result.isBot).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it('detects automated headless browser when navigator.webdriver is true', () => {
    mockNavigator.webdriver = true;
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.reason).toContain('navigator.webdriver is true');
    expect(result.signals).toContain('navigator.webdriver is true');
  });

  it('detects PhantomJS automation markers', () => {
    mockWindow.callPhantom = vi.fn();
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('PhantomJS'))).toBe(true);
  });

  it('detects Nightmare.js automation markers', () => {
    mockWindow.__nightmare = {};
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('Nightmare.js'))).toBe(true);
  });

  it('detects Cypress runner in production demo environment', () => {
    mockWindow.Cypress = {};
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('Cypress'))).toBe(true);
  });

  it('detects HeadlessChrome, Puppeteer, or Playwright in user-agent string', () => {
    mockNavigator.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36';
    mockNavigator.platform = 'Linux x86_64';
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('HeadlessChrome'))).toBe(true);
  });

  it('detects empty browser languages array', () => {
    mockNavigator.languages = [];
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('languages array is empty'))).toBe(true);
  });

  it('detects platform vs user-agent spoofing mismatch', () => {
    mockNavigator.platform = 'Linux x86_64';
    mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = detectBot(mockWindow, mockNavigator);

    expect(result.isBot).toBe(true);
    expect(result.signals.some((s) => s.includes('Platform mismatch'))).toBe(true);
  });

  it('enforces bot defense: wipes credentials and redirects to access-denied view', () => {
    mockNavigator.webdriver = true;
    const removeItemSpy = vi.fn();
    const clearSpy = vi.fn();

    vi.stubGlobal('localStorage', {
      removeItem: removeItemSpy,
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
    vi.stubGlobal('sessionStorage', {
      clear: clearSpy,
    });

    const isBlocked = enforceBotDefense(mockWindow, mockNavigator);
    expect(isBlocked).toBe(true);
    expect(removeItemSpy).toHaveBeenCalledWith('demo_access_token');
    expect(mockWindow.location.replace).toHaveBeenCalledWith('/demo/access-denied?reason=bot_detected');

    vi.unstubAllGlobals();
  });
});

describe('Demo Payload Shield & In-Memory Unpacker', () => {
  it('correctly identifies shielded payload structures', () => {
    expect(isShieldedPayload(null)).toBe(false);
    expect(isShieldedPayload({})).toBe(false);
    expect(isShieldedPayload({ __shielded: true, payload: 'abc' })).toBe(true);
    expect(isShieldedPayload({ __shielded: false, payload: 'abc' })).toBe(false);
  });

  it('accurately unscrambles and parses multi-byte masked payload', () => {
    const originalData = {
      title: 'Full-Stack Acceleration Roadmap',
      modulesCount: 4,
      proprietaryLessons: ['Event Streams', 'LaunchDarkly'],
    };

    // Simulate server-side encoding
    const jsonStr = JSON.stringify(originalData);
    const utf8Bytes = Buffer.from(jsonStr, 'utf-8');
    const masked = Buffer.alloc(utf8Bytes.length);
    for (let i = 0; i < utf8Bytes.length; i++) {
      masked[i] = utf8Bytes[i] ^ (0x5a ^ (i % 11));
    }
    const payloadStr = masked.toString('base64');

    const unpacked = unpackDemoPayload(payloadStr);
    expect(unpacked).toEqual(originalData);
    expect(unpacked.title).toBe('Full-Stack Acceleration Roadmap');
    expect(unpacked.proprietaryLessons).toContain('Event Streams');
  });
});
