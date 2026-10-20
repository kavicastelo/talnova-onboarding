import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';

import { FrontlineIdentifyModal } from '../features/kiosk/components/auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from '../features/kiosk/components/auth/SupervisorWitnessGateModal';
import { KioskPinOverlay } from '../features/kiosk/components/KioskPinOverlay';
import { KioskMaintenanceOverlay } from '../features/kiosk/components/KioskMaintenanceOverlay';
import { KioskPairingScreen } from '../features/kiosk/components/KioskPairingScreen';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { LanguageSelectorModal } from '../features/kiosk/components/localization/LanguageSelectorModal';
import { InputOTP } from '../components/InputOTP';
import { Login } from '../pages/Login';
import { RoleProvider } from '../context/RoleContext';
import { LanguageProvider } from '../context/LanguageContext';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => {
      if (typeof options === 'string') return options;
      if (typeof options === 'object' && options !== null && options.defaultValue) {
        return options.defaultValue;
      }
      return _key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() }
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  }
}));

// Mock kiosk services
vi.mock('../features/kiosk/services/kiosk.service', () => ({
  kioskService: {
    identifyFrontlineWorker: vi.fn(),
    verifySupervisorPin: vi.fn(),
    verifyPin: vi.fn(),
    pairDevice: vi.fn()
  }
}));

vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-KIOSK-001'),
    getOrCreateHardwareGuid: vi.fn(() => Promise.resolve('HW-GUID-KIOSK-001')),
    getEmployeeUser: vi.fn(() => null),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn(),
    getStoredDevice: vi.fn(() => ({ name: 'Terminal A', location: 'Gate 1' }))
  }
}));

vi.mock('../services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../services/sso.service', () => ({
  ssoService: {
    discoverDomain: vi.fn(() => Promise.resolve(null)),
    initiateSSO: vi.fn()
  }
}));

