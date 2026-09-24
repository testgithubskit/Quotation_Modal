import { Layout } from 'antd';
import { FilePdfOutlined, PlusSquareOutlined } from '@ant-design/icons';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Footer from '../Components/Footer';
import Navbar from '../Components/Navbar';
import RequireRole from '../Components/RequireRole';
import Sidebar from '../Components/sidebar';
import GenerateReport from './UserComponents/GenerateReport';
import Reports from './UserComponents/Reports';

const { Content } = Layout;

function UserShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const onReports = location.pathname.includes('/reports');
  const selectedKey = onReports ? 'reports' : 'generate';
  const pageTitle = onReports ? 'Reports' : 'Generate Report';

  return (
    <Layout className="flex h-screen overflow-hidden !bg-transparent">
      <Sidebar
        selectedKeys={[selectedKey]}
        items={[
          { key: 'generate', icon: <PlusSquareOutlined />, label: 'Generate Report' },
          { key: 'reports', icon: <FilePdfOutlined />, label: 'Reports' },
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
          <Route index element={<Navigate to="generate" replace />} />
          <Route path="*" element={<Navigate to="generate" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
