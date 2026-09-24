import { useEffect, useMemo, useState } from 'react';
import { Select, Table, message } from 'antd';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import TableToolbar from '../../Components/TableToolbar';
import { configTableScroll, recordMatchesSearch, slNoColumn } from '../../utils/tableHelpers';

const FILTERS = [
  { value: 'all', label: 'All events' },
  { value: 'login', label: 'Logged in' },
  { value: 'logout', label: 'Logged out' },
  { value: 'template-create', label: 'Template created' },
  { value: 'template-update', label: 'Template updated' },
  { value: 'user-create', label: 'User added' },
  { value: 'user-update', label: 'User updated' },
];

function describe(row) {
  const who = row.actor_name || row.actor_email || 'Someone';
  const subject = row.new_data?.name || row.new_data?.full_name || row.new_data?.email || '';
  const named = subject ? ` “${subject}”` : '';
  if (row.action === 'LOGIN') return `${who} logged in`;
  if (row.action === 'LOGOUT') return `${who} logged out`;
  if (row.entity_type === 'QuotationTemplate' && row.action === 'CREATE') {
    return `${who} created template${named}`;
  }
  if (row.entity_type === 'QuotationTemplate' && row.action === 'UPDATE') {
    return `${who} updated template${named}`;
  }
  if (row.entity_type === 'User' && row.action === 'CREATE') {
    return `${who} added user${named}`;
  }
  if (row.entity_type === 'User' && row.action === 'UPDATE') {
    return `${who} updated user${named}`;
  }
  return `${who} · ${row.action} · ${row.entity_type}`;
}

function matchesFilter(row, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'login') return row.action === 'LOGIN';
  if (filter === 'logout') return row.action === 'LOGOUT';
  if (filter === 'template-create') return row.entity_type === 'QuotationTemplate' && row.action === 'CREATE';
  if (filter === 'template-update') return row.entity_type === 'QuotationTemplate' && row.action === 'UPDATE';
  if (filter === 'user-create') return row.entity_type === 'User' && row.action === 'CREATE';
  if (filter === 'user-update') return row.entity_type === 'User' && row.action === 'UPDATE';
  return true;
}

function formatWhen(value) {
  return value ? dayjs(value).format('DD MMM YYYY, hh:mm A') : '—';
}

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/audit-logs', { params: { scope: 'org' } }).then((r) => r.data);
      setRows(data.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load audit logs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => rows.filter((row) => matchesFilter(row, filter) && recordMatchesSearch({
      ...row,
      user: row.actor_name || row.actor_email || '',
      event: describe(row),
      created: formatWhen(row.created_at),
    }, search)),
    [rows, search, filter],
  );

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <TableToolbar
        search={search}
        searchPlaceholder="Search by any field"
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <Select
            className="!min-w-[180px]"
            value={filter}
            options={FILTERS}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
            aria-label="Filter by"
          />
        )}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          dataSource={paged}
          scroll={configTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `${total} events`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          columns={[
            slNoColumn(page, pageSize),
            {
              title: 'User',
              key: 'user',
              sorter: (a, b) => String(a.actor_name || a.actor_email || '').localeCompare(String(b.actor_name || b.actor_email || '')),
              render: (_, row) => row.actor_name || row.actor_email || '—',
            },
            {
              title: 'Event',
              key: 'event',
              sorter: (a, b) => describe(a).localeCompare(describe(b)),
              render: (_, row) => describe(row),
            },
            {
              title: 'Created at',
              dataIndex: 'created_at',
              sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
              render: (value) => formatWhen(value),
            },
          ]}
        />
      </div>
    </div>
  );
}
