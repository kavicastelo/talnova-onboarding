import { twMerge } from 'tailwind-merge';

function clsx(...args: any[]): string {
  let classes = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      if (arg.length) {
        const inner = clsx(...arg);
        if (inner) classes.push(inner);
      }
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if (arg[key]) {
          classes.push(key);
        }
      }
    }
  }
  return classes.join(' ');
}

export function cn(...inputs: any[]) {
  return twMerge(clsx(...inputs));
}
