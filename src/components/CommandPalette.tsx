import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRole } from '../context/RoleContext';
import { Capability } from '../utils/rbac';
import { Role } from '../context/RoleContext';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator
} from './Command';
import { Dialog, DialogContent, DialogTitle } from './Dialog';
import {
  LayoutDashboard,
  Map,
  Users,
  BookOpen,
  BarChart2,
  Settings,
  GraduationCap,
  UserRound,
  Award,
  ShieldAlert,
  AlertOctagon,
  UserCheck,
  Wand2,
  FileText,
  CheckSquare,
  Laptop,
  CalendarCheck,
  HeartHandshake,
  Calendar,
  Workflow,
  Tv,
  MapPin,
  Trophy,
  Bot,
  KeyRound,
  AlertTriangle,
  Server,
  HardDrive,
  Activity,
  DollarSign,
  Layers,
  CreditCard,
  BarChart3,
  Clock,
  ToggleLeft,
  FileSpreadsheet,
  Building2,
  Receipt,
  Loader2
} from 'lucide-react';
import { useJourneys } from '../hooks/useJourneys';
import { useEmployees } from '../hooks/useEmployees';
import { superAdminService } from '../services/superAdmin.service';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PalettePage {
  title: string;
  category: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  capability?: Capability;
  featureFlag?: string;
  roles?: Role[];
}

