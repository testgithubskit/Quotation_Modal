import { Avatar, Dropdown } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../config/AuthContext.jsx';

function roleLabel(role) {
  const raw = String(role || '').trim();
  if (!raw) return 'User';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function initial(name) {
  const s = String(name || '').trim();
  return (s[0] || 'U').toUpperCase();
}

export default function Navbar({ title = '' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.full_name || user?.email || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <h1 className="m-0 truncate text-lg font-semibold text-slate-800">{title}</h1>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            {
              key: 'role',
              disabled: true,
              label: (
                <span className="text-sm text-slate-600">
                  Role: {roleLabel(user?.role_name)}
                </span>
              ),
            },
            { type: 'divider' },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Logout',
              onClick: handleLogout,
            },
          ],
        }}
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full px-1 py-1 hover:bg-slate-50"
          aria-label="Account menu"
        >
          <Avatar size={32} className="!bg-blue-500 text-sm font-semibold">
            {initial(displayName)}
          </Avatar>
          <span className="max-w-[140px] truncate text-sm font-medium text-slate-800">
            {displayName}
          </span>
        </button>
      </Dropdown>
    </header>
  );
}
