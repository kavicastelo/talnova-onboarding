import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Components under audit
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskActionFooter } from '../features/kiosk/components/KioskActionFooter';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskPinOverlay } from '../features/kiosk/components/KioskPinOverlay';
import { FrontlineIdentifyModal } from '../features/kiosk/components/auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from '../features/kiosk/components/auth/SupervisorWitnessGateModal';
import { KioskPairingScreen } from '../features/kiosk/components/KioskPairingScreen';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KnowledgeQuizEngine } from '../features/kiosk/components/interactions/KnowledgeQuizEngine';
import { EmergencyEvacuationOverlay } from '../features/kiosk/components/emergency/EmergencyEvacuationOverlay';

import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskStep } from '../types/kiosk/step.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-GUID-999-ACC'),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-999-ACC'),
    getEmployeeUser: vi.fn(() => ({
      id: 'usr-worker-01',
      fullName: 'Alex Morgan',
      department: 'Operations'
    })),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn(),
    setDeviceCredentials: vi.fn()
  }
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock kioskLockdownService
vi.mock('../features/kiosk/services/kiosk-lockdown.service', () => ({
  kioskLockdownService: {
    startLockdown: vi.fn(),
    stopLockdown: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    requestFullscreen: vi.fn()
  }
}));

// Mock emergencyService
vi.mock('../features/kiosk/services/emergency.service', () => ({
  emergencyService: {
    getActiveEmergency: vi.fn(() => null),
    subscribe: vi.fn(() => () => {}),
    getSiren: vi.fn(() => ({
      getIsMuted: () => false,
      toggleMute: () => true
    }))
  }
}));

/**
 * Lightweight Mock DOM Node for Layout Auditing in Node/Vitest
 */
export interface MockNode {
  tagName: string;
  attributes: Record<string, string>;
  id: string;
  className: string;
  parentElement: MockNode | null;
  children: MockNode[];
  getAttribute(name: string): string | null;
  querySelector(selector: string): MockNode | null;
  querySelectorAll(selector: string): MockNode[];
  getBoundingClientRect(): {
    x: number;
    y: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
}

function matchesSelector(node: MockNode, selector: string): boolean {
  selector = selector.trim();
  if (selector.startsWith('#')) {
    return node.id === selector.slice(1);
  }
  const testIdMatch = selector.match(/^\[data-testid=["']([^"']+)["']\]$/);
  if (testIdMatch) {
    return node.getAttribute('data-testid') === testIdMatch[1];
  }
  const roleMatch = selector.match(/^\[role=["']([^"']+)["']\]$/);
  if (roleMatch) {
    return node.getAttribute('role') === roleMatch[1];
  }
  const tagWithAttrMatch = selector.match(/^([a-zA-Z0-9-]+)\[([a-zA-Z0-9-_:]+)=["']([^"']+)["']\]$/);
  if (tagWithAttrMatch) {
    return (
      node.tagName === tagWithAttrMatch[1].toLowerCase() &&
      node.getAttribute(tagWithAttrMatch[2]) === tagWithAttrMatch[3]
    );
  }
  return node.tagName === selector.toLowerCase();
}

function queryAll(node: MockNode, selector: string): MockNode[] {
  const parts = selector.split(',').map((s) => s.trim());
  const results: MockNode[] = [];

  function traverse(curr: MockNode) {
    for (const part of parts) {
      if (matchesSelector(curr, part)) {
        results.push(curr);
        break;
      }
    }
    for (const child of curr.children) {
      traverse(child);
    }
  }

  for (const child of node.children) {
    traverse(child);
  }

  return results;
}

function queryOne(node: MockNode, selector: string): MockNode | null {
  const all = queryAll(node, selector);
  return all.length > 0 ? all[0] : null;
}

function createMockNode(tagName: string, attrs: Record<string, string>, parent: MockNode | null = null): MockNode {
  const node: MockNode = {
    tagName: tagName.toLowerCase(),
    attributes: attrs,
    id: attrs['id'] || '',
    className: attrs['class'] || '',
    parentElement: parent,
    children: [],
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    querySelector(sel: string) {
      return queryOne(this, sel);
    },
    querySelectorAll(sel: string) {
      return queryAll(this, sel);
    },
    getBoundingClientRect() {
      const dims = calculateElementDimensions(this.className);
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: dims.height,
        left: 0,
        right: dims.width,
        width: dims.width,
        height: dims.height
      };
    }
  };
  return node;
}

