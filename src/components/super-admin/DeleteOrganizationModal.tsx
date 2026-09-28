import React, { useState } from 'react';
import { Trash2, Archive, AlertTriangle, X, ShieldAlert, Check } from 'lucide-react';
import { Button } from '../Button';
import { OrganizationItem } from '../../services/superAdmin.service';
import { useDeleteOrganization } from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

interface DeleteOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (organization: any, mode: 'soft' | 'hard') => void;
  organization: (Partial<OrganizationItem> & { id: string; name: string; slug?: string; isDeleted?: boolean }) | null;
}

export function DeleteOrganizationModal({
  isOpen,
  onClose,
  onSuccess,
  organization,
}: DeleteOrganizationModalProps) {
  const [mode, setMode] = useState<'soft' | 'hard'>('soft');
  const [confirmSlug, setConfirmSlug] = useState('');
  const deleteOrgMutation = useDeleteOrganization();

  if (!isOpen || !organization) return null;

  const targetSlug = organization.slug?.toLowerCase().trim() || '';
  const isSlugConfirmed = confirmSlug.trim().toLowerCase() === targetSlug;

  const handleClose = () => {
    setConfirmSlug('');
    setMode('soft');
    onClose();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSlugConfirmed) {
      toast.error(`Please type "${targetSlug}" to confirm deletion.`);
      return;
    }

    try {
      await deleteOrgMutation.mutateAsync({
        id: organization.slug || organization.id,
        mode,
      });

      toast.success(
        mode === 'soft'
          ? `Organization "${organization.name}" archived successfully.`
          : `Organization "${organization.name}" and all associated data permanently purged.`
      );

      if (onSuccess) {
        onSuccess(organization, mode);
      }
      handleClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || err.message || 'Failed to delete organization.'
      );
    }
  };

  return (
    <div
      id="delete-organization-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        id="delete-organization-modal"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                mode === 'hard'
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {mode === 'hard' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {mode === 'hard' ? 'Permanent GDPR Purge' : 'Archive Organization'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">{organization.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              id="delete-mode-soft-tab"
              onClick={() => setMode('soft')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'soft'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive (Soft Delete)
            </button>
            <button
              type="button"
              id="delete-mode-hard-tab"
              onClick={() => setMode('hard')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'hard'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Permanent Purge (GDPR)
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          {mode === 'soft' ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Soft Delete / Archive Behavior
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                <li>Tenant status is set to <strong>Suspended</strong>.</li>
                <li>All user accounts are deactivated and active sessions are revoked.</li>
                <li>Tenant is hidden from standard workspace selector dropdowns.</li>
                <li>All data is <strong>preserved</strong> and can be restored anytime by a Super Admin.</li>
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/30 p-4 text-xs text-rose-800 dark:text-rose-300 space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Irreversible Permanent Purge (GDPR Right to Be Forgotten)
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                <li><strong>All user profiles and credentials</strong> will be permanently deleted.</li>
                <li>All Journeys, Tasks, Checklists, and progress records will be erased.</li>
                <li>All uploaded documents, certificates, and invoices will be purged.</li>
                <li><strong>This action cannot be undone</strong> and data cannot be recovered.</li>
              </ul>
            </div>
          )}

          {/* Safety Barrier Input */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              To confirm, type the workspace slug{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {targetSlug}
              </code>{' '}
              below:
            </label>
            <input
              id="confirm-delete-slug-input"
              type="text"
              required
              autoFocus
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={targetSlug}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none"
            />
            {isSlugConfirmed && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Workspace slug matches. Action unlocked.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={deleteOrgMutation.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-organization-btn"
              type="submit"
              disabled={!isSlugConfirmed || deleteOrgMutation.isPending}
              className={`text-xs gap-1.5 font-medium text-white shadow-sm ${
                mode === 'hard'
                  ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                  : 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50'
              }`}
            >
              {deleteOrgMutation.isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : mode === 'hard' ? (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Permanently Purge Organization
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" />
                  Archive Organization
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
