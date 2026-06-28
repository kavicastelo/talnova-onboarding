import { Building2, Users, ShieldCheck, Activity, TrendingUp, DollarSign } from 'lucide-react';
import { Card } from '../components/Card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const growthData = [
  { month: 'Jan', organizations: 12, revenue: 14000, users: 340 },
  { month: 'Feb', organizations: 15, revenue: 17500, users: 420 },
  { month: 'Mar', organizations: 18, revenue: 21000, users: 510 },
  { month: 'Apr', organizations: 24, revenue: 29000, users: 680 },
  { month: 'May', organizations: 29, revenue: 34500, users: 810 },
  { month: 'Jun', organizations: 35, revenue: 42000, users: 950 },
];

const systemLogs = [
  { id: 1, org: 'Northwind Labs', event: 'Added 12 new engineers', time: '10 mins ago', type: 'user' },
  { id: 2, org: 'Globex Inc', event: 'Created journey "Product Design Guide"', time: '45 mins ago', type: 'journey' },
  { id: 3, org: 'Acme Corp', event: 'Paid manual Invoice #INV-8890', time: '2 hours ago', type: 'finance' },
  { id: 4, org: 'Initech', event: 'Workspace settings updated (branding)', time: '4 hours ago', type: 'settings' },
  { id: 5, org: 'Umbrella Corp', event: 'Provisioned new workspace via API', time: '1 day ago', type: 'system' },
];

export function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Super Admin Portal</h1>
        <p className="text-gray-400">System telemetry and tenant management console</p>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Total Organizations</span>
            <Building2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">35</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">+18% MoM</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Platform Users</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">950</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">+24% MoM</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">Monthly Revenue (MRR)</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">$42,000</span>
            <span className="ml-2 text-xs font-semibold text-emerald-400">+21% MoM</span>
          </div>
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-400">System Health</span>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2.5">
            <span className="text-3xl font-bold text-white">99.98%</span>
            <span className="ml-2 text-xs font-semibold text-cyan-400">All services UP</span>
          </div>
        </Card>
      </div>

      {/* Charts section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="col-span-2 border-white/5 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">System Monthly Growth</h3>
              <p className="text-xs text-gray-400">Comparison of MRR revenue and active users</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>MoM upward trend</span>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: 'white', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="MRR ($)" />
                <Area type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" name="Active Users" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* System logs feed */}
        <Card className="border-white/5 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Cross-Tenant Activity</h3>
          </div>
          <div className="space-y-4">
            {systemLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-white/5 pb-3.5 last:border-0 last:pb-0">
                <div className={`mt-0.5 rounded-full p-1.5 ${
                  log.type === 'finance' ? 'bg-amber-500/10 text-amber-400' :
                  log.type === 'user' ? 'bg-emerald-500/10 text-emerald-400' :
                  log.type === 'journey' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-gray-400'
                }`}>
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-gray-300">{log.org}</span>
                    <span className="shrink-0 text-[10px] text-gray-500">{log.time}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400 leading-snug">{log.event}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
