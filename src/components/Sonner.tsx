import * as React from 'react';
import { Toaster as SonnerToaster } from 'sonner';

export interface SonnerProps extends React.ComponentProps<typeof SonnerToaster> {}

export const Sonner = ({ theme = 'light', ...props }: SonnerProps) => (
  <SonnerToaster
    theme={theme}
    className="toaster group"
    style={{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    } as React.CSSProperties}
    toastOptions={{ classNames: { toast: 'cn-toast' } }}
    {...props}
  />
);

// Toaster is an alias for Sonner
export const Toaster = Sonner;
