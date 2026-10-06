import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Row, Select, Spin, Table, Tooltip, Typography, message } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import QuotationPdfPreviewModal from '../../Components/Report Designer components/QuotationPdfPreviewModal.jsx';
import useQuotationPdfPreview from '../../hooks/useQuotationPdfPreview.js';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { slNoColumn } from '../../utils/tableHelpers';
import { templateForQuotation } from '../../utils/templateSnapshot.js';

function StatCard({ label, value, icon, boxClass, iconClass, valueClass }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm ${boxClass}`}>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`mt-1 text-2xl font-semibold leading-none ${valueClass}`}>{value}</div>
      </div>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${iconClass}`}>
        {icon}
      </span>
    </div>
  );
}

function pieSlicePath(cx, cy, r, startAngle, endAngle) {
  const toPoint = (angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = toPoint(startAngle);
  const [x2, y2] = toPoint(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function StatusChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const slices = [];
  let cursor = 0;
  items.forEach((item) => {
    if (!item.value || !total) return;
    const sweep = (item.value / total) * 360;
    const pct = Math.round((item.value / total) * 100);
    slices.push({ ...item, start: cursor, end: cursor + sweep, pct });
    cursor += sweep;
  });

  const tipFor = (s) => `${s.label}: ${s.value} report${s.value === 1 ? '' : 's'} · ${s.pct}% of total`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label="Reports by status">
        {total === 0 ? (
          <circle cx="60" cy="60" r="52" fill="#e2e8f0" />
        ) : slices.map((slice) => {
          if (slice.end - slice.start >= 359.9) {
            return (
              <Tooltip key={slice.label} title={tipFor(slice)}>
                <circle cx="60" cy="60" r="52" fill={slice.color} className="cursor-pointer" />
              </Tooltip>
            );
          }
          return (
            <Tooltip key={slice.label} title={tipFor(slice)}>
              <path
                d={pieSlicePath(60, 60, 52, slice.start, slice.end)}
                fill={slice.color}
                className="cursor-pointer transition-opacity hover:opacity-80"
              />
            </Tooltip>
          );
        })}
      </svg>
      <div className="flex min-w-[120px] flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
            <span className="font-semibold text-slate-800">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthChart({ items }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="flex h-44 items-end gap-1.5 border-b border-slate-200">
      {items.map((item) => {
        const empty = item.count === 0;
        const tip = (
          <div className="min-w-[160px] text-xs">
            <div className="mb-1 font-semibold">{item.fullLabel}</div>
            {empty ? (
              <div className="opacity-80">No reports submitted</div>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <span>Total reports</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
                <div className="my-1 border-t border-white/20" />
                <div className="flex justify-between gap-4">
                  <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />Pending</span>
                  <span>{item.pending}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />Accepted</span>
                  <span>{item.accepted}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />Rejected</span>
                  <span>{item.rejected}</span>
                </div>
              </>
            )}
          </div>
        );
        return (
          <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-slate-600">{item.count || ''}</span>
            <div className="flex h-32 w-full items-end">
              <Tooltip title={tip} placement="top">
                <div
                  className={`w-full cursor-pointer rounded-t-md transition ${
                    empty ? 'bg-slate-200 hover:bg-slate-300' : 'bg-teal-500 hover:bg-teal-600'
                  }`}
                  style={{ height: empty ? '4px' : `${Math.max(8, (item.count / max) * 100)}%` }}
                />
              </Tooltip>
            </div>
            <span className="pb-1 text-[10px] text-slate-500">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [users, setUsers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [activities, setActivities] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const pdfPreview = useQuotationPdfPreview();

  const load = async () => {
    setLoading(true);
    try {
      const [u, q, c, a, t] = await Promise.all([
        api.get('/users').then((r) => r.data),
        api.get('/quotations', { params: { sort_by: 'created_at', sort_order: 'desc' } }).then((r) => r.data),
        api.get('/customers').then((r) => r.data),
        api.get('/activities').then((r) => r.data),
        api.get('/quotation-templates').then((r) => r.data),
      ]);
      setUsers(u.items || []);
      setQuotations(q.items || []);
      const cItems = c.items || [];
      setCustomers(cItems);
      const cmap = {};
      cItems.forEach((item) => { cmap[item.id] = item; });
      setCustomersById(cmap);
      const tmap = {};
      (t.items || []).forEach((item) => { tmap[item.id] = item; });
      setTemplatesById(tmap);
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

  const statusSummary = useMemo(() => {
    const count = (status) => quotations.filter((q) => q.status === status).length;
    return {
      pending: count('SENT'),
      accepted: count('ACCEPTED'),
      rejected: count('REJECTED'),
    };
  }, [quotations]);

  const availableYears = useMemo(() => {
    const years = new Set();
    quotations.forEach((q) => {
      const year = dayjs(q.created_at || q.quotation_date).year();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [quotations]);

  const monthlySubmissions = useMemo(() => {
    const year = selectedYear;
    return Array.from({ length: 12 }, (_, i) => {
      const month = dayjs().year(year).month(i).startOf('month');
      const key = month.format('YYYY-MM');
      const inMonth = quotations.filter((q) => dayjs(q.created_at || q.quotation_date).format('YYYY-MM') === key);
      const byStatus = (status) => inMonth.filter((q) => q.status === status).length;
      return {
        label: month.format('MMM'),
        fullLabel: month.format('MMMM YYYY'),
        year: String(year),
        count: inMonth.length,
        pending: byStatus('SENT'),
        accepted: byStatus('ACCEPTED'),
        rejected: byStatus('REJECTED'),
      };
    });
  }, [quotations, selectedYear]);

  const openPreview = async (record) => {
    setBusyId(record.id);
    try {
      const full = await api.get(`/quotations/${record.id}`).then((r) => r.data);
      let template = templatesById[full.quotation_template_id];
      if (full.quotation_template_id) {
        try {
          template = await api.get(`/quotation-templates/${full.quotation_template_id}`).then((r) => r.data);
        } catch {
          /* keep cache */
        }
      }
      let organization = null;
      try {
        organization = await api.get('/organizations/me').then((r) => r.data);
      } catch {
        organization = null;
      }
      const activityCustomFields = await api.get('/custom-fields', { params: { entity_type: 'ACTIVITY' } }).then((r) => r.data.items || []);
      await pdfPreview.openPreview({
        report: full,
        customer: customersById[full.customer_id],
        template: templateForQuotation(full, template),
        organization,
        activityCustomFields,
      });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to open report'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Users"
            value={users.length}
            icon={<UserOutlined />}
            boxClass="border-blue-300 bg-blue-50/70"
            iconClass="bg-blue-100 text-blue-600"
            valueClass="text-blue-700"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Customers"
            value={customers.length}
            icon={<TeamOutlined />}
            boxClass="border-orange-300 bg-orange-50/80"
            iconClass="bg-orange-100 text-orange-600"
            valueClass="text-orange-700"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Activities"
            value={activities.length}
            icon={<AppstoreOutlined />}
            boxClass="border-sky-300 bg-sky-50/80"
            iconClass="bg-sky-100 text-sky-600"
            valueClass="text-sky-700"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Quotations"
            value={quotations.length}
            icon={<FileTextOutlined />}
            boxClass="border-emerald-300 bg-emerald-50/80"
            iconClass="bg-emerald-100 text-emerald-600"
            valueClass="text-emerald-700"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Accepted"
            value={statusSummary.accepted}
            icon={<CheckCircleOutlined />}
            boxClass="border-green-300 bg-green-50/80"
            iconClass="bg-green-100 text-green-600"
            valueClass="text-green-700"
          />
        </Col>
        <Col xs={24} sm={12} xl={4}>
          <StatCard
            label="Rejected"
            value={statusSummary.rejected}
            icon={<CloseCircleOutlined />}
            boxClass="border-rose-300 bg-rose-50/80"
            iconClass="bg-rose-100 text-rose-600"
            valueClass="text-rose-700"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Typography.Title level={5} className="!mb-4 !text-sm">Reports by status</Typography.Title>
            <StatusChart
              items={[
                { label: 'Pending', value: statusSummary.pending, color: '#3b82f6' },
                { label: 'Accepted', value: statusSummary.accepted, color: '#16a34a' },
                { label: 'Rejected', value: statusSummary.rejected, color: '#e11d48' },
              ]}
            />
          </div>
        </Col>
        <Col xs={24} lg={16}>
          <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <Typography.Title level={5} className="!mb-0 !text-sm">
                Reports submitted
              </Typography.Title>
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                style={{ width: 100 }}
                size="small"
              >
                {availableYears.map((year) => (
                  <Select.Option key={year} value={year}>
                    {year}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <MonthChart items={monthlySubmissions} />
          </div>
        </Col>
      </Row>

      <div className="flex items-center justify-between">
        <Typography.Title level={5} className="!mb-0">Recent quotations</Typography.Title>
        <Button type="link" onClick={() => navigate('/admin/report/generated')}>
          View all
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          className="app-data-table"
          rowKey="id"
          pagination={false}
          dataSource={recent}
          tableLayout="fixed"
          locale={{ emptyText: 'No quotations yet' }}
          columns={[
            slNoColumn(1, 5),
            {
              title: 'Quotation No.',
              dataIndex: 'quotation_number',
              sorter: (a, b) => String(a.quotation_number || '').localeCompare(String(b.quotation_number || '')),
            },
            {
              title: 'Customer',
              key: 'customer',
              render: (_, r) => customersById[r.customer_id]?.name || '—',
              sorter: (a, b) => String(customersById[a.customer_id]?.name || '')
                .localeCompare(String(customersById[b.customer_id]?.name || '')),
            },
            {
              title: 'Submitted by',
              key: 'submitted_by',
              render: (_, r) => r.created_by_name || '—',
              sorter: (a, b) => String(a.created_by_name || '').localeCompare(String(b.created_by_name || '')),
            },
            {
              title: 'Date',
              dataIndex: 'quotation_date',
              render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
              sorter: (a, b) => dayjs(a.quotation_date || 0).valueOf() - dayjs(b.quotation_date || 0).valueOf(),
            },
            {
              title: 'Total',
              dataIndex: 'total',
              render: (v, row) => `${row.currency || 'INR'} ${Number(v || 0).toLocaleString('en-IN')}`,
              sorter: (a, b) => Number(a.total || 0) - Number(b.total || 0),
            },
            {
              title: 'Action',
              key: 'action',
              width: 80,
              align: 'center',
              render: (_, record) => (
                <Tooltip title="View">
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    loading={busyId === record.id}
                    onClick={() => openPreview(record)}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      </div>

      <QuotationPdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.ctx?.report?.quotation_number || 'Report preview'}
        loading={pdfPreview.loading}
        pdfUrl={pdfPreview.pdfUrl}
        onClose={pdfPreview.close}
      />
    </div>
  );
}