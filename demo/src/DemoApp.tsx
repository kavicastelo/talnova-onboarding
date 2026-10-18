import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';

// Context Providers
import { LocalizationProvider } from '../../src/context/LocalizationProvider';
import { RoleProvider } from '../../src/context/RoleContext';
import { DemoAuthProvider } from './context/DemoAuthContext';
import { DemoErrorBoundary } from './components/DemoErrorBoundary';
import { SuperAdminFilterProvider } from '../../src/context/SuperAdminFilterContext';

// Demo Core Shell & Guards
import { DemoAppShell } from './components/DemoAppShell';
import { DemoProtectedRoute } from './components/DemoProtectedRoute';
import { DemoDashboardRedirect } from './components/DemoDashboardRedirect';

// Demo Pages
import { DemoLogin } from './pages/DemoLogin';
import { DemoInbox } from './pages/DemoInbox';
import { DemoNotFound } from './pages/DemoNotFound';
import { DemoAccessDenied } from './pages/DemoAccessDenied';
import { DemoInvitePage } from './pages/DemoInvitePage';

// Shared Application Pages (All Mounted in Demo Mode - Full Product)
import { AdminDashboard } from '../../src/pages/AdminDashboard';
import { EmployeeDashboard } from '../../src/pages/EmployeeDashboard';
import { ManagerDashboard } from '../../src/pages/ManagerDashboard';
import { JourneysList } from '../../src/pages/JourneysList';
import { JourneyBuilder } from '../../src/pages/JourneyBuilder';
import { CourseViewer } from '../../src/pages/CourseViewer';
import { Tasks } from '../../src/pages/Tasks';
import { EmployeeDirectory } from '../../src/pages/EmployeeDirectory';
import { EmployeeProfile } from '../../src/pages/EmployeeProfile';
import { KnowledgeBase } from '../../src/pages/KnowledgeBase';
import { Analytics } from '../../src/pages/Analytics';
import { Documents } from '../../src/pages/Documents';
import { DocumentSigner } from '../../src/pages/DocumentSigner';
import { Milestones } from '../../src/pages/Milestones';
import { Leaderboard } from '../../src/pages/Leaderboard';
import { BuddyProgram } from '../../src/pages/BuddyProgram';
import { AIAssistant } from '../../src/pages/AIAssistant';
import { AICourseBuilder } from '../../src/pages/AICourseBuilder';
import { Settings } from '../../src/pages/Settings';
import { Certificates } from '../../src/pages/Certificates';
import { PublicCertificateViewer } from '../../src/pages/PublicCertificateViewer';
import { Workflows } from '../../src/pages/Workflows';
import { OfficeMap } from '../../src/pages/OfficeMap';
import { KnowledgeBaseSlideshow } from '../../src/pages/KnowledgeBaseSlideshow';
import { CalendarIntegration } from '../../src/pages/CalendarIntegration';
import { HROperations } from '../../src/pages/HROperations';
import { HROpsExceptions } from '../../src/pages/HROpsExceptions';
import { HRISIntegrations } from '../../src/pages/HRISIntegrations';
import { SSOSettings } from '../../src/pages/SSOSettings';

// Kiosk Frontline Pages
import { KioskDashboard } from '../../src/pages/KioskDashboard';
import { KioskComplianceDashboard } from '../../src/pages/kiosk/KioskComplianceDashboard';
import { KioskTerminalPage, KioskPairingScreen, KioskPlayerPage } from '../../src/features/kiosk';

