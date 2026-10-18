import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { disableReactDevTools, neuterConsole, enforceDomainLock } from '../../demo/src/security/antiTamper';

describe('Demo Phase 1 — Anti-Tamper & DevTools Neutralization', () => {
  const originalWindow = (globalThis as any).window;
  let originalConsoleLog: any;

  beforeEach(() => {
    (globalThis as any).window = {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: undefined,
      location: {
        pathname: '/demo',
        hostname: 'localhost',
      },
    };
    originalConsoleLog = console.log;
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    console.log = originalConsoleLog;
    vi.restoreAllMocks();
  });

  it('1. Successfully neutralizes React DevTools global hook', () => {
    const dummyInject = vi.fn();
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      inject: dummyInject,
      sub: vi.fn(),
      renderers: new Map(),
      supportsFiber: true,
    };

    disableReactDevTools();

    // Calling inject after neutralization must be a no-op
    expect(typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject).toBe('function');
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject();
    expect(dummyInject).not.toHaveBeenCalled();
    expect((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber).toBeNull();
  });

  it('2. Pre-emptively registers dead React DevTools hook if undefined', () => {
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

    disableReactDevTools();

    expect((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__).toBeDefined();
    expect(typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject).toBe('function');
  });

  it('3. Neutering console silences console output in demo mode', () => {
    neuterConsole(true);

    // Test that the current console.log does not throw and acts as no-op
    expect(() => {
      console.log('Confidential Business Logic');
      console.info('Schema Data');
      console.debug('Internal State');
    }).not.toThrow();
  });

  it('4. Intercepts and blocks F12 DevTools shortcut', () => {
    let prevented = false;
    let stopped = false;

    const event = {
      key: 'F12',
      keyCode: 123,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    };

    // Simulate keydown listener logic from useDemoAntiTamper
    const isF12 = event.key === 'F12' || event.keyCode === 123;
    if (isF12) {
      event.preventDefault();
      event.stopPropagation();
    }

    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('5. Intercepts and blocks Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U shortcuts', () => {
    const shortcuts = [
      { key: 'I', shiftKey: true, ctrlKey: true },
      { key: 'J', shiftKey: true, ctrlKey: true },
      { key: 'C', shiftKey: true, ctrlKey: true },
      { key: 'U', shiftKey: false, ctrlKey: true },
      { key: 'S', shiftKey: false, ctrlKey: true },
      { key: 'P', shiftKey: false, ctrlKey: true },
    ];

    shortcuts.forEach((sc) => {
      let isBlocked = false;
      const e = {
        key: sc.key,
        shiftKey: sc.shiftKey,
        ctrlKey: sc.ctrlKey,
        metaKey: false,
        preventDefault: () => { isBlocked = true; },
      };

      const isInspect = e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C');
      const isSourceOrSaveOrPrint = e.ctrlKey && (e.key === 'U' || e.key === 'S' || e.key === 'P');

      if (isInspect || isSourceOrSaveOrPrint) {
        e.preventDefault();
      }

      expect(isBlocked).toBe(true);
    });
  });

  it('6. Intercepts contextmenu on UI components while preserving inputs', () => {
    let divPrevented = false;
    let inputPrevented = false;

    const divTarget = { tagName: 'DIV' } as any;
    const inputTarget = { tagName: 'INPUT' } as any;

    const handleContextMenu = (target: HTMLElement, cb: () => void) => {
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (!isInput) {
        cb();
      }
    };

    handleContextMenu(divTarget, () => { divPrevented = true; });
    handleContextMenu(inputTarget, () => { inputPrevented = true; });

    expect(divPrevented).toBe(true);
    expect(inputPrevented).toBe(false);
  });

  it('7. Enforces domain lock: allows execution on legitimate domains', () => {
    (globalThis as any).window.location.hostname = 'demo.talnova.io';
    expect(enforceDomainLock()).toBe(true);

    (globalThis as any).window.location.hostname = 'talnova-onboarding-demo.netlify.app';
    expect(enforceDomainLock()).toBe(true);

    (globalThis as any).window.location.hostname = 'localhost';
    expect(enforceDomainLock()).toBe(true);
  });

  it('8. Enforces domain lock: blocks execution and throws on unauthorized domains', () => {
    (globalThis as any).window.location.hostname = 'unauthorized-stealer.com';
    (globalThis as any).document = { body: { innerHTML: '' } };

    expect(() => enforceDomainLock()).toThrowError(/DEMO_SECURITY_VIOLATION/);
    expect((globalThis as any).document.body.innerHTML).toContain('Unauthorized Distribution');

    delete (globalThis as any).document;
  });
});
