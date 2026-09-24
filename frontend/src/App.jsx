import { useEffect } from 'react';
import { App as AntApp, ConfigProvider, Spin } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homePathForUser, useAuth } from './config/AuthContext.jsx';
import { installAutofillGuard } from './utils/disableAutofill.js';
import Login from './Pages/Login';
import Admin from './Pages/Admin';
import User from './Pages/User';

function AppRoutes() {
  const { user, booting, isAuthenticated } = useAuth();

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  const home = homePathForUser(user);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={home} replace /> : <Login />}
      />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/user/*" element={<User />} />
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => installAutofillGuard(), []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0D9488',
          colorInfo: '#0D9488',
          colorBgLayout: '#F1F5F9',
          colorBorder: '#CBD5E1',
          colorText: '#0F172A',
          borderRadius: 8,
          fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        },
        components: {
          Layout: {
            siderBg: '#134E4A',
            bodyBg: '#F1F5F9',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkItemSelectedBg: '#0D9488',
          },
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
