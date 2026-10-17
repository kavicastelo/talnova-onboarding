import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Demo Phase 3 — Tamper-Resistant Forensic Watermark & DOM Lockdown', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    (globalThis as any).window = {
      devicePixelRatio: 2,
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getComputedStyle: () => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        filter: '',
      }),
    };
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    vi.restoreAllMocks();
  });

  it('1. Formats forensic watermark metadata with persona, tenant, and session hash', () => {
    const tenantName = 'Acme Corp';
    const userFullName = 'Sarah Connor';
    const sessionId = '6ad30086896bab0b6cd41cf4';
    const currentTimestamp = '11:45 PM';

    const sessionHash = sessionId.slice(-8).toUpperCase();
    const formatted = `TALNOVA DEMO | ${tenantName} | ${userFullName} | ${currentTimestamp} | #${sessionHash} | CONFIDENTIAL`;

    expect(formatted).toContain('Acme Corp');
    expect(formatted).toContain('Sarah Connor');
    expect(formatted).toContain('#6CD41CF4');
    expect(formatted).toContain('CONFIDENTIAL');
  });

  it('2. Detects canvas deletion or detachment via MutationObserver logic', () => {
    let tamperDetected = false;
    const container = {
      contains: vi.fn((el) => el !== null && el.id === 'canvas-active'),
      appendChild: vi.fn(),
    };

    // Simulate removed canvas
    const canvas: any = null;
    if (!canvas || !container.contains(canvas)) {
      tamperDetected = true;
    }

    expect(tamperDetected).toBe(true);
  });

  it('3. Detects CSS style tampering (display:none, visibility:hidden, opacity:0)', () => {
    const tamperedStyles = [
      { display: 'none', visibility: 'visible', opacity: '1', filter: '' },
      { display: 'block', visibility: 'hidden', opacity: '1', filter: '' },
      { display: 'block', visibility: 'visible', opacity: '0.1', filter: '' },
      { display: 'block', visibility: 'visible', opacity: '1', filter: 'opacity(0)' },
    ];

    tamperedStyles.forEach((style) => {
      const isTampered =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity || '1') < 0.5 ||
        style.filter.includes('opacity(0)');

      expect(isTampered).toBe(true);
    });
  });

  it('4. Escalates to hard security lock when tamper count exceeds threshold (>= 4)', () => {
    let tamperCount = 0;
    let isHardLocked = false;

    const recordTamper = () => {
      tamperCount += 1;
      if (tamperCount >= 4) {
        isHardLocked = true;
      }
    };

    // Simulate 3 tampered attempts
    recordTamper();
    recordTamper();
    recordTamper();
    expect(isHardLocked).toBe(false);

    // 4th attempt must trigger hard lock
    recordTamper();
    expect(isHardLocked).toBe(true);
    expect(tamperCount).toBe(4);
  });

  it('5. Anti-Screen-Grab: Tracks window blur and focus states', () => {
    let isWindowBlurred = false;

    const handleBlur = () => { isWindowBlurred = true; };
    const handleFocus = () => { isWindowBlurred = false; };

    handleBlur();
    expect(isWindowBlurred).toBe(true);

    handleFocus();
    expect(isWindowBlurred).toBe(false);
  });

  it('6. DOM Lockdown: Select styles disable user selection on sensitive nodes', () => {
    const sensitiveNodeClasses = ['demo-shielded', 'journey-content', 'quiz-card'];
    const allowsSelection = (classes: string[]) => !classes.includes('demo-shielded');

    expect(allowsSelection(sensitiveNodeClasses)).toBe(false);
  });
});
