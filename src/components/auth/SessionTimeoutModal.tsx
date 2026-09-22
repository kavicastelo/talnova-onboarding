import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../Dialog';
import { Button } from '../Button';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  open: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  open,
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutModalProps) {
  // Format MM:SS
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${mins > 0 ? `${mins}:` : ''}${secs < 10 ? '0' : ''}${secs}`;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        closeOnBackdrop={false}
        className="sm:max-w-md border-amber-500/30 dark:border-amber-500/20 shadow-2xl"
      >
        <DialogHeader className="p-5 pb-3 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Session Inactivity Warning
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Your session is about to expire due to prolonged inactivity.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="p-5 sm:p-6 space-y-4 text-center">
          <div className="py-2 flex flex-col items-center justify-center">
            {/* Countdown Badge */}
            <div className="relative flex items-center justify-center">
              <div className="h-20 w-20 rounded-full border-4 border-amber-500/20 flex items-center justify-center bg-amber-500/5">
                <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                  {timeFormatted}
                </span>
              </div>
              <Clock className="absolute -bottom-1 -right-1 h-6 w-6 text-amber-500 bg-background rounded-full p-0.5 border border-border" />
            </div>

            <p className="text-xs text-muted-foreground mt-4 max-w-xs leading-relaxed">
              To protect your organization's confidential HR and employee data, inactive sessions are automatically logged out.
            </p>
          </div>
        </DialogBody>

        <DialogFooter className="p-4 sm:px-6 bg-muted/40 flex flex-col-reverse sm:flex-row gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out Now
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onStayLoggedIn}
            className="w-full sm:w-auto text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
