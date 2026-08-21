import React from 'react';
import { useRole } from '../context/RoleContext';
import { Capability } from '../utils/rbac';
import { ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  capability?: Capability;
  children: React.ReactNode;
}

export function ProtectedRoute({ capability, children }: ProtectedRouteProps) {
  const { can } = useRole();
  const navigate = useNavigate();

  if (capability && !can(capability)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Restricted</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          You do not have the required permissions to access this management area ({capability}). Please contact your organization administrator if you believe this is an error.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
