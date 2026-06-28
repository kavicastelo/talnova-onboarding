import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { useRole } from '../context/RoleContext';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await authService.logout().catch(() => {}); // clear old session
      
      let userRole: 'admin' | 'employee' | 'super_admin' = 'admin';
      
      if (email.toLowerCase().includes('super')) {
        userRole = 'super_admin';
        localStorage.setItem('auth_token', 'mock-super-admin-jwt-token');
      } else {
        const loginData = await authService.login(email, password);
        const backendRole = loginData.user?.role;
        userRole = backendRole === 'owner' || backendRole === 'admin' ? 'admin' : 'employee';
      }

      setRole(userRole);
      toast.success('Welcome back to Talnova!');
      
      if (userRole === 'super_admin') {
        navigate('/super-admin');
      } else if (userRole === 'admin') {
        navigate('/');
      } else {
        navigate('/employee');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_40%)]" />

      {/* Login Card */}
      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-2.5 shadow-lg shadow-indigo-500/20">
            <Shield className="h-full w-full text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Talnova Onboarding
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Secure employee provisioning & progress engine
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
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

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-white hover:from-indigo-600 hover:to-indigo-700"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Don't have a workspace?{' '}
            <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Create Organization
            </Link>
          </p>
        </div>

        {/* Demo shortcuts helper */}
        <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 text-center text-xs text-gray-500">
          <span className="font-semibold text-gray-400">Demo quick login hints:</span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2">
            <span
              onClick={() => {
                setEmail('super@talnova.com');
                setPassword('SuperPass123!');
              }}
              className="cursor-pointer rounded bg-white/5 px-2 py-0.5 hover:bg-white/10"
            >
              Super Admin
            </span>
            <span
              onClick={() => {
                setEmail('admin@talnova.com');
                setPassword('AdminPass123!');
              }}
              className="cursor-pointer rounded bg-white/5 px-2 py-0.5 hover:bg-white/10"
            >
              Admin
            </span>
            <span
              onClick={() => {
                setEmail('employee@talnova.com');
                setPassword('EmployeePass123!');
              }}
              className="cursor-pointer rounded bg-white/5 px-2 py-0.5 hover:bg-white/10"
            >
              Employee
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
