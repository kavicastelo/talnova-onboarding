import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminDashboard } from './pages/AdminDashboard';
import { JourneysList } from './pages/JourneysList';
import { JourneyBuilder } from './pages/JourneyBuilder';
import { EmployeeDirectory } from './pages/EmployeeDirectory';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { CourseViewer } from './pages/CourseViewer';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Certificates } from './pages/Certificates';
import { Tasks } from './pages/Tasks';
import { Workflows } from './pages/Workflows';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { Documents } from './pages/Documents';
import { DocumentSigner } from './pages/DocumentSigner';
import { Milestones } from './pages/Milestones';
import { BuddyProgram } from './pages/BuddyProgram';
import { CalendarIntegration } from './pages/CalendarIntegration';
import { HROperations } from './pages/HROperations';
import { HROpsExceptions } from './pages/HROpsExceptions';
import { Leaderboard } from './pages/Leaderboard';
import { AIAssistant } from './pages/AIAssistant';
import { AICourseBuilder } from './pages/AICourseBuilder';
import { SSOSettings } from './pages/SSOSettings';
import { HRISIntegrations } from './pages/HRISIntegrations';
import { OfficeMap } from './pages/OfficeMap';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminOrganizations } from './pages/SuperAdminOrganizations';
import { SuperAdminFinance } from './pages/SuperAdminFinance';
import { SuperAdminAlerts } from './pages/super-admin/SuperAdminAlerts';
import { SuperAdminOrganization360 } from './pages/super-admin/SuperAdminOrganization360';
import { SuperAdminUsers } from './pages/super-admin/SuperAdminUsers';
import { SuperAdminUser360 } from './pages/super-admin/SuperAdminUser360';
import { SuperAdminSessions } from './pages/super-admin/SuperAdminSessions';
import { SuperAdminOnboarding } from './pages/super-admin/SuperAdminOnboarding';
import { SuperAdminFeatures } from './pages/super-admin/SuperAdminFeatures';
import { SuperAdminTasksOps } from './pages/super-admin/SuperAdminTasksOps';
import { SuperAdminActivity } from './pages/super-admin/SuperAdminActivity';
import { SuperAdminObservability } from './pages/super-admin/SuperAdminObservability';
import { SuperAdminAudit } from './pages/super-admin/SuperAdminAudit';
import { SuperAdminReports } from './pages/super-admin/SuperAdminReports';
import { SuperAdminFeatureFlags } from './pages/super-admin/SuperAdminFeatureFlags';
import { SuperAdminPlatformSettings } from './pages/super-admin/SuperAdminPlatformSettings';
import { SuperAdminFilterProvider } from './context/SuperAdminFilterContext';
import { KnowledgeBaseSlideshow } from './pages/KnowledgeBaseSlideshow';
import { PublicCertificateViewer } from './pages/PublicCertificateViewer';
import { KioskPlayerPage } from './features/kiosk';
import { KioskDashboard } from './pages/KioskDashboard';
import { RoleProvider, useRole } from './context/RoleContext';
import { LocalizationProvider } from './context/LocalizationProvider';
import { SidebarProvider } from './components/Sidebar';
import { useScreenInit } from './useScreenInit';
import { Toaster } from 'sonner';
import { DemoAuthProvider } from '../demo/src/context/DemoAuthContext';
import { DemoAppShell } from '../demo/src/components/DemoAppShell';
import { DemoProtectedRoute } from '../demo/src/components/DemoProtectedRoute';
import { DemoLogin } from '../demo/src/pages/DemoLogin';
import { DemoInbox } from '../demo/src/pages/DemoInbox';
import { DemoDashboardRedirect } from '../demo/src/components/DemoDashboardRedirect';
import { DemoRestrictedPage } from '../demo/src/components/DemoRestrictedPage';
import { SuperAdminDemoManagement } from './pages/super-admin/demo/SuperAdminDemoManagement';
// Initialize i18n — must be imported before any component renders
import './i18n';

function DashboardRedirect() {
  const { role, roles, can } = useRole();
  if (role === 'super_admin' && can('view_super_admin')) return <SuperAdminDashboard />;
  if (role === 'manager' && can('view_team_ops')) return <ManagerDashboard />;
  if (role === 'it_admin' && can('manage_it_ops')) return <Navigate to="/tasks/it-ops" replace />;
  if ((role === 'admin' || role === 'owner') && can('manage_organization')) return <AdminDashboard />;
  if (role === 'hr_admin' && can('view_hr_ops')) return <AdminDashboard />;

  // Multi-role checks:
  if (can('manage_organization')) return <AdminDashboard />;
  if (can('view_team_ops') && !roles.includes('employee')) return <ManagerDashboard />;
  return <EmployeeDashboard />;
}

function NotFoundFallback() {
  const { t } = useTranslation('common');
  return (
    <div className="p-6 text-center text-muted-foreground">
      {t('pageNotFound', 'Page not found')}
    </div>
  );
}

