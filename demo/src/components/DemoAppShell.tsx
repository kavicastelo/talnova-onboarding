import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useDemoAuth } from '../context/DemoAuthContext';
import { useRole } from '../../../src/context/RoleContext';
import { DemoWatermark } from './DemoWatermark';
import { DemoRestrictedModal } from './DemoRestrictedModal';
import { useDemoTelemetry } from '../hooks/useDemoTelemetry';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
} from '../../../src/components/Sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../../src/components/Breadcrumb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../../src/components/DropdownMenu';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  Search,
  Bell,
  BarChart2,
  Award,
  CheckSquare,
  FileText,
  Calendar,
  ShieldAlert,
  Trophy,
  Bot,
  Sparkles,
  Mail,
  RotateCcw,
  LogOut,
  ChevronsUpDown,
  Lock,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { toast } from 'sonner';

const DEMO_PERSONAS = [
  {
    email: 'sarah.connor@acme-demo.com',
    fullName: 'Sarah Connor',
    role: 'Admin',
    company: 'Acme Corp',
    package: 'FULL_SUITE',
    title: 'VP of People Operations',
  },
  {
    email: 'john.doe@acme-demo.com',
    fullName: 'John Doe',
    role: 'Employee',
    company: 'Acme Corp',
    package: 'FULL_SUITE',
    title: 'Senior Frontend Engineer',
  },
  {
    email: 'alice.smith@acme-demo.com',
    fullName: 'Alice Smith',
    role: 'Manager',
    company: 'Acme Corp',
    package: 'FULL_SUITE',
    title: 'Engineering Manager',
  },
  {
    email: 'bob.vance@globex-demo.com',
    fullName: 'Bob Vance',
    role: 'Standard Admin',
    company: 'Globex Industries',
    package: 'STANDARD',
    title: 'Director of Business Dev',
  },
];

