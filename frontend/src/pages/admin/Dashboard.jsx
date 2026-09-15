import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Row, Space, Spin, Table, Tag, Typography, message } from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  TeamOutlined,
  FilePdfOutlined,
  BarChartOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { palette } from '../../theme';

const STATUS_COLOR = {
  DRAFT: 'default',
  SENT: 'processing',
  ACCEPTED: 'success',
  REJECTED: 'error',
  EXPIRED: 'warning',
  CANCELLED: 'default',
};

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="card-shell admin-stat-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
      {hint ? <div className="admin-stat-hint">{hint}</div> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [quotations, setQuotations] = useState([]);
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
          api.get('/customers', { params: { page: 1, page_size: 1 } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setUsers(u.items || []);
        setQuotations(q.items || []);
        setCustomerCount(c.total || 0);
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

  const recent = quotations.slice(0, 6);

  const columns = [
    { title: 'Quotation No.', dataIndex: 'quotation_number', width: 140 },
    {
      title: 'Date',
      dataIndex: 'quotation_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      width: 120,
      render: (v, r) => `₹${Number(v || 0).toLocaleString('en-IN')} ${r.currency || ''}`.trim(),
    },
    {
      title: '',
      width: 80,
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
        <Typography.Text type="secondary">
          Organization overview — quotations, team, and performance
        </Typography.Text>
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

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <button type="button" className="admin-quick-link" onClick={() => navigate('/admin/team')}>
            <TeamOutlined />
            <span>
              <strong>Manage team</strong>
              <em>Create supervisors &amp; users</em>
            </span>
            <ArrowRightOutlined />
          </button>
        </Col>
        <Col xs={24} md={8}>
          <button type="button" className="admin-quick-link" onClick={() => navigate('/admin/quotations')}>
            <FilePdfOutlined />
            <span>
              <strong>All quotations</strong>
              <em>Review generated reports</em>
            </span>
            <ArrowRightOutlined />
          </button>
        </Col>
        <Col xs={24} md={8}>
          <button type="button" className="admin-quick-link" onClick={() => navigate('/admin/analytics')}>
            <BarChartOutlined />
            <span>
              <strong>Analytics</strong>
              <em>Status &amp; value trends</em>
            </span>
            <ArrowRightOutlined />
          </button>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/user/generate')}>
            New quotation
          </Button>
        </Space>
      </div>

      <div className="card-shell">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={recent}
          pagination={false}
          locale={{ emptyText: 'No quotations yet' }}
        />
      </div>
    </div>
  );
}
