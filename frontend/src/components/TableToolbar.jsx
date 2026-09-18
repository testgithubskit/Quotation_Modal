import { Button, Input, Space, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

export default function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search any field…',
  onRefresh,
  refreshing = false,
  actions = null,
  addButton = null,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex max-w-md flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white">
        <Input
          allowClear
          variant="borderless"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="default"
          className="!h-auto !rounded-none !border-0 !border-l !border-slate-300"
          icon={<SearchOutlined />}
          aria-label="Search"
        />
      </div>
      <Space wrap>
        {actions}
        {onRefresh ? (
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={onRefresh}
              aria-label="Refresh"
            />
          </Tooltip>
        ) : null}
        {addButton}
      </Space>
    </div>
  );
}
