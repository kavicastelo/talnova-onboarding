import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, LayoutDashboard, RefreshCw } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Card, CardContent } from '../../../src/components/Card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class DemoErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DemoErrorBoundary] Caught runtime error in demo component:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReturnToDashboard = () => {
    window.location.href = '/demo';
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('talnova_demo_token');
      localStorage.removeItem('talnova_demo_user');
      localStorage.removeItem('talnova_demo_tenant');
      localStorage.removeItem('talnova_demo_watermark');
      localStorage.removeItem('talnova_demo_role');
      localStorage.removeItem('talnova_demo_roles');
    } catch {
      // ignore
    }
    window.location.href = '/demo/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5 mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-4 border border-amber-200 dark:border-amber-900/50">
            <span>Demo Error Shield</span>
            <span className="text-amber-400">•</span>
            <span className="font-bold">Safe Recovery</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Something went wrong in this demo view
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            The demo environment intercepted a runtime exception without crashing your session or redirecting to production.
          </p>

          {this.state.error?.message && (
            <Card className="w-full bg-muted/40 border-border/60 text-left mb-6 font-mono text-xs">
              <CardContent className="p-3 text-destructive overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Reload View
            </Button>
            <Button onClick={this.handleReturnToDashboard} className="gap-2 shadow-sm">
              <LayoutDashboard className="h-4 w-4" /> Return to Dashboard
            </Button>
            <Button variant="ghost" onClick={this.handleResetCache} className="gap-2 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" /> Reset Demo Session
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DemoErrorBoundary;
