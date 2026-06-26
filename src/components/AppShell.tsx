import React, { useState, Fragment } from 'react';
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
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter
} from
  './Sidebar';
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
  ChevronsUpDown
} from
  'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Toaster } from './Sonner';
import { useRole, Role } from '../context/RoleContext';
import { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';
import { useCurrentUser } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useSettings';
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}
const adminNav: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard
  },
  {
    title: 'Onboarding Journeys',
    url: '/journeys',
    icon: Map
  },
  {
    title: 'Employees',
    url: '/directory',
    icon: Users
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: BarChart2
  },
  {
    title: 'Knowledge Base',
    url: '/kb',
    icon: BookOpen
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings
  }];

const employeeNav: NavItem[] = [
  {
    title: 'Home',
    url: '/employee',
    icon: LayoutDashboard
  },
  {
    title: 'My Learning',
    url: '/journeys',
    icon: GraduationCap
  },
  {
    title: 'Knowledge Base',
    url: '/kb',
    icon: BookOpen
  },
  {
    title: 'Certificates',
    url: '/employee',
    icon: Award
  }];

const labelByPath: Record<string, string> = {
  '': 'Dashboard',
  journeys: 'Onboarding Journeys',
  directory: 'Employees',
  analytics: 'Analytics',
  kb: 'Knowledge Base',
  settings: 'Settings',
  employee: 'Home',
  course: 'Course'
};
function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(setPaletteOpen);
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: notifications = [] } = useNotifications();
  const navItems = role === 'admin' ? adminNav : employeeNav;
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbLabel = (seg: string) => labelByPath[seg] ?? titleCase(seg);
  const switchRole = (next: Role) => {
    setRole(next);
    navigate(next === 'admin' ? '/' : '/employee');
  };
  return (
    <SidebarProvider>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="bottom-right" />
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-sidebar-accent transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
                    N
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold leading-tight">
                      Northwind Labs
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
                  <Check className="mr-2 h-4 w-4" /> Northwind Labs
                </DropdownMenuItem>
                <DropdownMenuItem className="text-muted-foreground">
                  Northwind EU
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Create workspace</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                {role === 'admin' ? 'Workspace' : 'Learning'}
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

                          <Link to={item.url}>
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.email || 'jane@northwind.com'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                        <Link to="/">Northwind Labs</Link>
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
                                <Link to={href}>{label}</Link>
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

              {/* Role switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Badge
                      variant={role === 'admin' ? 'default' : 'secondary'}
                      className="px-1.5 capitalize">

                      {role}
                    </Badge>
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>View as</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => switchRole('admin')}>
                    {role === 'admin' && <Check className="mr-2 h-4 w-4" />}
                    <span className={role === 'admin' ? '' : 'ml-6'}>
                      Administrator
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => switchRole('employee')}>
                    {role === 'employee' && <Check className="mr-2 h-4 w-4" />}
                    <span className={role === 'employee' ? '' : 'ml-6'}>
                      Employee
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label="Notifications">

                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Notifications
                    <Badge variant="secondary">{notifications.length} new</Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No new notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex flex-col items-start gap-0.5 py-2">
                        <span className="text-sm leading-snug">{n.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {n.subtitle}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-sm text-muted-foreground">
                    View all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>);

}