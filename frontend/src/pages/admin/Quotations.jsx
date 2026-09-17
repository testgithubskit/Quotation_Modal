import { useEffect, useMemo, useState } from 'react';
import { Button, Select, Table, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import TableToolbar from '../../components/TableToolbar';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';
import { useTableScrollY } from '../../hooks/useTableScrollY';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function customerName(c) {
  if (!c) return '—';
  return c.name || '—';
}

function customerCompany(c) {
  if (!c) return '—';
  return c.notes || c.company || '—';
}

export default function AdminQuotations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async (nextStatus = status) => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' };
      if (nextStatus) params.status = nextStatus;
      const [data, customers] = await Promise.all([
        api.get('/quotations', { params }).then((r) => r.data),
        api.get('/customers', { params: { page: 1, page_size: 100 } }).then((r) => r.data),
      ]);
      const map = {};
      (customers.items || []).forEach((cust) => {
        map[cust.id] = cust;
      });
      setCustomersById(map);
      setRows(
        (data.items || []).map((q) => {
          const cust = map[q.customer_id];
          return {
            ...q,
            customer_name: customerName(cust),
            company_name: customerCompany(cust),
          };
        }),
      );
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
      'quotation_number', 'customer_name', 'company_name', 'subtotal', 'total', 'currency',
    ])),
    [rows, search],
  );

  const tableScroll = useTableScrollY(72, [pageSize, filtered.length]);

  const columns = useMemo(() => enhanceColumns([
    serialNoColumn(page, pageSize),
    { title: 'Quotation No.', dataIndex: 'quotation_number', width: 150, ellipsis: true },
    {
      title: 'Date',
      dataIndex: 'quotation_date',
      width: 130,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Company Name',
      dataIndex: 'company_name',
      width: 180,
      ellipsis: true,
      render: (v) => v || '—',
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
    <div className="table-page">
      <div className="table-page-toolbar">
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
      </div>

      <div className="table-card" ref={tableScroll.containerRef}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 'max-content', y: tableScroll.scrollY }}
          sticky
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
