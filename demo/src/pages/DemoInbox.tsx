import React, { useState, useEffect } from 'react';
import { ShieldCheck, Send, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const DemoInbox: React.FC = () => {
  const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api/v1';
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchEmails = async () => {
    try {
      const token = localStorage.getItem('talnova_demo_token');
      const res = await fetch(`${API_BASE}/demo/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.ok) {
        setEmails(data.data || []);
        if (data.data?.length > 0 && !selectedEmail) {
          setSelectedEmail(data.data[0]);
        }
      }
    } catch {
      toast.error('Failed to load email sink');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleSimulateEmail = async () => {
    setSimulating(true);
    try {
      const token = localStorage.getItem('talnova_demo_token');
      const res = await fetch(`${API_BASE}/demo/inbox/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: 'Onboarding Reminder: Complete Digital Signature',
          htmlContent:
            '<div style="font-family: sans-serif; padding: 16px;"><h3>Hello Demo User,</h3><p>This is a simulated reminder captured by the Talnova Demo Email Sink. No real outbound email was transmitted.</p><p><strong>Status:</strong> Safe Sink Verified.</p></div>',
        }),
      });
      if (res.ok) {
        toast.success('Simulated email safely captured in Demo Sink');
        await fetchEmails();
      }
    } catch {
      toast.error('Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero-Outbound Email Sink Active
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Simulated Notification Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            All transactional emails generated in the demo environment are routed to this isolated sink to ensure no production communications are triggered.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchEmails}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Refresh inbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSimulateEmail}
            disabled={simulating}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Simulate Notification</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
          No simulated emails captured yet. Click &quot;Simulate Notification&quot; to test the sink.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[500px]">
          {/* Email List */}
          <div className="md:col-span-1 border-r border-slate-200 divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
            {emails.map((m) => {
              const isSelected = selectedEmail?._id === m._id;
              return (
                <button
                  key={m._id}
                  onClick={() => setSelectedEmail(m)}
                  className={`w-full text-left p-4 transition-colors block ${
                    isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900 truncate">{m.subject}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">To: {m.to}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(m.sentAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Email Preview */}
          <div className="md:col-span-2 p-6 flex flex-col justify-between">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">{selectedEmail.subject}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                    <span><strong>Recipient:</strong> {selectedEmail.to}</span>
                    <span><strong>Captured At:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      SINK CAPTURED
                    </span>
                  </div>
                </div>

                <div
                  className="prose prose-sm max-w-none text-slate-700 pt-2"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.htmlContent }}
                />
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm m-auto">
                Select an email from the left to view the captured sink content.
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Isolated Sandbox Email: External mail servers and production users cannot receive these messages.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoInbox;
