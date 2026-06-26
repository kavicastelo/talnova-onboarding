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
import { RoleProvider } from './context/RoleContext';
import { useScreenInit } from './useScreenInit';
import { Toaster } from 'sonner';

export function App() {
  useScreenInit();
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<AdminDashboard />} />
            <Route path="journeys" element={<JourneysList />} />
            <Route path="journeys/:id" element={<JourneyBuilder />} />
            <Route path="directory" element={<EmployeeDirectory />} />
            <Route path="directory/:id" element={<EmployeeProfile />} />
            <Route path="employee" element={<EmployeeDashboard />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
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
        </Routes>
      </BrowserRouter>
      <Toaster richColors closeButton position="top-right" />
    </RoleProvider>
  );
}