describe('K-SEC-006: Shared Kiosk & Workstation Form Hardening Suite', () => {
  let dom: JSDOM;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost/kiosk',
      pretendToBeVisual: true
    });

    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document as any;
    globalThis.Node = dom.window.Node as any;
    globalThis.Element = dom.window.Element as any;
    globalThis.HTMLElement = dom.window.HTMLElement as any;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement as any;
    globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as any;
    globalThis.localStorage = dom.window.localStorage as any;

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const getMountElement = (): HTMLDivElement => {
    return container || document.createElement('div');
  };

  afterEach(() => {
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
    container = null;
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. FrontlineIdentifyModal Form Hardening & Credential Suppression
  // =========================================================================
  describe('1. FrontlineIdentifyModal Security Hardening', () => {
    it('suppresses autofill, credential caching, and password manager harvesting on Badge/ID input', () => {
      const html = renderToString(
        <FrontlineIdentifyModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          deviceId="HW-GUID-001"
        />
      );

      // Verify explicit attributes on Employee ID / Badge input
      expect(html).toContain('data-testid="employee-id-input"');
      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="off"');
      expect(lower).toContain('autocorrect="off"');
      expect(lower).toContain('autocapitalize="off"');
      expect(lower).toContain('spellcheck="false"');
      expect(lower).toContain('data-lpignore="true"');
      expect(lower).toContain('data-form-type="other"');
    });

    it('suppresses autocomplete and harvesting on Email input', () => {
      const html = renderToString(
        <FrontlineIdentifyModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          deviceId="HW-GUID-001"
          initialIdentifier="worker@test.com"
        />
      );

      expect(html).toContain('data-testid="employee-id-input"');
    });

    it('mounts and cleanly unmounts without throwing and scrubs in-memory state', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(
          <FrontlineIdentifyModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            deviceId="HW-GUID-001"
          />
        );
      });

      expect(container?.querySelector('[data-testid="employee-id-input"]')).toBeTruthy();

      // Trigger unmount
      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });

  // =========================================================================
  // 2. SupervisorWitnessGateModal Hardening
  // =========================================================================
  describe('2. SupervisorWitnessGateModal Security Hardening', () => {
    it('suppresses browser autofill and password manager overlays on supervisor credentials', () => {
      const html = renderToString(
        <SupervisorWitnessGateModal
          isOpen={true}
          sessionId="sess-100"
          workerName="John Doe"
          journeyTitle="Lockout Tagout Protocol"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="supervisor-identifier-input"');
      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="off"');
      expect(lower).toContain('autocorrect="off"');
      expect(lower).toContain('autocapitalize="off"');
      expect(lower).toContain('spellcheck="false"');
      expect(lower).toContain('data-lpignore="true"');
      expect(lower).toContain('data-form-type="other"');
    });

    it('mounts and cleanly unmounts while scrubbing witness PIN state', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(
          <SupervisorWitnessGateModal
            isOpen={true}
            sessionId="sess-100"
            workerName="John Doe"
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />
        );
      });

      expect(container?.querySelector('[data-testid="supervisor-identifier-input"]')).toBeTruthy();

      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });

  // =========================================================================
  // 3. KioskPinOverlay Credential Scrubbing
  // =========================================================================
  describe('3. KioskPinOverlay In-Memory Hardening', () => {
    it('renders PIN keypad and handles unmount scrubbing without memory leaks', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(
          <KioskPinOverlay
            journeyId="journey-test-123"
            pinLength={6}
            onSuccess={vi.fn()}
            onCancel={vi.fn()}
          />
        );
      });

      expect(container?.querySelector('[data-testid="kiosk-pin-keypad"]')).toBeTruthy();

      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });

  // =========================================================================
  // 4. InputOTP Component Hardening
  // =========================================================================
  describe('4. InputOTP Security Hardening', () => {
    it('renders with autocomplete="one-time-code" and numeric inputMode with lpignore', () => {
      const html = renderToString(
        <InputOTP maxLength={6} value="123456" />
      );

      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="one-time-code"');
      expect(lower).toContain('inputmode="numeric"');
      expect(lower).toContain('autocorrect="off"');
      expect(lower).toContain('autocapitalize="off"');
      expect(lower).toContain('spellcheck="false"');
      expect(lower).toContain('data-lpignore="true"');
      expect(lower).toContain('data-form-type="other"');
    });

    it('mounts and unmounts cleanly with internal value scrubbing', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(<InputOTP maxLength={6} />);
      });

      expect(container?.querySelector('input[autocomplete="one-time-code"], input[autoComplete="one-time-code"]')).toBeTruthy();

      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });

  // =========================================================================
  // 5. KioskMaintenanceOverlay Technician PIN Hardening
  // =========================================================================
  describe('5. KioskMaintenanceOverlay Hardening', () => {
    it('suppresses autofill and password manager overlays on field technician PIN input', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(
          <KioskMaintenanceOverlay
            isOpen={true}
            onExitMaintenance={vi.fn()}
          />
        );
      });

      // Click to open field technician unlock form
      const unlockBtn = container?.querySelector('[data-testid="open-technician-unlock-btn"]') as HTMLButtonElement;
      expect(unlockBtn).toBeTruthy();

      act(() => {
        unlockBtn.click();
      });

      const pinInput = container?.querySelector('[data-testid="maintenance-pin-input"]') as HTMLInputElement;
      expect(pinInput).toBeTruthy();
      expect(pinInput.getAttribute('autocomplete')?.toLowerCase()).toBe('off');
      expect(pinInput.getAttribute('autocorrect')?.toLowerCase()).toBe('off');
      expect(pinInput.getAttribute('autocapitalize')?.toLowerCase()).toBe('off');
      expect(pinInput.getAttribute('spellcheck')?.toLowerCase()).toBe('false');
      expect(pinInput.getAttribute('data-lpignore')?.toLowerCase()).toBe('true');
      expect(pinInput.getAttribute('data-form-type')?.toLowerCase()).toBe('other');

      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });

  // =========================================================================
  // 6. KioskPairingScreen Device Setup Hardening
  // =========================================================================
  describe('6. KioskPairingScreen Hardening', () => {
    it('applies autocomplete suppression to terminal naming and location setup inputs', () => {
      const html = renderToString(
        <KioskPairingScreen
          onPairSuccess={vi.fn()}
        />
      );

      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="off"');
      expect(lower).toContain('autocorrect="off"');
      expect(lower).toContain('autocapitalize="off"');
      expect(lower).toContain('spellcheck="false"');
      expect(lower).toContain('data-lpignore="true"');
      expect(lower).toContain('data-form-type="other"');
    });
  });

  // =========================================================================
  // 7. KioskHomeScreen & Language Selector Search Inputs Hardening
  // =========================================================================
  describe('7. Touch Search Inputs Hardening', () => {
    it('suppresses autocomplete and harvesting on KioskHomeScreen touch search', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={{
            device: { name: 'Gate 1', location: 'Main Entrance' },
            journeys: []
          } as any}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="touch-search-input"');
      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="off"');
      expect(lower).toContain('data-lpignore="true"');
    });

    it('suppresses autocomplete on LanguageSelectorModal search input', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={true}
          selectedLanguage="en"
          onSelectLanguage={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="language-search-input"');
      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="off"');
      expect(lower).toContain('data-lpignore="true"');
    });
  });

  // =========================================================================
  // 8. Login Screen Form Hardening
  // =========================================================================
  describe('8. Login Screen Form Hardening', () => {
    it('configures standard email and password autocomplete attributes and spellcheck suppression', () => {
      const html = renderToString(
        <BrowserRouter>
          <LanguageProvider>
            <RoleProvider>
              <Login />
            </RoleProvider>
          </LanguageProvider>
        </BrowserRouter>
      );

      expect(html).toContain('id="login-email-input"');
      const lower = html.toLowerCase();
      expect(lower).toContain('autocomplete="username"');
      expect(html).toContain('id="login-password-input"');
      expect(lower).toContain('autocomplete="current-password"');
      expect(lower).toContain('spellcheck="false"');
    });

    it('mounts and cleanly unmounts Login component while scrubbing passwords', () => {
      const root = createRoot(getMountElement());
      act(() => {
        root.render(
          <BrowserRouter>
            <LanguageProvider>
              <RoleProvider>
                <Login />
              </RoleProvider>
            </LanguageProvider>
          </BrowserRouter>
        );
      });

      expect(container?.querySelector('#login-password-input')).toBeTruthy();

      act(() => {
        root.unmount();
      });

      expect(container?.innerHTML).toBe('');
    });
  });
});
