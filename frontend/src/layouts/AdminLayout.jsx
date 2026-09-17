import { Layout } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FilePdfOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  UserOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppSidebar from '../components/AppSidebar';

const { Content } = Layout;

const PATH_KEY = [
  ['/admin/team', 'team'],
  ['/admin/quotations', 'quotations'],
  ['/admin/analytics', 'analytics'],
  ['/admin/activities', 'activities'],
  ['/admin/customers', 'customers'],
  ['/admin/company', 'company'],
  ['/admin', 'dashboard'],
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = PATH_KEY.find(([path]) => location.pathname.startsWith(path))?.[1] || 'dashboard';

  return (
    <Layout className="app-shell app-shell--sidebar">
      <AppSidebar
        selectedKeys={[selectedKey]}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
          { key: 'quotations', icon: <FilePdfOutlined />, label: 'Quotations' },
          { key: 'team', icon: <TeamOutlined />, label: 'Team' },
          { key: 'analytics', icon: <BarChartOutlined />, label: 'Analytics' },
          { type: 'divider' },
          { key: 'activities', icon: <AppstoreOutlined />, label: 'Activities' },
          { key: 'customers', icon: <UserOutlined />, label: 'Customers' },
          { key: 'company', icon: <BankOutlined />, label: 'Company Settings' },
        ]}
        onMenuClick={({ key }) => {
          if (key === 'dashboard') navigate('/admin');
          else navigate(`/admin/${key}`);
        }}
      />
      <Content className="app-shell-content">
        <Outlet />
      </Content>
    </Layout>
  );
}
