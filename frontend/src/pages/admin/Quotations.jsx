import { useEffect, useMemo, useState } from 'react';
import { Button, Select, Table, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import TableToolbar from '../../components/TableToolbar';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_COLOR = {
  DRAFT: 'default',
  SENT: 'processing',
  ACCEPTED: 'success',
  REJECTED: 'error',
  EXPIRED: 'warning',
  CANCELLED: 'default',
};

export default function AdminQuotations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async (nextStatus = status) => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' };
      if (nextStatus) params.status = nextStatus;
      const data = await api.get('/quotations', { params }).then((r) => r.data);
      setRows(data.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load quotations'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const filtered = useMemo(
    () => rows.filter((row) => recordMatchesSearch(row, search, [
      'quotation_number', 'status', 'subtotal', 'total', 'currency',
    ])),
    [rows, search],
  );

  const columns = useMemo(() => enhanceColumns([
    serialNoColumn(page, pageSize),
    { title: 'Quotation No.', dataIndex: 'quotation_number', width: 150 },
    {
      title: 'Date',
      dataIndex: 'quotation_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Validity',
      dataIndex: 'validity_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      width: 120,
      render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 130,
      render: (v, r) => `₹${Number(v || 0).toLocaleString('en-IN')} ${r.currency || 'INR'}`,
    },
    {
      title: 'Actions',
      width: 90,
      render: (_, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/user/reports/${r.id}/view`)}
        >
          View
        </Button>
      ),
    },
  ], { subtotal: 'number', total: 'number' }), [navigate, page, pageSize]);

  return (
    <div>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search quotations by any field…"
        onRefresh={() => load()}
        refreshing={loading}
        actions={(
          <Select
            style={{ width: 160 }}
            value={status}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              setStatus(v);
              load(v);
            }}
          />
        )}
      />

      <div className="card-shell">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={tablePagination({
            current: page,
            pageSize,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          })}
        />
      </div>
    </div>
  );
}
