import React from 'react';
import { Navigate } from 'react-router-dom';
import { useDemoAuth } from '../context/DemoAuthContext';

export const DemoProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useDemoAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/demo/login" replace />;
  }

  return <>{children}</>;
};

export default DemoProtectedRoute;
