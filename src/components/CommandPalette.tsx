import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator
} from
  './Command';
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
  Award
} from
  'lucide-react';
import { useJourneys } from '../hooks/useJourneys';
import { useEmployees } from '../hooks/useEmployees';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const pages = [
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
    title: 'Employee Directory',
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
  },
  {
    title: 'My Learning (Employee)',
    url: '/employee',
    icon: GraduationCap
  },
  {
    title: 'Certificates',
    url: '/certificates',
    icon: Award
  }];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { role } = useRole();
  const { data: journeys = [] } = useJourneys();
  const { data: employeesRes } = useEmployees({ limit: 1000 });
  const employees = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.employees || []);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  const allowedPages = pages.filter((p) => {
    if (role === 'employee') {
      return p.url === '/employee' || p.url === '/kb' || p.url === '/certificates';
    }
    return p.url !== '/employee' && p.url !== '/certificates';
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="[&_[cmdk-input-wrapper]]:border-b">
          <CommandInput placeholder="Search pages, journeys, employees…" />
          <CommandList>
            <CommandGroup heading="Navigate">
              {allowedPages.map((p) =>
                <CommandItem
                  key={p.url}
                  value={`page ${p.title}`}
                  onSelect={() => go(p.url)}>

                  <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{p.title}</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Journeys">
              {journeys.map((j) =>
                <CommandItem
                  key={j.id}
                  value={`journey ${j.title}`}
                  onSelect={() => go(role === 'admin' ? `/journeys/${j.id}` : `/course/${j.id}`)}>

                  <Map className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{j.title}</span>
                  <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                    {j.status}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {employees.map((e) =>
                <CommandItem
                  key={e.id}
                  value={`employee ${e.name} ${e.department}`}
                  onSelect={() => go(`/directory/${e.id}`)}>

                  <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{e.name}</span>
                  <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                    {e.department}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>);

}
/** Global Cmd/Ctrl+K listener that toggles the palette. */
export function useCommandPaletteHotkey(
  setOpen: (fn: (o: boolean) => boolean) => void) {
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