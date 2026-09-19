import React, { useState, Fragment, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar
} from './Sidebar';
import { EmployeeAvatar } from './EmployeeAvatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from
  './DropdownMenu';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator
} from
  './Breadcrumb';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  Search,
  Bell,
  BarChart2,
  GraduationCap,
  Award,
  Check,
  ChevronsUpDown,
  CheckSquare,
  Workflow,
  UserCheck,
  FileText,
  CalendarCheck,
  HeartHandshake,
  Calendar,
  ShieldAlert,
  AlertOctagon,
  Trophy,
  Bot,
  Wand2,
  KeyRound,
  MapPin,
  Tv,
  Laptop,
  Server,
  HardDrive,
  Activity,
  DollarSign,
  AlertTriangle,
  Layers,
  CreditCard,
  BarChart3,
  Clock,
  ToggleLeft,
  FileSpreadsheet
} from
  'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Toaster } from './Sonner';
import { useRole, Role } from '../context/RoleContext';
import { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useCurrentUser } from '../hooks/useAuth';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { useEmployeeDocumentInbox } from '../hooks/useDocuments';
import { useOnboardingExceptions } from '../hooks/useOnboardingExceptions';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead
} from '../hooks/useNotifications';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PWAInstallBanner } from './PWAInstallBanner';
import { MobileBottomNav } from './MobileBottomNav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './Dialog';

