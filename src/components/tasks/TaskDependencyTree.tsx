import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Lock,
  Unlock
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip';

export interface ITaskPrerequisite {
  taskId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'verified' | 'cancelled';
  isMandatory?: boolean;
}

interface TaskDependencyTreeProps {
  prerequisites?: ITaskPrerequisite[];
  isLocked?: boolean;
  lockReason?: string;
}

export const TaskDependencyTree: React.FC<TaskDependencyTreeProps> = ({
  prerequisites = [],
  isLocked = false,
  lockReason,
}) => {
  const { t } = useTranslation(['tasks', 'common']);

  if (prerequisites.length === 0 && !isLocked) {
    return null;
  }

  const allCompleted = prerequisites.every(
    (p) => p.status === 'completed' || p.status === 'verified'
  );

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 text-xs">
        {isLocked || !allCompleted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-help">
                <Lock className="h-3 w-3 shrink-0" />
                <span>{t('dependencies.prerequisiteLocked', { defaultValue: 'Prerequisite Locked' })}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1.5 p-2.5">
              <p className="font-semibold text-amber-500 flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                {t('dependencies.blockedBy', { defaultValue: 'Blocked by Dependent Action' })}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {lockReason || t('dependencies.defaultLockReason', { defaultValue: 'This task unlocks automatically once preceding items are verified.' })}
              </p>
              {prerequisites.length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-border space-y-1">
                  {prerequisites.map((p) => {
                    const isDone = p.status === 'completed' || p.status === 'verified';
                    return (
                      <div
                        key={p.taskId}
                        className="flex items-center justify-between gap-2 text-[10px]"
                      >
                        <span className="truncate text-foreground">{p.title}</span>
                        <span
                          className={`font-mono text-[9px] px-1 py-0.2 rounded ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Unlock className="h-3 w-3" />
                <span>{t('dependencies.prerequisitesMet', { defaultValue: 'Prerequisites Met' })}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {t('dependencies.allMetTooltip', { defaultValue: 'All preceding dependencies have been completed and verified.' })}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
