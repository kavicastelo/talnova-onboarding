import React, { useState, useEffect } from 'react';
import { useDemoAuth } from '../context/DemoAuthContext';
import {
  CheckCircle2,
  Circle,
  FileText,
  Sparkles,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

export const DemoDashboard: React.FC = () => {
  const { user, tenant, setRestrictedModalFeature } = useDemoAuth();
  const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('talnova_demo_token');
      const res = await fetch(`${API_BASE}/demo/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (res.ok) {
        setData(json.data);
      }
    } catch {
      toast.error('Failed to load demo dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const token = localStorage.getItem('talnova_demo_token');
      const res = await fetch(`${API_BASE}/demo/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const text = await res.text();
      const resJson = text ? JSON.parse(text) : {};
      if (res.ok) {
        toast.success(`Task marked as ${nextStatus}`);
        fetchDashboard();
      } else {
        if (resJson.code === 'DEMO_FEATURE_RESTRICTED') {
          setRestrictedModalFeature('Checklist Task Execution');
        } else {
          toast.error(resJson.message || 'Action restricted');
        }
      }
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleSignDocument = async (docId: string) => {
    try {
      const token = localStorage.getItem('talnova_demo_token');
      const res = await fetch(`${API_BASE}/demo/documents/${docId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const text = await res.text();
      const resJson = text ? JSON.parse(text) : {};
      if (res.ok) {
        toast.success('Document digitally signed in demo sandbox');
        fetchDashboard();
      } else {
        if (resJson.code === 'DEMO_FEATURE_RESTRICTED') {
          setRestrictedModalFeature('Digital Signatures');
        } else {
          toast.error(resJson.message || 'Signature failed');
        }
      }
    } catch {
      toast.error('Failed to sign document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const tasks = data?.tasks || [];
  const journeys = data?.journeys || [];
  const documents = data?.documents || [];
  const colleagues = data?.colleagues || [];
  const progressRate = data?.progressRate || 0;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {tenant?.name} Sandbox
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to the Team, {user?.fullName}!
          </h1>
          <p className="mt-2 text-slate-600 text-sm leading-relaxed">
            Your personalized onboarding roadmap has been initiated. Complete your checklist items and digital documents below to progress through your first 30 days.
          </p>
        </div>

        {/* Progress Metric */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span>Onboarding Progress</span>
              <span className="text-indigo-600">{progressRate}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressRate}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              <strong className="text-slate-900">{data?.completedTasks || 0}</strong> of{' '}
              <strong className="text-slate-900">{data?.totalTasks || 0}</strong> tasks done
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-900">{data?.pendingDocuments || 0}</strong> signatures needed
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tasks Checklist & Digital Documents */}
        <div className="lg:col-span-2 space-y-8">
          {/* Checklist Tasks */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Checklist Tasks</h2>
                <p className="text-xs text-slate-500">Interactive onboarding actions</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {tasks.length} total
              </span>
            </div>

            <div className="space-y-3">
              {tasks.map((t: any) => {
                const isCompleted = t.status === 'completed';
                return (
                  <div
                    key={t._id}
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
                      isCompleted
                        ? 'bg-slate-50/70 border-slate-200/80 opacity-75'
                        : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTask(t._id, t.status)}
                      className={`mt-0.5 rounded-full p-1 transition-colors ${
                        isCompleted
                          ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-slate-400 hover:text-indigo-600'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {t.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                      Due in {t.dueDays}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Digital Documents */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Required Documents</h2>
                <p className="text-xs text-slate-500">Legal agreements and forms</p>
              </div>
            </div>

            <div className="space-y-3">
              {documents.map((doc: any) => {
                const isSigned = doc.status === 'signed';
                return (
                  <div
                    key={doc._id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                        <p className="text-xs text-slate-500 capitalize">
                          Type: {doc.documentType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" />
                          Signed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSignDocument(doc._id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
                        >
                          Sign Digitally
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Journeys & Colleagues */}
        <div className="space-y-8">
          {/* Active Journeys */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Learning Journeys</h2>
            <p className="text-xs text-slate-500 mb-4">Structured milestones & curriculum</p>

            <div className="space-y-3">
              {journeys.map((j: any) => (
                <div
                  key={j._id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 mb-1.5">
                    {j.category}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{j.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{j.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{j.modulesCount} interactive modules</span>
                    <span>{j.durationDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Synthetic Colleagues Directory */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Your Team</h2>
            <p className="text-xs text-slate-500 mb-4">Synthetic team members</p>

            <div className="divide-y divide-slate-100">
              {colleagues.map((c: any) => (
                <div key={c._id} className="py-2.5 flex items-center gap-3 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {c.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{c.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{c.jobTitle} • {c.department}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoDashboard;
