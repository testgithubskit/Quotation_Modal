import { Layout } from 'antd';
import { FilePdfOutlined, PlusSquareOutlined } from '@ant-design/icons';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import RequireRole from '../Components/RequireRole';
import Sidebar from '../Components/sidebar';
import GenerateReport from './UserComponents/GenerateReport';
import Reports from './UserComponents/Reports';

const { Content } = Layout;

function UserShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = location.pathname.includes('/reports') ? 'reports' : 'generate';

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
      <Content className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-4 font-sans">
        <Outlet />
      </Content>
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