export function parseHtml(html: string): MockNode {
  const root = createMockNode('root', {});
  const stack: MockNode[] = [root];

  const tagRegex = /<([/]?)([a-zA-Z0-9-]+)([^>]*)>/g;
  let match: RegExpExecArray | null;

  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase();
    const rawAttrs = match[3];

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tagName) {
          stack.length = i;
          break;
        }
      }
    } else {
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9-_:]+)(?:=["']([^"']*)["']|=([^\s>]+))?/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
        const attrName = attrMatch[1];
        const attrValue = attrMatch[2] ?? attrMatch[3] ?? '';
        attrs[attrName] = attrValue;
      }

      const parent = stack[stack.length - 1];
      const newNode = createMockNode(tagName, attrs, parent);
      parent.children.push(newNode);

      const isSelfClosing = rawAttrs.trim().endsWith('/') || voidTags.has(tagName);
      if (!isSelfClosing) {
        stack.push(newNode);
      }
    }
  }

  return root;
}

/**
 * Tailwind Class Dimension & Spacing Evaluator
 * Maps standard Tailwind utility classes to CSS pixels
 */
export function calculateElementDimensions(className: string): {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
} {
  const classes = className.split(/\s+/);
  let width = 0;
  let height = 0;
  let minWidth = 0;
  let minHeight = 0;

  for (const cls of classes) {
    // Arbitrary pixel patterns: min-h-[48px], min-w-[64px], h-[56px], w-[120px]
    const minHMatch = cls.match(/^min-h-\[(\d+)px\]$/);
    if (minHMatch) minHeight = Math.max(minHeight, parseInt(minHMatch[1], 10));

    const minWMatch = cls.match(/^min-w-\[(\d+)px\]$/);
    if (minWMatch) minWidth = Math.max(minWidth, parseInt(minWMatch[1], 10));

    const hMatch = cls.match(/^h-\[(\d+)px\]$/);
    if (hMatch) height = Math.max(height, parseInt(hMatch[1], 10));

    const wMatch = cls.match(/^w-\[(\d+)px\]$/);
    if (wMatch) width = Math.max(width, parseInt(wMatch[1], 10));

    // Tailwind standard size mappings: 1 unit = 4px
    if (cls === 'h-16') height = Math.max(height, 64);
    if (cls === 'w-16') width = Math.max(width, 64);
    if (cls === 'h-14') height = Math.max(height, 56);
    if (cls === 'w-14') width = Math.max(width, 56);
    if (cls === 'h-12') height = Math.max(height, 48);
    if (cls === 'w-12') width = Math.max(width, 48);
    if (cls === 'h-28') height = Math.max(height, 112);
    if (cls === 'w-28') width = Math.max(width, 112);
    if (cls === 'w-60') width = Math.max(width, 240);
    if (cls === 'w-full') width = Math.max(width, 280);
    if (cls === 'flex-1') width = Math.max(width, 120);

    // Padding estimation (if no explicit height set)
    if (cls === 'py-4') height = Math.max(height, 56);
    if (cls === 'py-3.5') height = Math.max(height, 50);
    if (cls === 'py-3') height = Math.max(height, 48);
    if (cls === 'px-6') width = Math.max(width, 64);
    if (cls === 'px-8') width = Math.max(width, 80);
  }

  // Effective dimensions respect min-height and min-width constraints
  const effectiveWidth = Math.max(width, minWidth);
  const effectiveHeight = Math.max(height, minHeight);

  return {
    width: effectiveWidth,
    height: effectiveHeight,
    minWidth,
    minHeight
  };
}

/**
 * Extracts separation distance between adjacent elements from parent class (gap / space-x / space-y)
 */
