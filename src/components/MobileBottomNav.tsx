import { useNavigate, useLocation } from 'react-router-dom';
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
import { useSidebar } from './Sidebar';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useRole();
  const { toggleSidebar } = useSidebar();

  let navItems = [
    { title: 'Home', url: '/', icon: LayoutDashboard },
    { title: 'HR Ops', url: '/hr-ops', icon: ShieldAlert },
    { title: 'Directory', url: '/directory', icon: Users },
    { title: 'Tasks', url: '/tasks', icon: CheckSquare },
  ];

  if (role === 'employee') {
    navItems = [
      { title: 'Roadmap', url: '/employee', icon: LayoutDashboard },
      { title: 'Documents', url: '/documents', icon: FileText },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Journeys', url: '/journeys', icon: GraduationCap },
    ];
  } else if (role === 'manager') {
    navItems = [
      { title: 'Team Ops', url: '/manager', icon: UserCheck },
      { title: 'Milestones', url: '/milestones', icon: CalendarCheck },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Directory', url: '/directory', icon: Users },
    ];
  } else if (role === 'it_admin') {
    navItems = [
      { title: 'IT Queue', url: '/tasks/it-ops', icon: Laptop },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Directory', url: '/directory', icon: Users },
      { title: 'Integrations', url: '/settings/integrations', icon: Workflow },
    ];
  } else if (role === 'super_admin') {
    navItems = [
      { title: 'Platform', url: '/super-admin', icon: LayoutDashboard },
      { title: 'Workspaces', url: '/super-admin/organizations', icon: Users },
      { title: 'Finance', url: '/super-admin/finance', icon: BarChart2 },
    ];
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-2 py-1.5 flex justify-around items-center">
      {navItems.map((item) => {
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
        aria-label="Open Navigation Menu"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] mt-0.5">More</span>
      </button>
    </div>
  );
}

export default MobileBottomNav;
