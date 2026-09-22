import { useEffect, useMemo, useState } from 'react';
import { Avatar, Layout, Menu, Tooltip } from 'antd';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../config/AuthContext.jsx';
import { cn } from '../utils/cn';

const { Sider } = Layout;

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function parentKeysForSelection(items, selectedKeys) {
  const selected = new Set(selectedKeys || []);
  const open = [];
  (items || []).forEach((item) => {
    if (item?.children?.some((child) => selected.has(child.key))) {
      open.push(item.key);
    }
  });
  return open;
}

export default function Sidebar({
  items = [],
  selectedKeys = [],
  onMenuClick,
  width = 236,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const displayName = user?.full_name || user?.email || 'User';
  const autoOpenKeys = useMemo(
    () => parentKeysForSelection(items, selectedKeys),
    [items, selectedKeys],
  );
  const [openKeys, setOpenKeys] = useState(autoOpenKeys);

  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev, ...autoOpenKeys])));
  }, [autoOpenKeys]);

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
      theme="dark"
      className="app-side !bg-[#134e4a]"
    >
      <div className="flex h-full flex-col font-sans">
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500 text-sm font-bold tracking-wide text-white">
            QM
          </div>
          {!collapsed ? (
            <span className="truncate text-base font-semibold tracking-tight text-white">
              Quotation Modal
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={setOpenKeys}
            items={items}
            onClick={onMenuClick}
            inlineCollapsed={collapsed}
            className="!border-none !bg-transparent"
          />
        </div>

        <div className="shrink-0 border-t border-white/10 p-3">
          {user ? (
            <div className={cn('mb-2 flex items-center gap-2.5', collapsed && 'flex-col')}>
              <Avatar size={36} className="!bg-teal-500 text-xs font-semibold">
                {initials(displayName)}
              </Avatar>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
                  <div className="truncate text-[11px] uppercase tracking-wider text-teal-100/70">
                    {user.role_name}
                  </div>
                </div>
              ) : null}
              <Tooltip title="Logout" placement="right">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg text-teal-100/80 hover:bg-white/10 hover:text-white"
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
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] text-teal-100/70 hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center',
            )}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </div>
    </Sider>
  );
}
