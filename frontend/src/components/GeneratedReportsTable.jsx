import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Popconfirm, Space, Table, Tooltip, message } from 'antd';
import {
  DeleteOutlined, EyeOutlined, FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../config/auth.js';
import TableToolbar from './TableToolbar';
import { recordMatchesSearch, slNoColumn } from '../utils/tableHelpers';
import {
  downloadQuotationExcel,
  downloadQuotationPdfViaChromium,
  renderQuotationDocument,
  resolveLineItems,
} from '../utils/renderQuotationReport.js';

function ReportPreviewContent({ report, customer, template, organization }) {
  const doc = renderQuotationDocument({ report, customer, template, organization });

  if (!doc.hasContent) {
    const lines = resolveLineItems(report);
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>This report’s template has no designed layout yet. Showing items:</p>
        <div><strong>Customer:</strong> {customer?.name || '—'}</div>
        <div><strong>Total:</strong> ₹{Number(report.total || 0).toLocaleString('en-IN')}</div>
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100">
              <th className="border p-2">Sl No</th>
              <th className="border p-2">Activity Name</th>
              <th className="border p-2">Description</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Rate</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((item) => (
              <tr key={item.slNo}>
                <td className="border p-2 text-center">{item.slNo}</td>
                <td className="border p-2">{item.activityName || '—'}</td>
                <td className="border p-2">{item.description}</td>
                <td className="border p-2">{item.quantity} {item.unit}</td>
                <td className="border p-2">₹{Number(item.unit_price || 0).toLocaleString('en-IN')}</td>
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
        className="mx-auto bg-white text-slate-900 shadow-md"
        style={{
          width: Math.min(doc.width, 780),
          minHeight: doc.height * (Math.min(doc.width, 780) / doc.width),
          padding: `${m.top || 5}mm ${m.right || 5}mm ${m.bottom || 5}mm ${m.left || 5}mm`,
          fontFamily: `${doc.pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif`,
          fontSize: doc.pageSettings.fontSize || '12px',
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: doc.headerHtml }} />
        <div
          style={{ margin: `${doc.pageSettings.headerSpacing || 0}mm 0` }}
          dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
        />
        <div dangerouslySetInnerHTML={{ __html: doc.footerHtml }} />
      </div>
    </div>
  );
}

async function loadReportContext(record, customersById, templatesById) {
  const full = await api.get(`/quotations/${record.id}`).then((r) => r.data);
  let template = templatesById[full.quotation_template_id];
  if (full.quotation_template_id) {
    try {
      template = await api
        .get(`/quotation-templates/${full.quotation_template_id}`)
        .then((r) => r.data);
    } catch {
      /* keep list cache */
    }
  }
  let organization = null;
  try {
    organization = await api.get('/organizations/me').then((r) => r.data);
  } catch {
    organization = null;
  }
  return {
    report: full,
    customer: customersById[full.customer_id],
    template,
    organization,
  };
}

function showReportDetail(ctx) {
  const { report, customer, template, organization } = ctx;
  const orgName = organization?.name || organization?.organization_name || 'Organization';

  Modal.info({
    title: report.quotation_number || 'Report',
    width: 860,
    icon: null,
    okText: 'Close',
    content: (
      <ReportPreviewContent
        report={report}
        customer={customer}
        template={template}
        organization={organization}
      />
    ),
    footer: (_, { OkBtn }) => (
      <Space wrap>
        <Button
          icon={<FileExcelOutlined />}
          onClick={() => {
            try {
              downloadQuotationExcel(report, { organizationName: orgName });
              message.success('Excel downloaded');
            } catch (error) {
              message.error(error?.message || 'Excel download failed');
            }
          }}
        >
          Excel
        </Button>
        <Button
          type="primary"
          icon={<FilePdfOutlined />}
          className="!bg-teal-600 hover:!bg-teal-700"
          onClick={() => {
            try {
              downloadQuotationPdfViaChromium({
                report,
                customer,
                template,
                organization,
              });
            } catch (error) {
              message.error(error?.message || 'PDF download failed');
            }
          }}
        >
          PDF
        </Button>
        <OkBtn />
      </Space>
    ),
  });
}

export default function GeneratedReportsTable({ active = true }) {
  const [rows, setRows] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [q, c, t] = await Promise.all([
        api.get('/quotations', {
          params: { sort_by: 'created_at', sort_order: 'desc' },
        }).then((r) => r.data),
        api.get('/customers').then((r) => r.data),
        api.get('/quotation-templates').then((r) => r.data),
      ]);
      setRows(q.items || []);
      const cmap = {};
      (c.items || []).forEach((item) => {
        cmap[item.id] = item;
      });
      setCustomersById(cmap);
      const tmap = {};
      (t.items || []).forEach((item) => {
        tmap[item.id] = item;
      });
      setTemplatesById(tmap);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [q, c, t] = await Promise.all([
          api.get('/quotations', {
            params: { sort_by: 'created_at', sort_order: 'desc' },
          }).then((r) => r.data),
          api.get('/customers').then((r) => r.data),
          api.get('/quotation-templates').then((r) => r.data),
        ]);
        if (cancelled) return;
        setRows(q.items || []);
        const cmap = {};
        (c.items || []).forEach((item) => {
          cmap[item.id] = item;
        });
        setCustomersById(cmap);
        const tmap = {};
        (t.items || []).forEach((item) => {
          tmap[item.id] = item;
        });
        setTemplatesById(tmap);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load reports'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const remove = async (id) => {
    try {
      await api.delete(`/quotations/${id}`);
      message.success('Report deleted');
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const withContext = async (record, action) => {
    setBusyId(record.id);
    try {
      const ctx = await loadReportContext(record, customersById, templatesById);
      await action(ctx);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(
    () => rows.filter((r) => recordMatchesSearch(r, search, [
      'quotation_number',
      'status',
      (row) => customersById[row.customer_id]?.name,
      (row) => templatesById[row.quotation_template_id]?.name,
    ])),
    [rows, search, customersById, templatesById],
  );

  return (
    <div className="space-y-3">
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search reports…"
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={[
            slNoColumn(page, pageSize),
            { title: 'Report No', dataIndex: 'quotation_number' },
            {
              title: 'Customer',
              key: 'customer',
              render: (_, r) => customersById[r.customer_id]?.name || '—',
            },
            {
              title: 'Date',
              dataIndex: 'quotation_date',
              render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
            },
            {
              title: 'Total',
              dataIndex: 'total',
              render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 180,
              render: (_, record) => (
                <Space size={0}>
                  <Tooltip title="View">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      loading={busyId === record.id}
                      onClick={() => withContext(record, (ctx) => showReportDetail(ctx))}
                    />
                  </Tooltip>
                  <Tooltip title="Download Excel">
                    <Button
                      type="text"
                      icon={<FileExcelOutlined />}
                      loading={busyId === record.id}
                      onClick={() => withContext(record, ({ report, organization }) => {
                        downloadQuotationExcel(report, {
                          organizationName:
                            organization?.name || organization?.organization_name || 'Organization',
                        });
                        message.success('Excel downloaded');
                      })}
                    />
                  </Tooltip>
                  <Tooltip title="Download PDF (Chromium)">
                    <Button
                      type="text"
                      icon={<FilePdfOutlined />}
                      loading={busyId === record.id}
                      onClick={() => withContext(record, (ctx) => {
                        downloadQuotationPdfViaChromium(ctx);
                      })}
                    />
                  </Tooltip>
                  <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
