import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  Bot,
  KeyRound,
  Tv,
  Workflow,
  Trophy
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';

export function SuperAdminFeatures() {
  const navigate = useNavigate();

  const features = [
    {
      id: 'ai-courses',
      name: 'AI Course Generator (Gemini)',
      description: 'Generative AI automated onboarding curriculum builder with quizzes',
      adoptionPct: 82,
      activeTenants: 14,
      totalTenants: 17,
      category: 'Intelligence',
      icon: Bot,
      status: 'GA'
    },
    {
      id: 'sso-enterprise',
      name: 'Enterprise SAML 2.0 & OIDC SSO',
      description: 'Okta, Azure AD, and custom identity provider authentication gateway',
      adoptionPct: 76,
      activeTenants: 13,
      totalTenants: 17,
      category: 'Security',
      icon: KeyRound,
      status: 'GA'
    },
    {
      id: 'hris-webhooks',
      name: 'Real-Time HRIS Integration Sync',
      description: 'Automated worker ingestion from BambooHR, Workday, and HiBob',
      adoptionPct: 65,
      activeTenants: 11,
      totalTenants: 17,
      category: 'Integration',
      icon: Workflow,
      status: 'GA'
    },
    {
      id: 'kiosk-terminals',
      name: 'Kiosk Orientation Displays',
      description: 'Public tablet and wall terminal player mode for physical campuses',
      adoptionPct: 41,
      activeTenants: 7,
      totalTenants: 17,
      category: 'Hardware',
      icon: Tv,
      status: 'Beta'
    },
    {
      id: 'gamification',
      name: 'Learner Gamification & Badges',
      description: 'Milestone badges, streak multipliers, and departmental leaderboards',
      adoptionPct: 88,
      activeTenants: 15,
      totalTenants: 17,
      category: 'Engagement',
      icon: Trophy,
      status: 'GA'
    }
  ];

  return (
    <SuperAdminShell
      title="Feature Adoption & Module Matrix"
      subtitle="Cross-tenant product usage analytics, capability utilization, and enterprise enablement"
      actions={
        <Button
          onClick={() => navigate('/super-admin/settings/flags')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
        >
          <Sliders className="h-3.5 w-3.5" /> Feature Flags
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.id} className="border border-slate-200 bg-white shadow-sm p-5 flex flex-col justify-between space-y-4 rounded-xl">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <Badge className={
                    f.status === 'GA'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }>
                    {f.status}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-3">{f.name}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{f.description}</p>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Adoption Rate</span>
                  <span className="font-bold text-slate-900 font-mono">{f.adoptionPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${f.adoptionPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>{f.activeTenants} / {f.totalTenants} tenants enabled</span>
                  <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{f.category}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </SuperAdminShell>
  );
}

export default SuperAdminFeatures;