const pages: PalettePage[] = [
  // Overview & Onboarding
  {
    title: 'Dashboard',
    category: 'Overview',
    url: '/',
    icon: LayoutDashboard,
    keywords: ['home', 'overview', 'metrics', 'stats'],
    roles: ['admin', 'owner', 'super_admin', 'hr_admin', 'manager'],
  },
  {
    title: 'Onboarding Roadmap',
    category: 'My Onboarding',
    url: '/employee',
    icon: LayoutDashboard,
    featureFlag: 'onboarding_roadmap',
    keywords: ['roadmap', 'phases', 'progress', 'journey', 'welcome', 'home'],
  },
  {
    title: 'Required Documents',
    category: 'My Onboarding',
    url: '/documents',
    icon: FileText,
    featureFlag: 'digital_signatures',
    keywords: ['documents', 'sign', 'nda', 'handbook', 'compliance', 'legal'],
  },
  {
    title: 'Checklist Tasks',
    category: 'My Onboarding',
    url: '/tasks',
    icon: CheckSquare,
    featureFlag: 'checklist_tasks',
    keywords: ['tasks', 'checklist', 'todo', 'action items'],
  },
  {
    title: 'Earned Certificates',
    category: 'My Onboarding',
    url: '/certificates',
    icon: Award,
    featureFlag: 'certificates',
    keywords: ['certificates', 'credentials', 'diploma', 'graduation', 'badges'],
  },

  // Operations & Tasks
  {
    title: 'HR Operations',
    category: 'Operations',
    url: '/hr-ops',
    icon: ShieldAlert,
    capability: 'view_hr_ops',
    featureFlag: 'hr_ops_dashboard',
    keywords: ['hr operations', 'handover', 'graduation', 'verification', 'batch'],
  },
  {
    title: 'Exceptions Workbench',
    category: 'Operations',
    url: '/hr-ops/exceptions',
    icon: AlertOctagon,
    capability: 'view_hr_ops',
    featureFlag: 'hr_exceptions',
    keywords: ['exceptions', 'quarantine', 'velocity risk', 'stuck', 'sla', 'holds'],
  },
  {
    title: 'IT Hardware Queue',
    category: 'Operations',
    url: '/tasks/it-ops',
    icon: Laptop,
    capability: 'manage_it_ops',
    featureFlag: 'it_ops_queue',
    keywords: ['it hardware', 'laptop', 'provisioning', 'serial', 'asset tag', 'courier'],
  },

  // People & Teams
  {
    title: 'Team Operations',
    category: 'People & Teams',
    url: '/manager',
    icon: UserCheck,
    capability: 'view_team_ops',
    featureFlag: 'manager_dashboard',
    keywords: ['manager', 'direct reports', 'nudge', 'team', 'sign-off', 'supervision'],
  },
  {
    title: 'Employee Directory',
    category: 'People & Teams',
    url: '/directory',
    icon: Users,
    featureFlag: 'employee_directory',
    keywords: ['directory', 'employees', 'staff', 'team', 'people', 'invite', 'csv'],
  },
  {
    title: 'Buddy Program',
    category: 'People & Teams',
    url: '/buddy',
    icon: HeartHandshake,
    featureFlag: 'buddy_connection',
    keywords: ['buddy', 'mentor', 'pairing', 'mentee', 'icebreaker', 'support'],
  },
  {
    title: '30/60/90 Milestones',
    category: 'People & Teams',
    url: '/milestones',
    icon: CalendarCheck,
    featureFlag: 'milestone_ratings',
    keywords: ['milestones', 'evaluation', '30 day', '60 day', '90 day', 'self rating', 'review'],
  },
  {
    title: 'Calendar & Meetings',
    category: 'People & Teams',
    url: '/calendar',
    icon: Calendar,
    featureFlag: 'calendar_integration',
    keywords: ['calendar', 'meetings', 'schedule', '1-on-1', 'check-in', 'meet'],
  },

  // Learning & Content
  {
    title: 'Journey Templates',
    category: 'Learning & Content',
    url: '/journeys',
    icon: GraduationCap,
    featureFlag: 'journey_templates',
    keywords: ['journeys', 'curriculum', 'lms', 'modules', 'steps', 'courses', 'templates'],
  },
  {
    title: 'AI Course Builder',
    category: 'Learning & Content',
    url: '/ai-course-builder',
    icon: Wand2,
    capability: 'ai_course_builder',
    featureFlag: 'ai_course_builder',
    keywords: ['ai course builder', 'generate course', 'pdf', 'docx', 'quiz', 'curriculum'],
  },
  {
    title: 'Knowledge Base',
    category: 'Learning & Content',
    url: '/kb',
    icon: BookOpen,
    featureFlag: 'knowledge_base',
    keywords: ['knowledge base', 'articles', 'handbook', 'policies', 'faq', 'docs', 'wiki'],
  },
  {
    title: 'Policy Slideshow',
    category: 'Learning & Content',
    url: '/kb/slideshow',
    icon: Tv,
    featureFlag: 'kb_slideshow',
    keywords: ['slideshow', 'tv', 'presentation', 'policies', 'kiosk'],
  },

  // Workplace & Tools
  {
    title: 'AI Assistant',
    category: 'Workplace & Tools',
    url: '/ai-assistant',
    icon: Bot,
    featureFlag: 'ai_assistant',
    keywords: ['ai assistant', 'chatbot', 'help', 'questions', 'bot', 'gpt'],
  },
  {
    title: 'Office Map',
    category: 'Workplace & Tools',
    url: '/office-map',
    icon: MapPin,
    featureFlag: 'office_map',
    keywords: ['office map', 'floorplan', 'desks', 'rooms', 'amenities', 'cafeteria'],
  },
  {
    title: 'Leaderboard',
    category: 'Workplace & Tools',
    url: '/leaderboard',
    icon: Trophy,
    featureFlag: 'gamified_milestones',
    keywords: ['leaderboard', 'gamification', 'points', 'badges', 'ranks', 'achievements'],
  },
  {
    title: 'Kiosk Terminals',
    category: 'Workplace & Tools',
    url: '/kiosks',
    icon: Tv,
    capability: 'manage_organization',
    featureFlag: 'kiosk_mode',
    keywords: ['kiosks', 'frontline', 'sop', 'touch screen', 'pairing code', 'terminal'],
  },

  // System & Administration
  {
    title: 'Analytics & Reports',
    category: 'System & Administration',
    url: '/analytics',
    icon: BarChart2,
    capability: 'view_analytics',
    featureFlag: 'tenant_analytics',
    keywords: ['analytics', 'metrics', 'drop-off', 'velocity', 'cohorts', 'reports'],
  },
  {
    title: 'Workflows & Automation',
    category: 'System & Administration',
    url: '/workflows',
    icon: Workflow,
    capability: 'manage_workflows',
    featureFlag: 'workflow_rules',
    keywords: ['workflows', 'automation', 'rules', 'triggers', 'actions', 'events', 'logs'],
  },
  {
    title: 'Workspace Settings',
    category: 'System & Administration',
    url: '/settings',
    icon: Settings,
    roles: ['admin', 'owner', 'super_admin', 'hr_admin'],
    keywords: ['settings', 'branding', 'logo', 'colors', 'departments', 'profile'],
  },
  {
    title: 'SSO & Identity',
    category: 'System & Administration',
    url: '/settings/sso',
    icon: KeyRound,
    capability: 'manage_sso',
    featureFlag: 'sso_enforcement',
    keywords: ['sso', 'saml', 'oidc', 'identity', 'okta', 'azure ad', 'single sign-on'],
  },
  {
    title: 'HRIS Integrations',
    category: 'System & Administration',
    url: '/settings/integrations',
    icon: Workflow,
    capability: 'manage_integrations',
    featureFlag: 'advanced_hris_sync',
    keywords: ['hris', 'integrations', 'bamboohr', 'workday', 'marketplace', 'sync'],
  },

  // Platform Control
  {
    title: 'Command Center',
    category: 'Platform Control',
    url: '/super-admin',
    icon: LayoutDashboard,
    roles: ['super_admin'],
    keywords: ['super admin', 'command center', 'executive', 'platform', 'telemetry', 'stats'],
  },
  {
    title: 'Platform Alert Center',
    category: 'Platform Control',
    url: '/super-admin/alerts',
    icon: AlertTriangle,
    roles: ['super_admin'],
    keywords: ['alerts', 'incidents', 'quarantine', 'severity', 'warnings', 'critical'],
  },

  // Tenants & Users
  {
    title: 'Organizations & Tenants',
    category: 'Tenants & Users',
    url: '/super-admin/organizations',
    icon: Building2,
    roles: ['super_admin'],
    keywords: ['tenants', 'workspaces', 'organizations', 'provision', 'plans', 'quotas'],
  },
  {
    title: 'User Directory (Cross-Tenant)',
    category: 'Tenants & Users',
    url: '/super-admin/users',
    icon: Users,
    roles: ['super_admin'],
    keywords: ['users', 'directory', 'super admin', 'roles', 'accounts', 'cross-tenant'],
  },
  {
    title: 'Active Sessions & Security',
    category: 'Tenants & Users',
    url: '/super-admin/users/sessions',
    icon: KeyRound,
    roles: ['super_admin'],
    keywords: ['sessions', 'revoke', 'active users', 'devices', 'ip', 'tokens'],
  },

  // Onboarding & Product
  {
    title: 'Cross-Tenant Onboarding Monitor',
    category: 'Onboarding & Product',
    url: '/super-admin/onboarding',
    icon: GraduationCap,
    roles: ['super_admin'],
    keywords: ['onboarding', 'journeys', 'completion', 'drop-off', 'funnel', 'cohorts'],
  },
  {
    title: 'Feature Adoption Matrix',
    category: 'Onboarding & Product',
    url: '/super-admin/product/features',
    icon: BarChart2,
    roles: ['super_admin'],
    keywords: ['features', 'adoption', 'usage', 'modules', 'flags'],
  },
  {
    title: 'Operations & Hardware Queue',
    category: 'Onboarding & Product',
    url: '/super-admin/tasks-ops',
    icon: CheckSquare,
    roles: ['super_admin'],
    keywords: ['tasks', 'hardware', 'provisioning', 'laptops', 'cross-tenant ops'],
  },

  // Platform Observability
  {
    title: 'Activity Explorer',
    category: 'Platform Observability',
    url: '/super-admin/activity',
    icon: Clock,
    roles: ['super_admin'],
    keywords: ['activity', 'stream', 'events', 'audit', 'timeline'],
  },
  {
    title: 'API Observability & Telemetry',
    category: 'Platform Observability',
    url: '/super-admin/observability/api',
    icon: Activity,
    roles: ['super_admin'],
    keywords: ['api', 'telemetry', 'latency', 'p95', 'p99', 'errors', 'endpoints'],
  },
  {
    title: 'System Logs',
    category: 'Platform Observability',
    url: '/super-admin/observability/logs',
    icon: FileText,
    roles: ['super_admin'],
    keywords: ['logs', 'pino', 'fastify', 'errors', 'debug', 'server logs'],
  },
  {
    title: 'Infrastructure & DB Health',
    category: 'Platform Observability',
    url: '/super-admin/observability/infrastructure',
    icon: Server,
    roles: ['super_admin'],
    keywords: ['database', 'mongo', 'memory', 'cpu', 'event loop', 'infrastructure'],
  },
  {
    title: 'AI Observability & Cost',
    category: 'Platform Observability',
    url: '/super-admin/observability/ai',
    icon: Bot,
    roles: ['super_admin'],
    keywords: ['ai', 'tokens', 'gemini', 'course builder', 'assistant', 'ai cost'],
  },
  {
    title: 'Storage & Media Operations',
    category: 'Platform Observability',
    url: '/super-admin/observability/storage',
    icon: HardDrive,
    roles: ['super_admin'],
    keywords: ['storage', 's3', 'media', 'uploads', 'quotas', 'assets'],
  },

  // Internal Finance
  {
    title: 'Internal Finance Overview',
    category: 'Internal Finance',
    url: '/super-admin/finance',
    icon: DollarSign,
    roles: ['super_admin'],
    keywords: ['finance', 'cash', 'revenue', 'expenses', 'p&l', 'operating result'],
  },
  {
    title: 'Invoices & Receivables',
    category: 'Internal Finance',
    url: '/super-admin/finance/invoices',
    icon: FileSpreadsheet,
    roles: ['super_admin'],
    keywords: ['invoices', 'receivables', 'aging', 'overdue', 'billing'],
  },
  {
    title: 'Payment Ledger',
    category: 'Internal Finance',
    url: '/super-admin/finance/payments',
    icon: CreditCard,
    roles: ['super_admin'],
    keywords: ['payments', 'ledger', 'bank wire', 'receipts', 'cash collected'],
  },
  {
    title: 'Expense Tracker',
    category: 'Internal Finance',
    url: '/super-admin/finance/expenses',
    icon: BarChart3,
    roles: ['super_admin'],
    keywords: ['expenses', 'hosting', 'infrastructure cost', 'licenses', 'salaries'],
  },
  {
    title: 'Customer Accounts & Ledger',
    category: 'Internal Finance',
    url: '/super-admin/finance/accounts',
    icon: Layers,
    roles: ['super_admin'],
    keywords: ['accounts', 'tenants balance', 'credits', 'outstanding balance'],
  },

  // Audit & Governance
  {
    title: 'Audit & Security Explorer',
    category: 'Audit & Governance',
    url: '/super-admin/audit',
    icon: ShieldAlert,
    roles: ['super_admin'],
    keywords: ['audit', 'security', 'compliance', 'immutable', 'governance', 'diff'],
  },
  {
    title: 'Reporting Center',
    category: 'Audit & Governance',
    url: '/super-admin/reports',
    icon: BarChart3,
    roles: ['super_admin'],
    keywords: ['reports', 'csv', 'export', 'data', 'executive summary'],
  },

  // Platform Settings
  {
    title: 'Feature Flags & Toggles',
    category: 'Platform Settings',
    url: '/super-admin/settings/flags',
    icon: ToggleLeft,
    roles: ['super_admin'],
    keywords: ['feature flags', 'toggles', 'canary', 'beta', 'rollout'],
  },
  {
    title: 'Platform Settings & Config',
    category: 'Platform Settings',
    url: '/super-admin/settings/platform',
    icon: Settings,
    roles: ['super_admin'],
    keywords: ['platform settings', 'maintenance', 'retention', 'session timeout'],
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { role, can, hasFeature } = useRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<{
    organizations: any[];
    users: any[];
    journeys: any[];
    invoices: any[];
  }>({ organizations: [], users: [], journeys: [], invoices: [] });
  const [isSearchingAdmin, setIsSearchingAdmin] = useState(false);

  const { data: journeys = [] } = useJourneys({ enabled: open });
  const { data: employeesRes } = useEmployees({ limit: 1000 }, { enabled: open && role !== 'super_admin' });
  const employees = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.employees || []);

  const go = (url: string) => {
    setSearchQuery('');
    onOpenChange(false);
    navigate(url);
  };

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setAdminSearchResults({ organizations: [], users: [], journeys: [], invoices: [] });
    }
  }, [open]);

  useEffect(() => {
    if (role !== 'super_admin' || !searchQuery || searchQuery.trim().length < 2) {
      setAdminSearchResults({ organizations: [], users: [], journeys: [], invoices: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAdmin(true);
      try {
        const res = await superAdminService.globalSearch(searchQuery.trim());
        setAdminSearchResults(res || { organizations: [], users: [], journeys: [], invoices: [] });
      } catch {
        // silently ignore error
      } finally {
        setIsSearchingAdmin(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, role]);

  const q = searchQuery.toLowerCase().trim();

  const allowedPages = pages.filter((p) => {
    if (p.capability && !can(p.capability)) return false;
    if (p.featureFlag && !hasFeature(p.featureFlag)) return false;
    if (p.roles && !p.roles.includes(role)) return false;
    if (role === 'employee' && p.url === '/') return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  });

  const filteredJourneys = !q
    ? journeys
    : journeys.filter((j) => j.title.toLowerCase().includes(q));

  const filteredEmployees = !q
    ? employees.slice(0, 50)
    : employees.filter((e) =>
        `${e.name || ''} ${e.fullName || ''} ${e.department || ''} ${e.jobTitle || ''}`
          .toLowerCase()
          .includes(q)
      ).slice(0, 50);

  // Group allowed pages by category
  const categories = Array.from(new Set(allowedPages.map((p) => p.category)));

  const hasSuperAdminResults =
    role === 'super_admin' &&
    (adminSearchResults.organizations.length > 0 ||
      adminSearchResults.users.length > 0 ||
      adminSearchResults.journeys.length > 0 ||
      adminSearchResults.invoices.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-xl max-h-[85vh] flex flex-col" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('commandPalette', 'Command palette')}</DialogTitle>
        <Command className="[&_[cmdk-input-wrapper]]:border-b flex-1 flex flex-col min-h-0">
          <CommandInput
            placeholder={
              role === 'super_admin'
                ? 'Search platform pages, tenants, users, journeys, invoices…'
                : 'Search pages, journeys, employees, or tools… (e.g. SSO, Milestones, IT)'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            {isSearchingAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching cross-tenant database…
              </div>
            )}

            {/* Live Cross-Tenant Super Admin Results */}
            {hasSuperAdminResults && (
              <>
                {adminSearchResults.organizations.length > 0 && (
                  <CommandGroup heading="Organizations & Tenants (Global)">
                    {adminSearchResults.organizations.map((org) => (
                      <CommandItem
                        key={org._id}
                        onSelect={() => go(`/super-admin/organizations/${org._id}`)}
                        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                      >
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{org.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {org.domain || org.slug} · {org.plan}
                          </span>
                        </div>
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-mono ${
                          org.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          {org.status}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {adminSearchResults.users.length > 0 && (
                  <CommandGroup heading="Users (Cross-Tenant)">
                    {adminSearchResults.users.map((u) => (
                      <CommandItem
                        key={u._id}
                        onSelect={() => go(`/super-admin/users/${u._id}`)}
                        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                      >
                        <UserCheck className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{u.profile?.fullName || 'User'}</span>
                          <span className="text-[11px] text-muted-foreground">{u.auth?.email}</span>
                        </div>
                        <span className="ml-auto text-xs text-muted-foreground capitalize">
                          {u.permissions?.role?.replace('_', ' ')}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {adminSearchResults.invoices.length > 0 && (
                  <CommandGroup heading="Invoices (Cross-Tenant)">
                    {adminSearchResults.invoices.map((inv) => (
                      <CommandItem
                        key={inv._id}
                        onSelect={() => go('/super-admin/finance/invoices')}
                        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                      >
                        <Receipt className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{inv.invoiceNo} · {inv.organization}</span>
                          <span className="text-[11px] text-muted-foreground">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <span className="ml-auto text-xs font-mono font-medium">
                          ${inv.amount?.toLocaleString()}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandSeparator className="my-1" />
              </>
            )}

            {/* Navigation Pages */}
            {categories.map((cat) => {
              const catPages = allowedPages.filter((p) => p.category === cat);
              return (
                <CommandGroup key={cat} heading={cat}>
                  {catPages.map((p) => (
                    <CommandItem
                      key={p.url}
                      onSelect={() => go(p.url)}
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                    >
                      <p.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{p.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground/60">{p.url}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}

            {filteredJourneys.length > 0 && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Journeys & Curricula">
                  {filteredJourneys.map((j) => (
                    <CommandItem
                      key={j.id}
                      onSelect={() => go(role === 'admin' || role === 'owner' || role === 'hr_admin' ? `/journeys/${j.id}` : `/course/${j.id}`)}
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                    >
                      <Map className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{j.title}</span>
                      <span className="ml-auto text-xs tracking-wide capitalize text-muted-foreground">
                        {j.status}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {filteredEmployees.length > 0 && (role !== 'employee' || can('manage_employees')) && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Employees & Team">
                  {filteredEmployees.map((e) => (
                    <CommandItem
                      key={e.id}
                      onSelect={() => go(`/directory/${e.id}`)}
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                    >
                      <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{e.fullName || e.name}</span>
                        <span className="text-[11px] text-muted-foreground">{e.jobTitle || e.department}</span>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground/70">
                        {e.department}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Global Cmd/Ctrl+K listener that toggles the palette. */
export function useCommandPaletteHotkey(
  setOpen: (fn: (o: boolean) => boolean) => void
) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);
}