// Super Admin / Platform Pages
import { SuperAdminDashboard } from '../../src/pages/SuperAdminDashboard';
import { SuperAdminOrganizations } from '../../src/pages/SuperAdminOrganizations';
import { SuperAdminOrganization360 } from '../../src/pages/super-admin/SuperAdminOrganization360';
import { SuperAdminUsers } from '../../src/pages/super-admin/SuperAdminUsers';
import { SuperAdminUser360 } from '../../src/pages/super-admin/SuperAdminUser360';
import { SuperAdminSessions } from '../../src/pages/super-admin/SuperAdminSessions';
import { SuperAdminOnboarding } from '../../src/pages/super-admin/SuperAdminOnboarding';
import { SuperAdminFeatures } from '../../src/pages/super-admin/SuperAdminFeatures';
import { SuperAdminFeatureFlags } from '../../src/pages/super-admin/SuperAdminFeatureFlags';
import { SuperAdminPackages } from '../../src/pages/super-admin/SuperAdminPackages';
import { SuperAdminTasksOps } from '../../src/pages/super-admin/SuperAdminTasksOps';
import { SuperAdminActivity } from '../../src/pages/super-admin/SuperAdminActivity';
import { SuperAdminObservability } from '../../src/pages/super-admin/SuperAdminObservability';
import { SuperAdminAudit } from '../../src/pages/super-admin/SuperAdminAudit';
import { SuperAdminReports } from '../../src/pages/super-admin/SuperAdminReports';
import { SuperAdminFinance } from '../../src/pages/SuperAdminFinance';
import { SuperAdminAlerts } from '../../src/pages/super-admin/SuperAdminAlerts';
import { SuperAdminPlatformSettings } from '../../src/pages/super-admin/SuperAdminPlatformSettings';
import { SuperAdminDemoManagement } from '../../src/pages/super-admin/demo/SuperAdminDemoManagement';

const DemoKioskPairRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <KioskPairingScreen
      onPairSuccess={() => {
        navigate('/demo/kiosk/terminal');
      }}
    />
  );
};

