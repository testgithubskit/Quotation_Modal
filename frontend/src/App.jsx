import { App as AntApp, ConfigProvider, Spin } from 'antd';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homePathForUser, useAuth } from './config/auth.jsx';
import { antdTheme } from './theme';
import { DataProvider } from './store/DataContext';

import RoleLogin from './pages/RoleLogin';
import RequireRole from './components/RequireRole';
import AdminLayout from './layouts/AdminLayout';
import SupervisorLayout from './layouts/SupervisorLayout';
import UserLayout from './layouts/UserLayout';

import AdminDashboard from './pages/admin/Dashboard';
import AdminQuotations from './pages/admin/Quotations';
import AdminTeam from './pages/admin/Team';
import AdminAnalytics from './pages/admin/Analytics';

import Activities from './pages/supervisor/Activities';
import Customers from './pages/supervisor/Customers';

import Reports from './pages/user/Reports';
import GenerateReport from './pages/user/GenerateReport';
import ReportView from './pages/user/ReportView';
import ReportEdit from './pages/user/ReportEdit';
import ReportDesigner from './pages/reportDesigner/ReportDesigner.jsx';
import ReportTemplateEditor from './pages/reportDesigner/ReportTemplateEditor.jsx';

function AppRoutes() {
  const { user, booting, isAuthenticated } = useAuth();

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const home = homePathForUser(user);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={home} replace /> : <RoleLogin />}
      />

      <Route element={<RequireRole allowed="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="quotations" element={<AdminQuotations />} />
          <Route path="team" element={<AdminTeam />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>
      </Route>

      <Route element={<RequireRole allowed="supervisor" />}>
        <Route path="/supervisor" element={<SupervisorLayout />}>
          <Route path="activities" element={<Activities />} />
          <Route path="customers" element={<Customers />} />
          <Route index element={<Navigate to="activities" replace />} />
        </Route>
      </Route>

      <Route element={<RequireRole allowed="user" />}>
        <Route path="/user" element={<UserLayout />}>
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id/view" element={<ReportView />} />
          <Route path="reports/:id/edit" element={<ReportEdit />} />
          <Route path="generate" element={<GenerateReport />} />
          <Route path="templates" element={<ReportDesigner />} />
          <Route path="templates/new" element={<ReportTemplateEditor />} />
          <Route path="templates/edit/:id" element={<ReportTemplateEditor />} />
          <Route index element={<Navigate to="reports" replace />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntApp>
        <AuthProvider>
          <DataProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </DataProvider>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
