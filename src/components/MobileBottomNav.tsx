import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  GraduationCap,
  CheckSquare,
  FileText,
  Users,
  CalendarCheck,
  ShieldAlert,
  UserCheck,
  Laptop,
  Workflow,
  BarChart2,
  Menu
} from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { Capability } from '../utils/rbac';
import { useSidebar } from './Sidebar';

export interface MobileNavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  featureFlag?: string;
  capability?: Capability;
}

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, can, hasFeature } = useRole();
  const { toggleSidebar } = useSidebar();
  const { t } = useTranslation(['nav', 'common']);

  let navItems: MobileNavItem[] = [
    { title: 'Home', url: '/', icon: LayoutDashboard },
    { title: 'HR Ops', url: '/hr-ops', icon: ShieldAlert, capability: 'view_hr_ops' },
    { title: 'Directory', url: '/directory', icon: Users },
    { title: 'Tasks', url: '/tasks', icon: CheckSquare },
  ];

  if (role === 'employee') {
    navItems = [
      { title: 'Roadmap', url: '/employee', icon: LayoutDashboard },
      { title: 'Documents', url: '/documents', icon: FileText, featureFlag: 'digital_signatures' },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Journeys', url: '/journeys', icon: GraduationCap },
    ];
  } else if (role === 'manager') {
    navItems = [
      { title: 'Team Ops', url: '/manager', icon: UserCheck, capability: 'view_team_ops' },
      { title: 'Milestones', url: '/milestones', icon: CalendarCheck },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Directory', url: '/directory', icon: Users },
    ];
  } else if (role === 'it_admin') {
    navItems = [
      { title: 'IT Queue', url: '/tasks/it-ops', icon: Laptop, capability: 'manage_it_ops' },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Directory', url: '/directory', icon: Users },
      { title: 'Integrations', url: '/settings/integrations', icon: Workflow, capability: 'manage_integrations', featureFlag: 'advanced_hris_sync' },
    ];
  } else if (role === 'super_admin') {
    navItems = [
      { title: 'Platform', url: '/super-admin', icon: LayoutDashboard },
      { title: 'Workspaces', url: '/super-admin/organizations', icon: Users },
      { title: 'Finance', url: '/super-admin/finance', icon: BarChart2 },
    ];
  }

  const filteredNavItems = navItems.filter((item) => {
    if (item.capability && !can(item.capability)) return false;
    if (item.featureFlag && !hasFeature(item.featureFlag)) return false;
    return true;
  });

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-2 py-1.5 flex justify-around items-center">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.url;
        return (
          <button
            key={item.title}
            onClick={() => navigate(item.url)}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">{item.title}</span>
          </button>
        );
      })}

      <button
        onClick={toggleSidebar}
        className="flex flex-col items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t('nav:openNavMenu', 'Open Navigation Menu')}
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] mt-0.5">{t('nav:more', 'More')}</span>
      </button>
    </div>
  );
}

export default MobileBottomNav;