export function App() {
  useScreenInit();
  return (
    <LocalizationProvider>
      <RoleProvider>
        <BrowserRouter>
          <SuperAdminFilterProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/accept-invite" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/kb/slideshow" element={<KnowledgeBaseSlideshow />} />
            <Route path="/public/certificate/:id" element={<PublicCertificateViewer />} />
            <Route path="/demo/login" element={<DemoAuthProvider><DemoLogin /></DemoAuthProvider>} />
            <Route path="/demo" element={<DemoAuthProvider><DemoProtectedRoute><DemoAppShell /></DemoProtectedRoute></DemoAuthProvider>}>
              <Route index element={<DemoDashboardRedirect />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="employee" element={<EmployeeDashboard />} />
              <Route path="manager" element={<ManagerDashboard />} />
              <Route path="journeys" element={<JourneysList />} />
              <Route path="journeys/:id" element={<JourneyBuilder />} />
              <Route path="course/:id" element={<CourseViewer />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="directory" element={<EmployeeDirectory />} />
              <Route path="directory/:id" element={<EmployeeProfile />} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="kb" element={<KnowledgeBase />} />
              <Route path="kb/:id" element={<KnowledgeBase />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:id/sign" element={<DocumentSigner />} />
              <Route path="milestones" element={<Milestones />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="buddy" element={<BuddyProgram />} />
              <Route path="calendar" element={<DemoRestrictedPage featureName="Calendar Integration" />} />
              <Route path="hr-ops" element={<DemoRestrictedPage featureName="HR Operations & Sync" />} />
              <Route path="hr-ops/*" element={<DemoRestrictedPage featureName="HR Operations & Sync" />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/integrations" element={<DemoRestrictedPage featureName="HRIS Integrations" />} />
              <Route path="settings/sso" element={<DemoRestrictedPage featureName="SSO Enforcement" />} />
              <Route path="inbox" element={<DemoInbox />} />
            </Route>

            <Route path="/" element={<SidebarProvider><AppShell /></SidebarProvider>}>
              <Route index element={<DashboardRedirect />} />
              <Route path="admin" element={<ProtectedRoute capability="manage_organization"><AdminDashboard /></ProtectedRoute>} />
              <Route path="super-admin" element={<ProtectedRoute capability="view_super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
              <Route path="super-admin/demo" element={<ProtectedRoute capability="view_super_admin"><SuperAdminDemoManagement /></ProtectedRoute>} />
              <Route path="super-admin/demo/*" element={<ProtectedRoute capability="view_super_admin"><SuperAdminDemoManagement /></ProtectedRoute>} />
              <Route path="super-admin/alerts" element={<ProtectedRoute capability="view_super_admin"><SuperAdminAlerts /></ProtectedRoute>} />
              <Route path="super-admin/organizations" element={<ProtectedRoute capability="view_super_admin"><SuperAdminOrganizations /></ProtectedRoute>} />
              <Route path="super-admin/organizations/:id" element={<ProtectedRoute capability="view_super_admin"><SuperAdminOrganization360 /></ProtectedRoute>} />
              <Route path="super-admin/users" element={<ProtectedRoute capability="view_super_admin"><SuperAdminUsers /></ProtectedRoute>} />
              <Route path="super-admin/users/sessions" element={<ProtectedRoute capability="view_super_admin"><SuperAdminSessions /></ProtectedRoute>} />
              <Route path="super-admin/users/:id" element={<ProtectedRoute capability="view_super_admin"><SuperAdminUser360 /></ProtectedRoute>} />
              <Route path="super-admin/onboarding" element={<ProtectedRoute capability="view_super_admin"><SuperAdminOnboarding /></ProtectedRoute>} />
              <Route path="super-admin/product/features" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFeatures /></ProtectedRoute>} />
              <Route path="super-admin/tasks-ops" element={<ProtectedRoute capability="view_super_admin"><SuperAdminTasksOps /></ProtectedRoute>} />
              <Route path="super-admin/activity" element={<ProtectedRoute capability="view_super_admin"><SuperAdminActivity /></ProtectedRoute>} />
              <Route path="super-admin/observability" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/observability/api" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/observability/logs" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/observability/infrastructure" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/observability/ai" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/observability/storage" element={<ProtectedRoute capability="view_super_admin"><SuperAdminObservability /></ProtectedRoute>} />
              <Route path="super-admin/finance" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFinance /></ProtectedRoute>} />
              <Route path="super-admin/finance/invoices" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFinance /></ProtectedRoute>} />
              <Route path="super-admin/finance/payments" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFinance /></ProtectedRoute>} />
              <Route path="super-admin/finance/expenses" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFinance /></ProtectedRoute>} />
              <Route path="super-admin/finance/accounts" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFinance /></ProtectedRoute>} />
              <Route path="super-admin/audit" element={<ProtectedRoute capability="view_super_admin"><SuperAdminAudit /></ProtectedRoute>} />
              <Route path="super-admin/reports" element={<ProtectedRoute capability="view_super_admin"><SuperAdminReports /></ProtectedRoute>} />
              <Route path="super-admin/settings/flags" element={<ProtectedRoute capability="view_super_admin"><SuperAdminFeatureFlags /></ProtectedRoute>} />
              <Route path="super-admin/settings/platform" element={<ProtectedRoute capability="view_super_admin"><SuperAdminPlatformSettings /></ProtectedRoute>} />
              <Route path="journeys" element={<ProtectedRoute featureFlag="journey_templates"><JourneysList /></ProtectedRoute>} />
              <Route path="journeys/:id" element={<ProtectedRoute featureFlag="journey_builder"><JourneyBuilder /></ProtectedRoute>} />
              <Route path="kiosks" element={<ProtectedRoute capability="manage_organization" featureFlag="kiosk_mode"><KioskDashboard /></ProtectedRoute>} />
              <Route path="directory" element={<ProtectedRoute capability="view_directory"><EmployeeDirectory /></ProtectedRoute>} />
              <Route path="directory/:id" element={<ProtectedRoute capability="view_directory"><EmployeeProfile /></ProtectedRoute>} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="profile/:id" element={<EmployeeProfile />} />
              <Route path="employee" element={<EmployeeDashboard />} />
              <Route path="kb" element={<ProtectedRoute featureFlag="knowledge_base"><KnowledgeBase /></ProtectedRoute>} />
              <Route path="kb/:id" element={<ProtectedRoute featureFlag="knowledge_base"><KnowledgeBase /></ProtectedRoute>} />
              <Route path="knowledge-base/:id" element={<ProtectedRoute featureFlag="knowledge_base"><KnowledgeBase /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute capability="view_analytics"><Analytics /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute capability="manage_organization"><Settings /></ProtectedRoute>} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="tasks" element={<ProtectedRoute featureFlag="checklist_tasks"><Tasks /></ProtectedRoute>} />
              <Route path="tasks/it-ops" element={<ProtectedRoute capability="manage_it_ops" featureFlag="checklist_tasks"><Tasks /></ProtectedRoute>} />
              <Route path="workflows" element={<ProtectedRoute capability="manage_workflows" featureFlag="workflow_rules"><Workflows /></ProtectedRoute>} />
              <Route path="manager" element={<ProtectedRoute capability="view_team_ops"><ManagerDashboard /></ProtectedRoute>} />
              <Route path="documents" element={<ProtectedRoute featureFlag="digital_signatures"><Documents /></ProtectedRoute>} />
              <Route path="documents/:id/sign" element={<ProtectedRoute featureFlag="digital_signatures"><DocumentSigner /></ProtectedRoute>} />
              <Route path="documents/sign/:id" element={<ProtectedRoute featureFlag="digital_signatures"><DocumentSigner /></ProtectedRoute>} />
              <Route path="milestones" element={<ProtectedRoute featureFlag="milestone_ratings"><Milestones /></ProtectedRoute>} />
              <Route path="buddy" element={<ProtectedRoute featureFlag="buddy_connection"><BuddyProgram /></ProtectedRoute>} />
              <Route path="calendar" element={<ProtectedRoute featureFlag="calendar_integration"><CalendarIntegration /></ProtectedRoute>} />
              <Route path="hr-ops" element={<ProtectedRoute capability="view_hr_ops"><HROperations /></ProtectedRoute>} />
              <Route path="hr-ops/exceptions" element={<ProtectedRoute capability="view_hr_ops"><HROpsExceptions /></ProtectedRoute>} />
              <Route path="leaderboard" element={<ProtectedRoute featureFlag="gamified_milestones"><Leaderboard /></ProtectedRoute>} />
              <Route path="ai-assistant" element={<ProtectedRoute featureFlag="ai_assistant"><AIAssistant /></ProtectedRoute>} />
              <Route path="ai-course-builder" element={<ProtectedRoute capability="ai_course_builder" featureFlag="ai_course_builder"><AICourseBuilder /></ProtectedRoute>} />
              <Route path="settings/sso" element={<ProtectedRoute capability="manage_sso" featureFlag="sso_enforcement"><SSOSettings /></ProtectedRoute>} />
              <Route path="settings/integrations" element={<ProtectedRoute capability="manage_integrations" featureFlag="advanced_hris_sync"><HRISIntegrations /></ProtectedRoute>} />
              <Route path="office-map" element={<ProtectedRoute featureFlag="office_map"><OfficeMap /></ProtectedRoute>} />
              <Route path="*" element={<NotFoundFallback />} />
            </Route>
            <Route path="/course/:id" element={<CourseViewer />} />
            <Route path="/kiosk/play/:id" element={<KioskPlayerPage />} />
          </Routes>
          </SuperAdminFilterProvider>
        </BrowserRouter>
        <Toaster richColors closeButton position="top-right" />
      </RoleProvider>
    </LocalizationProvider>
  );
}