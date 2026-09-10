import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { getErrorMessage } from '../api/client';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Reset token is missing or invalid.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setSuccess(true);
      toast.success('Password reset successfully! You can now log in.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_40%)]" />

      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-2.5 shadow-lg shadow-indigo-500/20">
            <Lock className="h-full w-full text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Set New Password
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Please enter and confirm your new secure password.
          </p>
        </div>

        {success ? (
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-6 text-emerald-400">
              <CheckCircle className="h-10 w-10 mb-2" />
              <p className="font-semibold text-base">Password Reset Complete</p>
              <p className="mt-1 text-sm text-gray-300">Your password has been successfully updated. Redirecting to login...</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  New Password
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`block w-full rounded-lg border bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:ring-2 ${
                      password.length > 0 && password.length < 8
                        ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p id="password-hint" className="mt-1 text-xs text-rose-500 font-medium">
                    Password must be at least 8 characters.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-white hover:from-indigo-600 hover:to-indigo-700"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Reset Password'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
