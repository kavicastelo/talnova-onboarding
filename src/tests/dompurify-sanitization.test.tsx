import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StepComposer, StepComposerData } from '../components/super-admin/sales/campaigns/StepComposer';
import { antiTamperingService } from '../features/kiosk/services/anti-tampering.service';

describe('SEC-PHASE-5: Universal DOMPurify Sanitization Across Client Rich Text Renderers', () => {
  const baseComposerData: StepComposerData = {
    subject: 'Welcome to Talnova {{firstName}}',
    previewText: 'Kickstart your enterprise journey',
    content: '',
    whatsappTemplateName: 'lead_welcome_intro',
    whatsappLanguageCode: 'en_US',
    whatsappParameters: {},
  };

  /**
   * Helper to isolate the rendered email preview container from renderToString output
   * (ensuring we inspect the sanitized preview output, not the raw textarea input value)
   */
  const extractRenderedPreview = (html: string): string => {
    const match = html.match(/data-testid="email-preview-rendered-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
    if (match && match[1]) {
      return match[1];
    }
    // Fallback: extract between the preview container markers
    const previewStart = html.indexOf('data-testid="email-preview-rendered-content"');
    if (previewStart !== -1) {
      return html.substring(previewStart);
    }
    return html;
  };

  // =========================================================================
  // 1. STEP COMPOSER EMAIL PREVIEW SANITIZATION
  // =========================================================================
  describe('1. StepComposer Email Preview XSS Defense', () => {
    it('completely strips <script>alert(2)</script> from email preview', () => {
      const maliciousData: StepComposerData = {
        ...baseComposerData,
        content: '<p>Hello {{firstName}},</p><script>alert(2)</script><p>Welcome aboard!</p>',
      };

      const html = renderToString(
        <StepComposer
          channel="email"
          data={maliciousData}
          onChange={() => {}}
        />
      );

      const previewHtml = extractRenderedPreview(html);

      expect(previewHtml).not.toContain('<script>');
      expect(previewHtml).not.toContain('alert(2)');
      expect(previewHtml).toContain('Hello Sarah,');
      expect(previewHtml).toContain('Welcome aboard!');
    });

    it('completely strips <img src=x onerror=alert(1)> from email preview', () => {
      const maliciousData: StepComposerData = {
        ...baseComposerData,
        content: '<div>Important Announcement</div><img src=x onerror=alert(1)><p>Check your schedule.</p>',
      };

      const html = renderToString(
        <StepComposer
          channel="email"
          data={maliciousData}
          onChange={() => {}}
        />
      );

      const previewHtml = extractRenderedPreview(html);

      expect(previewHtml).not.toContain('<img');
      expect(previewHtml).not.toContain('onerror');
      expect(previewHtml).not.toContain('alert(1)');
      expect(previewHtml).toContain('Important Announcement');
      expect(previewHtml).toContain('Check your schedule.');
    });

    it('automatically injects rel="noopener noreferrer" onto hyperlinks in preview', () => {
      const linkData: StepComposerData = {
        ...baseComposerData,
        content: '<p>Visit your portal: <a href="https://app.talnova.io/dashboard" target="_blank">Portal Link</a></p>',
      };

      const html = renderToString(
        <StepComposer
          channel="email"
          data={linkData}
          onChange={() => {}}
        />
      );

      const previewHtml = extractRenderedPreview(html);

      expect(previewHtml).toContain('href="https://app.talnova.io/dashboard"');
      expect(previewHtml).toContain('rel="noopener noreferrer"');
    });

    it('preserves legitimate rich text tags in email body', () => {
      const richTextData: StepComposerData = {
        ...baseComposerData,
        content: '<h1>Quarterly Plan</h1><p><strong>Bold text</strong> and <em>italicized notes</em>.</p><ul><li>Milestone 1</li><li>Milestone 2</li></ul>',
      };

      const html = renderToString(
        <StepComposer
          channel="email"
          data={richTextData}
          onChange={() => {}}
        />
      );

      const previewHtml = extractRenderedPreview(html);

      expect(previewHtml).toContain('<h1>Quarterly Plan</h1>');
      expect(previewHtml).toContain('<strong>Bold text</strong>');
      expect(previewHtml).toContain('<em>italicized notes</em>');
      expect(previewHtml).toContain('<ul><li>Milestone 1</li><li>Milestone 2</li></ul>');
    });
  });

  // =========================================================================
  // 2. KIOSK & LESSON ANTI-TAMPERING HTML SANITIZATION
  // =========================================================================
  describe('2. Kiosk & Player Content DOMPurify Sanitization', () => {
    it('strips malicious <script> and inline event handlers from kiosk text blocks', () => {
      const dirtyHtml = '<p>Safety Protocol</p><script>window.location="http://evil.com"</script><div onmouseover="alert(3)">Hover me</div>';
      const clean = antiTamperingService.sanitizeHtml(dirtyHtml);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('evil.com');
      expect(clean).not.toContain('onmouseover');
      expect(clean).not.toContain('alert(3)');
      expect(clean).toContain('Safety Protocol');
      expect(clean).toContain('Hover me');
    });

    it('strips <img src=x onerror=alert(1)> and enforces rel="noopener noreferrer" on kiosk links', () => {
      const dirtyHtml = '<p>Review document <a href="https://talnova.io/handbook">Handbook</a></p><img src=x onerror=alert(1)>';
      const clean = antiTamperingService.sanitizeHtml(dirtyHtml);

      expect(clean).not.toContain('<img');
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('alert(1)');
      expect(clean).toContain('rel="noopener noreferrer"');
      expect(clean).toContain('href="https://talnova.io/handbook"');
    });
  });
});
