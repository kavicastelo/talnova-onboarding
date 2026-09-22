import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Input } from '../Input';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  Edit2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { IRoleChecklistTemplate } from '../../services/task-template.service';
import { useTaskTemplates, useDeleteTaskTemplate } from '../../hooks/useTaskTemplates';
import { RoleChecklistEditorModal } from './RoleChecklistEditorModal';
import { ApplyChecklistModal } from './ApplyChecklistModal';
import { useRole } from '../../context/RoleContext';

export const RoleChecklistManager: React.FC = () => {
  const { t } = useTranslation(['tasks', 'common']);
  const { can } = useRole();
  const canManage = can('create_task_template') || can('manage_organization');

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<IRoleChecklistTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<IRoleChecklistTemplate | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  const { data: templates = [], isLoading, refetch } = useTaskTemplates();
  const deleteMutation = useDeleteTaskTemplate();

  const filteredTemplates = templates.filter((tmpl) => {
    const matchesSearch =
      tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tmpl.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tmpl.audience?.departmentNames || []).some((d) => d.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole =
      roleFilter === 'all' || (tmpl.audience?.roles || []).includes(roleFilter as any);

    return matchesSearch && matchesRole;
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (tmpl: IRoleChecklistTemplate) => {
    setEditingTemplate(tmpl);
    setIsEditorOpen(true);
  };

  const handleOpenApply = (tmpl: IRoleChecklistTemplate) => {
    setApplyingTemplate(tmpl);
    setIsApplyModalOpen(true);
  };

  const handleDelete = (tmpl: IRoleChecklistTemplate) => {
    if (window.confirm(t('checklistManager.confirmArchive', { title: tmpl.title, defaultValue: `Are you sure you want to archive "${tmpl.title}"?` }))) {
      deleteMutation.mutate(tmpl._id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" /> {t('checklistManager.title', { defaultValue: 'Role-Based Checklist Templates' })}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('checklistManager.desc', { defaultValue: 'Configure automated onboarding task lists and default checklists with relative deadlines (now() + N days) tied to new hire roles.' })}
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4" /> {t('checklistManager.newTemplateBtn', { defaultValue: 'New Checklist Template' })}
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('checklistManager.searchPlaceholder', { defaultValue: 'Search templates, departments...' })}
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1">
          {['all', 'employee', 'manager', 'admin', 'hr_admin'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? t('checklistManager.allRoles', { defaultValue: 'All Roles' }) : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Template Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          {t('checklistManager.loading', { defaultValue: 'Loading checklist templates...' })}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-2 border-dashed p-10 text-center space-y-3">
          <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <div>
            <h4 className="font-bold text-sm text-foreground">
              {t('checklistManager.emptyTitle', { defaultValue: 'No Checklist Templates Found' })}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {t('checklistManager.emptyDesc', { defaultValue: 'Create reusable checklists tailored to specific departments and roles to automate task provisioning for incoming hires.' })}
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={handleOpenCreate} className="text-xs gap-1.5 bg-indigo-600 text-white">
              <Plus className="h-4 w-4" /> {t('checklistManager.createFirstBtn', { defaultValue: 'Create First Template' })}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tmpl) => (
            <Card
              key={tmpl._id}
              className="border shadow-xs hover:border-indigo-500/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3 border-b bg-muted/10">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-bold leading-snug line-clamp-2">
                    {tmpl.title}
                  </CardTitle>
                  {tmpl.audience?.autoAssignNewHires && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 shrink-0 gap-1"
                    >
                      <Sparkles className="h-2.5 w-2.5" /> {t('checklistManager.autoAssignBadge', { defaultValue: 'Auto-Assign' })}
                    </Badge>
                  )}
                </div>
                {tmpl.description && (
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {tmpl.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-3 flex-1">
                {/* Audience Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {t('checklistManager.targetAudience', { defaultValue: 'Target Audience:' })}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(tmpl.audience?.roles || []).map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px] font-medium uppercase">
                        {r.replace('_', ' ')}
                      </Badge>
                    ))}
                    {(tmpl.audience?.departmentNames || []).map((d) => (
                      <Badge key={d} variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Items Summary */}
                <div className="p-2.5 rounded-lg border bg-background/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {t('checklistManager.checklistItemsCount', { count: tmpl.items?.length || 0, defaultValue: `${tmpl.items?.length || 0} checklist items` })}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3 text-indigo-600" />
                      {t('checklistManager.daySpan', { days: Math.max(...(tmpl.items?.map((i) => i.relativeOffsetDays || 0) || [0])), defaultValue: `0 - ${Math.max(...(tmpl.items?.map((i) => i.relativeOffsetDays || 0) || [0]))}d span` })}
                    </span>
                  </div>

                  {/* Sample items list */}
                  <div className="space-y-1 pt-1">
                    {(tmpl.items || []).slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] truncate">
                        <span className="truncate max-w-[200px]">• {item.title}</span>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          +{item.relativeOffsetDays}d
                        </span>
                      </div>
                    ))}
                    {(tmpl.items?.length || 0) > 3 && (
                      <span className="text-[10px] text-muted-foreground italic block">
                        {t('checklistManager.moreTasks', { count: (tmpl.items?.length || 0) - 3, defaultValue: `+ ${(tmpl.items?.length || 0) - 3} more tasks` })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>

              {/* Card Footer Actions */}
              <div className="p-3 border-t bg-muted/10 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenApply(tmpl)}
                  className="text-xs h-7 gap-1 font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                >
                  <UserCheck className="h-3 w-3" /> {t('checklistManager.applyBtn', { defaultValue: 'Apply' })}
                </Button>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(tmpl)}
                      className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-3 w-3" /> {t('checklistManager.editBtn', { defaultValue: 'Edit' })}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tmpl)}
                      className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <RoleChecklistEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingTemplate(null);
          refetch();
        }}
        template={editingTemplate}
      />

      {/* Apply to Employee Modal */}
      <ApplyChecklistModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setApplyingTemplate(null);
        }}
        template={applyingTemplate}
      />
    </div>
  );
};

export default RoleChecklistManager;
