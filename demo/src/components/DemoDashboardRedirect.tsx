import React from 'react';
import { useDemoAuth } from '../context/DemoAuthContext';
import { AdminDashboard } from '../../../src/pages/AdminDashboard';
import { ManagerDashboard } from '../../../src/pages/ManagerDashboard';
import { EmployeeDashboard } from '../../../src/pages/EmployeeDashboard';

export const DemoDashboardRedirect: React.FC = () => {
  const { user } = useDemoAuth();

  if (!user) {
    return <AdminDashboard />;
  }

  const role = user.role?.toLowerCase() || '';

  if (role.includes('manager')) {
    return <ManagerDashboard />;
  }

  if (role.includes('employee')) {
    return <EmployeeDashboard />;
  }

  return <AdminDashboard />;
};
