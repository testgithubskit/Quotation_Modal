import { useState } from 'react';
import { Avatar, Layout, Menu, Tooltip } from 'antd';
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../config/auth.jsx';

const { Sider } = Layout;

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Full-height dark sidebar: brand top, nav middle, user + collapse bottom.
 */
export default function AppSidebar({
  items = [],
  selectedKeys = [],
  onMenuClick,
  width = 236,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const displayName = user?.full_name || user?.email || 'User';
  const roleLabel = user?.role_name || '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={width}
      collapsedWidth={72}
      className="app-sidebar"
      theme="dark"
    >
      <div className="app-sidebar-inner">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-logo" aria-hidden>
            QM
          </div>
          {!collapsed ? (
            <div className="app-sidebar-brand-text">
              <span className="app-sidebar-brand-name">Quotation Modal</span>
            </div>
          ) : null}
        </div>

        <div className="app-sidebar-nav">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            items={items}
            onClick={onMenuClick}
            inlineCollapsed={collapsed}
            className="app-sidebar-menu"
          />
        </div>

        <div className="app-sidebar-footer">
          {user ? (
            <div className={`app-sidebar-user ${collapsed ? 'is-collapsed' : ''}`}>
              <Avatar size={36} className="app-sidebar-avatar">
                {initials(displayName)}
              </Avatar>
              {!collapsed ? (
                <div className="app-sidebar-user-meta">
                  <div className="app-sidebar-user-name" title={displayName}>{displayName}</div>
                  <div className="app-sidebar-user-role">{roleLabel}</div>
                </div>
              ) : null}
              <Tooltip title="Logout" placement="right">
                <button
                  type="button"
                  className="app-sidebar-logout"
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <LogoutOutlined />
                </button>
              </Tooltip>
            </div>
          ) : null}

          <button
            type="button"
            className="app-sidebar-collapse"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            {!collapsed ? <span>Collapse sidebar</span> : null}
          </button>
        </div>
      </div>
    </Sider>
  );
}