export const DemoAppShell: React.FC = () => {
  const { user, tenant, watermark, logout, login, restrictedModalFeature, setRestrictedModalFeature } = useDemoAuth();
  const { setRole, setRoles } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackFeature } = useDemoTelemetry();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1';

  const isFeatureAllowed = (featureKey?: string): boolean => {
    if (!featureKey) return true;
    if (!tenant?.allowedFeatures) return true;
    return tenant.allowedFeatures.includes(featureKey);
  };

  const handleNavClick = (e: React.MouseEvent, item: { title: string; url: string; featureFlag?: string }) => {
    if (item.featureFlag && !isFeatureAllowed(item.featureFlag)) {
      e.preventDefault();
      trackFeature(item.featureFlag, 'click', 'RESTRICTED', 0, { itemTitle: item.title });
      setRestrictedModalFeature(item.title);
      return;
    }
    trackFeature(item.featureFlag || item.title, 'click', 'ALLOWED', 0);
  };

  const handleSwitchPersona = async (persona: (typeof DEMO_PERSONAS)[0]) => {
    try {
      await login(persona.email, 'DemoPass123!');
      const roleStr = (persona.role || '').toLowerCase();
      const targetRole = roleStr.includes('admin')
        ? 'admin'
        : roleStr.includes('manager')
        ? 'manager'
        : 'employee';
      setRole(targetRole);
      setRoles([targetRole]);
      toast.success(`Switched persona to ${persona.fullName} (${persona.company})`);
      navigate('/demo');
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`${API_BASE}/super-admin/demo/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: 'RESET DEMO' }),
      });
      if (res.ok) {
        toast.success('Demo environment restored to baseline');
        setResetDialogOpen(false);
        window.location.reload();
      } else {
        toast.error('Failed to trigger reset');
      }
    } catch {
      toast.error('Network error during reset');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out of demo session');
    navigate('/demo/login');
  };

  const demoNavSections = [
    {
      label: 'Overview & Operations',
      items: [
        { title: 'Dashboard', url: '/demo', icon: LayoutDashboard },
        { title: 'HR Operations', url: '/demo/hr-ops', icon: ShieldAlert, featureFlag: 'hr_operations' },
      ],
    },
    {
      label: 'People & Journeys',
      items: [
        { title: 'Journeys', url: '/demo/journeys', icon: BookOpen, featureFlag: 'journey_templates' },
        { title: 'Tasks', url: '/demo/tasks', icon: CheckSquare, featureFlag: 'checklist_tasks' },
        { title: 'Employee Directory', url: '/demo/directory', icon: Users, featureFlag: 'employee_directory' },
        { title: 'Buddy Program', url: '/demo/buddy', icon: Users, featureFlag: 'buddy_connection' },
        { title: 'Calendar', url: '/demo/calendar', icon: Calendar, featureFlag: 'calendar_integration' },
      ],
    },
    {
      label: 'Knowledge & Documents',
      items: [
        { title: 'Knowledge Base', url: '/demo/kb', icon: BookOpen, featureFlag: 'knowledge_base' },
        { title: 'Documents & E-Sign', url: '/demo/documents', icon: FileText, featureFlag: 'digital_signatures' },
        { title: 'Milestones & Badges', url: '/demo/milestones', icon: Award, featureFlag: 'milestone_ratings' },
        { title: 'Leaderboard', url: '/demo/leaderboard', icon: Trophy, featureFlag: 'gamified_milestones' },
      ],
    },
    {
      label: 'Intelligence & Settings',
      items: [
        { title: 'Analytics', url: '/demo/analytics', icon: BarChart2, featureFlag: 'analytics_dashboard' },
        { title: 'AI Assistant', url: '/demo/ai-assistant', icon: Bot, featureFlag: 'ai_assistant' },
        { title: 'Settings', url: '/demo/settings', icon: Settings },
        { title: 'Email Sink (Sandbox)', url: '/demo/inbox', icon: Mail },
      ],
    },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased font-sans relative">
        {/* Repeating Canvas Watermark */}
        <DemoWatermark watermarkText={watermark?.text} />

        {/* Real Product Sidebar */}
        <Sidebar>
          <SidebarHeader className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
            <Link to="/demo" className="flex items-center gap-2.5 font-bold text-base tracking-tight">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 leading-none">TALNOVA</span>
                <span className="text-[10px] text-amber-600 font-semibold tracking-wider uppercase mt-0.5">
                  Interactive Demo
                </span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3 space-y-6">
            {demoNavSections.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.url === '/demo'
                          ? location.pathname === '/demo' || location.pathname === '/demo/'
                          : location.pathname.startsWith(item.url);
                      const isLocked = item.featureFlag && !isFeatureAllowed(item.featureFlag);

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`flex items-center justify-between text-sm py-2 px-2.5 rounded-md transition-colors ${
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                            }`}
                          >
                            <Link to={item.url} onClick={(e) => handleNavClick(e, item)}>
                              <div className="flex items-center gap-2.5">
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{item.title}</span>
                              </div>
                              {isLocked ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50 gap-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  Pro
                                </Badge>
                              ) : null}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-border/50 p-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>{tenant?.name || 'Demo Tenant'}</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-tight">
                Package: <strong>{tenant?.entitlementPackage || 'Full Suite'}</strong>
              </p>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Demo Bar */}
          <div className="bg-slate-900 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs z-30">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                DEMO ENVIRONMENT
              </span>
              <span className="text-slate-400 hidden sm:inline">|</span>
              <span className="text-slate-300">
                Active Tenant: <strong className="text-white">{tenant?.name}</strong> ({tenant?.entitlementPackage})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Persona Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                    <span>Persona: <strong>{user?.fullName}</strong></span>
                    <ChevronsUpDown className="w-3 h-3 ml-1.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Switch Demo Persona</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {DEMO_PERSONAS.map((p) => (
                    <DropdownMenuItem
                      key={p.email}
                      onClick={() => handleSwitchPersona(p)}
                      className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-xs text-slate-900">{p.fullName}</span>
                        {user?.email === p.email ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                      </div>
                      <span className="text-[11px] text-slate-500">{p.title} · {p.company}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Email Sink Quick Link */}
              <Link to="/demo/inbox">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800">
                  <Mail className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Email Sink
                </Button>
              </Link>

              {/* Reset Demo Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setResetDialogOpen(true)}
                className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>

              {/* Exit Demo */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="h-7 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-950/50"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Exit
              </Button>
            </div>
          </div>

          {/* Top Application Header (Real Product UX) */}
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md px-6 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/demo">Demo Portal</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="capitalize">
                      {location.pathname.replace(/^\/demo\/?/, '') || 'Dashboard'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search demo features..."
                  className="h-9 w-60 rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <Link to="/demo/inbox" className="p-2 rounded-md text-muted-foreground hover:text-foreground relative">
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5" />
              </Link>
            </div>
          </header>

          {/* Page Outlet */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 relative">
            <Outlet />
          </main>
        </div>

        {/* Guided Feature Modal when a restricted feature is clicked */}
        {restrictedModalFeature && (
          <DemoRestrictedModal
            isOpen={!!restrictedModalFeature}
            featureName={restrictedModalFeature}
            onClose={() => setRestrictedModalFeature(null)}
          />
        )}

        {/* Reset Confirmation Dialog */}
        {resetDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Reset Demo Environment?</h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                This will wipe customized demo tasks, reset documents to unsigned state, clear demo emails, and re-seed the standard baseline. Production data is completely isolated and unaffected.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(false)} disabled={isResetting}>
                  Cancel
                </Button>
                <Button size="sm" variant="destructive" onClick={handleExecuteReset} disabled={isResetting}>
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
};

export default DemoAppShell;
