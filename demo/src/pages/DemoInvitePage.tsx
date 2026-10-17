import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, ShieldAlert, Loader2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../../../src/components/Button';
import { Card, CardContent } from '../../../src/components/Card';
import { apiClient } from '../../../src/api/client';
import { useDemoAuth } from '../context/DemoAuthContext';
import { toast } from 'sonner';

export const DemoInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { loginWithToken } = useDemoAuth() as any;

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    isExpired?: boolean;
    isInvalid?: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorState({
        isInvalid: true,
        message: 'No invite token was provided in the invitation link.',
      });
      return;
    }

    const redeem = async () => {
      try {
        const res = await apiClient.post('/demo/auth/invite/redeem', { token });
        const data = res.data?.data || res.data;

        if (data?.token) {
          // Persist token
          localStorage.setItem('demo_access_token', data.token);
          if (data.user) {
            localStorage.setItem('demo_active_user', JSON.stringify(data.user));
          }

          if (loginWithToken) {
            loginWithToken(data.token, data.user, data.tenant);
          }

          toast.success(
            `Welcome to Talnova! Evaluation access granted for ${data.tenant?.name || 'your company'}.`
          );
          navigate('/demo', { replace: true });
        }
      } catch (err: any) {
        setLoading(false);
        const code = err?.response?.data?.error || err?.response?.data?.code || err?.code;
        const msg = err?.response?.data?.message || err?.message;

        if (code === 'INVITE_EXPIRED' || msg?.includes('expired')) {
          setErrorState({
            isExpired: true,
            message: 'This demonstration link has expired. Request an extension from the Talnova team.',
          });
        } else {
          setErrorState({
            isInvalid: true,
            message: msg || 'The demonstration invite link is invalid or has already been consumed.',
          });
        }
      }
    };

    redeem();
  }, [token, navigate, loginWithToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm mx-auto">
          <div className="relative mb-6 mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-75" />
            <div className="relative h-14 w-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Validating Evaluation Access
          </h2>
          <p className="text-sm text-muted-foreground">
            Verifying your cryptographic demonstration token and provisioning tenant sandbox...
          </p>
        </div>
      </div>
    );
  }

  if (errorState?.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60 bg-card/60 backdrop-blur-md text-center shadow-xl">
          <CardContent className="p-8">
            <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-md">
              <Clock className="h-8 w-8 animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-xs font-semibold text-amber-500 mb-3 border border-amber-500/20">
              <span>Time-Bombed Access Link</span>
              <span>•</span>
              <span>Expired</span>
            </div>

            <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-3">
              This demonstration link has expired
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Request an extension from the Talnova team to resume your interactive product evaluation.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() =>
                  (window.location.href =
                    'mailto:demo@talnova.com?subject=Talnova%20Demo%20Extension%20Request')
                }
                className="w-full gap-2 shadow-sm"
              >
                <Mail className="h-4 w-4" /> Request Access Extension
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/demo/login')}
                className="w-full gap-2"
              >
                Sign In with Credentials
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60 bg-card/60 backdrop-blur-md text-center shadow-xl">
        <CardContent className="p-8">
          <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-md">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-3">
            Invalid Invite Link
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {errorState?.message || 'This demonstration invitation token is invalid or malformed.'}
          </p>

          <Button onClick={() => navigate('/demo/login')} className="w-full gap-2">
            Return to Demo Login <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DemoInvitePage;
