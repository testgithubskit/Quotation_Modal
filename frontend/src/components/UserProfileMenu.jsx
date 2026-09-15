import { Avatar, Dropdown, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../config/auth.jsx';

export default function UserProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = user.full_name || user.email;
  const roleLabel = user.role_name;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dropdownContent = (
    <div className="profile-dropdown">
      <div className="profile-dropdown-role">{user.email}</div>
      <div className="profile-dropdown-role">Role: {roleLabel}</div>
      <div className="profile-dropdown-divider" />
      <button type="button" className="profile-dropdown-logout" onClick={handleLogout}>
        <LogoutOutlined />
        <span>Logout</span>
      </button>
    </div>
  );

  return (
    <Dropdown dropdownRender={() => dropdownContent} trigger={['click']} placement="bottomRight">
      <div className="profile-trigger">
        <Avatar size={36} style={{ backgroundColor: '#B8863A', flexShrink: 0 }}>
          {displayName[0]?.toUpperCase()}
        </Avatar>
        <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>{displayName}</Typography.Text>
      </div>
    </Dropdown>
  );
}
