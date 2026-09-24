import { useEffect, useMemo, useState } from 'react';
import { Layout, Menu } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { cn } from '../utils/cn';

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
}) {
  const [collapsed, setCollapsed] = useState(false);
  const autoOpenKeys = useMemo(
    () => parentKeysForSelection(items, selectedKeys),
    [items, selectedKeys],
  );
  const [openKeys, setOpenKeys] = useState(autoOpenKeys);

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
            items={items}
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
