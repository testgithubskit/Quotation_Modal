import { useEffect, useMemo, useState } from 'react';
import { Col, Empty, Progress, Row, Spin, Typography, message } from 'antd';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { palette } from '../../theme';

const STATUS_ORDER = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
const STATUS_COLORS = {
  DRAFT: '#8A8578',
  SENT: '#3B82F6',
  ACCEPTED: palette.success,
  REJECTED: palette.danger,
  EXPIRED: palette.brass,
  CANCELLED: '#94A3B8',
};

const tooltipStyle = {
  background: '#fff',
  border: `1px solid ${palette.line}`,
  borderRadius: 6,
  fontSize: 12,
};

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [q, u] = await Promise.all([
          api.get('/quotations', {
            params: { page: 1, page_size: 100, sort_by: 'quotation_date', sort_order: 'desc' },
          }).then((r) => r.data),
          api.get('/users', { params: { page: 1, page_size: 100 } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setQuotations(q.items || []);
        setUsers(u.items || []);
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Failed to load analytics'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(() => {
    const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, { count: 0, value: 0 }]));
    quotations.forEach((q) => {
      const key = q.status in byStatus ? q.status : 'DRAFT';
      byStatus[key].count += 1;
      byStatus[key].value += Number(q.total || 0);
    });

    const totalValue = quotations.reduce((s, q) => s + Number(q.total || 0), 0);
    const acceptedValue = byStatus.ACCEPTED.value;
    const winRate = quotations.length
      ? Math.round((byStatus.ACCEPTED.count / quotations.length) * 100)
      : 0;

    const statusChart = STATUS_ORDER
      .map((status) => ({
        name: status,
        count: byStatus[status].count,
        value: byStatus[status].value,
        fill: STATUS_COLORS[status],
      }))
      .filter((row) => row.count > 0);

    const monthMap = {};
    quotations.forEach((q) => {
      const key = dayjs(q.quotation_date || q.created_at).format('YYYY-MM');
      if (!monthMap[key]) {
        monthMap[key] = {
          key,
          label: dayjs(`${key}-01`).format('MMM YY'),
          count: 0,
          value: 0,
        };
      }
      monthMap[key].count += 1;
      monthMap[key].value += Number(q.total || 0);
    });
    const months = Object.values(monthMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);

    const byCreator = {};
    quotations.forEach((q) => {
      const id = q.created_by || 'unknown';
      if (!byCreator[id]) byCreator[id] = { id, count: 0, value: 0 };
      byCreator[id].count += 1;
      byCreator[id].value += Number(q.total || 0);
    });
    const creators = Object.values(byCreator)
      .map((c) => {
        const u = users.find((x) => x.id === c.id);
        return {
          ...c,
          name: u?.full_name || 'Unknown',
          role: u?.role_name || '—',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const roleMap = {};
    users.forEach((u) => {
      const role = u.role_name || 'OTHER';
      roleMap[role] = (roleMap[role] || 0) + 1;
    });
    const teamChart = Object.entries(roleMap).map(([name, count]) => ({
      name,
      count,
      fill: name === 'ADMIN' ? palette.brass : name === 'SUPERVISOR' ? palette.navy : '#5B7C99',
    }));

    return {
      byStatus,
      totalValue,
      acceptedValue,
      winRate,
      statusChart,
      months,
      creators,
      teamChart,
    };
  }, [quotations, users]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const hasQuotes = quotations.length > 0;

  return (
    <div className="page-scroll-y">
      <div style={{ marginBottom: 20 }}>
        <p className="section-eyebrow">Admin</p>
        <Typography.Title level={3} className="page-title" style={{ margin: 0 }}>
          Analytics
        </Typography.Title>
        <Typography.Text type="secondary">
          Quotation pipeline, acceptance rate, and team output
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <div className="card-shell admin-stat-card">
            <div className="admin-stat-label">Total pipeline</div>
            <div className="admin-stat-value">{formatInr(analytics.totalValue)}</div>
            <div className="admin-stat-hint">{quotations.length} quotations</div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="card-shell admin-stat-card">
            <div className="admin-stat-label">Accepted value</div>
            <div className="admin-stat-value">{formatInr(analytics.acceptedValue)}</div>
            <div className="admin-stat-hint">{analytics.byStatus.ACCEPTED.count} accepted</div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="card-shell admin-stat-card">
            <div className="admin-stat-label">Acceptance rate</div>
            <div className="admin-stat-value">{analytics.winRate}%</div>
            <Progress
              percent={analytics.winRate}
              showInfo={false}
              strokeColor={palette.success}
              trailColor="#E4E0D8"
              style={{ marginTop: 8 }}
            />
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="card-shell" style={{ padding: 20 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Quotations by status
            </Typography.Title>
            {!hasQuotes || analytics.statusChart.length === 0 ? (
              <Empty description="No quotation data yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.statusChart}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {analytics.statusChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name, item) => [
                      `${value} quotes · ${formatInr(item?.payload?.value)}`,
                      name,
                    ]}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div className="card-shell" style={{ padding: 20 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Pipeline value by month
            </Typography.Title>
            {analytics.months.length === 0 ? (
              <Empty description="No monthly data yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={palette.navy} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={palette.navy} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={palette.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: palette.inkSoft, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: palette.inkSoft, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      name === 'value' ? formatInr(value) : value,
                      name === 'value' ? 'Value' : 'Count',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={palette.navy}
                    strokeWidth={2}
                    fill="url(#valueFill)"
                    name="value"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <div className="card-shell" style={{ padding: 20 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Top creators
            </Typography.Title>
            {analytics.creators.length === 0 ? (
              <Empty description="No creators yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={analytics.creators}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={palette.line} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: palette.inkSoft, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: palette.ink, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      name === 'value' ? formatInr(value) : value,
                      name === 'value' ? 'Value' : 'Quotations',
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="count" name="Quotations" fill={palette.navy} radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="value" name="Value" fill={palette.brass} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        <Col xs={24} lg={10}>
          <div className="card-shell" style={{ padding: 20 }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Team by role
            </Typography.Title>
            {analytics.teamChart.length === 0 ? (
              <Empty description="No team members yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.teamChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={palette.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: palette.inkSoft, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: palette.inkSoft, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Members']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                    {analytics.teamChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
