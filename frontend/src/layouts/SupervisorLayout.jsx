import { Layout, Menu, Typography } from 'antd';
import { FileTextOutlined, TeamOutlined, FilePdfOutlined, DashboardOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { canAccessRoute, useAuth } from '../config/auth.jsx';
import UserProfileMenu from '../components/UserProfileMenu';

const { Header, Sider, Content } = Layout;

export default function SupervisorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const selectedKey = location.pathname.includes('/customers') ? 'customers' : 'activities';

  const items = [];
  if (user?.role_name === 'ADMIN') {
    items.push({ key: 'admin', icon: <DashboardOutlined />, label: 'Admin dashboard' });
  }
  items.push(
    { key: 'activities', icon: <FileTextOutlined />, label: 'Activities' },
    { key: 'customers', icon: <TeamOutlined />, label: 'Customers' },
  );
  if (canAccessRoute(user, 'user')) {
    items.push({ key: 'reports', icon: <FilePdfOutlined />, label: 'Reports' });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Typography.Text className="brand-mark" style={{ color: '#fff', fontSize: 18 }}>
          Quotation Modal
        </Typography.Text>
        <UserProfileMenu />
      </Header>
      <Layout>
        <Sider width={220} theme="dark">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ paddingTop: 12 }}
            items={items}
            onClick={({ key }) => {
              if (key === 'admin') navigate('/admin');
              else if (key === 'reports') navigate('/user/reports');
              else navigate(`/supervisor/${key}`);
            }}
          />
        </Sider>
        <Layout style={{ padding: 24 }}>
          <Content>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
