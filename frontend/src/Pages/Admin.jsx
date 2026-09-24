import { Layout } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  BankOutlined,
  FileTextOutlined,
  FormOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Footer from '../Components/Footer';
import Navbar from '../Components/Navbar';
import RequireRole from '../Components/RequireRole';
import Sidebar from '../Components/sidebar';
import Dashboard from './AdminComponents/Dashboard';
import Activities from './AdminComponents/Activities';
import Configuration from './AdminComponents/Configuration';
import Templates from './AdminComponents/Templates';
import GeneratedReports from './AdminComponents/GeneratedReports';

const { Content } = Layout;

const PATH_META = [
  ['/admin/activities', 'activities', 'Activities'],
  ['/admin/report/design', 'report-design', 'Design template'],
  ['/admin/report/generated', 'report-generated', 'Generated Reports'],
  ['/admin/templates', 'report-design', 'Design template'],
  ['/admin/configuration', 'configuration', 'Configuration'],
  ['/admin/customers', 'configuration', 'Configuration'],
  ['/admin', 'dashboard', 'Dashboard'],
];

function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = PATH_META.find(([path]) => location.pathname.startsWith(path));
  const selectedKey = meta?.[1] || 'dashboard';
  const pageTitle = meta?.[2] || 'Dashboard';

  return (
    <Layout className="flex h-screen overflow-hidden !bg-transparent">
      <Sidebar
        selectedKeys={[selectedKey]}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
          {
            key: 'report',
            icon: <FileTextOutlined />,
            label: 'Reports',
            children: [
              { key: 'report-design', icon: <FormOutlined />, label: 'Design template' },
              { key: 'report-generated', icon: <FileDoneOutlined />, label: 'Generated Reports' },
            ],
          },
          { key: 'activities', icon: <AppstoreOutlined />, label: 'Activities' },
          { key: 'configuration', icon: <BankOutlined />, label: 'Configuration' },
        ]}
        onMenuClick={({ key }) => {
          if (key === 'dashboard') navigate('/admin');
          else if (key === 'report-design') navigate('/admin/report/design');
          else if (key === 'report-generated') navigate('/admin/report/generated');
          else if (key === 'report') navigate('/admin/report/design');
          else navigate(`/admin/${key}`);
        }}
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

export default function Admin() {
  return (
    <Routes>
      <Route element={<RequireRole allowed="admin" />}>
        <Route element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="team" element={<Navigate to="/admin/configuration?tab=user" replace />} />
          <Route path="customers" element={<Navigate to="/admin/configuration?tab=customers" replace />} />
          <Route path="activities" element={<Activities />} />
          <Route path="report/design" element={<Templates />} />
          <Route path="report/generated" element={<GeneratedReports />} />
          <Route path="templates" element={<Navigate to="/admin/report/design" replace />} />
          <Route path="configuration" element={<Configuration />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
