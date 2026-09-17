import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  KeyRound
} from 'lucide-react';
import { useJourneys } from '../hooks/useJourneys';
import { useEmployees } from '../hooks/useEmployees';

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
    keywords: ['roadmap', 'phases', 'progress', 'journey', 'welcome', 'home'],
  },
  {
    title: 'Required Documents',
    category: 'My Onboarding',
    url: '/documents',
    icon: FileText,
    keywords: ['documents', 'sign', 'nda', 'handbook', 'compliance', 'legal'],
  },
  {
    title: 'Checklist Tasks',
    category: 'My Onboarding',
    url: '/tasks',
    icon: CheckSquare,
    keywords: ['tasks', 'checklist', 'todo', 'action items'],
  },
  {
    title: 'Earned Certificates',
    category: 'My Onboarding',
    url: '/certificates',
    icon: Award,
    keywords: ['certificates', 'credentials', 'diploma', 'graduation', 'badges'],
  },

  // Operations & Tasks
  {
    title: 'HR Operations',
    category: 'Operations',
    url: '/hr-ops',
    icon: ShieldAlert,
    capability: 'view_hr_ops',
    keywords: ['hr operations', 'handover', 'graduation', 'verification', 'batch'],
  },
  {
    title: 'Exceptions Workbench',
    category: 'Operations',
    url: '/hr-ops/exceptions',
    icon: AlertOctagon,
    capability: 'view_hr_ops',
    keywords: ['exceptions', 'quarantine', 'velocity risk', 'stuck', 'sla', 'holds'],
  },
  {
    title: 'IT Hardware Queue',
    category: 'Operations',
    url: '/tasks/it-ops',
    icon: Laptop,
    capability: 'manage_it_ops',
    keywords: ['it hardware', 'laptop', 'provisioning', 'serial', 'asset tag', 'courier'],
  },

  // People & Teams
  {
    title: 'Team Operations',
    category: 'People & Teams',
    url: '/manager',
    icon: UserCheck,
    capability: 'view_team_ops',
    keywords: ['manager', 'direct reports', 'nudge', 'team', 'sign-off', 'supervision'],
  },
  {
    title: 'Employee Directory',
    category: 'People & Teams',
    url: '/directory',
    icon: Users,
    keywords: ['directory', 'employees', 'staff', 'team', 'people', 'invite', 'csv'],
  },
  {
    title: 'Buddy Program',
    category: 'People & Teams',
    url: '/buddy',
    icon: HeartHandshake,
    keywords: ['buddy', 'mentor', 'pairing', 'mentee', 'icebreaker', 'support'],
  },
  {
    title: '30/60/90 Milestones',
    category: 'People & Teams',
    url: '/milestones',
    icon: CalendarCheck,
    keywords: ['milestones', 'evaluation', '30 day', '60 day', '90 day', 'self rating', 'review'],
  },
  {
    title: 'Calendar & Meetings',
    category: 'People & Teams',
    url: '/calendar',
    icon: Calendar,
    keywords: ['calendar', 'meetings', 'schedule', '1-on-1', 'check-in', 'meet'],
  },

  // Learning & Content
  {
    title: 'Journey Templates',
    category: 'Learning & Content',
    url: '/journeys',
    icon: GraduationCap,
    keywords: ['journeys', 'curriculum', 'lms', 'modules', 'steps', 'courses', 'templates'],
  },
  {
    title: 'AI Course Builder',
    category: 'Learning & Content',
    url: '/ai-course-builder',
    icon: Wand2,
    capability: 'ai_course_builder',
    keywords: ['ai course builder', 'generate course', 'pdf', 'docx', 'quiz', 'curriculum'],
  },
  {
    title: 'Knowledge Base',
    category: 'Learning & Content',
    url: '/kb',
    icon: BookOpen,
    keywords: ['knowledge base', 'articles', 'handbook', 'policies', 'faq', 'docs', 'wiki'],
  },
  {
    title: 'Policy Slideshow',
    category: 'Learning & Content',
    url: '/kb/slideshow',
    icon: Tv,
    keywords: ['slideshow', 'tv', 'presentation', 'policies', 'kiosk'],
  },

  // Workplace & Tools
  {
    title: 'AI Assistant',
    category: 'Workplace & Tools',
    url: '/ai-assistant',
    icon: Bot,
    keywords: ['ai assistant', 'chatbot', 'help', 'questions', 'bot', 'gpt'],
  },
  {
    title: 'Office Map',
    category: 'Workplace & Tools',
    url: '/office-map',
    icon: MapPin,
    keywords: ['office map', 'floorplan', 'desks', 'rooms', 'amenities', 'cafeteria'],
  },
  {
    title: 'Leaderboard',
    category: 'Workplace & Tools',
    url: '/leaderboard',
    icon: Trophy,
    keywords: ['leaderboard', 'gamification', 'points', 'badges', 'ranks', 'achievements'],
  },
  {
    title: 'Kiosk Terminals',
    category: 'Workplace & Tools',
    url: '/kiosks',
    icon: Tv,
    capability: 'manage_organization',
    keywords: ['kiosks', 'frontline', 'sop', 'touch screen', 'pairing code', 'terminal'],
  },

  // System & Administration
  {
    title: 'Analytics & Reports',
    category: 'System & Administration',
    url: '/analytics',
    icon: BarChart2,
    capability: 'view_analytics',
    keywords: ['analytics', 'metrics', 'drop-off', 'velocity', 'cohorts', 'reports'],
  },
  {
    title: 'Workflows & Automation',
    category: 'System & Administration',
    url: '/workflows',
    icon: Workflow,
    capability: 'manage_workflows',
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
    keywords: ['sso', 'saml', 'oidc', 'identity', 'okta', 'azure ad', 'single sign-on'],
  },
  {
    title: 'HRIS Integrations',
    category: 'System & Administration',
    url: '/settings/integrations',
    icon: Workflow,
    capability: 'manage_integrations',
    keywords: ['hris', 'integrations', 'bamboohr', 'workday', 'marketplace', 'sync'],
  },

  // Platform Management
  {
    title: 'Platform Dashboard',
    category: 'Platform Management',
    url: '/super-admin',
    icon: LayoutDashboard,
    capability: 'view_super_admin',
    keywords: ['super admin', 'platform', 'tenants', 'health', 'system'],
  },
  {
    title: 'Organizations & Tenants',
    category: 'Platform Management',
    url: '/super-admin/organizations',
    icon: Users,
    capability: 'view_super_admin',
    keywords: ['tenants', 'workspaces', 'organizations', 'provision', 'plans'],
  },
  {
    title: 'Cross-Tenant Finance',
    category: 'Platform Management',
    url: '/super-admin/finance',
    icon: BarChart2,
    capability: 'view_super_admin',
    keywords: ['finance', 'billing', 'mrr', 'arr', 'revenue', 'invoices'],
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { role, can } = useRole();
  const { data: journeys = [] } = useJourneys();
  const { data: employeesRes } = useEmployees({ limit: 1000 });
  const employees = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.employees || []);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const allowedPages = pages.filter((p) => {
    if (p.capability && !can(p.capability)) return false;
    if (p.roles && !p.roles.includes(role)) return false;
    if (role === 'employee' && p.url === '/') return false;
    return true;
  });

  // Group allowed pages by category
  const categories = Array.from(new Set(allowedPages.map((p) => p.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="[&_[cmdk-input-wrapper]]:border-b flex-1 flex flex-col min-h-0">
          <CommandInput placeholder="Search pages, journeys, employees, or tools… (e.g. SSO, Milestones, IT)" />
          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            {categories.map((cat) => {
              const catPages = allowedPages.filter((p) => p.category === cat);
              return (
                <CommandGroup key={cat} heading={cat}>
                  {catPages.map((p) => (
                    <CommandItem
                      key={p.url}
                      value={`page ${p.title} ${p.category} ${p.keywords.join(' ')}`}
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

            {journeys.length > 0 && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Journeys & Curricula">
                  {journeys.map((j) => (
                    <CommandItem
                      key={j.id}
                      value={`journey ${j.title}`}
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

            {employees.length > 0 && (role !== 'employee' || can('manage_employees')) && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading="Employees & Team">
                  {employees.slice(0, 50).map((e) => (
                    <CommandItem
                      key={e.id}
                      value={`employee ${e.name} ${e.fullName || ''} ${e.department || ''} ${e.jobTitle || ''}`}
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