import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Row, Space, Spin, Table, Typography, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { palette } from '../../theme';

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="card-shell admin-stat-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
      {hint ? <div className="admin-stat-hint">{hint}</div> : null}
    </div>
  );
}

function customerName(c) {
  if (!c) return '—';
  return c.name || '—';
}

function customerCompany(c) {
  if (!c) return '—';
  // UI "company" is stored in notes on the backend
  return c.notes || c.company || '—';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [u, q, c] = await Promise.all([
          api.get('/users', { params: { page: 1, page_size: 100 } }).then((r) => r.data),
          api.get('/quotations', {
            params: { page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' },
          }).then((r) => r.data),
          api.get('/customers', { params: { page: 1, page_size: 100 } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setUsers(u.items || []);
        setQuotations(q.items || []);
        const map = {};
        (c.items || []).forEach((cust) => {
          map[cust.id] = cust;
        });
        setCustomersById(map);
        setCustomerCount(c.total || (c.items || []).length || 0);
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Failed to load dashboard'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const supervisors = users.filter((u) => u.role_name === 'SUPERVISOR').length;
    const teamUsers = users.filter((u) => u.role_name === 'USER').length;
    const accepted = quotations.filter((q) => q.status === 'ACCEPTED').length;
    const totalValue = quotations.reduce((sum, q) => sum + Number(q.total || 0), 0);
    return { supervisors, teamUsers, accepted, totalValue, quoteCount: quotations.length };
  }, [users, quotations]);

  const recent = useMemo(
    () => quotations.slice(0, 5).map((q) => {
      const cust = customersById[q.customer_id];
      return {
        ...q,
        customer_name: customerName(cust),
        company_name: customerCompany(cust),
      };
    }),
    [quotations, customersById],
  );

  const columns = [
    { title: 'Quotation No.', dataIndex: 'quotation_number', width: '16.66%', ellipsis: true },
    {
      title: 'Date',
      dataIndex: 'quotation_date',
      width: '16.66%',
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      width: '16.66%',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Company Name',
      dataIndex: 'company_name',
      width: '16.66%',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: '16.66%',
      render: (v, r) => `₹${Number(v || 0).toLocaleString('en-IN')} ${r.currency || ''}`.trim(),
    },
    {
      title: 'Action',
      width: '16.66%',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/user/reports/${r.id}/view`)} />
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p className="section-eyebrow">Admin</p>
        <Typography.Title level={3} className="page-title" style={{ margin: 0 }}>
          Dashboard
        </Typography.Title>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="Quotations"
            value={stats.quoteCount}
            hint={`${stats.accepted} accepted`}
            accent={palette.navy}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="Pipeline value"
            value={`₹${stats.totalValue.toLocaleString('en-IN')}`}
            hint="All quotation totals"
            accent={palette.brass}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="Team"
            value={users.length}
            hint={`${stats.supervisors} supervisors · ${stats.teamUsers} users`}
            accent={palette.success}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="Customers"
            value={customerCount}
            hint="In master data"
            accent="#5B7C99"
          />
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Recent quotations
        </Typography.Title>
        <Space>
          <Button type="link" onClick={() => navigate('/admin/quotations')}>
            View all
          </Button>
        </Space>
      </div>

      <div className="card-shell">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={recent}
          pagination={false}
          tableLayout="fixed"
          locale={{ emptyText: 'No quotations yet' }}
        />
      </div>
    </div>
  );
}
