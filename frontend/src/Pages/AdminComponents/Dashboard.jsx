import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Row, Spin, Table, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { slNoColumn } from '../../utils/tableHelpers';

function StatCard({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 border-t-[3px] border-t-teal-600 bg-white p-4 text-left shadow-sm transition hover:border-teal-300"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-teal-700">{value}</div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [u, q, c, a] = await Promise.all([
        api.get('/users').then((r) => r.data),
        api.get('/quotations', { params: { sort_by: 'created_at', sort_order: 'desc' } }).then((r) => r.data),
        api.get('/customers').then((r) => r.data),
        api.get('/activities').then((r) => r.data),
      ]);
      setUsers(u.items || []);
      setQuotations(q.items || []);
      setCustomers(c.items || []);
      setActivities(a.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const recent = useMemo(() => quotations.slice(0, 5), [quotations]);

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <Typography.Title level={3} className="!mb-0 !font-sans !text-teal-800">
        Dashboard
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Team members" value={users.length} onClick={() => navigate('/admin/team')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Customers" value={customers.length} onClick={() => navigate('/admin/customers')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Activities" value={activities.length} onClick={() => navigate('/admin/activities')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Quotations" value={quotations.length} onClick={() => navigate('/admin/templates')} />
        </Col>
      </Row>

      <div className="flex items-center justify-between">
        <Typography.Title level={5} className="!mb-0">Recent quotations</Typography.Title>
        <Button type="link" onClick={() => navigate('/admin/templates')}>View all</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={recent}
          locale={{ emptyText: 'No quotations yet' }}
          columns={[
            slNoColumn(1, 5),
            { title: 'Quotation No.', dataIndex: 'quotation_number' },
            {
              title: 'Date',
              dataIndex: 'quotation_date',
              render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
            },
            { title: 'Status', dataIndex: 'status' },
            {
              title: 'Total',
              dataIndex: 'total',
              render: (v, row) => `${row.currency || 'INR'} ${Number(v || 0).toLocaleString('en-IN')}`,
            },
          ]}
        />
      </div>
    </div>
  );
}
