import { Layout } from 'antd';
import { FilePdfOutlined, PlusSquareOutlined, DashboardOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../config/auth.jsx';
import AppSidebar from '../components/AppSidebar';

const { Content } = Layout;

export default function UserLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const selectedKey = location.pathname.includes('/generate')
    ? 'generate'
    : location.pathname.includes('/templates')
      ? 'templates'
      : 'reports';
  const flushContent = location.pathname.includes('/templates');

  const items = [];
  if (user?.role_name === 'ADMIN') {
    items.push({ key: 'admin', icon: <DashboardOutlined />, label: 'Admin dashboard' });
  }
  items.push(
    { key: 'reports', icon: <FilePdfOutlined />, label: 'Report' },
    { key: 'generate', icon: <PlusSquareOutlined />, label: 'Generate Report' },
  );

  return (
    <Layout className="app-shell app-shell--sidebar">
      <AppSidebar
        selectedKeys={[selectedKey]}
        items={items}
        onMenuClick={({ key }) => {
          if (key === 'admin') navigate('/admin');
          else navigate(`/user/${key}`);
        }}
      />
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
  );
}
