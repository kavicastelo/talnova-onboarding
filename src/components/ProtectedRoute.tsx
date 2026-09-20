import React from 'react';
import { useRole } from '../context/RoleContext';
import { Capability } from '../utils/rbac';
import { ShieldAlert, Sliders } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  capability?: Capability;
  featureFlag?: string;
  children: React.ReactNode;
}

export const FEATURE_TITLES: Record<string, string> = {
  ai_course_builder: 'AI Course Builder',
  kiosk_mode: 'Kiosk Terminals',
  office_map: 'Office Floor Map',
  gamified_milestones: 'Leaderboard & Gamification',
  gamification_badges: 'Leaderboard & Gamification',
  sso_enforcement: 'SSO & Identity Management',
  advanced_hris_sync: 'HRIS Directory Sync',
  digital_signatures: 'Digital Signatures & Documents',
  buddy_connection: 'Onboarding Buddy Program',
  journey_templates: 'Journey & Course Templates',
  journey_builder: 'Journey Visual Builder',
  milestone_ratings: '30/60/90 Day Milestones',
  calendar_integration: 'Calendar & Meeting Scheduling',
  checklist_tasks: 'Onboarding Checklist Tasks',
  workflow_rules: 'Automated Workflow Rules',
  knowledge_base: 'Knowledge Base',
  ai_assistant: 'AI Onboarding Assistant',
  onboarding_copilot: 'Onboarding AI Copilot',
  scim_provisioning: 'SCIM Directory Provisioning',
  multi_org_switch: 'Multi-Organization Switcher',
  advanced_reporting: 'Advanced Executive Reporting',
};

export function ProtectedRoute({ capability, featureFlag, children }: ProtectedRouteProps) {
  const { can, hasFeature } = useRole();
  const navigate = useNavigate();

  // 1. RBAC Capability Check
  if (capability && !can(capability)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Restricted</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          You do not have the required permissions to access this management area ({capability}). Please contact your organization administrator if you believe this is an error.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // 2. Runtime Feature Flag Check
  if (featureFlag && !hasFeature(featureFlag)) {
    const friendlyTitle = FEATURE_TITLES[featureFlag] || featureFlag;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mb-4">
          <Sliders className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Feature Temporarily Unavailable</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          The feature <strong>{friendlyTitle}</strong> (<code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">{featureFlag}</code>) is currently disabled by platform administration for your organization.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
