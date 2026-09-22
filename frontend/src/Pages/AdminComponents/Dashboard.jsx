import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Modal, Row, Spin, Table, Tooltip, Typography, message } from 'antd';
import { CloseOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { slNoColumn } from '../../utils/tableHelpers';
import {
  downloadQuotationPdfViaChromium,
  preserveBlankParagraphs,
  renderQuotationDocument,
  resolveLineItems,
} from '../../utils/renderQuotationReport.js';

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

function ReportPreviewContent({ report, customer, template, organization }) {
  const doc = renderQuotationDocument({ report, customer, template, organization });
  if (!doc.hasContent) {
    const lines = resolveLineItems(report);
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <div><strong>Customer:</strong> {customer?.name || '—'}</div>
        <div><strong>Total:</strong> ₹{Number(report.total || 0).toLocaleString('en-IN')}</div>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="bg-teal-50">
              <th className="border p-2">Sl No</th>
              <th className="border p-2">Activity</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((item) => (
              <tr key={item.slNo}>
                <td className="border p-2 text-center">{item.slNo}</td>
                <td className="border p-2">{item.activityName || '—'}</td>
                <td className="border p-2">{item.quantity} {item.unit}</td>
                <td className="border p-2">₹{Number(item.total || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const m = doc.pageSettings.margins || {};
  return (
    <div className="max-h-[70vh] overflow-auto bg-slate-200 p-4">
      <div
        className="report-preview-body mx-auto bg-white shadow-md"
        style={{
          width: Math.min(doc.width, 780),
          minHeight: doc.height * (Math.min(doc.width, 780) / doc.width),
          padding: `${m.top || 5}mm ${m.right || 5}mm ${m.bottom || 5}mm ${m.left || 5}mm`,
          fontFamily: `${doc.pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif`,
          fontSize: doc.pageSettings.fontSize || '12px',
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.headerHtml) }} />
        <div
          style={{ margin: `${doc.pageSettings.headerSpacing || 0}mm 0` }}
          dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.bodyHtml) }}
        />
        <div dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.footerHtml) }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [activities, setActivities] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCtx, setPreviewCtx] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

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
      setPreviewCtx({
        report: full,
        customer: customersById[full.customer_id],
        template,
        organization,
      });
      setPreviewOpen(true);
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
      <Typography.Title level={3} className="!mb-0 !font-sans !text-teal-800">
        Dashboard
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Users" value={users.length} onClick={() => navigate('/admin/team')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Customers" value={customers.length} onClick={() => navigate('/admin/customers')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard label="Activities" value={activities.length} onClick={() => navigate('/admin/activities')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="Quotations"
            value={quotations.length}
            onClick={() => navigate('/admin/report/generated')}
          />
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

      <Modal
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setPreviewCtx(null);
        }}
        title={previewCtx?.report?.quotation_number || 'Report preview'}
        width={900}
        centered
        destroyOnClose
        maskClosable={false}
        keyboard={false}
        closable
        closeIcon={<CloseOutlined />}
        footer={(
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setPreviewOpen(false);
                setPreviewCtx(null);
              }}
            >
              Close
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={pdfDownloading}
              className="!bg-teal-600 hover:!bg-teal-700"
              onClick={async () => {
                if (!previewCtx) return;
                setPdfDownloading(true);
                try {
                  await downloadQuotationPdfViaChromium(previewCtx);
                  message.success('PDF downloaded');
                } catch (error) {
                  message.error(error?.message || 'PDF download failed');
                } finally {
                  setPdfDownloading(false);
                }
              }}
            >
              Download PDF
            </Button>
          </div>
        )}
      >
        {previewCtx ? (
          <ReportPreviewContent
            report={previewCtx.report}
            customer={previewCtx.customer}
            template={previewCtx.template}
            organization={previewCtx.organization}
          />
        ) : null}
      </Modal>
    </div>
  );
}
