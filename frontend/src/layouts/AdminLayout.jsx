import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FilePdfOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import UserProfileMenu from '../components/UserProfileMenu';

const { Header, Sider, Content } = Layout;

const PATH_KEY = [
  ['/admin/team', 'team'],
  ['/admin/quotations', 'quotations'],
  ['/admin/analytics', 'analytics'],
  ['/admin', 'dashboard'],
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = PATH_KEY.find(([path]) => location.pathname.startsWith(path))?.[1] || 'dashboard';

  return (
    <Layout className="app-shell">
      <Header className="app-shell-header">
        <Typography.Text className="brand-mark" style={{ color: '#fff', fontSize: 18 }}>
          Quotation Modal
        </Typography.Text>
        <UserProfileMenu />
      </Header>
      <Layout className="app-shell-body">
        <Sider width={220} theme="dark" className="app-shell-sider">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ paddingTop: 12, height: '100%', borderInlineEnd: 0 }}
            items={[
              { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
              { key: 'quotations', icon: <FilePdfOutlined />, label: 'Quotations' },
              { key: 'team', icon: <TeamOutlined />, label: 'Team' },
              { key: 'analytics', icon: <BarChartOutlined />, label: 'Analytics' },
              { type: 'divider' },
              { key: 'master', icon: <SettingOutlined />, label: 'Master data' },
            ]}
            onClick={({ key }) => {
              if (key === 'master') navigate('/supervisor/activities');
              else if (key === 'dashboard') navigate('/admin');
              else navigate(`/admin/${key}`);
            }}
          />
        </Sider>
        <Content className="app-shell-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