export function extractSeparationPixels(parentClassName: string): number {
  if (!parentClassName) return 0;
  const classes = parentClassName.split(/\s+/);
  let separation = 0;

  for (const cls of classes) {
    if (cls === 'gap-2' || cls === 'gap-x-2' || cls === 'gap-y-2') separation = Math.max(separation, 8);
    if (cls === 'gap-2.5' || cls === 'gap-x-2.5' || cls === 'gap-y-2.5') separation = Math.max(separation, 10);
    if (cls === 'gap-3' || cls === 'gap-x-3' || cls === 'gap-y-3') separation = Math.max(separation, 12);
    if (cls === 'gap-4' || cls === 'gap-x-4' || cls === 'gap-y-4') separation = Math.max(separation, 16);
    if (cls === 'space-x-2' || cls === 'space-y-2') separation = Math.max(separation, 8);
    if (cls === 'space-x-2.5' || cls === 'space-y-2.5') separation = Math.max(separation, 10);
    if (cls === 'space-x-3' || cls === 'space-y-3') separation = Math.max(separation, 12);
    if (cls === 'space-x-4' || cls === 'space-y-4') separation = Math.max(separation, 16);
    const gapPx = cls.match(/^gap(?:-[xy])?-\[(\d+)px\]$/);
    if (gapPx) separation = Math.max(separation, parseInt(gapPx[1], 10));
    const spacePx = cls.match(/^space-[xy]-\[(\d+)px\]$/);
    if (spacePx) separation = Math.max(separation, parseInt(spacePx[1], 10));
  }
  return separation;
}

/**
 * Audit Helper: parses HTML into MockNode tree and finds interactive elements
 */
function auditHtmlForTouchTargets(html: string) {
  const doc = parseHtml(html);
  const interactiveElements = doc.querySelectorAll(
    'button, a, input[type="text"], input[type="search"], [role="button"]'
  );
  return { doc, interactiveElements };
}

