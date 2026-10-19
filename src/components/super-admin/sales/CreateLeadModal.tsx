import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../Dialog';
import { Button } from '../../Button';
import { Input } from '../../Input';
import { Label } from '../../Label';
import { salesService, CreateLeadPayload, CompanySize, LeadSource, LeadPriority } from '../../../services/sales.service';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateLeadModal({ isOpen, onClose, onCreated }: CreateLeadModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateLeadPayload>({
    name: '',
    email: '',
    companyName: '',
    phone: '',
    jobTitle: '',
    industry: '',
    companySize: undefined,
    source: 'website',
    priority: 'normal',
    estimatedBudget: undefined,
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateLeadPayload) => salesService.createLead(payload),
    onSuccess: (newLead) => {
      toast.success(`Lead created successfully for ${newLead.name}`);
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
      if (onCreated) onCreated();
      handleClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create lead';
      toast.error(msg);
    },
  });

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      companyName: '',
      phone: '',
      jobTitle: '',
      industry: '',
      companySize: undefined,
      source: 'website',
      priority: 'normal',
      estimatedBudget: undefined,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Lead full name is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Valid work email is required');
      return;
    }
    if (!formData.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    mutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl bg-white p-6 rounded-xl shadow-2xl border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Create Prospective Sales Lead
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Register a new inbound prospect into the CRM pipeline with automated rule scoring.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="lead-name" className="text-xs font-semibold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="lead-name"
                placeholder="e.g. Sarah Connor"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="lead-email" className="text-xs font-semibold text-slate-700">
                Work Email <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="sarah@cyberdyne.test"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            {/* Company Name */}
            <div>
              <Label htmlFor="lead-company" className="text-xs font-semibold text-slate-700">
                Company Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="lead-company"
                placeholder="e.g. Cyberdyne Systems"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="lead-phone" className="text-xs font-semibold text-slate-700">
                Phone Number
              </Label>
              <Input
                id="lead-phone"
                placeholder="+1 (555) 000-1234"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Job Title */}
            <div>
              <Label htmlFor="lead-title" className="text-xs font-semibold text-slate-700">
                Job Title
              </Label>
              <Input
                id="lead-title"
                placeholder="e.g. Chief Technology Officer"
                value={formData.jobTitle || ''}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Industry */}
            <div>
              <Label htmlFor="lead-industry" className="text-xs font-semibold text-slate-700">
                Industry
              </Label>
              <Input
                id="lead-industry"
                placeholder="e.g. Enterprise Software"
                value={formData.industry || ''}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Company Size */}
            <div>
              <Label htmlFor="lead-size" className="text-xs font-semibold text-slate-700">
                Company Size
              </Label>
              <select
                id="lead-size"
                value={formData.companySize || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    companySize: (e.target.value as CompanySize) || undefined,
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select Company Size...</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1,000 employees</option>
                <option value="1000+">1,000+ employees (Enterprise)</option>
              </select>
            </div>

            {/* Acquisition Source */}
            <div>
              <Label htmlFor="lead-source" className="text-xs font-semibold text-slate-700">
                Lead Source
              </Label>
              <select
                id="lead-source"
                value={formData.source || 'website'}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value as LeadSource })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="website">Website Form</option>
                <option value="product_demo">Product Demo Request (+25 pts)</option>
                <option value="referral">Customer Referral (+20 pts)</option>
                <option value="campaign">Marketing Campaign (+10 pts)</option>
                <option value="inbound_email">Inbound Email (+15 pts)</option>
                <option value="import">CSV Import</option>
                <option value="other">Other Channel</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <Label htmlFor="lead-priority" className="text-xs font-semibold text-slate-700">
                Initial Priority
              </Label>
              <select
                id="lead-priority"
                value={formData.priority || 'normal'}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as LeadPriority })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Estimated Budget */}
            <div>
              <Label htmlFor="lead-budget" className="text-xs font-semibold text-slate-700">
                Estimated Budget (USD)
              </Label>
              <Input
                id="lead-budget"
                type="number"
                min="0"
                step="1000"
                placeholder="e.g. 75000"
                value={formData.estimatedBudget || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimatedBudget: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {mutation.isPending ? 'Creating Lead...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateLeadModal;
