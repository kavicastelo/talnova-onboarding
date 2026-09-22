import React, { useState, useEffect } from 'react';
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
import { Input } from '../Input';
import { Plus, Trash2, Layers, CheckCircle2, Clock, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { IRoleChecklistTemplate, IRoleChecklistItem } from '../../services/task-template.service';
import { useCreateTaskTemplate, useUpdateTaskTemplate } from '../../hooks/useTaskTemplates';
import { useDepartments } from '../../hooks/useSettings';
import { toast } from 'sonner';

interface RoleChecklistEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: IRoleChecklistTemplate | null;
}

const AVAILABLE_ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Administrator' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'it_admin', label: 'IT Admin' },
];

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' },
];

export const RoleChecklistEditorModal: React.FC<RoleChecklistEditorModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const isEditing = Boolean(template?._id);
  const { data: orgDepartments = [] } = useDepartments();

  const createMutation = useCreateTaskTemplate();
  const updateMutation = useUpdateTaskTemplate();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['employee']);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedEmpTypes, setSelectedEmpTypes] = useState<string[]>([]);
  const [autoAssignNewHires, setAutoAssignNewHires] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Items state
  const [items, setItems] = useState<IRoleChecklistItem[]>([
    {
      title: 'Complete Workspace Profile & Photo Upload',
      description: 'Review contact details and upload profile avatar.',
      category: 'general',
      stage: 'day_1',
      priority: 'normal',
      relativeOffsetDays: 0,
      requiresVerification: false,
    },
    {
      title: 'Review Role Security Protocols & Code of Conduct',
      description: 'Sign statutory security compliance agreement.',
      category: 'hr_paperwork',
      stage: 'day_1',
      priority: 'high',
      relativeOffsetDays: 3,
      requiresVerification: true,
    },
    {
      title: 'First Week Manager Alignment Check-In',
      description: 'Conduct 1-on-1 milestone sync with direct supervisor.',
      category: 'training',
      stage: 'week_1',
      priority: 'critical',
      relativeOffsetDays: 7,
      requiresVerification: false,
    },
  ]);

  useEffect(() => {
    if (template) {
      setTitle(template.title || '');
      setDescription(template.description || '');
      setSelectedRoles(template.audience?.roles || ['employee']);
      setSelectedDepts(template.audience?.departmentNames || []);
      setSelectedEmpTypes(template.audience?.employmentTypes || []);
      setAutoAssignNewHires(template.audience?.autoAssignNewHires !== false);
      setIsActive(template.isActive !== false);
      setItems(
        template.items?.length
          ? template.items
          : [
              {
                title: 'Initial Orientation Task',
                category: 'general',
                stage: 'day_1',
                priority: 'normal',
                relativeOffsetDays: 0,
                requiresVerification: false,
              },
            ]
      );
    } else {
      setTitle('');
      setDescription('');
      setSelectedRoles(['employee']);
      setSelectedDepts([]);
      setSelectedEmpTypes([]);
      setAutoAssignNewHires(true);
      setIsActive(true);
      setItems([
        {
          title: 'Complete Workspace Profile & Photo Upload',
          description: 'Review contact details and upload profile avatar.',
          category: 'general',
          stage: 'day_1',
          priority: 'normal',
          relativeOffsetDays: 0,
          requiresVerification: false,
        },
        {
          title: 'Review Role Security Protocols & Code of Conduct',
          description: 'Sign statutory security compliance agreement.',
          category: 'hr_paperwork',
          stage: 'day_1',
          priority: 'high',
          relativeOffsetDays: 3,
          requiresVerification: true,
        },
        {
          title: 'First Week Manager Alignment Check-In',
          description: 'Conduct 1-on-1 milestone sync with direct supervisor.',
          category: 'training',
          stage: 'week_1',
          priority: 'critical',
          relativeOffsetDays: 7,
          requiresVerification: false,
        },
      ]);
    }
  }, [template, isOpen]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        title: '',
        description: '',
        category: 'general',
        stage: 'day_1',
        priority: 'normal',
        relativeOffsetDays: 3,
        responsibleRole: 'employee',
        requiresVerification: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof IRoleChecklistItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleRoleSelection = (roleVal: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleVal) ? prev.filter((r) => r !== roleVal) : [...prev, roleVal]
    );
  };

  const toggleDeptSelection = (deptName: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
  };

  const toggleEmpTypeSelection = (typeVal: string) => {
    setSelectedEmpTypes((prev) =>
      prev.includes(typeVal) ? prev.filter((t) => t !== typeVal) : [...prev, typeVal]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please provide a template title');
      return;
    }

    if (items.length === 0 || items.some((item) => !item.title.trim())) {
      toast.error('All checklist items must have a title');
      return;
    }

    const payload: Partial<IRoleChecklistTemplate> = {
      title: title.trim(),
      description: description.trim(),
      audience: {
        roles: selectedRoles as any,
        departmentNames: selectedDepts,
        employmentTypes: selectedEmpTypes as any,
        autoAssignNewHires,
        locations: [],
      },
      items,
      isActive,
    };

    if (isEditing && template?._id) {
      updateMutation.mutate(
        { id: template._id, data: payload },
        {
          onSuccess: () => onClose(),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold">
                {isEditing ? 'Edit Role Checklist Template' : 'Create Role Checklist Template'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                Define reusable default tasks with relative deadlines (now() + N days) automatically assigned to matching new hires.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Section 1: Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-foreground">Template Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Software Engineer Day 1-30 Ramp Checklist"
                className="text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Description / Purpose</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what this checklist guides new hires through..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Section 2: Audience Matrix */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> Target Audience Matching Matrix
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  New hires matching any selected filters will have this checklist automatically assigned upon creation.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAssignNewHires}
                  onChange={(e) => setAutoAssignNewHires(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <span>Auto-assign to new hires</span>
              </label>
            </div>

            {/* Roles Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">System Roles:</span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_ROLES.map((r) => {
                  const isSelected = selectedRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRoleSelection(r.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-background text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Departments Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Departments ({selectedDepts.length === 0 ? 'All Departments' : `${selectedDepts.length} selected`}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {(orgDepartments.length ? orgDepartments.map((d: any) => d.name) : ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Operations']).map(
                  (deptName: string) => {
                    const isSelected = selectedDepts.includes(deptName);
                    return (
                      <button
                        key={deptName}
                        type="button"
                        onClick={() => toggleDeptSelection(deptName)}
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground hover:text-foreground border-border'
                        }`}
                      >
                        {deptName}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Employment Types */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Employment Contract ({selectedEmpTypes.length === 0 ? 'All Types' : `${selectedEmpTypes.length} selected`}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYMENT_TYPES.map((et) => {
                  const isSelected = selectedEmpTypes.includes(et.value);
                  return (
                    <button
                      key={et.value}
                      type="button"
                      onClick={() => toggleEmpTypeSelection(et.value)}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-background text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      {et.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Checklist Items & Relative Deadlines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">Checklist Tasks & Relative Deadlines</h4>
                <p className="text-xs text-muted-foreground">
                  Specify relative due days (+0 = Day 1 / today, +3 = Day 3, +7 = Week 1, +30 = Month 1).
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddItem} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Task
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border bg-card hover:border-indigo-500/40 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-muted text-foreground text-[11px] font-mono font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <Input
                        value={item.title}
                        onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                        placeholder="Task title (e.g. Schedule 1-on-1 team welcome)"
                        className="text-xs font-bold h-8 w-72 sm:w-96"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                    {/* Category */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                        Category
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                        className="w-full text-xs p-1.5 border rounded-md bg-background focus:outline-none"
                      >
                        <option value="general">General</option>
                        <option value="it_setup">IT Setup</option>
                        <option value="hr_paperwork">HR Paperwork</option>
                        <option value="training">Training</option>
                        <option value="equipment">Equipment</option>
                      </select>
                    </div>

                    {/* Stage */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                        Onboarding Stage
                      </label>
                      <select
                        value={item.stage}
                        onChange={(e) => handleItemChange(idx, 'stage', e.target.value)}
                        className="w-full text-xs p-1.5 border rounded-md bg-background focus:outline-none"
                      >
                        <option value="preboarding">Pre-Boarding</option>
                        <option value="day_1">Day 1</option>
                        <option value="week_1">Week 1</option>
                        <option value="month_1">Month 1</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {/* Responsible Role */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-indigo-600" /> Responsible Role
                      </label>
                      <select
                        value={item.responsibleRole || 'employee'}
                        onChange={(e) => handleItemChange(idx, 'responsibleRole', e.target.value)}
                        className="w-full text-xs p-1.5 border rounded-md bg-background focus:outline-none font-medium"
                      >
                        <option value="employee">New Hire</option>
                        <option value="manager">Direct Manager</option>
                        <option value="it_admin">IT Administrator</option>
                        <option value="hr_admin">HR Administrator</option>
                        <option value="buddy">Onboarding Buddy</option>
                      </select>
                    </div>

                    {/* Relative Deadline Offset */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-indigo-600" /> Due in (+Days)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          value={item.relativeOffsetDays}
                          onChange={(e) =>
                            handleItemChange(idx, 'relativeOffsetDays', parseInt(e.target.value, 10) || 0)
                          }
                          className="text-xs h-7 w-20 font-mono font-bold"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {item.relativeOffsetDays === 0 ? 'Today' : `+${item.relativeOffsetDays}d`}
                        </span>
                      </div>
                    </div>

                    {/* Verification Toggle */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> Verification
                      </label>
                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.requiresVerification}
                          onChange={(e) => handleItemChange(idx, 'requiresVerification', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                        />
                        <span className="text-[11px]">Requires sign-off</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isEditing ? 'Save Template Changes' : 'Publish Checklist Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleChecklistEditorModal;
