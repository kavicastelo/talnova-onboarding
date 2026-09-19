import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield,
  KeyRound,
  LogOut,
  Building2,
  AlertTriangle,
  ArrowLeft,
  Mail,
  Calendar,
  Briefcase,
  GraduationCap,
  Edit,
  Unlock,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SuperAdminShell } from '../../components/super-admin/SuperAdminShell';
import {
  useSuperAdminUser360,
  useUpdateSuperAdminUser,
  useForceLogoutUser,
  useRevokeSession
} from '../../hooks/useSuperAdmin';
import { toast } from 'sonner';

export function SuperAdminUser360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useSuperAdminUser360(id);

  const updateMutation = useUpdateSuperAdminUser();
  const forceLogoutMutation = useForceLogoutUser();
  const revokeSessionMutation = useRevokeSession();

  // Edit Role Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRole, setEditRole] = useState('employee');
  const [editStatus, setEditStatus] = useState('active');
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <SuperAdminShell title="User 360° Profile" subtitle="Loading identity profile…">
        <div className="space-y-4 animate-pulse">
          <div className="h-10 w-48 rounded bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 border border-slate-200" />
            ))}
          </div>
        </div>
      </SuperAdminShell>
    );
  }

  if (isError || !data) {
    return (
      <SuperAdminShell title="User 360° Profile" subtitle="User identity profile">
        <div className="p-8 text-center bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">User Profile Not Found</h2>
          <p className="text-xs text-slate-500">
            Could not find user profile for ID: <span className="font-mono">{id}</span>
          </p>
          <Button
            onClick={() => navigate('/super-admin/users')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Users Directory
          </Button>
        </div>
      </SuperAdminShell>
    );
  }

  const { user, activeSessions = [], onboardingCase } = data;

  const handleOpenEdit = () => {
    setEditRole(user.role || 'employee');
    setEditStatus(user.employment?.status || 'active');
    setShowEditModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          role: editRole,
          status: editStatus
        }
      });
      toast.success('User privileges and status updated.');
      setShowEditModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockAccount = async () => {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { unlock: true }
      });
      toast.success('Account lock removed and failed attempts reset.');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to unlock account.');
    }
  };

  const handleForceLogoutAll = async () => {
    try {
      await forceLogoutMutation.mutateAsync(user.id);
      toast.success(`Terminated all active sessions for ${user.email}.`);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke sessions.');
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    try {
      await revokeSessionMutation.mutateAsync(sessionId);
      toast.success('Session revoked successfully.');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke session.');
    }
  };

  return (
    <SuperAdminShell
      title={`${user.name} — User 360° Profile`}
      subtitle={`Identity ID: ${user.id} · Organization: ${user.organization?.name || 'Platform Root'}`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/super-admin/users')}
            className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Users
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenEdit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <Edit className="h-3.5 w-3.5" /> Change Role / Status
          </Button>
        </div>
      }
    >
      {/* Top Identity Header Card */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-lg border border-blue-200">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                  {user.role?.replace('_', ' ')}
                </Badge>
                <Badge
                  className={
                    user.employment?.status?.toLowerCase() === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }
                >
                  {user.employment?.status || 'Active'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                <span className="flex items-center gap-1 text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-indigo-600" />
                  {user.email}
                </span>
                <span className="flex items-center gap-1 text-slate-700">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  {user.organization?.name || 'Platform Root'}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Joined: {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.failedLoginAttempts > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnlockAccount}
                className="border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs gap-1.5"
              >
                <Unlock className="h-3.5 w-3.5" /> Unlock Account
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceLogoutAll}
              className="border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Terminate All Sessions
            </Button>
          </div>
        </div>
      </Card>

      {/* 3-Column Identity Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Security & Authentication */}
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-3.5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Shield className="h-4 w-4 text-cyan-600" />
            Security & Authentication Posture
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Auth Provider</span>
              <span className="font-mono text-slate-900 capitalize">{user.authProvider}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Email Verified</span>
              <span className={user.emailVerified ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                {user.emailVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">MFA Enabled</span>
              <span className="text-slate-700 font-mono">{user.mfaEnabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Failed Login Attempts</span>
              <span className={`font-mono ${user.failedLoginAttempts > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                {user.failedLoginAttempts}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Last Login Timestamp</span>
              <span className="font-mono text-slate-600">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </Card>

        {/* Employment & Organization Role */}
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-3.5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Briefcase className="h-4 w-4 text-emerald-600" />
            Employment & Org Structure
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Employee ID</span>
              <span className="font-mono text-slate-900">{user.employment?.employeeId || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Job Title</span>
              <span className="text-slate-700">{user.employment?.jobTitle || 'Team Member'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Department</span>
              <span className="text-slate-700">{user.employment?.department || 'General'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Employment Type</span>
              <span className="text-slate-700 capitalize">{user.employment?.employmentType?.replace('_', ' ') || 'Full Time'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Onboarding State</span>
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] capitalize">
                {onboardingCase?.state || user.employment?.onboardingState || 'not_started'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Learning Statistics */}
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-3.5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            Learning & Curricula Progress
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Assigned Journeys</span>
              <span className="font-mono text-slate-900">{user.statistics?.assignedJourneys ?? 0}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Completed Journeys</span>
              <span className="font-mono text-emerald-600">{user.statistics?.completedJourneys ?? 0}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Certificates Earned</span>
              <span className="font-mono text-amber-600">{user.statistics?.certificates ?? 0}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Overall Completion Rate</span>
              <span className="font-mono font-bold text-indigo-600">
                {user.statistics?.completionRate ?? 0}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Sessions List Card */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              Active User Sessions ({activeSessions.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Valid JWT tokens and active browser devices bound to this identity.
            </p>
          </div>
          {activeSessions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceLogoutAll}
              className="border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs gap-1"
            >
              <LogOut className="h-3 w-3" /> Terminate All
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-4 py-3">Device / User Agent</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Revoke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No active sessions found for this user.
                  </td>
                </tr>
              ) : (
                activeSessions.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.deviceInfo}</td>
                    <td className="px-4 py-3 font-mono text-indigo-600">{s.ipAddress}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(s.lastActivityAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(s.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeSingleSession(s.id)}
                        className="h-6 px-2 text-[11px] text-rose-600 hover:bg-rose-50"
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Role Modal Dialog */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border border-slate-200 bg-white rounded-2xl p-6 shadow-2xl relative text-slate-900">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600" />
              Update User Role & Access Status
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Apply administrative changes to {user.name} ({user.email}).
            </p>

            <form onSubmit={handleSaveUser} className="space-y-4 mt-5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Platform Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr_admin">HR Admin</option>
                  <option value="it_admin">IT Admin</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Employment / Access Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="inactive">Inactive (Suspended)</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </SuperAdminShell>
  );
}

export default SuperAdminUser360;
