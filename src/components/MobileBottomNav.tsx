import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  CheckSquare,
  BookOpen,
  Bot
} from 'lucide-react';
import { useRole } from '../context/RoleContext';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useRole();

  const isEmployee = role === 'employee';

  const navItems = [
    {
      title: 'Home',
      url: isEmployee ? '/employee' : '/',
      icon: LayoutDashboard,
    },
    {
      title: 'Journeys',
      url: '/journeys',
      icon: GraduationCap,
    },
    {
      title: 'Tasks',
      url: '/tasks',
      icon: CheckSquare,
    },
    {
      title: 'Knowledge',
      url: '/knowledge-base',
      icon: BookOpen,
    },
    {
      title: 'AI Helper',
      url: '/ai-assistant',
      icon: Bot,
    },
  ];

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
                ? 'text-indigo-600 font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">{item.title}</span>
          </button>
        );
      })}
    </div>
  );
}

export default MobileBottomNav;
