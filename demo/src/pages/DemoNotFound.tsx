import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutDashboard, Sparkles, BookOpen, CheckSquare, Users } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Card, CardContent } from '../../../src/components/Card';
import { useDemoAuth } from '../context/DemoAuthContext';

export const DemoNotFound: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useDemoAuth();

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
      {/* Icon Badge */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5">
          <Compass className="h-10 w-10 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4 border border-border">
        <span>Talnova Interactive Demo</span>
        <span className="text-slate-400">•</span>
        <span className="text-amber-600 font-bold">Error 404</span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-3">
        Demo Page Not Found
      </h1>
      <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-8">
        The route you requested does not exist within the interactive demo environment or is not available for persona <span className="font-semibold text-foreground">{user?.fullName || 'Demo User'}</span>.
      </p>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
        <Button onClick={() => navigate('/demo')} className="gap-2 shadow-sm">
          <LayoutDashboard className="h-4 w-4" /> Return to Demo Dashboard
        </Button>
      </div>

      {/* Suggested Demo Sections */}
      <Card className="w-full border-border/60 bg-card/60 backdrop-blur-xs text-left">
        <CardContent className="p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Explore Interactive Demo Sections
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => navigate('/demo/journeys')}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all text-xs font-medium text-foreground text-left"
            >
              <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>Onboarding Journeys</span>
            </button>
            <button
              onClick={() => navigate('/demo/tasks')}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all text-xs font-medium text-foreground text-left"
            >
              <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Checklist Tasks</span>
            </button>
            <button
              onClick={() => navigate('/demo/directory')}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-all text-xs font-medium text-foreground text-left"
            >
              <Users className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Employee Directory</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoNotFound;
