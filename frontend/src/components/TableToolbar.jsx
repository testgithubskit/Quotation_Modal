import { Button, Input, Space, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

/**
 * Toolbar: global search on the left, action buttons on the right.
 * Place the primary Add button last; pass refresh as an icon-only control via `onRefresh`.
 */
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
    <div className="table-toolbar">
      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined style={{ color: '#8A8578' }} />}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="table-toolbar-search"
      />
      <Space wrap className="table-toolbar-actions">
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