export const DemoApp: React.FC = () => {
  return (
    <LocalizationProvider>
      <RoleProvider>
        <DemoAuthProvider>
          <DemoErrorBoundary>
            <BrowserRouter>
              <SuperAdminFilterProvider>
                <Routes>
                  {/* Demo Authentication & Invite Routes */}
                  <Route path="/login" element={<DemoLogin />} />
                  <Route path="/demo/login" element={<DemoLogin />} />
                  <Route path="/invite" element={<DemoInvitePage />} />
                  <Route path="/demo/invite" element={<DemoInvitePage />} />

                  {/* Standalone Full-Screen Slideshow & Public Certificate Views */}
                  <Route path="/kb/slideshow" element={<DemoProtectedRoute><KnowledgeBaseSlideshow /></DemoProtectedRoute>} />
                  <Route path="/demo/kb/slideshow" element={<DemoProtectedRoute><KnowledgeBaseSlideshow /></DemoProtectedRoute>} />
                  <Route path="/public/certificate/:id" element={<PublicCertificateViewer />} />
                  <Route path="/demo/public/certificate/:id" element={<PublicCertificateViewer />} />

                  {/* Subdomain Root Mode (e.g. demo.talnova.io/*) */}
                  <Route
                    path="/"
                    element={
                      <DemoProtectedRoute>
                        <DemoAppShell />
                      </DemoProtectedRoute>
                    }
                  >
                    <Route index element={<DemoDashboardRedirect />} />
                    <Route path="admin" element={<AdminDashboard />} />
                    <Route path="employee" element={<EmployeeDashboard />} />
                    <Route path="manager" element={<ManagerDashboard />} />
                    <Route path="journeys" element={<JourneysList />} />
                    <Route path="journeys/:id" element={<JourneyBuilder />} />
                    <Route path="ai-course-builder" element={<AICourseBuilder />} />
                    <Route path="course/:id" element={<CourseViewer />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="tasks/it-ops" element={<Tasks />} />
                    <Route path="workflows" element={<Workflows />} />
                    <Route path="directory" element={<EmployeeDirectory />} />
                    <Route path="directory/:id" element={<EmployeeProfile />} />
                    <Route path="profile" element={<EmployeeProfile />} />
                    <Route path="office-map" element={<OfficeMap />} />
                    <Route path="kb" element={<KnowledgeBase />} />
                    <Route path="kb/:id" element={<KnowledgeBase />} />
                    <Route path="kb/slideshow" element={<KnowledgeBaseSlideshow />} />
                    <Route path="certificates" element={<Certificates />} />
                    <Route path="certificates/:id" element={<PublicCertificateViewer />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="documents/:id/sign" element={<DocumentSigner />} />
                    <Route path="milestones" element={<Milestones />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="buddy" element={<BuddyProgram />} />
                    <Route path="calendar" element={<CalendarIntegration />} />
                    <Route path="hr-ops" element={<HROperations />} />
                    <Route path="hr-ops/exceptions" element={<HROpsExceptions />} />
                    <Route path="ai-assistant" element={<AIAssistant />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="settings/integrations" element={<HRISIntegrations />} />
                    <Route path="settings/sso" element={<SSOSettings />} />
                    <Route path="kiosk" element={<KioskDashboard />} />
                    <Route path="kiosk/compliance" element={<KioskComplianceDashboard />} />
                    <Route path="kiosk/terminal" element={<KioskTerminalPage />} />
                    <Route path="kiosk/pair" element={<DemoKioskPairRoute />} />
                    <Route path="kiosk/play/:journeyId" element={<KioskPlayerPage />} />
                    <Route path="super-admin" element={<SuperAdminDashboard />} />
                    <Route path="super-admin/demo" element={<SuperAdminDemoManagement />} />
                    <Route path="super-admin/demo/*" element={<SuperAdminDemoManagement />} />
                    <Route path="super-admin/organizations" element={<SuperAdminOrganizations />} />
                    <Route path="super-admin/organizations/:id" element={<SuperAdminOrganization360 />} />
                    <Route path="super-admin/users" element={<SuperAdminUsers />} />
                    <Route path="super-admin/users/:id" element={<SuperAdminUser360 />} />
                    <Route path="super-admin/sessions" element={<SuperAdminSessions />} />
                    <Route path="super-admin/onboarding" element={<SuperAdminOnboarding />} />
                    <Route path="super-admin/features" element={<SuperAdminFeatures />} />
                    <Route path="super-admin/feature-flags" element={<SuperAdminFeatureFlags />} />
                    <Route path="super-admin/packages" element={<SuperAdminPackages />} />
                    <Route path="super-admin/tasks-ops" element={<SuperAdminTasksOps />} />
                    <Route path="super-admin/activity" element={<SuperAdminActivity />} />
                    <Route path="super-admin/observability" element={<SuperAdminObservability />} />
                    <Route path="super-admin/audit" element={<SuperAdminAudit />} />
                    <Route path="super-admin/reports" element={<SuperAdminReports />} />
                    <Route path="super-admin/finance" element={<SuperAdminFinance />} />
                    <Route path="super-admin/alerts" element={<SuperAdminAlerts />} />
                    <Route path="super-admin/settings" element={<SuperAdminPlatformSettings />} />
                    <Route path="inbox" element={<DemoInbox />} />
                    <Route path="403" element={<DemoAccessDenied />} />
                    <Route path="*" element={<DemoNotFound />} />
                  </Route>

                  {/* Subpath Mode (e.g. /demo/*) */}
                  <Route
                    path="/demo"
                    element={
                      <DemoProtectedRoute>
                        <DemoAppShell />
                      </DemoProtectedRoute>
                    }
                  >
                    <Route index element={<DemoDashboardRedirect />} />
                    <Route path="admin" element={<AdminDashboard />} />
                    <Route path="employee" element={<EmployeeDashboard />} />
                    <Route path="manager" element={<ManagerDashboard />} />
                    <Route path="journeys" element={<JourneysList />} />
                    <Route path="journeys/:id" element={<JourneyBuilder />} />
                    <Route path="ai-course-builder" element={<AICourseBuilder />} />
                    <Route path="course/:id" element={<CourseViewer />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="tasks/it-ops" element={<Tasks />} />
                    <Route path="workflows" element={<Workflows />} />
                    <Route path="directory" element={<EmployeeDirectory />} />
                    <Route path="directory/:id" element={<EmployeeProfile />} />
                    <Route path="profile" element={<EmployeeProfile />} />
                    <Route path="office-map" element={<OfficeMap />} />
                    <Route path="kb" element={<KnowledgeBase />} />
                    <Route path="kb/:id" element={<KnowledgeBase />} />
                    <Route path="kb/slideshow" element={<KnowledgeBaseSlideshow />} />
                    <Route path="certificates" element={<Certificates />} />
                    <Route path="certificates/:id" element={<PublicCertificateViewer />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="documents/:id/sign" element={<DocumentSigner />} />
                    <Route path="milestones" element={<Milestones />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="buddy" element={<BuddyProgram />} />
                    <Route path="calendar" element={<CalendarIntegration />} />
                    <Route path="hr-ops" element={<HROperations />} />
                    <Route path="hr-ops/exceptions" element={<HROpsExceptions />} />
                    <Route path="ai-assistant" element={<AIAssistant />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="settings/integrations" element={<HRISIntegrations />} />
                    <Route path="settings/sso" element={<SSOSettings />} />
                    <Route path="kiosk" element={<KioskDashboard />} />
                    <Route path="kiosk/compliance" element={<KioskComplianceDashboard />} />
                    <Route path="kiosk/terminal" element={<KioskTerminalPage />} />
                    <Route path="kiosk/pair" element={<DemoKioskPairRoute />} />
                    <Route path="kiosk/play/:journeyId" element={<KioskPlayerPage />} />
                    <Route path="super-admin" element={<SuperAdminDashboard />} />
                    <Route path="super-admin/demo" element={<SuperAdminDemoManagement />} />
                    <Route path="super-admin/demo/*" element={<SuperAdminDemoManagement />} />
                    <Route path="super-admin/organizations" element={<SuperAdminOrganizations />} />
                    <Route path="super-admin/organizations/:id" element={<SuperAdminOrganization360 />} />
                    <Route path="super-admin/users" element={<SuperAdminUsers />} />
                    <Route path="super-admin/users/:id" element={<SuperAdminUser360 />} />
                    <Route path="super-admin/sessions" element={<SuperAdminSessions />} />
                    <Route path="super-admin/onboarding" element={<SuperAdminOnboarding />} />
                    <Route path="super-admin/features" element={<SuperAdminFeatures />} />
                    <Route path="super-admin/feature-flags" element={<SuperAdminFeatureFlags />} />
                    <Route path="super-admin/packages" element={<SuperAdminPackages />} />
                    <Route path="super-admin/tasks-ops" element={<SuperAdminTasksOps />} />
                    <Route path="super-admin/activity" element={<SuperAdminActivity />} />
                    <Route path="super-admin/observability" element={<SuperAdminObservability />} />
                    <Route path="super-admin/audit" element={<SuperAdminAudit />} />
                    <Route path="super-admin/reports" element={<SuperAdminReports />} />
                    <Route path="super-admin/finance" element={<SuperAdminFinance />} />
                    <Route path="super-admin/alerts" element={<SuperAdminAlerts />} />
                    <Route path="super-admin/settings" element={<SuperAdminPlatformSettings />} />
                    <Route path="inbox" element={<DemoInbox />} />
                    <Route path="403" element={<DemoAccessDenied />} />
                    <Route path="*" element={<DemoNotFound />} />
                  </Route>
                </Routes>
              </SuperAdminFilterProvider>
              <Toaster richColors closeButton position="top-right" />
            </BrowserRouter>
          </DemoErrorBoundary>
        </DemoAuthProvider>
      </RoleProvider>
    </LocalizationProvider>
  );
};

export default DemoApp;
