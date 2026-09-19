import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
// Initialize i18n — must be imported before any component renders
import './i18n';

function DashboardRedirect() {
  const { role } = useRole();
  if (role === 'super_admin') return <SuperAdminDashboard />;
  if (role === 'manager') return <ManagerDashboard />;
  return role === 'admin' || role === 'owner' || role === 'hr_admin' ? <AdminDashboard /> : <EmployeeDashboard />;
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/kb/slideshow" element={<KnowledgeBaseSlideshow />} />
            <Route path="/public/certificate/:id" element={<PublicCertificateViewer />} />

            <Route path="/" element={<SidebarProvider><AppShell /></SidebarProvider>}>
              <Route index element={<DashboardRedirect />} />
              <Route path="super-admin" element={<ProtectedRoute capability="view_super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
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
              <Route path="journeys" element={<JourneysList />} />
              <Route path="journeys/:id" element={<JourneyBuilder />} />
              <Route path="kiosks" element={<ProtectedRoute capability="manage_organization"><KioskDashboard /></ProtectedRoute>} />
              <Route path="directory" element={<EmployeeDirectory />} />
              <Route path="directory/:id" element={<EmployeeProfile />} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="profile/:id" element={<EmployeeProfile />} />
              <Route path="employee" element={<EmployeeDashboard />} />
              <Route path="kb" element={<KnowledgeBase />} />
              <Route path="kb/:id" element={<KnowledgeBase />} />
              <Route path="knowledge-base/:id" element={<KnowledgeBase />} />
              <Route path="analytics" element={<ProtectedRoute capability="view_analytics"><Analytics /></ProtectedRoute>} />
              <Route path="settings" element={<Settings />} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="tasks/it-ops" element={<ProtectedRoute capability="manage_it_ops"><Tasks /></ProtectedRoute>} />
              <Route path="workflows" element={<ProtectedRoute capability="manage_workflows"><Workflows /></ProtectedRoute>} />
              <Route path="manager" element={<ProtectedRoute capability="view_team_ops"><ManagerDashboard /></ProtectedRoute>} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:id/sign" element={<DocumentSigner />} />
              <Route path="documents/sign/:id" element={<DocumentSigner />} />
              <Route path="milestones" element={<Milestones />} />
              <Route path="buddy" element={<BuddyProgram />} />
              <Route path="calendar" element={<CalendarIntegration />} />
              <Route path="hr-ops" element={<ProtectedRoute capability="view_hr_ops"><HROperations /></ProtectedRoute>} />
              <Route path="hr-ops/exceptions" element={<ProtectedRoute capability="view_hr_ops"><HROpsExceptions /></ProtectedRoute>} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="ai-course-builder" element={<ProtectedRoute capability="ai_course_builder"><AICourseBuilder /></ProtectedRoute>} />
              <Route path="settings/sso" element={<ProtectedRoute capability="manage_sso"><SSOSettings /></ProtectedRoute>} />
              <Route path="settings/integrations" element={<ProtectedRoute capability="manage_integrations"><HRISIntegrations /></ProtectedRoute>} />
              <Route path="office-map" element={<OfficeMap />} />
              <Route
                path="*"
                element={
                  <div className="p-6 text-center text-muted-foreground">
                    Page not found
                  </div>
                }
              />
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