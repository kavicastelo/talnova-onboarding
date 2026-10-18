import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard, UserCheck, Sparkles, Bot } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Card, CardContent } from '../../../src/components/Card';
import { useDemoAuth } from '../context/DemoAuthContext';
import { useRole } from '../../../src/context/RoleContext';
import { toast } from 'sonner';

const DEMO_PERSONAS = [
  {
    email: 'sarah.connor@acme-demo.com',
    fullName: 'Sarah Connor',
    role: 'Admin',
    company: 'Acme Corp',
    title: 'VP of People Operations',
  },
  {
    email: 'alice.smith@acme-demo.com',
    fullName: 'Alice Smith',
    role: 'Manager',
    company: 'Acme Corp',
    title: 'Engineering Manager',
  },
  {
    email: 'john.doe@acme-demo.com',
    fullName: 'John Doe',
    role: 'Employee',
    company: 'Acme Corp',
    title: 'Senior Frontend Engineer',
  },
];

interface DemoAccessDeniedProps {
  requiredRole?: string;
  requiredCapability?: string;
}

export const DemoAccessDenied: React.FC<DemoAccessDeniedProps> = ({
  requiredRole,
  requiredCapability,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBotDetected = searchParams.get('reason') === 'bot_detected';
  const { user, login } = useDemoAuth();
  const { setRole, setRoles } = useRole();

  const handleQuickSwitch = async (persona: (typeof DEMO_PERSONAS)[0]) => {
    try {
      await login(persona.email, 'DemoPass123!');
      const targetRole = persona.role.toLowerCase() as any;
      setRole(targetRole);
      setRoles([targetRole]);
      toast.success(`Switched persona to ${persona.fullName} (${persona.role})`);
      navigate('/demo');
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  if (isBotDetected) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5">
            <Bot className="h-10 w-10 animate-bounce" />
          </div>
          <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-xs font-semibold text-amber-500 mb-4 border border-amber-500/20">
          <span>Automated Environment Shield</span>
          <span className="text-amber-400">•</span>
          <span className="font-bold">Execution Suspended</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-3">
          Automated Environment Detected
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-4">
          Automated scraping, headless crawlers (Puppeteer, Playwright, Selenium), and bot automation are strictly blocked to protect proprietary evaluation content.
        </p>
        <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-8">
          Please access the interactive demo using a standard, un-automated desktop browser or contact Talnova Enterprise for a developer API evaluation license.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            Reload in Standard Browser
          </Button>
          <Button onClick={() => window.open('https://talnovaonboard.com/contact', '_blank')} className="gap-2 shadow-sm">
            Contact Sales for License
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
      {/* Shield Icon */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/5">
          <ShieldAlert className="h-10 w-10 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-4 border border-rose-200 dark:border-rose-900/50">
        <span>Demo Access Control</span>
        <span className="text-rose-400">•</span>
        <span className="font-bold">403 Forbidden</span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-3">
        Access Restricted for Current Persona
      </h1>
      <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-2">
        You are currently viewing the demo as{' '}
        <span className="font-semibold text-foreground">
          {user?.fullName || 'Demo User'} ({user?.role || 'Employee'})
        </span>
        .
      </p>
      <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto mb-8">
        {requiredRole || requiredCapability ? (
          <>
            This management surface requires{' '}
            <span className="font-semibold text-foreground">
              {requiredRole || requiredCapability}
            </span>{' '}
            entitlements.
          </>
        ) : (
          'This management area requires administrative or managerial permissions.'
        )}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
        <Button onClick={() => navigate('/demo')} className="gap-2 shadow-sm">
          <LayoutDashboard className="h-4 w-4" /> Return to Dashboard
        </Button>
      </div>

      {/* 1-Click Persona Switcher for Quick Access */}
      <Card className="w-full border-border/60 bg-card/60 backdrop-blur-xs text-left">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Instant Persona Switcher
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Switch roles in 1-click to preview this feature
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DEMO_PERSONAS.map((persona) => (
              <button
                key={persona.email}
                onClick={() => handleQuickSwitch(persona)}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/50 transition-all text-xs font-medium text-foreground text-left group"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{persona.fullName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{persona.role} • {persona.company}</div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoAccessDenied;
