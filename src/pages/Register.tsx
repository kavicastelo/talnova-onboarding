import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Building2, User, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { authService } from '../services/auth.service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../api/client';
import { useRole } from '../context/RoleContext';

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const { setRole, setRoles } = useRole();
  const { t } = useTranslation('auth');

  // -------------------------------------------------------------
  // INVITATION ACCEPTANCE MODE (Triggered when ?token= is present)
  // -------------------------------------------------------------
  const [isVerifying, setIsVerifying] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    organizationName: string;
    organizationSlug?: string;
    organizationLogo?: string;
    role?: string;
  } | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;

    setIsVerifying(true);
    setInviteError(null);
    authService
      .verifyInvitation(inviteToken)
      .then((data) => {
        setInviteData(data);
      })
      .catch((err) => {
        setInviteError(getErrorMessage(err) || 'Invitation token is invalid or has expired.');
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, [inviteToken]);

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;

    if (invitePassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    if (invitePassword !== confirmPassword) {
      toast.error('Passwords do not match. Please re-enter your password.');
      return;
    }

    setAcceptLoading(true);
    try {
      const data = await authService.acceptInvitation({
        token: inviteToken,
        password: invitePassword,
      });

      if (data?.accessToken) {
        localStorage.setItem('auth_token', data.accessToken);
      }
      const assignedRole = (data?.user?.role || inviteData?.role || 'employee') as any;
      const assignedRoles = (Array.isArray(data?.user?.roles) && data.user.roles.length > 0
        ? data.user.roles
        : [assignedRole]) as any;

      setRole(assignedRole);
      setRoles(assignedRoles);

      toast.success('Welcome aboard! Your account has been activated.');
      navigate('/');
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Failed to activate account.');
    } finally {
      setAcceptLoading(false);
    }
  };

  // -------------------------------------------------------------
  // REGULAR WORKSPACE CREATION MODE (When no ?token= is present)
  // -------------------------------------------------------------
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgSlug) {
      toast.error('Please enter the organization name and workspace URL.');
      return;
    }
    setStep(2);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      toast.error('Please fill in all administrator details.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.register({
        orgName,
        orgSlug,
        supportEmail,
        firstName,
        lastName,
        email,
        password,
      });

      const token = data?.accessToken || data?.token;
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      const userRole = (data?.user?.role || 'owner') as any;
      setRole(userRole);
      setRoles([userRole]);

      toast.success('Workspace created successfully!');
      navigate('/');
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateSlug = (val: string) => {
    setOrgName(val);
    setOrgSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_40%)]" />

      {/* Card Container */}
      <div className="relative w-full max-w-lg space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md">
        
        {/* ========================================================= */}
        {/* INVITATION ACCEPTANCE VIEW                                */}
        {/* ========================================================= */}
        {inviteToken ? (
          <div>
            {isVerifying ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-sm text-gray-400">Verifying your team invitation...</p>
              </div>
            ) : inviteError ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="h-14 w-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-white">Invalid or Expired Invitation</h2>
                <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                  {inviteError}
                </p>
                <div className="pt-2">
                  <Button asChild variant="outline" className="border-white/10 text-white hover:bg-white/5">
                    <Link to="/login">Go to Sign In</Link>
                  </Button>
                </div>
              </div>
            ) : inviteData ? (
              <div>
                <div className="flex flex-col items-center justify-center text-center">
                  {inviteData.organizationLogo ? (
                    <img src={inviteData.organizationLogo} alt={inviteData.organizationName} className="h-10 object-contain mb-3" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-2.5 shadow-lg shadow-indigo-500/20 mb-3">
                      <Building2 className="h-full w-full text-white" />
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
                    <ShieldCheck className="h-3.5 w-3.5" /> Team Invitation
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    Welcome, {inviteData.fullName || inviteData.firstName || 'Team Member'}!
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-gray-400 max-w-sm">
                    You have been invited to join <span className="font-semibold text-white">{inviteData.organizationName}</span> on Talnova Onboarding. Set your password to activate your account.
                  </p>
                </div>

                <form className="mt-8 space-y-4" onSubmit={handleAcceptInvitation}>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Account Email
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        type="email"
                        disabled
                        value={inviteData.email}
                        className="block w-full rounded-lg border border-white/10 bg-white/[0.02] py-2.5 pl-10 pr-4 text-sm text-gray-300 cursor-not-allowed outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Create Password
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className={`block w-full rounded-lg border bg-white/[0.05] py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:ring-2 ${
                          invitePassword.length > 0 && invitePassword.length < 8
                            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {invitePassword.length > 0 && invitePassword.length < 8 && (
                      <p className="mt-1 text-xs text-rose-400 font-medium">
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
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type your password"
                        className={`block w-full rounded-lg border bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:ring-2 ${
                          confirmPassword.length > 0 && confirmPassword !== invitePassword
                            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20'
                            : 'border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20'
                        }`}
                      />
                    </div>
                    {confirmPassword.length > 0 && confirmPassword !== invitePassword && (
                      <p className="mt-1 text-xs text-rose-400 font-medium">
                        Passwords do not match.
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={acceptLoading || invitePassword.length < 8 || invitePassword !== confirmPassword}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-white hover:from-indigo-600 hover:to-indigo-700 mt-6 font-medium shadow-lg shadow-indigo-500/20"
                  >
                    {acceptLoading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        Activate Account & Sign In
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="text-center mt-6">
                  <p className="text-xs text-gray-500">
                    Already have your password set?{' '}
                    <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
                      Sign in directly
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* ========================================================= */
          /* NEW WORKSPACE REGISTRATION VIEW                           */
          /* ========================================================= */
          <>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-2.5 shadow-lg shadow-emerald-500/20">
                <Building2 className="h-full w-full text-white" />
              </div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
                {t('register.title')}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {t('register.subtitle')}
              </p>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-2">
              <div className={`h-2 w-12 rounded-full transition-all ${step === 1 ? 'bg-indigo-500' : 'bg-white/20'}`} />
              <div className={`h-2 w-12 rounded-full transition-all ${step === 2 ? 'bg-indigo-500' : 'bg-white/20'}`} />
            </div>

            {step === 1 ? (
              <form className="mt-8 space-y-6" onSubmit={handleNextStep}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t('register.orgName')}
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => autoGenerateSlug(e.target.value)}
                        placeholder="Acme Corp"
                        className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Workspace URL
                    </label>
                    <div className="relative mt-1 flex rounded-lg shadow-sm">
                      <span className="inline-flex items-center rounded-l-lg border border-r-0 border-white/10 bg-white/[0.02] px-3 text-sm text-gray-500">
                        talnova.app/
                      </span>
                      <input
                        type="text"
                        required
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        placeholder="acme-corp"
                        className="block w-full rounded-r-lg border border-white/10 bg-white/[0.05] py-2.5 px-3 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Support Email
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="support@acme.com"
                        className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-white hover:from-emerald-600 hover:to-emerald-700"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <form className="mt-8 space-y-6" onSubmit={handleFormSubmit}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {t('register.firstName')}
                      </label>
                      <div className="relative mt-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                          <User className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jane"
                          className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {t('register.lastName')}
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 px-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t('register.email')}
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
                        placeholder="jane@acme.com"
                        className="block w-full rounded-lg border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none ring-offset-[#0B0F19] transition-all hover:border-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t('register.password')}
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
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex items-center justify-center gap-2 rounded-lg border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-white hover:from-indigo-600 hover:to-indigo-700"
                  >
                    {loading ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        {t('register.submit')}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center">
              <p className="text-xs text-gray-500">
                {t('register.alreadyHave')}{' '}
                <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
                  {t('register.signIn')}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
