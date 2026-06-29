import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, Send } from 'lucide-react';
import { Button } from '../components/Button';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      toast.success('Recovery link sent successfully!');
      setSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send recovery email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_40%)]" />

      {/* Forgot Password Card */}
      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-2.5 shadow-lg shadow-indigo-500/20">
            <KeyRound className="h-full w-full text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Forgot Password
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            We will email you a secure link to reset your password
          </p>
        </div>

        {sent ? (
          <div className="space-y-6 text-center">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
              An email has been sent to <span className="font-semibold">{email}</span> with instructions to reset your password.
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-white hover:from-indigo-600 hover:to-indigo-700"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Send Reset Link
                    <Send className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
