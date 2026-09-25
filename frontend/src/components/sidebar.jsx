import { useEffect, useMemo, useState } from 'react';
import { Badge, Layout, Menu } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { cn } from '../utils/cn';

function withMenuBadges(items, badgeByKey = {}, collapsed = false) {
  return (items || []).map((item) => {
    const count = badgeByKey[item.key];
    const next = { ...item };
    if (item.children?.length) {
      next.children = withMenuBadges(item.children, badgeByKey, collapsed);
      return next;
    }
    if (!count) return next;
    const n = Number(count) || 0;
    if (n <= 0) return next;
    const badge = (
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
        {n > 99 ? '99+' : n}
      </span>
    );
    if (collapsed) {
      next.icon = (
        <Badge count={n} size="small" offset={[2, 0]}>
          {item.icon}
        </Badge>
      );
      return next;
    }
    next.label = (
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-0.5">
        <span className="truncate">{item.label}</span>
        {badge}
      </span>
    );
    return next;
  });
}

const { Sider } = Layout;

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
  badgeByKey = {},
}) {
  const [collapsed, setCollapsed] = useState(false);
  const autoOpenKeys = useMemo(
    () => parentKeysForSelection(items, selectedKeys),
    [items, selectedKeys],
  );
  const [openKeys, setOpenKeys] = useState(autoOpenKeys);
  const menuItems = useMemo(
    () => withMenuBadges(items, badgeByKey, collapsed),
    [items, badgeByKey, collapsed],
  );

  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev, ...autoOpenKeys])));
  }, [autoOpenKeys]);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={width}
      collapsedWidth={72}
      theme="light"
      className="app-side !border-r !border-slate-200 !bg-white"
    >
      <div className="flex h-full flex-col font-sans">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500 text-sm font-bold tracking-wide text-white">
            QM
          </div>
          {!collapsed ? (
            <span className="truncate text-base font-semibold tracking-tight text-slate-800">
              Quotation Modal
            </span>
          ) : null}
        </div>

        <div className="app-side-menu relative min-h-0 flex-1 overflow-y-auto py-2">
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={setOpenKeys}
            items={menuItems}
            onClick={onMenuClick}
            inlineCollapsed={collapsed}
            className="!border-none !bg-transparent"
          />
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] text-slate-500 hover:bg-slate-100 hover:text-slate-800',
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
