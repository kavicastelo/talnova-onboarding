import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { ProtectedRoute, FEATURE_TITLES } from '../components/ProtectedRoute';

describe('PR-ROU-001: Comprehensive Client Route Guards & Canonical Key Alignment', () => {
  const renderRoute = (
    initialPath: string,
    features: Record<string, boolean>,
    role: any = 'admin'
  ) => {
    return renderToString(
      <RoleProvider initialRole={role} initialFeatures={features}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="/documents"
              element={
                <ProtectedRoute featureFlag="digital_signatures">
                  <div data-testid="documents-page">Documents Content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute featureFlag="gamified_milestones">
                  <div data-testid="leaderboard-page">Leaderboard Content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kiosks"
              element={
                <ProtectedRoute capability="manage_organization" featureFlag="kiosk_mode">
                  <div data-testid="kiosks-page">Kiosks Content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-course-builder"
              element={
                <ProtectedRoute capability="ai_course_builder" featureFlag="ai_course_builder">
                  <div data-testid="ai-builder-page">AI Builder Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </RoleProvider>
    );
  };

  it('Step 1-3: Direct navigation to /documents when digital_signatures is false renders fallback screen', () => {
    const html = renderRoute('/documents', { digital_signatures: false });

    // Assert "Feature Temporarily Unavailable" renders
    expect(html).toContain('Feature Temporarily Unavailable');
    expect(html).toContain('Digital Signatures &amp; Documents');
    expect(html).toContain('digital_signatures');
    // Content should NOT be rendered
    expect(html).not.toContain('Documents Content');
  });

  it('Navigation to /documents when digital_signatures is true renders the documents page', () => {
    const html = renderRoute('/documents', { digital_signatures: true });

    expect(html).not.toContain('Feature Temporarily Unavailable');
    expect(html).toContain('Documents Content');
  });

  it('Step 4-6: Canonical key alignment for /leaderboard with gamified_milestones', () => {
    // When gamified_milestones is false, route guard intercepts and renders fallback
    const htmlDisabled = renderRoute('/leaderboard', { gamified_milestones: false });

    expect(htmlDisabled).toContain('Feature Temporarily Unavailable');
    expect(htmlDisabled).toContain('Leaderboard &amp; Gamification');
    expect(htmlDisabled).toContain('gamified_milestones');
    expect(htmlDisabled).not.toContain('Leaderboard Content');

    // When gamified_milestones is true, leaderboard renders
    const htmlEnabled = renderRoute('/leaderboard', { gamified_milestones: true });

    expect(htmlEnabled).not.toContain('Feature Temporarily Unavailable');
    expect(htmlEnabled).toContain('Leaderboard Content');
  });

  it('Renders human-readable feature names from FEATURE_TITLES dictionary', () => {
    expect(FEATURE_TITLES['digital_signatures']).toBe('Digital Signatures & Documents');
    expect(FEATURE_TITLES['gamified_milestones']).toBe('Leaderboard & Gamification');
    expect(FEATURE_TITLES['ai_course_builder']).toBe('AI Course Builder');
    expect(FEATURE_TITLES['kiosk_mode']).toBe('Kiosk Terminals');
    expect(FEATURE_TITLES['office_map']).toBe('Office Floor Map');
    expect(FEATURE_TITLES['sso_enforcement']).toBe('SSO & Identity Management');
    expect(FEATURE_TITLES['advanced_hris_sync']).toBe('HRIS Directory Sync');
  });

  it('Enforces both capability and feature flag on guarded routes', () => {
    // Role 'employee' lacks capability 'manage_organization' for kiosks
    const htmlCapabilityDenied = renderRoute(
      '/kiosks',
      { kiosk_mode: true },
      'employee'
    );
    expect(htmlCapabilityDenied).toContain('Access Restricted');
    expect(htmlCapabilityDenied).not.toContain('Kiosks Content');

    // Admin has capability, but kiosk_mode is disabled
    const htmlFlagDenied = renderRoute(
      '/kiosks',
      { kiosk_mode: false },
      'admin'
    );
    expect(htmlFlagDenied).toContain('Feature Temporarily Unavailable');
    expect(htmlFlagDenied).not.toContain('Kiosks Content');

    // Admin has capability AND kiosk_mode is enabled
    const htmlSuccess = renderRoute(
      '/kiosks',
      { kiosk_mode: true },
      'admin'
    );
    expect(htmlSuccess).toContain('Kiosks Content');
    expect(htmlSuccess).not.toContain('Feature Temporarily Unavailable');
    expect(htmlSuccess).not.toContain('Access Restricted');
  });
});
