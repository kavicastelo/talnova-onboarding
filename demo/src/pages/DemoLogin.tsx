import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoAuth } from '../context/DemoAuthContext';
import { Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const DemoLogin: React.FC = () => {
  const { login, isLoading } = useDemoAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('john.doe@acme-demo.com');
  const [password, setPassword] = useState('DemoPass123!');
  const [error, setError] = useState<string | null>(null);

  const syntheticPersonas = [
    {
      name: 'John Doe',
      role: 'Employee (Acme Corp)',
      email: 'john.doe@acme-demo.com',
      badge: 'Full Suite',
      color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    },
    {
      name: 'Sarah Connor',
      role: 'Admin / VP People (Acme Corp)',
      email: 'sarah.connor@acme-demo.com',
      badge: 'Full Suite',
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    {
      name: 'Alice Smith',
      role: 'Manager (Acme Corp)',
      email: 'alice.smith@acme-demo.com',
      badge: 'Full Suite',
      color: 'bg-purple-50 border-purple-200 text-purple-700',
    },
    {
      name: 'Jim Halpert',
      role: 'Sales Rep (Globex)',
      email: 'jim.halpert@globex-demo.com',
      badge: 'Standard',
      color: 'bg-amber-50 border-amber-200 text-amber-700',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      toast.success('Authenticated to Demo Environment');
      navigate('/demo');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      toast.error(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          Isolated Demo Environment
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Talnova Onboarding Demo
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Experience the employee onboarding journey in a safe, synthetic sandbox.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-800/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Persona Selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Attributable Persona
            </label>
            <div className="grid grid-cols-2 gap-2">
              {syntheticPersonas.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => {
                    setEmail(p.email);
                    setPassword('DemoPass123!');
                  }}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    email === p.email
                      ? 'border-indigo-400 bg-indigo-950/60 ring-1 ring-indigo-400'
                      : 'border-slate-700 bg-slate-800/60 hover:bg-slate-700/50'
                  }`}
                >
                  <p className="font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{p.role}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Demo User Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-indigo-500 transition-colors"
                placeholder="name@demo-company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Demo Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-indigo-500 transition-colors"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Entering Sandbox...</span>
              ) : (
                <>
                  <span>Enter Demo Environment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Attributable identity active. All demo actions are isolated to synthetic storage and recorded for compliance & security review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoLogin;
