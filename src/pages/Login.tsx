import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '../components/Button';
import { useRole } from '../context/RoleContext';
import { applyProfileLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { authService } from '../services/auth.service';
import { ssoService } from '../services/sso.service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../api/client';

export function Login() {
  const navigate = useNavigate();
  const { setRole } = useRole();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('login.errorEmpty'));
      return;
    }

    setLoading(true);
    try {
      await authService.logout().catch(() => undefined);
      const loginData = await authService.login(email, password);
      const backendRole = loginData.user?.role;

      applyProfileLanguage(loginData.user?.preferences?.language);

      let userRole: 'admin' | 'employee' | 'super_admin' = 'employee';
      if (backendRole === 'super_admin') {
        userRole = 'super_admin';
      } else if (backendRole === 'owner' || backendRole === 'admin') {
        userRole = 'admin';
      }

      setRole(userRole);
      toast.success(t('login.success'));

      if (userRole === 'super_admin') {
        navigate('/super-admin');
      } else if (userRole === 'admin') {
        navigate('/');
      } else {
        navigate('/employee');
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_40%)]" />

      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-2.5 shadow-lg shadow-indigo-500/20">
            <Shield className="h-full w-full text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            {t('login.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {t('login.subtitle')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('login.emailLabel')}
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
                  placeholder={t('login.emailPlaceholder')}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('login.passwordLabel')}
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                  {t('login.forgotPassword')}
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
                  placeholder={t('login.passwordPlaceholder')}
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
                {t('login.signIn')}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (!email) {
                toast.error('Please enter your work email address first for SSO domain discovery');
                return;
              }
              try {
                const discovery = await ssoService.discoverDomain(email);
                if (discovery.ssoEnabled) {
                  const init = await ssoService.initiateSSO(email);
                  toast.success(`Redirecting to ${discovery.provider?.toUpperCase()} Single Sign-On...`);
                  window.location.href = init.authUrl;
                } else {
                  toast.info('No Enterprise SSO configuration detected for this email domain. Please use password login.');
                }
              } catch (err: any) {
                toast.error('Failed to discover SSO domain');
              }
            }}
            className="w-full border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <KeyRound className="h-4 w-4 mr-2" /> Sign in with Enterprise SSO
          </Button>
        </form>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {t('login.noWorkspace')}{' '}
            <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300">
              {t('login.createOrg')}
            </Link>
          </p>
          <LanguageSwitcher variant="full" />
        </div>
      </div>
    </div>
  );
}
