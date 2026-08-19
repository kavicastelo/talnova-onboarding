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
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar
} from './Sidebar';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
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
  Map,
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
  Tv,
  CheckSquare,
  Workflow,
  UserCheck,
  FileText,
  CalendarCheck,
  HeartHandshake,
  Calendar
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
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead
} from '../hooks/useNotifications';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './Dialog';
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const { t } = useTranslation('nav');

  // Nav arrays computed inside component so they re-render on language change
  const adminNav: NavItem[] = [
    { title: t('items.dashboard'), url: '/', icon: LayoutDashboard },
    { title: 'Team Operations', url: '/manager', icon: UserCheck },
    { title: t('items.journeys'), url: '/journeys', icon: Map },
    { title: 'Tasks & Checklists', url: '/tasks', icon: CheckSquare },
    { title: 'Digital Documents', url: '/documents', icon: FileText },
    { title: '30/60/90 Milestones', url: '/milestones', icon: CalendarCheck },
    { title: 'Buddy Support', url: '/buddy', icon: HeartHandshake },
    { title: 'Calendar & Meetings', url: '/calendar', icon: Calendar },
    { title: 'Workflows', url: '/workflows', icon: Workflow },
    { title: 'Kiosk Dashboard', url: '/kiosks', icon: Tv },
    { title: t('items.employees'), url: '/directory', icon: Users },
    { title: t('items.analytics'), url: '/analytics', icon: BarChart2 },
    { title: t('items.knowledgeBase'), url: '/kb', icon: BookOpen },
    { title: t('items.settings'), url: '/settings', icon: Settings },
  ];

  const employeeNav: NavItem[] = [
    { title: t('items.home'), url: '/employee', icon: LayoutDashboard },
    { title: t('items.myLearning'), url: '/journeys', icon: GraduationCap },
    { title: 'Tasks & Checklists', url: '/tasks', icon: CheckSquare },
    { title: 'Digital Documents', url: '/documents', icon: FileText },
    { title: '30/60/90 Milestones', url: '/milestones', icon: CalendarCheck },
    { title: 'Buddy Support', url: '/buddy', icon: HeartHandshake },
    { title: 'Calendar & Meetings', url: '/calendar', icon: Calendar },
    { title: t('items.knowledgeBase'), url: '/kb', icon: BookOpen },
    { title: t('items.certificates'), url: '/certificates', icon: Award },
  ];

  const superAdminNav: NavItem[] = [
    { title: t('items.superAdminDashboard'), url: '/super-admin', icon: LayoutDashboard },
    { title: t('items.organizations'), url: '/super-admin/organizations', icon: Users },
    { title: t('items.finance'), url: '/super-admin/finance', icon: BarChart2 },
  ];

  const labelByPath: Record<string, string> = {
    '': t('breadcrumb.dashboard'),
    'super-admin': t('breadcrumb.superAdmin'),
    organizations: t('breadcrumb.organizations'),
    finance: t('breadcrumb.finance'),
    journeys: t('breadcrumb.journeys'),
    directory: t('breadcrumb.directory'),
    analytics: t('breadcrumb.analytics'),
    kb: t('breadcrumb.kb'),
    settings: t('breadcrumb.settings'),
    employee: t('breadcrumb.employee'),
    course: t('breadcrumb.course'),
    certificates: t('breadcrumb.certificates'),
    tasks: 'Tasks & Checklists',
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

  const navItems = !hasToken
    ? [{ title: 'Knowledge Base', url: '/kb', icon: BookOpen }]
    : role === 'super_admin' ? superAdminNav : role === 'admin' ? adminNav : employeeNav;
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbLabel = (seg: string) => labelByPath[seg] ?? titleCase(seg);
  const switchRole = (next: Role) => {
    const action = () => {
      setRole(next);
      if (next === 'super_admin') {
        navigate('/super-admin');
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
      <div className="flex min-h-screen w-full bg-background text-foreground">
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
            <SidebarGroup>
              <SidebarGroupLabel>
                {role === 'super_admin' ? 'Platform Management' : role === 'admin' ? 'Workspace' : 'Learning'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive =
                      item.url === '/' || item.url === '/employee' ?
                        location.pathname === item.url :
                        location.pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}>

                          <Link to={item.url} onClick={handleNavClick(item.url)}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>);

                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3">
            {hasToken ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent transition-colors">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatar || ''} />
                      <AvatarFallback>
                        {user?.name
                          ? user.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                          : 'JD'}
                      </AvatarFallback>
                    </Avatar>
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
                        <Link to="/" onClick={handleNavClick('/')}>Northwind Labs</Link>
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
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
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
                            className={`flex flex-col items-start gap-1 py-2 px-3 cursor-pointer ${
                              !n.isRead ? 'bg-muted/50 font-medium' : 'opacity-70'
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
    </>);

}