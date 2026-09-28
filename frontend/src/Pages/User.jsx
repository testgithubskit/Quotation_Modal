import { Layout } from 'antd';
import { BellOutlined, FilePdfOutlined } from '@ant-design/icons';
import Notification from './UserComponents/Notification';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Footer from '../Components/Footer';
import Navbar from '../Components/Navbar';
import RequireRole from '../Components/RequireRole';
import Sidebar from '../Components/sidebar';
import GenerateReport from './UserComponents/GenerateReport';
import Reports from './UserComponents/Reports';
import useNotificationUnreadCount from '../hooks/useNotificationUnreadCount';

const { Content } = Layout;

function UserShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count: notificationCount } = useNotificationUnreadCount(true);
  const onNotifications = location.pathname.includes('/notifications');
  const onGenerate = location.pathname.includes('/generate');
  const selectedKey = onNotifications ? 'notifications' : 'reports';
  const pageTitle = onNotifications ? 'Notifications' : (onGenerate ? 'Generate Report' : 'Reports');

  return (
    <Layout className="flex h-screen overflow-hidden !bg-transparent">
      <Sidebar
        selectedKeys={[selectedKey]}
        badgeByKey={{ notifications: notificationCount }}
        items={[
          { key: 'reports', icon: <FilePdfOutlined />, label: 'Reports' },
          { key: 'notifications', icon: <BellOutlined />, label: 'Notifications' },
        ]}
        onMenuClick={({ key }) => navigate(`/user/${key}`)}
      />
      <Layout className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden !bg-slate-100">
        <Navbar title={pageTitle} />
        <Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 font-sans">
          <Outlet />
        </Content>
        <Footer />
      </Layout>
    </Layout>
  );
}

export default function User() {
  return (
    <Routes>
      <Route element={<RequireRole allowed="user" />}>
        <Route element={<UserShell />}>
          <Route path="generate" element={<GenerateReport />} />
          <Route path="reports" element={<Reports />} />
          <Route
            path="notifications"
            element={<Notification />}
          />
          <Route index element={<Navigate to="reports" replace />} />
          <Route path="*" element={<Navigate to="reports" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