interface NavSubItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{
    className?: string;
  }>;
  badge?: string | number | null;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  badge?: string | number | null;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
  subItems?: NavSubItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const { t } = useTranslation('nav');

  const isEmployee = role === 'employee';
  const isAdminOrOwner = role === 'admin' || role === 'owner' || role === 'hr_admin';

  const { data: employeeDocInbox = [] } = useEmployeeDocumentInbox({ enabled: isEmployee });
  const pendingDocsCount = isEmployee
    ? (employeeDocInbox || []).filter((d: any) => d.status === 'pending').length
    : 0;

  const { data: exceptionsData } = useOnboardingExceptions(undefined, { enabled: isAdminOrOwner });
  const exceptionsCount = isAdminOrOwner
    ? (exceptionsData?.pagination?.total || exceptionsData?.data?.length || 0)
    : 0;

  // Semantic navigation sections by role
  const adminNavSections: NavSection[] = [
    {
      label: 'Overview & Operations',
      items: [
        { title: t('items.dashboard') || 'Dashboard', url: '/', icon: LayoutDashboard },
        {
          title: 'HR Operations',
          url: '/hr-ops',
          icon: ShieldAlert,
          subItems: [
            {
              title: 'Exceptions Workbench',
              url: '/hr-ops/exceptions',
              icon: AlertOctagon,
              badge: exceptionsCount > 0 ? exceptionsCount : null,
              badgeVariant: 'destructive',
            },
          ],
        },
        { title: 'Team Operations', url: '/manager', icon: UserCheck },
      ],
    },
    {
      label: 'People & Teams',
      items: [
        { title: 'Employee Directory', url: '/directory', icon: Users },
        { title: 'Buddy Program', url: '/buddy', icon: HeartHandshake },
        { title: '30/60/90 Milestones', url: '/milestones', icon: CalendarCheck },
      ],
    },
    {
      label: 'Learning & Content',
      items: [
        { title: t('items.myLearning') || 'Journey Templates', url: '/journeys', icon: GraduationCap },
        { title: 'AI Course Builder', url: '/ai-course-builder', icon: Wand2 },
        { title: t('items.knowledgeBase') || 'Knowledge Base', url: '/kb', icon: BookOpen },
      ],
    },
    {
      label: 'Operations & Compliance',
      items: [
        { title: 'Digital Documents', url: '/documents', icon: FileText },
        {
          title: 'Tasks & Checklists',
          url: '/tasks',
          icon: CheckSquare,
          subItems: [
            { title: 'IT Hardware Queue', url: '/tasks/it-ops', icon: Laptop },
          ],
        },
        { title: 'Calendar & Meetings', url: '/calendar', icon: Calendar },
        { title: 'Kiosk Terminals', url: '/kiosks', icon: Tv },
      ],
    },
    {
      label: 'System & Insights',
      items: [
        { title: t('items.analytics') || 'Analytics', url: '/analytics', icon: BarChart2 },
        { title: 'Workflows & Rules', url: '/workflows', icon: Workflow },
        { title: 'Office Map', url: '/office-map', icon: MapPin },
        { title: 'AI Assistant', url: '/ai-assistant', icon: Bot },
        { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
        {
          title: t('items.settings') || 'Settings',
          url: '/settings',
          icon: Settings,
          subItems: [
            { title: 'SSO & Identity', url: '/settings/sso', icon: KeyRound },
            { title: 'HRIS Integrations', url: '/settings/integrations', icon: Workflow },
          ],
        },
      ],
    },
  ];

  const managerNavSections: NavSection[] = [
    {
      label: 'Team Supervision',
      items: [
        { title: 'Team Operations', url: '/manager', icon: UserCheck },
        { title: '30/60/90 Milestones', url: '/milestones', icon: CalendarCheck },
        { title: 'Tasks & Verification', url: '/tasks', icon: CheckSquare },
      ],
    },
    {
      label: 'People & Mentorship',
      items: [
        { title: 'Employee Directory', url: '/directory', icon: Users },
        { title: 'Buddy Support', url: '/buddy', icon: HeartHandshake },
        { title: '1-on-1 Calendar', url: '/calendar', icon: Calendar },
      ],
    },
    {
      label: 'Insights & Tools',
      items: [
        { title: t('items.analytics') || 'Team Analytics', url: '/analytics', icon: BarChart2 },
        { title: t('items.knowledgeBase') || 'Knowledge Base', url: '/kb', icon: BookOpen },
        { title: 'Office Map', url: '/office-map', icon: MapPin },
        { title: 'AI Assistant', url: '/ai-assistant', icon: Bot },
      ],
    },
  ];

  const employeeNavSections: NavSection[] = [
    {
      label: 'My Onboarding',
      items: [
        { title: 'Onboarding Roadmap', url: '/employee', icon: LayoutDashboard },
        {
          title: 'Required Documents',
          url: '/documents',
          icon: FileText,
          badge: pendingDocsCount > 0 ? `${pendingDocsCount} pending` : null,
          badgeVariant: 'destructive',
        },
        { title: 'Checklist Tasks', url: '/tasks', icon: CheckSquare },
        { title: t('items.myLearning') || 'Learning Journeys', url: '/journeys', icon: GraduationCap },
      ],
    },
    {
      label: 'Support & Milestones',
      items: [
        { title: 'My Onboarding Buddy', url: '/buddy', icon: HeartHandshake },
        { title: '30/60/90 Goals', url: '/milestones', icon: CalendarCheck },
        { title: 'Schedule & Meetings', url: '/calendar', icon: Calendar },
      ],
    },
    {
      label: 'Workplace & Resources',
      items: [
        { title: t('items.knowledgeBase') || 'Knowledge Base', url: '/kb', icon: BookOpen },
        { title: 'AI Assistant', url: '/ai-assistant', icon: Bot },
        { title: t('items.certificates') || 'Certificates', url: '/certificates', icon: Award },
        { title: 'Office Map', url: '/office-map', icon: MapPin },
        { title: 'Leaderboard', url: '/leaderboard', icon: Trophy },
      ],
    },
  ];

  const itAdminNavSections: NavSection[] = [
    {
      label: 'Hardware & Provisioning',
      items: [
        { title: 'IT Hardware Queue', url: '/tasks/it-ops', icon: Laptop },
        { title: 'Tasks & Checklists', url: '/tasks', icon: CheckSquare },
      ],
    },
    {
      label: 'Systems & Directory',
      items: [
        { title: 'HRIS Integrations', url: '/settings/integrations', icon: Workflow },
        { title: 'Employee Directory', url: '/directory', icon: Users },
        { title: t('items.knowledgeBase') || 'Knowledge Base', url: '/kb', icon: BookOpen },
        { title: 'Office Map', url: '/office-map', icon: MapPin },
      ],
    },
  ];

  const superAdminNavSections: NavSection[] = [
    {
      label: 'Platform Control',
      items: [
        { title: t('items.superAdminDashboard') || 'Command Center', url: '/super-admin', icon: LayoutDashboard },
        { title: 'Alert Center', url: '/super-admin/alerts', icon: AlertTriangle },
      ],
    },
    {
      label: 'Tenants & Users',
      items: [
        { title: t('items.organizations') || 'Organizations', url: '/super-admin/organizations', icon: Users },
        {
          title: 'Users & Access',
          url: '/super-admin/users',
          icon: UserCheck,
          subItems: [
            { title: 'User Directory', url: '/super-admin/users', icon: Users },
            { title: 'Active Sessions', url: '/super-admin/users/sessions', icon: KeyRound },
          ],
        },
      ],
    },
    {
      label: 'Onboarding & Product',
      items: [
        { title: 'Onboarding Monitor', url: '/super-admin/onboarding', icon: GraduationCap },
        { title: 'Feature Adoption', url: '/super-admin/product/features', icon: BarChart2 },
        { title: 'Operations & Hardware', url: '/super-admin/tasks-ops', icon: CheckSquare },
      ],
    },
    {
      label: 'Platform Observability',
      items: [
        { title: 'Activity Explorer', url: '/super-admin/activity', icon: Clock },
        { title: 'API Observability', url: '/super-admin/observability/api', icon: Activity },
        { title: 'System Logs', url: '/super-admin/observability/logs', icon: FileText },
        { title: 'Infrastructure & DB', url: '/super-admin/observability/infrastructure', icon: Server },
        { title: 'AI Observability', url: '/super-admin/observability/ai', icon: Bot },
        { title: 'Storage & Media', url: '/super-admin/observability/storage', icon: HardDrive },
      ],
    },
    {
      label: 'Internal Finance',
      items: [
        {
          title: t('items.finance') || 'Finance & Billing',
          url: '/super-admin/finance',
          icon: DollarSign,
          subItems: [
            { title: 'Finance Overview', url: '/super-admin/finance', icon: DollarSign },
            { title: 'Invoices & Receivables', url: '/super-admin/finance/invoices', icon: FileSpreadsheet },
            { title: 'Payment Ledger', url: '/super-admin/finance/payments', icon: CreditCard },
            { title: 'Expense Tracker', url: '/super-admin/finance/expenses', icon: BarChart3 },
            { title: 'Customer Accounts', url: '/super-admin/finance/accounts', icon: Layers },
          ],
        },
      ],
    },
    {
      label: 'Audit & Governance',
      items: [
        { title: 'Audit & Security', url: '/super-admin/audit', icon: ShieldAlert },
        { title: 'Reporting Center', url: '/super-admin/reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Platform Settings',
      items: [
        { title: 'Feature Flags', url: '/super-admin/settings/flags', icon: ToggleLeft },
        { title: 'Platform Settings', url: '/super-admin/settings/platform', icon: Settings },
      ],
    },
  ];

  const anonymousNavSections: NavSection[] = [
    {
      label: 'Public Resources',
      items: [
        { title: 'Knowledge Base', url: '/kb', icon: BookOpen },
      ],
    },
  ];

  const labelByPath: Record<string, string> = {
    '': t('breadcrumb.dashboard') || 'Dashboard',
    'super-admin': t('breadcrumb.superAdmin') || 'Super Admin',
    organizations: t('breadcrumb.organizations') || 'Organizations',
    finance: t('breadcrumb.finance') || 'Finance & Billing',
    alerts: 'Alert Center',
    users: 'Users Directory',
    sessions: 'Active Sessions',
    onboarding: 'Onboarding Monitor',
    features: 'Feature Adoption',
    'tasks-ops': 'Operations & Hardware',
    activity: 'Activity Explorer',
    observability: 'Observability',
    api: 'API Observability',
    logs: 'System Logs',
    infrastructure: 'Infrastructure & DB',
    ai: 'AI Observability',
    storage: 'Storage & Media Assets',
    invoices: 'Invoicing & Receivables',
    payments: 'Payment Ledger',
    expenses: 'Expense Tracker',
    accounts: 'Customer Accounts',
    audit: 'Audit & Security',
    reports: 'Reporting Center',
    flags: 'Feature Flags',
    platform: 'Platform Settings',
    journeys: t('breadcrumb.journeys') || 'Journey Templates',
    directory: t('breadcrumb.directory') || 'Employee Directory',
    analytics: t('breadcrumb.analytics') || 'Analytics',
    kb: t('breadcrumb.kb') || 'Knowledge Base',
    'knowledge-base': 'Knowledge Base',
    slideshow: 'Policy Slideshow',
    settings: t('breadcrumb.settings') || 'Settings',
    sso: 'SSO & Identity',
    integrations: 'HRIS Integrations',
    employee: t('breadcrumb.employee') || 'Onboarding Roadmap',
    course: t('breadcrumb.course') || 'Course Player',
    certificates: t('breadcrumb.certificates') || 'Certificates',
    tasks: 'Tasks & Checklists',
    'it-ops': 'IT Hardware Queue',
    documents: 'Digital Documents',
    sign: 'E-Signature',
    milestones: '30/60/90 Milestones',
    workflows: 'Workflows & Rules',
    manager: 'Team Operations',
    buddy: 'Buddy Support',
    calendar: 'Calendar & Meetings',
    'hr-ops': 'HR Operations',
    exceptions: 'Exceptions & Holds',
    leaderboard: 'Leaderboard',
    'ai-assistant': 'AI Assistant',
    'ai-course-builder': 'AI Course Builder',
    'office-map': 'Office Map',
    kiosks: 'Kiosk Terminals',
    profile: 'Profile',
    me: 'My Profile',
  };
  const { setOpen, isMobile } = useSidebar();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  const handleNavClick = (url: string) => (e: React.MouseEvent) => {
    if (isMobile) {
      setOpen(false);
    }
    if ((window as any).isJourneyBuilderDirty) {
      e.preventDefault();
      setPendingNavAction(() => () => {
        (window as any).isJourneyBuilderDirty = false;
        navigate(url);
      });
    }
  };

  const handleSelectAction = (action: () => void) => (e?: any) => {
    if (isMobile) {
      setOpen(false);
    }
    if ((window as any).isJourneyBuilderDirty) {
      e?.preventDefault?.();
      setPendingNavAction(() => () => {
        (window as any).isJourneyBuilderDirty = false;
        action();
      });
    } else {
      action();
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success('Successfully logged out.');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      toast.error('Failed to log out.');
    }
  };
  useCommandPaletteHotkey(setPaletteOpen);
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const { data: settings } = useWorkspaceSettings();

  useEffect(() => {
    if (settings) {
      if (settings.orgName) {
        document.title = `${settings.orgName} - Talnova Onboarding`;
      }

      const primary = settings.primaryColor || '#4F46E5';
      document.documentElement.style.setProperty('--primary', primary);
      document.documentElement.style.setProperty('--sidebar-primary', primary);

      const getContrastColor = (hexColor: string): string => {
        if (!hexColor || !hexColor.startsWith('#')) return 'oklch(0.985 0 0)';
        const hex = hexColor.replace('#', '');
        if (hex.length !== 6) return 'oklch(0.985 0 0)';
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)';
      };

      const contrast = getContrastColor(primary);
      document.documentElement.style.setProperty('--primary-foreground', contrast);
      document.documentElement.style.setProperty('--sidebar-primary-foreground', contrast);
    } else {
      document.title = 'Talnova Onboarding';
      document.documentElement.style.setProperty('--primary', 'oklch(0.205 0 0)');
      document.documentElement.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)');
      document.documentElement.style.setProperty('--sidebar-primary', 'oklch(0.205 0 0)');
      document.documentElement.style.setProperty('--sidebar-primary-foreground', 'oklch(0.985 0 0)');
    }
  }, [settings]);

  const isAnonymousKb = location.pathname.startsWith('/kb') || location.pathname.startsWith('/knowledge-base');
  const hasToken = !!localStorage.getItem('auth_token');

  useEffect(() => {
    if (isAnonymousKb) return;
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate, location.pathname, isAnonymousKb]);

  useEffect(() => {
    if (isAnonymousKb) return;
    if (userError) {
      localStorage.removeItem('auth_token');
      navigate('/login');
    }
  }, [userError, navigate, location.pathname, isAnonymousKb]);

  const navSections = !hasToken
    ? anonymousNavSections
    : role === 'super_admin'
      ? superAdminNavSections
      : role === 'it_admin'
        ? itAdminNavSections
        : role === 'admin' || role === 'owner' || role === 'hr_admin'
          ? adminNavSections
          : role === 'manager'
            ? managerNavSections
            : employeeNavSections;
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbLabel = (seg: string) => labelByPath[seg] ?? titleCase(seg);
  const switchRole = (next: Role) => {
    const action = () => {
      setRole(next);
      if (next === 'super_admin') {
        navigate('/super-admin');
      } else if (next === 'it_admin') {
        navigate('/tasks/it-ops');
      } else {
        navigate(next === 'admin' ? '/' : '/employee');
      }
    };

    if ((window as any).isJourneyBuilderDirty) {
      setPendingNavAction(() => () => {
        (window as any).isJourneyBuilderDirty = false;
        action();
      });
    } else {
      action();
    }
  };
  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="bottom-right" />
      <PWAInstallBanner />
      <div className="flex min-h-screen w-full bg-background text-foreground pb-12 md:pb-0">
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-sidebar-accent transition-colors">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 rounded-md object-contain border p-0.5 bg-white shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
                      {settings?.orgName ? settings.orgName.charAt(0).toUpperCase() : 'T'}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold leading-tight">
                      {settings?.orgName || 'Talnova Onboarding'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Enterprise plan
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Check className="mr-2 h-4 w-4" /> {settings?.orgName || 'Talnova Onboarding'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>

          <SidebarContent>
            {navSections.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const hasSub = item.subItems && item.subItems.length > 0;
                      const isSelfActive =
                        item.url === '/' || item.url === '/employee'
                          ? location.pathname === item.url
                          : location.pathname === item.url || (item.url !== '/' && location.pathname.startsWith(item.url + '/'));
                      const isSubActive = !!hasSub && item.subItems!.some((sub) => location.pathname === sub.url || location.pathname.startsWith(sub.url + '/'));

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isSelfActive || isSubActive}
                            tooltip={item.title}>
                            <Link to={item.url} onClick={handleNavClick(item.url)} className="flex items-center w-full">
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate ml-2">{item.title}</span>
                              {item.badge !== undefined && item.badge !== null && (
                                <span
                                  className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    item.badgeVariant === 'destructive'
                                      ? 'bg-destructive/15 text-destructive dark:bg-destructive/30'
                                      : 'bg-primary/10 text-primary'
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>

                          {hasSub && (
                            <SidebarMenuSub>
                              {item.subItems!.map((sub) => {
                                const isThisSubActive = location.pathname === sub.url || location.pathname.startsWith(sub.url + '/');
                                return (
                                  <SidebarMenuSubItem key={sub.url}>
                                    <SidebarMenuSubButton asChild isActive={isThisSubActive}>
                                      <Link to={sub.url} onClick={handleNavClick(sub.url)} className="flex items-center w-full">
                                        {sub.icon && <sub.icon className="h-3.5 w-3.5 shrink-0 mr-1.5" />}
                                        <span className="flex-1 truncate">{sub.title}</span>
                                        {sub.badge !== undefined && sub.badge !== null && (
                                          <span
                                            className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                              sub.badgeVariant === 'destructive'
                                                ? 'bg-destructive/15 text-destructive dark:bg-destructive/30'
                                                : 'bg-primary/10 text-primary'
                                            }`}
                                          >
                                            {sub.badge}
                                          </span>
                                        )}
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3">
            {hasToken ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent transition-colors">
                    <EmployeeAvatar
                      src={user?.avatar}
                      name={user?.name}
                      email={user?.email}
                      userId={user?.id}
                      size="sm"
                      status="online"
                    />
                    <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-medium leading-tight">
                        {userLoading ? 'Loading...' : (user?.name || 'Jane Doe')}
                      </span>
                      <span className="truncate text-xs capitalize text-muted-foreground">
                        {role}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56">
                  <DropdownMenuLabel>{user?.email || 'jane@northwind.com'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSelectAction(() => navigate('/directory/me'))}>Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSelectAction(() => navigate('/settings'))}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSelectAction(handleLogout)}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2"
                variant="default"
              >
                Sign In
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger />
              <div className="hidden min-w-0 sm:block">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/" onClick={handleNavClick('/')}>Talnova Labs</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    {segments.length === 0 && role === 'admin' &&
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>Dashboard</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    }
                    {segments.map((seg, i) => {
                      const href = '/' + segments.slice(0, i + 1).join('/');
                      const isLast = i === segments.length - 1;
                      const label = /^\d+$/.test(seg) ?
                        `#${seg}` :
                        crumbLabel(seg);
                      return (
                        <Fragment key={href}>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            {isLast ?
                              <BreadcrumbPage>{label}</BreadcrumbPage> :

                              <BreadcrumbLink asChild>
                                <Link to={href} onClick={handleNavClick(href)}>{label}</Link>
                              </BreadcrumbLink>
                            }
                          </BreadcrumbItem>
                        </Fragment>);

                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex md:w-64 lg:w-72">

                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search…</span>
                <kbd className="pointer-events-none rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                  ⌘K
                </kbd>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search">

                <Search className="h-5 w-5" />
              </Button>

              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Role switcher */}
              {hasToken && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Badge
                        variant={role === 'super_admin' ? 'default' : role === 'admin' ? 'default' : 'secondary'}
                        className="px-1.5 capitalize">

                        {role === 'super_admin' ? 'Super Admin' : role}
                      </Badge>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>View as</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(user?.role === 'super_admin') && (
                      <DropdownMenuItem onSelect={() => switchRole('super_admin')}>
                        {role === 'super_admin' && <Check className="mr-2 h-4 w-4" />}
                        <span className={role === 'super_admin' ? '' : 'ml-6'}>
                          Super Admin
                        </span>
                      </DropdownMenuItem>
                    )}
                    {(user?.role === 'super_admin' || user?.role === 'admin') && (
                      <DropdownMenuItem onSelect={() => switchRole('admin')}>
                        {role === 'admin' && <Check className="mr-2 h-4 w-4" />}
                        <span className={role === 'admin' ? '' : 'ml-6'}>
                          Administrator
                        </span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => switchRole('employee')}>
                      {role === 'employee' && <Check className="mr-2 h-4 w-4" />}
                      <span className={role === 'employee' ? '' : 'ml-6'}>
                        Employee
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Notifications */}
              {hasToken && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative"
                      aria-label="Notifications">

                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Notifications</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{unreadCount} new</Badge>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markAllReadMutation.mutate()}
                            className="text-xs text-primary hover:underline font-normal">
                            Mark all read
                          </button>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">No notifications</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            onClick={() => {
                              if (!n.isRead) markReadMutation.mutate(n.id);
                              if (n.deepLink) navigate(n.deepLink);
                            }}
                            className={`flex flex-col items-start gap-1 py-2 px-3 cursor-pointer ${!n.isRead ? 'bg-muted/50 font-medium' : 'opacity-70'
                              }`}>
                            <div className="flex w-full items-center justify-between">
                              <span className="text-sm font-semibold leading-snug">{n.title}</span>
                              {!n.isRead && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {n.message}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">{n.createdAt}</span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Dialog open={!!pendingNavAction} onOpenChange={(open: boolean) => !open && setPendingNavAction(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            You have unsaved changes in the Journey Builder. If you leave, your changes will be lost. Are you sure you want to discard your changes and leave?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingNavAction(null)}>Stay</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const action = pendingNavAction;
                setPendingNavAction(null);
                if (action) {
                  action();
                }
              }}
            >
              Discard & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MobileBottomNav />
    </>
  );
}