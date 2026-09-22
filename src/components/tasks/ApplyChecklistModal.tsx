import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Badge } from '../Badge';
import { Input } from '../Input';
import { SearchableSelect } from '../SearchableSelect';
import { useApplyTaskTemplate } from '../../hooks/useTaskTemplates';
import { useEmployees } from '../../hooks/useEmployees';
import { IRoleChecklistTemplate } from '../../services/task-template.service';
import { Layers, Calendar, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ApplyChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: IRoleChecklistTemplate | null;
}

export const ApplyChecklistModal: React.FC<ApplyChecklistModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const { t } = useTranslation(['tasks', 'common']);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [referenceDate, setReferenceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: employeesData } = useEmployees({ page: 1, limit: 1000 });
  const employees = employeesData?.employees || [];

  const applyMutation = useApplyTaskTemplate();

  const handleApply = () => {
    if (!template?._id) return;
    if (!selectedEmployeeId) {
      toast.error(t('applyChecklist.selectEmployeeToast', { defaultValue: 'Please select an employee to receive this checklist.' }));
      return;
    }

    applyMutation.mutate(
      {
        templateId: template._id,
        employeeId: selectedEmployeeId,
        referenceDate,
      },
      {
        onSuccess: () => {
          setSelectedEmployeeId('');
          onClose();
        },
      }
    );
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {t('applyChecklist.title', { defaultValue: 'Apply Checklist Template' })}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('applyChecklist.desc', {
                  title: template.title,
                  count: template.items?.length || 0,
                  defaultValue: `Manually assign ${template.title} (${template.items?.length || 0} tasks) to an existing employee.`
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 text-xs">
          {/* Target Employee Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">
              {t('applyChecklist.selectEmployee', { defaultValue: 'Select Target Employee *' })}
            </label>
            <SearchableSelect
              value={selectedEmployeeId}
              onChange={setSelectedEmployeeId}
              placeholder={t('applyChecklist.searchPlaceholder', { defaultValue: 'Search by name, email, department...' })}
              searchPlaceholder={t('applyChecklist.typeEmployeeName', { defaultValue: 'Type employee name...' })}
              options={employees.map((emp: any) => ({
                value: emp.id || emp._id,
                label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
                sublabel: emp.email,
                badge: emp.department || 'General',
              }))}
            />
          </div>

          {/* Reference Start Date */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" /> {t('applyChecklist.referenceDate', { defaultValue: 'Reference Anchor Date (Day 0)' })}
            </label>
            <Input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="text-xs"
            />
            <span className="text-[11px] text-muted-foreground block">
              {t('applyChecklist.referenceDateDesc', { defaultValue: 'Relative task deadlines (+3 days, +7 days) will be calculated starting from this date.' })}
            </span>
          </div>

          {/* Task Preview Card */}
          <div className="p-3 bg-muted/30 border rounded-xl space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              {t('applyChecklist.tasksGenerated', { defaultValue: 'Tasks that will be generated:' })}
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {(template.items || []).map((item, idx) => {
                const base = new Date(referenceDate);
                const targetDueDate = new Date(base.getTime() + (item.relativeOffsetDays || 0) * 86400 * 1000);

                return (
                  <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-md bg-background border">
                    <span className="truncate max-w-[240px] font-medium">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                      {targetDueDate.toLocaleDateString()} (+{item.relativeOffsetDays}d)
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            {t('applyChecklist.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!selectedEmployeeId || applyMutation.isPending}
            className="text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <UserCheck className="h-4 w-4" />
            {applyMutation.isPending ? t('applyChecklist.assigning', { defaultValue: 'Assigning...' }) : t('applyChecklist.confirmAssign', { defaultValue: 'Confirm & Assign Tasks' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyChecklistModal;
