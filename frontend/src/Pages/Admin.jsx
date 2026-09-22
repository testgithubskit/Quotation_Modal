import { Layout } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  AppstoreOutlined,
  BankOutlined,
  FileTextOutlined,
  FormOutlined,
  FileDoneOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import RequireRole from '../Components/RequireRole';
import Sidebar from '../Components/sidebar';
import Dashboard from './AdminComponents/Dashboard';
import Customers from './AdminComponents/Customers';
import Activities from './AdminComponents/Activities';
import Configuration from './AdminComponents/Configuration';
import Templates from './AdminComponents/Templates';
import GeneratedReports from './AdminComponents/GeneratedReports';
import Team from './AdminComponents/Team';

const { Content } = Layout;

const PATH_KEY = [
  ['/admin/customers', 'customers'],
  ['/admin/activities', 'activities'],
  ['/admin/report/design', 'report-design'],
  ['/admin/report/generated', 'report-generated'],
  ['/admin/templates', 'report-design'],
  ['/admin/configuration', 'configuration'],
  ['/admin/team', 'team'],
  ['/admin', 'dashboard'],
];

function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = PATH_KEY.find(([path]) => location.pathname.startsWith(path))?.[1] || 'dashboard';

  return (
    <Layout className="flex h-screen overflow-hidden !bg-transparent">
      <Sidebar
        selectedKeys={[selectedKey]}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
          { key: 'team', icon: <TeamOutlined />, label: 'Users' },
          { key: 'customers', icon: <UserOutlined />, label: 'Customers' },
          { key: 'activities', icon: <AppstoreOutlined />, label: 'Activities' },
          {
            key: 'report',
            icon: <FileTextOutlined />,
            label: 'Report',
            children: [
              { key: 'report-design', icon: <FormOutlined />, label: 'Design template' },
              { key: 'report-generated', icon: <FileDoneOutlined />, label: 'Generated Reports' },
            ],
          },
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
      <Content className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100 p-4 font-sans">
        <Outlet />
      </Content>
    </Layout>
  );
}

export default function Admin() {
  return (
    <Routes>
      <Route element={<RequireRole allowed="admin" />}>
        <Route element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="team" element={<Team />} />
          <Route path="customers" element={<Customers />} />
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
