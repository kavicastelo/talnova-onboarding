import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
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
import { Leaderboard } from './pages/Leaderboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { SuperAdminOrganizations } from './pages/SuperAdminOrganizations';
import { SuperAdminFinance } from './pages/SuperAdminFinance';
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
  return role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}

export function App() {
  useScreenInit();
  return (
    <LocalizationProvider>
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/kb/slideshow" element={<KnowledgeBaseSlideshow />} />
            <Route path="/public/certificate/:id" element={<PublicCertificateViewer />} />

            <Route path="/" element={<SidebarProvider><AppShell /></SidebarProvider>}>
              <Route index element={<DashboardRedirect />} />
              <Route path="super-admin" element={<SuperAdminDashboard />} />
              <Route path="super-admin/organizations" element={<SuperAdminOrganizations />} />
              <Route path="super-admin/finance" element={<SuperAdminFinance />} />
              <Route path="journeys" element={<JourneysList />} />
              <Route path="journeys/:id" element={<JourneyBuilder />} />
              <Route path="kiosks" element={<KioskDashboard />} />
              <Route path="directory" element={<EmployeeDirectory />} />
              <Route path="directory/:id" element={<EmployeeProfile />} />
              <Route path="employee" element={<EmployeeDashboard />} />
              <Route path="kb" element={<KnowledgeBase />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="workflows" element={<Workflows />} />
              <Route path="manager" element={<ManagerDashboard />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/:id/sign" element={<DocumentSigner />} />
              <Route path="milestones" element={<Milestones />} />
              <Route path="buddy" element={<BuddyProgram />} />
              <Route path="calendar" element={<CalendarIntegration />} />
              <Route path="hr-ops" element={<HROperations />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route
                path="*"
                element={
                  <div className="p-6 text-center text-muted-foreground">
                    Coming soon
                  </div>
                }
              />
            </Route>
            <Route path="/course/:id" element={<CourseViewer />} />
            <Route path="/kiosk/play/:id" element={<KioskPlayerPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors closeButton position="top-right" />
      </RoleProvider>
    </LocalizationProvider>
  );
}