import React, { useState, useEffect } from 'react';
import { SuperAdminShell } from '../../../components/super-admin/SuperAdminShell';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import {
  Building2,
  Users,
  KeyRound,
  RotateCcw,
  AlertTriangle,
  Activity,
  Plus,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Lock,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { superAdminService } from '../../../services/superAdmin.service';

export function SuperAdminDemoManagement() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'companies' | 'users' | 'sessions' | 'activity' | 'suspicious' | 'entitlements' | 'telemetry' | 'reset'
  >('overview');

  const [overview, setOverview] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<any[]>([]);
  const [resetHistory, setResetHistory] = useState<any[]>([]);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<any | null>(null);

  // Form states
  const [newCompany, setNewCompany] = useState({
    name: '',
    slug: '',
    domain: '',
    contactEmail: '',
    entitlementPackage: 'FULL_SUITE',
    durationDays: 30,
  });

  const [newUser, setNewUser] = useState({
    demoTenantId: '',
    email: '',
    fullName: '',
    role: 'demo_employee',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
  });

  const fetchOverview = async () => {
    try {
      const data = await superAdminService.getDemoOverview();
      setOverview(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const data = await superAdminService.getDemoCompanies();
      setCompanies(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await superAdminService.getDemoUsers();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await superAdminService.getDemoSessions();
      setSessions(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const data = await superAdminService.getDemoActivity(50);
      setActivity(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRiskAlerts = async () => {
    try {
      const data = await superAdminService.getDemoRiskAlerts();
      setRiskAlerts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchResetHistory = async () => {
    try {
      const data = await superAdminService.getDemoResetHistory();
      setResetHistory(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTelemetry = async () => {
    try {
      const data = await superAdminService.getDemoTelemetryAnalytics();
      setTelemetryData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchCompanies(),
      fetchUsers(),
      fetchSessions(),
      fetchActivity(),
      fetchRiskAlerts(),
      fetchResetHistory(),
      fetchTelemetry(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminService.createDemoCompany(newCompany);
      toast.success(res.message || 'Demo company provisioned');
      setShowCreateCompanyModal(false);
      setNewCompany({
        name: '',
        slug: '',
        domain: '',
        contactEmail: '',
        entitlementPackage: 'FULL_SUITE',
        durationDays: 30,
      });
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || 'Provisioning failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await superAdminService.createDemoUser(newUser);
      toast.success(res.message || 'Demo user created');
      setShowCreateUserModal(false);
      setNewUser({
        demoTenantId: '',
        email: '',
        fullName: '',
        role: 'demo_employee',
        department: 'Engineering',
        jobTitle: 'Software Engineer',
      });
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || 'User creation failed');
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await superAdminService.terminateDemoSession(sessionId);
      toast.success(`Session ${sessionId.substring(0, 8)} terminated`);
      fetchSessions();
      fetchOverview();
    } catch (err) {
      toast.error('Failed to terminate session');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await superAdminService.resolveDemoRiskAlert(alertId, 'Acknowledged and reviewed by Super Admin');
      toast.success('Risk alert marked as resolved');
      fetchRiskAlerts();
      fetchOverview();
    } catch (err) {
      toast.error('Error resolving alert');
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmInput !== 'RESET DEMO') {
      toast.error('You must type RESET DEMO exactly to confirm.');
      return;
    }

    setIsResetting(true);
    setResetResult(null);
    try {
      const res = await superAdminService.resetDemoEnvironment('RESET DEMO');
      toast.success('Demo environment has been completely reset.');
      setResetResult(res.data);
      setResetConfirmInput('');
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute reset');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SuperAdminShell
      title="Demo Environment Management"
      subtitle="Centralized administration, session monitoring, feature gating, and deterministic reset controls for the isolated demo surface."
      actions={
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateCompanyModal(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Demo Company
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setResetResult(null);
              setShowResetModal(true);
            }}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Demo
          </Button>
        </div>
      }
    >
      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto text-sm font-semibold">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'companies', label: `Companies (${companies.length})`, icon: Building2 },
            { id: 'users', label: `Attributable Users (${users.length})`, icon: Users },
            { id: 'sessions', label: `Active Sessions (${sessions.length})`, icon: KeyRound },
            { id: 'activity', label: 'Activity Feed', icon: Clock },
            {
              id: 'suspicious',
              label: `Suspicious Signals (${riskAlerts.filter((a) => a.status === 'OPEN').length})`,
              icon: AlertTriangle,
            },
            { id: 'entitlements', label: 'Feature Access', icon: Layers },
            { id: 'telemetry', label: 'Feature Telemetry', icon: BarChart2 },
            { id: 'reset', label: 'Reset & History', icon: RotateCcw },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {loading && (
        <div className="text-xs text-indigo-600 font-semibold animate-pulse flex items-center gap-2 py-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Syncing demo telemetry...</span>
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Active Demo Companies</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {overview?.tenantsCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Multi-tenant isolated companies</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Attributable Users</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {overview?.activeUsersCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Individual non-shared identities</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Live Active Sessions</span>
                <KeyRound className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {overview?.activeSessionsCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Limit: {overview?.sessionLimit || 1} concurrent session / user
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Open Suspicious Alerts</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-3xl font-extrabold text-rose-600 mt-2">
                {overview?.openAlertsCount || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Concurrent anomalies & rapid IP shifts</p>
            </Card>
          </div>

          {/* Quick Security & Isolation Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Active Demo Security Boundaries
              </h3>
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span>Database Isolation</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Dedicated demoConnection (Zero Prod Access)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span>Transactional Notification Sink</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Active DemoEmailSink (Zero Outbound)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span>Visual & Export Watermarking</span>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    Enforced (Session, User, Company)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span>Inactivity Session Timeout</span>
                  <span className="font-semibold text-slate-800">
                    {overview?.idleTimeoutMinutes || 15} minutes
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span>External Integrations / Webhooks</span>
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    Completely Sandboxed / Blocked
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
                Deterministic Seed & Reset Status
              </h3>
              {overview?.lastReset ? (
                <div className="space-y-3 text-xs text-slate-600">
                  <p>
                    <strong>Last Reset:</strong>{' '}
                    {new Date(overview.lastReset.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Initiated By:</strong> {overview.lastReset.performedBy} (
                    {overview.lastReset.actorRole})
                  </p>
                  <p>
                    <strong>Duration:</strong> {overview.lastReset.durationMs}ms
                  </p>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-semibold text-slate-800">Restored Entities:</p>
                    <p>• {overview.lastReset.seedStats?.tenantsCreated || 0} Companies</p>
                    <p>• {overview.lastReset.seedStats?.usersCreated || 0} Attributable Users</p>
                    <p>• {overview.lastReset.seedStats?.journeysCreated || 0} Onboarding Journeys</p>
                    <p>• {overview.lastReset.seedStats?.tasksCreated || 0} Checklist Tasks</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No reset has been recorded yet. Click &quot;Reset Demo&quot; to restore the initial deterministic baseline.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Companies (Tenants) */}
      {activeTab === 'companies' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Demo Companies / Tenants</h3>
              <p className="text-xs text-slate-500">Each organization operates in strict isolation.</p>
            </div>
            <Button size="sm" onClick={() => setShowCreateCompanyModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Provision Company
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Slug / Domain</th>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Users</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {c.slug} ({c.domain})
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="font-semibold">
                        {c.entitlementPackage}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{c.usersCount} users</td>
                    <td className="py-3 px-4">{new Date(c.expiresAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={c.status === 'ACTIVE' ? 'default' : 'destructive'}
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={async () => {
                          const nextStatus = c.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
                          await superAdminService.updateDemoCompany(c._id, { status: nextStatus });
                          toast.success(`Company status updated to ${nextStatus}`);
                          fetchCompanies();
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        {c.status === 'ACTIVE' ? 'Revoke Access' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Attributable Users */}
      {activeTab === 'users' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Attributable Demo Users</h3>
              <p className="text-xs text-slate-500">
                Individual identities attributed to specific demo companies. No shared generic credentials.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateUserModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Demo User
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.fullName}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">{u.companyName}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">{u.role}</td>
                    <td className="py-3 px-4">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={u.status === 'ACTIVE' ? 'default' : 'destructive'}
                        className="text-[10px]"
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={async () => {
                          const nextStatus = u.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
                          await superAdminService.updateDemoUser(u._id, { status: nextStatus });
                          toast.success(`User updated to ${nextStatus}`);
                          fetchUsers();
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        {u.status === 'ACTIVE' ? 'Revoke' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 4: Active Sessions */}
      {activeTab === 'sessions' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Live Active Demo Sessions</h3>
              <p className="text-xs text-slate-500">
                Monitors concurrent sessions and device metadata in real time.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Session ID</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Risk State</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No active demo sessions currently online.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{s.userName}</p>
                        <p className="text-[11px] text-slate-400">{s.userEmail}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {s.sessionId.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">{s.ipAddress || '127.0.0.1'}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            s.riskStatus === 'NORMAL'
                              ? 'default'
                              : s.riskStatus === 'SUSPICIOUS'
                              ? 'outline'
                              : 'destructive'
                          }
                          className={`text-[10px] ${
                            s.riskStatus === 'SUSPICIOUS'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : ''
                          }`}
                        >
                          {s.riskStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{new Date(s.lastActivityAt).toLocaleTimeString()}</td>
                      <td className="py-3 px-4">{new Date(s.expiresAt).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleTerminateSession(s.sessionId)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Terminate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 5: Activity Feed */}
      {activeTab === 'activity' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Demo Activity Audit Trail</h3>
              <p className="text-xs text-slate-500">Every significant demo action is recorded.</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchActivity}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {activity.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-900">{l.action}</td>
                    <td className="py-3 px-4 text-slate-500">{l.category}</td>
                    <td className="py-3 px-4 text-slate-700">{l.userEmail || 'System'}</td>
                    <td className="py-3 px-4 text-slate-700">{l.companyName || '-'}</td>
                    <td className="py-3 px-4 font-sans text-xs text-slate-600">{l.description}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(l.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 6: Suspicious Signals */}
      {activeTab === 'suspicious' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Suspicious Signals & Anomaly Detection</h3>
              <p className="text-xs text-slate-500">
                Objective risk indicators (concurrent logins, sudden IP changes, restricted access).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {riskAlerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-sm">
                No risk alerts flagged. All demo activity is operating within normal parameters.
              </div>
            ) : (
              riskAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    alert.status === 'OPEN'
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{alert.alertType}</span>
                      <Badge
                        variant={alert.severity === 'CRITICAL' ? 'destructive' : 'outline'}
                        className="text-[10px]"
                      >
                        {alert.severity}
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      User: <strong>{alert.userEmail || 'Unknown'}</strong>
                    </p>
                    <ul className="text-[11px] text-slate-600 list-disc list-inside">
                      {alert.signals?.map((s: string, idx: number) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {alert.status === 'OPEN' ? (
                      <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert._id)}>
                        Acknowledge & Resolve
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Tab 7: Entitlements */}
      {activeTab === 'entitlements' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Demo Feature Entitlements</h3>
            <p className="text-xs text-slate-500">
              Granular access packages mapping atomic SaaS features to demo tiers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <h4 className="font-bold text-sm text-slate-900">Standard Package</h4>
              <p className="text-xs text-slate-500">Core onboarding essentials for basic demonstrations.</p>
              <ul className="text-xs text-slate-700 space-y-1.5 pt-2 border-t border-slate-100">
                <li>• Roadmap Timeline</li>
                <li>• Checklist Tasks</li>
                <li>• Journey Templates</li>
                <li>• Digital Signatures</li>
                <li>• Employee Directory</li>
                <li>• Knowledge Base</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
              <h4 className="font-bold text-sm text-indigo-950">Executive Package</h4>
              <p className="text-xs text-indigo-700">High-level management oversight and analytics.</p>
              <ul className="text-xs text-slate-700 space-y-1.5 pt-2 border-t border-indigo-100">
                <li>• Roadmap Timeline</li>
                <li>• Team Supervision</li>
                <li>• Analytics Dashboard</li>
                <li>• Milestone Ratings</li>
                <li>• Compliance Audit View</li>
                <li>• Knowledge Base</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
              <h4 className="font-bold text-sm text-purple-950">Full Suite Demo</h4>
              <p className="text-xs text-purple-700">Complete breadth of AI, Gamification, and Journeys.</p>
              <ul className="text-xs text-slate-700 space-y-1.5 pt-2 border-t border-purple-100">
                <li>• Everything in Standard & Executive</li>
                <li>• AI Assistant & Course Builder</li>
                <li>• Interactive Office Map</li>
                <li>• Gamified Milestones</li>
                <li>• Digital Documents & Signer</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Feature Usage & Telemetry Analytics */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Total Feature Interactions</span>
                <Activity className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {telemetryData?.totalEvents || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Logged page views, clicks & submissions</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Top Explored Feature</span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900 mt-2 truncate">
                {telemetryData?.topFeatures?.[0]?.featureKey || 'None Yet'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {telemetryData?.topFeatures?.[0]?.count || 0} interactions recorded
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Upgrade Intent Signals</span>
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {telemetryData?.restrictedAttempts?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Prospect attempts on locked features</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Engagement Leaderboard */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Feature Engagement Leaderboard</h3>
                  <p className="text-xs text-slate-500">Most visited surfaces and workflows in demo mode.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTelemetry}>
                  Refresh
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Feature Key</th>
                      <th className="py-2.5 px-3">Interactions</th>
                      <th className="py-2.5 px-3">Unique Personas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {telemetryData?.topFeatures?.length > 0 ? (
                      telemetryData.topFeatures.map((f: any) => (
                        <tr key={f.featureKey} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono text-xs">
                            {f.featureKey}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-indigo-600">{f.count}</td>
                          <td className="py-2.5 px-3 text-slate-600">{f.uniqueUsersCount} users</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400">
                          No feature interactions recorded yet. Browse /demo to generate telemetry.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Upgrade Intent Heatmap */}
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Upgrade Intent Signals</h3>
                <p className="text-xs text-slate-500">
                  Prospective clients attempting to access features not in their demo package.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Locked Feature</th>
                      <th className="py-2.5 px-3">Prospect Company</th>
                      <th className="py-2.5 px-3">Attempts</th>
                      <th className="py-2.5 px-3">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {telemetryData?.restrictedAttempts?.length > 0 ? (
                      telemetryData.restrictedAttempts.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-amber-900">{r.feature}</td>
                          <td className="py-2.5 px-3 text-slate-800">{r.company}</td>
                          <td className="py-2.5 px-3 font-bold text-rose-600">{r.count}x</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(r.lastAttempt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No restricted feature attempts logged. Evaluators are operating within entitlements.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Recent Telemetry Stream */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Live Telemetry Event Stream</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Feature</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telemetryData?.recentEvents?.length > 0 ? (
                    telemetryData.recentEvents.map((ev: any) => (
                      <tr key={ev._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {new Date(ev.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{ev.userEmail}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700">{ev.featureKey}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{ev.route}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-semibold">{ev.action}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={ev.status === 'ALLOWED' ? 'default' : 'outline'}
                            className={`text-[10px] ${
                              ev.status === 'RESTRICTED' ? 'border-amber-300 text-amber-700 bg-amber-50' : ''
                            }`}
                          >
                            {ev.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No recent telemetry events recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 8: Reset & History */}
      {activeTab === 'reset' && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Deterministic Reset Engine</h3>
              <p className="text-xs text-slate-500">
                Executes the 10-step atomic reset, restoring clean deterministic seed state.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setResetResult(null);
                setShowResetModal(true);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Demo Environment
            </Button>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3">Reset Execution Log</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Seed Stats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resetHistory.map((h) => (
                    <tr key={h._id}>
                      <td className="py-3 px-4">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold">{h.performedBy}</td>
                      <td className="py-3 px-4">
                        <Badge variant={h.status === 'SUCCESS' ? 'default' : 'destructive'}>
                          {h.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{h.durationMs}ms</td>
                      <td className="py-3 px-4 text-slate-600">
                        {h.seedStats?.tenantsCreated || 0} Orgs, {h.seedStats?.usersCreated || 0} Users,{' '}
                        {h.seedStats?.journeysCreated || 0} Journeys
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Modal: Provision Demo Company */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-slate-900">
            <h3 className="text-lg font-bold mb-4">Provision Demo Company</h3>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={(e) =>
                    setNewCompany({
                      ...newCompany,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-demo',
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Initech Logistics"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slug (URL Key)</label>
                <input
                  type="text"
                  required
                  value={newCompany.slug}
                  onChange={(e) => setNewCompany({ ...newCompany, slug: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  placeholder="initech-demo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Domain</label>
                <input
                  type="text"
                  required
                  value={newCompany.domain}
                  onChange={(e) => setNewCompany({ ...newCompany, domain: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="initech-demo.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={newCompany.contactEmail}
                  onChange={(e) => setNewCompany({ ...newCompany, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="eval@initech.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Entitlement Package</label>
                <select
                  value={newCompany.entitlementPackage}
                  onChange={(e) => setNewCompany({ ...newCompany, entitlementPackage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="FULL_SUITE">Full Enterprise Suite</option>
                  <option value="EXECUTIVE">Executive Overview</option>
                  <option value="STANDARD">Standard Onboarding</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setShowCreateCompanyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Provision</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Demo User */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-slate-900">
            <h3 className="text-lg font-bold mb-4">Add Attributable Demo User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Assign to Company</label>
                <select
                  required
                  value={newUser.demoTenantId}
                  onChange={(e) => setNewUser({ ...newUser, demoTenantId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Peter Gibbons"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="peter@initech-demo.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="demo_employee">Employee</option>
                    <option value="demo_manager">Manager</option>
                    <option value="demo_admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setShowCreateUserModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Demo Environment */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-rose-200 text-slate-900 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Reset Demo Environment</h3>
                <p className="text-xs text-rose-600 font-semibold">10-Step Deterministic Restore</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-slate-700 space-y-2">
              <p className="font-bold text-rose-800">WARNING: This destructive operation will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Immediately terminate all active demo sessions</li>
                <li>Wipe all demo-generated tenants, users, and tasks</li>
                <li>Purge sandboxed demo storage and email sinks</li>
                <li>Restore initial deterministic baseline fixtures</li>
              </ul>
              <p className="pt-1 text-[11px] font-semibold text-emerald-800">
                ✓ Production data is physically isolated and will NOT be affected.
              </p>
            </div>

            {resetResult ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-xs">
                <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Reset Successfully Completed in {resetResult.durationMs}ms
                </p>
                <ul className="text-emerald-800 space-y-0.5 font-mono text-[11px]">
                  {resetResult.stepsCompleted?.map((step: string, idx: number) => (
                    <li key={idx}>✓ {step}</li>
                  ))}
                </ul>
                <div className="pt-3 flex justify-end">
                  <Button onClick={() => setShowResetModal(false)}>Close</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To confirm, please type <span className="font-mono text-rose-600">RESET DEMO</span> below:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    placeholder="RESET DEMO"
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isResetting}
                    onClick={() => setShowResetModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={resetConfirmInput !== 'RESET DEMO' || isResetting}
                    onClick={handleExecuteReset}
                  >
                    {isResetting ? 'Resetting...' : 'Execute Reset'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}

export default SuperAdminDemoManagement;
