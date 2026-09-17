import { Layout, Menu, Typography } from 'antd';
import { FilePdfOutlined, PlusSquareOutlined, SettingOutlined, DashboardOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { canAccessRoute, useAuth } from '../config/auth.jsx';
import UserProfileMenu from '../components/UserProfileMenu';

const { Header, Sider, Content } = Layout;

export default function UserLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const selectedKey = location.pathname.includes('/generate') ? 'generate' : 'reports';
  const flushContent = location.pathname.includes('/templates');

  const items = [];
  if (user?.role_name === 'ADMIN') {
    items.push({ key: 'admin', icon: <DashboardOutlined />, label: 'Admin dashboard' });
  }
  items.push(
    { key: 'reports', icon: <FilePdfOutlined />, label: 'Report' },
    { key: 'generate', icon: <PlusSquareOutlined />, label: 'Generate Report' },
  );
  if (canAccessRoute(user, 'supervisor')) {
    items.push({ key: 'master', icon: <SettingOutlined />, label: 'Master data' });
  }

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
            items={items}
            onClick={({ key }) => {
              if (key === 'admin') navigate('/admin');
              else if (key === 'master') navigate('/supervisor/activities');
              else navigate(`/user/${key}`);
            }}
          />
        </Sider>
        <Content className={`app-shell-content${flushContent ? ' app-shell-content--flush' : ''}`}>
          {flushContent ? (
            <div className="report-designer-root" style={{ height: '100%' }}>
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
