import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../src/components/Card';
import { useDemoTelemetry } from '../hooks/useDemoTelemetry';

interface DemoRestrictedPageProps {
  featureName: string;
  description?: string;
  highlights?: string[];
}

const FEATURE_METADATA: Record<string, { description: string; highlights: string[] }> = {
  'Calendar Integration': {
    description: 'Sync orientation sessions, manager 1-on-1 check-ins, and buddy coffee catchups directly with Google Calendar and Microsoft Outlook 365.',
    highlights: [
      'Two-way sync with Google Workspace & Microsoft 365 calendars',
      'Automated conflict detection during onboarding schedule generation',
      'Instant video call link generation (Google Meet, Zoom, Microsoft Teams)',
      'Calendar invite dispatches to managers, buddies, and new hires'
    ],
  },
  'HR Operations & Sync': {
    description: 'Enterprise HRIS connectivity ensuring bi-directional synchronisation of employee profiles, compensation bands, and compliance records.',
    highlights: [
      'Real-time bi-directional sync with Workday, BambooHR, and Rippling',
      'Automated candidate-to-employee onboarding transitions',
      'Automated payroll and benefits enrollment handoffs',
      'Custom exception handling and discrepancy reconciliation queues'
    ],
  },
  'HRIS Integrations': {
    description: 'Connect your centralized HR tech stack to eliminate duplicate data entry and accelerate time-to-productivity.',
    highlights: [
      'Native connectors for Workday, BambooHR, Personio, and Gusto',
      'Webhook subscriptions for immediate hire, promotion, and termination events',
      'Field mapping customizer with transformation rules',
      'Encrypted credential vault with automated key rotation'
    ],
  },
  'SSO Enforcement': {
    description: 'Enforce SAML 2.0 and OIDC single sign-on across your enterprise identity providers.',
    highlights: [
      'SAML 2.0 integration with Okta, Azure AD (Entra ID), and Google Workspace',
      'Just-In-Time (JIT) automated user provisioning',
      'SCIM 2.0 directory synchronization for real-time deprovisioning',
      'Granular MFA enforcement policies per role tier'
    ],
  },
};

export const DemoRestrictedPage: React.FC<DemoRestrictedPageProps> = ({
  featureName,
  description,
  highlights,
}) => {
  const navigate = useNavigate();
  const { trackFeature } = useDemoTelemetry();

  const meta = FEATURE_METADATA[featureName] || {
    description: description || 'This capability connects to external enterprise infrastructure and is restricted in the self-guided demo sandbox to protect security.',
    highlights: highlights || [
      'Production-grade automated sync and enterprise security',
      'Available during a live guided walkthrough with our technical architects',
      'Customizable to your specific organizational compliance standards'
    ],
  };

  useEffect(() => {
    trackFeature(featureName, 'view', 'RESTRICTED', 0, { isFullPage: true });
  }, [featureName, trackFeature]);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/demo')}
        className="gap-2 text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Button>

      <Card className="border-border/60 shadow-md overflow-hidden bg-card">
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 mb-1">
                <Sparkles className="w-3 h-3" />
                Enterprise Feature Preview
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{featureName}</h1>
            </div>
          </div>
        </div>

        <CardHeader className="space-y-3 pt-6">
          <CardTitle className="text-lg font-semibold text-foreground">
            Feature Overview & Capabilities
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            {meta.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted/40 p-4 border border-border/50">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Included in Enterprise Full Suite
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {meta.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Sandbox Security Policy Active
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Outbound external system calls, live SMTP dispatching, and direct HRIS connections are isolated in this demo environment.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto"
            >
              Continue Exploring Sandbox
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/demo/journeys')}
              className="w-full sm:w-auto"
            >
              View Onboarding Journeys
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
