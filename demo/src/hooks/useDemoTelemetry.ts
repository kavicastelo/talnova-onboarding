import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1';

export function useDemoTelemetry() {
  const location = useLocation();
  const enterTimeRef = useRef<number>(Date.now());
  const currentPathRef = useRef<string>(location.pathname);

  const getFeatureKeyFromPath = (path: string): string => {
    const clean = path.replace(/^\/demo\/?/, '').split('/')[0];
    switch (clean) {
      case '':
      case 'admin':
        return 'admin_dashboard';
      case 'employee':
        return 'employee_dashboard';
      case 'manager':
        return 'manager_dashboard';
      case 'journeys':
        return 'journey_templates';
      case 'tasks':
        return 'checklist_tasks';
      case 'directory':
      case 'profile':
        return 'employee_directory';
      case 'kb':
      case 'knowledge-base':
        return 'knowledge_base';
      case 'analytics':
        return 'analytics_dashboard';
      case 'documents':
        return 'digital_signatures';
      case 'milestones':
      case 'leaderboard':
        return 'gamified_milestones';
      case 'buddy':
        return 'buddy_connection';
      case 'calendar':
        return 'calendar_integration';
      case 'hr-ops':
        return 'hr_operations';
      case 'ai-assistant':
        return 'ai_assistant';
      case 'settings':
        return 'settings_integrations';
      case 'inbox':
        return 'email_sink';
      default:
        return clean || 'general_exploration';
    }
  };

  const trackFeature = async (
    featureKey: string,
    action: 'view' | 'click' | 'toggle' | 'submit' | 'export' | 'restricted_attempt' = 'view',
    status: 'ALLOWED' | 'RESTRICTED' | 'SIMULATED' = 'ALLOWED',
    durationSeconds = 0,
    metadata: Record<string, any> = {}
  ) => {
    try {
      const token = localStorage.getItem('talnova_demo_token');
      if (!token) return;

      await fetch(`${API_BASE}/demo/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          featureKey,
          route: location.pathname,
          action,
          status,
          durationSeconds,
          metadata,
        }),
      });
    } catch {
      // Telemetry failures should never interrupt demo user UX
    }
  };

  // Track page view and dwell time automatically
  useEffect(() => {
    const prevPath = currentPathRef.current;
    const dwellSeconds = Math.round((Date.now() - enterTimeRef.current) / 1000);

    // Record dwell time of previous page if spent more than 1 second
    if (dwellSeconds > 1) {
      const prevFeature = getFeatureKeyFromPath(prevPath);
      trackFeature(prevFeature, 'view', 'ALLOWED', dwellSeconds);
    }

    // Reset timer for new page
    enterTimeRef.current = Date.now();
    currentPathRef.current = location.pathname;

    // Track arrival at new page
    const currentFeature = getFeatureKeyFromPath(location.pathname);
    trackFeature(currentFeature, 'view', 'ALLOWED', 0);

    return () => {
      const finalDwell = Math.round((Date.now() - enterTimeRef.current) / 1000);
      if (finalDwell > 1) {
        trackFeature(currentFeature, 'view', 'ALLOWED', finalDwell);
      }
    };
  }, [location.pathname]);

  return { trackFeature };
}