describe('K-ACC-001: WCAG 2.2 Level AA / AAA Kiosk Touch Target Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. KioskHomeScreen Touch Targets', () => {
    const mockManifest: KioskDeviceManifest = {
      deviceId: 'HW-TEST-001',
      organizationId: 'org-01',
      device: {
        _id: 'dev-01',
        deviceId: 'HW-TEST-001',
        name: 'Main Entrance Terminal',
        location: 'Sector 1',
        status: 'online'
      },
      launchMode: 'launcher',
      journeys: [
        {
          _id: 'jrn-1',
          organizationId: 'org-01',
          title: 'Forklift Safety Protocol',
          description: 'Standard operational briefing',
          priority: 1,
          isMandatory: true,
          status: 'published',
          version: 1,
          language: 'en',
          supportedLanguages: ['en'],
          steps: []
        }
      ],
      branding: { organizationName: 'Talnova Heavy Industries' }
    };

    it('asserts zero interactive controls measure less than 48x48 CSS px', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
          onSyncManifest={vi.fn()}
        />
      );
      const { interactiveElements } = auditHtmlForTouchTargets(html);

      expect(interactiveElements.length).toBeGreaterThan(0);
      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const testId = el.getAttribute('data-testid') || el.id || el.tagName;
        expect(
          rect.width,
          `Element ${testId} width should be >= 48px, got ${rect.width}`
        ).toBeGreaterThanOrEqual(48);
        expect(
          rect.height,
          `Element ${testId} height should be >= 48px, got ${rect.height}`
        ).toBeGreaterThanOrEqual(48);
      });
    });

    it('enforces critical launch button measures >= 64x64 CSS px', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);
      const launchBtn = doc.querySelector('[data-testid="launch-journey-jrn-1"]') as MockNode;
      expect(launchBtn).not.toBeNull();
      const rect = launchBtn.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(64);
      expect(rect.height).toBeGreaterThanOrEqual(64);
    });

    it('asserts adjacent footer action buttons maintain at least 8 CSS px separation', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
          onOpenEmergencyModal={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);
      const identifyBtn = doc.querySelector('[data-testid="identify-employee-button"]');
      expect(identifyBtn).not.toBeNull();
      const parent = identifyBtn?.parentElement;
      const separation = extractSeparationPixels(parent?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('2. KioskActionFooter Critical Controls', () => {
    it('enforces critical progression controls (Next, Back, Finish, Hold) measure >= 64x64 CSS px', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          isLastStep={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onFinish={vi.fn()}
          onRestart={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);

      const nextBtn = doc.querySelector('#kiosk-btn-next') as MockNode;
      const prevBtn = doc.querySelector('#kiosk-btn-prev') as MockNode;
      const restartBtn = doc.querySelector('#kiosk-btn-restart') as MockNode;

      expect(nextBtn).not.toBeNull();
      expect(prevBtn).not.toBeNull();
      expect(restartBtn).not.toBeNull();

      expect(nextBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(nextBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      expect(prevBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(prevBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      expect(restartBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
      expect(restartBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    });

    it('enforces finish button and hold-to-confirm meet >= 64x64 CSS px on last step', () => {
      const htmlHold = renderToString(
        <KioskActionFooter
          currentStepIndex={2}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          isLastStep={true}
          isHoldToConfirm={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onFinish={vi.fn()}
          onRestart={vi.fn()}
        />
      );
      const { doc: holdDoc } = auditHtmlForTouchTargets(htmlHold);
      const holdBtn = holdDoc.querySelector('#kiosk-btn-hold') as MockNode;
      expect(holdBtn).not.toBeNull();
      expect(holdBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(holdBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      const htmlFinish = renderToString(
        <KioskActionFooter
          currentStepIndex={2}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          isLastStep={true}
          isHoldToConfirm={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onFinish={vi.fn()}
          onRestart={vi.fn()}
        />
      );
      const { doc: finishDoc } = auditHtmlForTouchTargets(htmlFinish);
      const finishBtn = finishDoc.querySelector('#kiosk-btn-finish') as MockNode;
      expect(finishBtn).not.toBeNull();
      expect(finishBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(finishBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);
    });

    it('asserts separation between adjacent footer buttons is >= 8 CSS px', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          isLastStep={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onFinish={vi.fn()}
          onRestart={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);
      const footerRightContainer = doc.querySelector('#kiosk-btn-next')?.parentElement;
      const separation = extractSeparationPixels(footerRightContainer?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('3. KioskPlayerHeader Secondary Touch Controls', () => {
    it('verifies audio, subtitles, contrast, language, and exit buttons meet >= 48x48 CSS px', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Hazard Communication Standard"
          currentStepIndex={0}
          totalSteps={4}
          languages={['en', 'es']}
          selectedLanguage="en"
          onLanguageChange={vi.fn()}
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
          highContrast={false}
          onToggleHighContrast={vi.fn()}
          canExit={true}
          onExit={vi.fn()}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const subtitlesBtn = doc.querySelector('[data-testid="toggle-subtitles-btn"]');
      const muteBtn = doc.querySelector('[data-testid="toggle-mute-btn"]');
      const contrastBtn = doc.querySelector('[data-testid="toggle-contrast-btn"]');
      const exitBtn = doc.querySelector('#kiosk-btn-exit');

      expect(subtitlesBtn).not.toBeNull();
      expect(muteBtn).not.toBeNull();
      expect(contrastBtn).not.toBeNull();
      expect(exitBtn).not.toBeNull();

      const controlsContainer = subtitlesBtn?.parentElement;
      const separation = extractSeparationPixels(controlsContainer?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('4. KioskPinOverlay Numeric Keypad & Actions', () => {
    it('verifies all keypad digits, clear, back, and cancel meet >= 48x48 CSS px with >= 8px gap', () => {
      const html = renderToString(
        <KioskPinOverlay
          journeyId="jrn-test"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      expect(interactiveElements.length).toBeGreaterThanOrEqual(12);
      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const keypadContainer = doc.querySelector('#kiosk-keypad-btn-1')?.parentElement;
      expect(keypadContainer).not.toBeNull();
      const separation = extractSeparationPixels(keypadContainer?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('5. FrontlineIdentifyModal & SupervisorWitnessGateModal Audits', () => {
    it('validates FrontlineIdentifyModal tabs, keypad, and critical confirm button', () => {
      const html = renderToString(
        <FrontlineIdentifyModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const tabContainer = doc.querySelector('[data-testid="tab-keypad"]')?.parentElement;
      const tabSeparation = extractSeparationPixels(tabContainer?.getAttribute('class') || '');
      expect(tabSeparation).toBeGreaterThanOrEqual(8);

      const keypadContainer = doc.querySelector('#keypad-digit-1')?.parentElement;
      const keypadSeparation = extractSeparationPixels(keypadContainer?.getAttribute('class') || '');
      expect(keypadSeparation).toBeGreaterThanOrEqual(8);

      const submitBtn = doc.querySelector('[data-testid="submit-identify-button"]') as MockNode;
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(submitBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);
    });

    it('validates SupervisorWitnessGateModal close button (48px) and dual-custody submit (64px)', () => {
      const html = renderToString(
        <SupervisorWitnessGateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const closeBtn = doc.querySelector('[data-testid="supervisor-modal-close-btn"]') as MockNode;
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
      expect(closeBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);

      const submitBtn = doc.querySelector('#supervisor-submit-btn') as MockNode;
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(submitBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      const keypadBtn = doc.querySelector('#keypad-1') as MockNode;
      expect(keypadBtn).not.toBeNull();
      expect(keypadBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(keypadBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      const keypadContainer = keypadBtn.parentElement;
      const separation = extractSeparationPixels(keypadContainer?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('6. KioskPairingScreen Setup & Keypad Controls', () => {
    it('verifies continue setup button measures >= 64x64 CSS px and keypad >= 48x48 CSS px', () => {
      const html = renderToString(<KioskPairingScreen onPairSuccess={vi.fn()} />);
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const submitBtn = doc.querySelector('button[type="submit"]') as MockNode;
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(submitBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);
    });
  });

  describe('7. KioskStepContainer & KnowledgeQuizEngine Controls', () => {
    it('enforces yes/no buttons and hold-to-confirm exceed 64x64 CSS px with >= 8px separation', () => {
      const yesNoStep: KioskStep = {
        id: 'step-yn',
        title: 'Safety Check',
        type: 'warning_step',
        order: 0,
        blocks: [],
        interaction: { type: 'yes_no' }
      };

      const html = renderToString(
        <KioskStepContainer
          step={yesNoStep}
          stepIndex={0}
          selectedLanguage="en"
          onYesNoSelection={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);

      const yesBtn = doc.querySelector('[data-testid="yes-btn"]') as MockNode;
      const noBtn = doc.querySelector('[data-testid="no-btn"]') as MockNode;

      expect(yesBtn).not.toBeNull();
      expect(noBtn).not.toBeNull();

      expect(yesBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(yesBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);
      expect(noBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(noBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);

      const parent = yesBtn.parentElement;
      const separation = extractSeparationPixels(parent?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });

    it('enforces circular hold-to-confirm measures >= 64x64 CSS px', () => {
      const holdStep: KioskStep = {
        id: 'step-hold',
        title: 'Hold to Confirm',
        type: 'content',
        order: 0,
        blocks: [],
        interaction: { type: 'hold_to_confirm' }
      };

      const html = renderToString(
        <KioskStepContainer
          step={holdStep}
          stepIndex={0}
          selectedLanguage="en"
          onHoldStart={vi.fn()}
          onHoldEnd={vi.fn()}
        />
      );
      const { doc } = auditHtmlForTouchTargets(html);
      const holdBtn = doc.querySelector('[data-testid="hold-to-confirm-btn"]') as MockNode;
      expect(holdBtn).not.toBeNull();
      expect(holdBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);
      expect(holdBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(64);
    });

    it('enforces KnowledgeQuizEngine quiz options and Next Question button meet standards', () => {
      const html = renderToString(
        <KnowledgeQuizEngine
          quiz={{
            questions: [
              {
                id: 'q1',
                question: 'What is the speed limit inside warehouse bays?',
                options: ['5 mph', '15 mph', '25 mph'],
                correctOptionIndex: 0
              }
            ],
            passingScore: 70
          }}
          onPass={vi.fn()}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const opt0 = doc.querySelector('#quiz-option-0') as MockNode;
      expect(opt0).not.toBeNull();
      expect(opt0.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);

      const optContainer = opt0.parentElement;
      const separation = extractSeparationPixels(optContainer?.getAttribute('class') || '');
      expect(separation).toBeGreaterThanOrEqual(8);
    });
  });

  describe('8. EmergencyEvacuationOverlay Controls', () => {
    it('verifies siren toggle and emergency phone links measure >= 48x48 CSS px', () => {
      const html = renderToString(
        <EmergencyEvacuationOverlay
          emergency={{
            id: 'emg-01',
            type: 'fire',
            severity: 'critical',
            title: 'Facility Fire Alarm',
            message: 'Evacuate immediately via Exit A.',
            primaryExit: 'Exit A Ground Floor',
            secondaryExit: 'Exit B South Bay',
            assemblyZone: 'North Parking Lot',
            soundSiren: true,
            isActive: true,
            createdAt: new Date().toISOString()
          }}
        />
      );
      const { doc, interactiveElements } = auditHtmlForTouchTargets(html);

      interactiveElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(48);
        expect(rect.height).toBeGreaterThanOrEqual(48);
      });

      const sirenToggle = doc.querySelector('[data-testid="siren-toggle"]') as MockNode;
      expect(sirenToggle).not.toBeNull();
      expect(sirenToggle.getBoundingClientRect().width).toBeGreaterThanOrEqual(48);
      expect(sirenToggle.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    });
  });
});
