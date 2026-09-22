import { useEffect, useMemo, useState } from 'react';
import {
  Button, Dropdown, Empty, Modal, Pagination, Popconfirm, Select, Space, Spin, Table, Tooltip, message,
} from 'antd';
import {
  AppstoreOutlined, CloseOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined,
  FileExcelOutlined, FilePdfOutlined, FileTextOutlined, ReloadOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../config/auth.js';
import { recordMatchesSearch, slNoColumn } from '../utils/tableHelpers';
import {
  downloadQuotationExcel,
  downloadQuotationPdfViaChromium,
  preserveBlankParagraphs,
  renderQuotationDocument,
  resolveLineItems,
} from '../utils/renderQuotationReport.js';

const PAGE_SIZE_GRID = 8;

function timeAgo(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  const mins = dayjs().diff(d, 'minute');
  if (mins < 60) return `Updated ${Math.max(1, mins)}m ago`;
  const hours = dayjs().diff(d, 'hour');
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = dayjs().diff(d, 'day');
  if (days < 14) return `Updated ${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `Updated ${weeks}w ago`;
  return `Updated ${Math.max(1, Math.floor(days / 30))}mo ago`;
}

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
        className="report-preview-body mx-auto flex flex-col bg-white text-slate-900 shadow-md"
        style={{
          width: Math.min(doc.width, 780),
          minHeight: doc.height * (Math.min(doc.width, 780) / doc.width),
          padding: `${m.top || 5}mm ${m.right || 5}mm ${m.bottom || 5}mm ${m.left || 5}mm`,
          fontFamily: `${doc.pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif`,
          fontSize: doc.pageSettings.fontSize || '12px',
        }}
      >
        <div className="shrink-0" dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.headerHtml) }} />
        <div
          className="min-h-0 flex-1"
          style={{ margin: `${doc.pageSettings.headerSpacing || 0}mm 0 ${doc.pageSettings.footerSpacing || 0}mm` }}
          dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.bodyHtml) }}
        />
        <div className="mt-auto shrink-0" dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.footerHtml) }} />
      </div>
    </div>
  );
}

function ReportCardThumb({ report, customer, template, organization }) {
  const doc = renderQuotationDocument({ report, customer, template, organization });
  const m = doc.pageSettings?.margins || { top: 5, right: 5, bottom: 5, left: 5 };
  const landscape = doc.pageSettings?.orientation === 'landscape';
  const pageW = landscape ? 900 : 640;
  const pageH = landscape ? 640 : 900;
  const scale = landscape ? 0.42 : 0.34;

  return (
    <div className="template-card-thumb relative aspect-[16/10] overflow-hidden bg-[#e8eef5]">
      <div className="absolute inset-0 flex items-start justify-center pt-3">
        <div
          className="overflow-hidden bg-white shadow-sm"
          style={{ width: pageW * scale, height: pageH * scale }}
        >
          <div
            className="template-card-preview flex flex-col"
            style={{
              width: pageW,
              minHeight: pageH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              padding: `${m.top || 5}mm ${m.right || 5}mm ${m.bottom || 5}mm ${m.left || 5}mm`,
              boxSizing: 'border-box',
              fontFamily: `${doc.pageSettings?.fontFamily || 'Times New Roman'}, Times, serif`,
              fontSize: doc.pageSettings?.fontSize || '12px',
              background: '#fff',
            }}
          >
            {doc.hasContent ? (
              <>
                <div className="shrink-0" dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.headerHtml) }} />
                <div
                  className="min-h-0 flex-1"
                  style={{
                    marginTop: `${doc.pageSettings.headerSpacing || 0}mm`,
                    marginBottom: `${doc.pageSettings.footerSpacing || 0}mm`,
                  }}
                  dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.bodyHtml) }}
                />
                <div className="mt-auto shrink-0" dangerouslySetInnerHTML={{ __html: preserveBlankParagraphs(doc.footerHtml) }} />
              </>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: '#0f766e', marginBottom: 8 }}>
                  {report?.quotation_number || 'Report'}
                </div>
                <div>{customer?.name || '—'}</div>
                <div style={{ marginTop: 8 }}>
                  ₹{Number(report?.total || 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>
        </div>
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

function PrintMenu({ onPdf, onExcel, loading }) {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'pdf',
            icon: <FilePdfOutlined />,
            label: 'Download as PDF',
            onClick: ({ domEvent }) => {
              domEvent?.stopPropagation?.();
              onPdf?.();
            },
          },
          {
            key: 'excel',
            icon: <FileExcelOutlined />,
            label: 'Download as Excel',
            onClick: ({ domEvent }) => {
              domEvent?.stopPropagation?.();
              onExcel?.();
            },
          },
        ],
      }}
    >
      <Tooltip title="Download">
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          loading={loading}
          onClick={(e) => e.stopPropagation()}
        />
      </Tooltip>
    </Dropdown>
  );
}

export default function GeneratedReportsTable({ active = true }) {
  const [rows, setRows] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCtx, setPreviewCtx] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [cardCtxById, setCardCtxById] = useState({});

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

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, view]);

  const remove = async (id) => {
    try {
      await api.delete(`/quotations/${id}`);
      message.success('Deleted');
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const withContext = async (record, fn) => {
    setBusyId(record.id);
    try {
      let ctx = cardCtxById[record.id];
      if (!ctx) {
        ctx = await loadReportContext(record, customersById, templatesById);
        setCardCtxById((s) => ({ ...s, [record.id]: ctx }));
      }
      await fn(ctx);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewCtx(null);
  };

  const downloadPdf = async (ctx) => {
    setPdfDownloading(true);
    try {
      await downloadQuotationPdfViaChromium(ctx);
      message.success('PDF downloaded');
    } catch (error) {
      message.error(error?.message || 'PDF download failed');
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadExcel = (ctx) => {
    downloadQuotationExcel(ctx.report, {
      customer: ctx.customer,
      organizationName:
        ctx.organization?.name || ctx.organization?.organization_name || 'Organization',
    });
    message.success('Excel downloaded');
  };

  const filtered = useMemo(() => {
    let list = rows.filter((r) => recordMatchesSearch(r, search, [
      'quotation_number',
      'status',
      'notes',
      (row) => customersById[row.customer_id]?.name,
      (row) => customersById[row.customer_id]?.company,
      (row) => customersById[row.customer_id]?.email,
      (row) => templatesById[row.quotation_template_id]?.name,
      (row) => (row.quotation_date ? dayjs(row.quotation_date).format('DD MMM YYYY') : ''),
      (row) => String(row.total ?? ''),
      (row) => `₹${Number(row.total || 0).toLocaleString('en-IN')}`,
    ]));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.quotation_number || '').localeCompare(String(b.quotation_number || ''));
      }
      if (sortBy === 'total') {
        return Number(b.total || 0) - Number(a.total || 0);
      }
      return dayjs(b.quotation_date || 0).valueOf() - dayjs(a.quotation_date || 0).valueOf();
    });
    return sorted;
  }, [rows, search, customersById, templatesById, sortBy]);

  const gridPageSize = PAGE_SIZE_GRID;
  const effectivePageSize = view === 'grid' ? gridPageSize : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);

  // Prefetch card contexts for visible grid items
  useEffect(() => {
    if (view !== 'grid' || !paged.length) return undefined;
    let cancelled = false;
    (async () => {
      const missing = paged.filter((r) => !cardCtxById[r.id]);
      if (!missing.length) return;
      const next = { ...cardCtxById };
      await Promise.all(missing.map(async (record) => {
        try {
          next[record.id] = await loadReportContext(record, customersById, templatesById);
        } catch {
          /* ignore thumb errors */
        }
      }));
      if (!cancelled) setCardCtxById(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, paged.map((r) => r.id).join(','), customersById, templatesById]);

  const previewReport = previewCtx?.report;

  const openPreview = (record) => {
    withContext(record, (ctx) => {
      setPreviewCtx(ctx);
      setPreviewOpen(true);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-md flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white">
          <input
            className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
            placeholder="Search by any field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-200">
          <Tooltip title="Grid view">
            <button
              type="button"
              className={`px-2.5 py-1.5 ${view === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setView('grid')}
            >
              <AppstoreOutlined />
            </button>
          </Tooltip>
          <Tooltip title="List view">
            <button
              type="button"
              className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setView('list')}
            >
              <UnorderedListOutlined />
            </button>
          </Tooltip>
        </div>
        <Select
          value={sortBy}
          onChange={setSortBy}
          className="!min-w-[180px]"
          options={[
            { value: 'date', label: 'Report date' },
            { value: 'name', label: 'Report no' },
            { value: 'total', label: 'Total amount' },
          ]}
        />
        <Tooltip title="Refresh">
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={load}
            aria-label="Refresh"
          />
        </Tooltip>
      </div>

      {loading && !rows.length ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spin />
        </div>
      ) : !filtered.length ? (
        <Empty description="No reports found" className="py-16" />
      ) : view === 'grid' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paged.map((record) => {
              const ctx = cardCtxById[record.id];
              const updatedAt = record.updated_at || record.created_at;
              return (
                <div
                  key={record.id}
                  className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-teal-400 hover:shadow-md"
                >
                  <div className="relative cursor-pointer" onClick={() => openPreview(record)}>
                    {ctx ? (
                      <ReportCardThumb
                        report={ctx.report}
                        customer={ctx.customer}
                        template={ctx.template}
                        organization={ctx.organization}
                      />
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-[#e8eef5]">
                        <Spin size="small" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-teal-600">
                      <FileTextOutlined />
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openPreview(record)}
                    >
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {record.quotation_number || 'Report'}
                      </div>
                      <Tooltip title={updatedAt ? dayjs(updatedAt).format('DD MMM YYYY, hh:mm A') : ''}>
                        <div className="truncate text-[11px] text-slate-500">
                          {customersById[record.customer_id]?.name || '—'}
                          {' · '}
                          {timeAgo(updatedAt)}
                        </div>
                      </Tooltip>
                    </button>
                    <Space size={0}>
                      <PrintMenu
                        loading={busyId === record.id || pdfDownloading}
                        onPdf={() => withContext(record, (c) => downloadPdf(c))}
                        onExcel={() => withContext(record, (c) => downloadExcel(c))}
                      />
                      <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > gridPageSize ? (
            <div className="flex justify-center py-4">
              <Pagination
                current={safePage}
                pageSize={gridPageSize}
                total={filtered.length}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
          <Table
            className="app-data-table"
            rowKey="id"
            loading={loading}
            dataSource={filtered}
            pagination={{
              current: safePage,
              pageSize,
              total: filtered.length,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            columns={[
              slNoColumn(safePage, pageSize),
              {
                title: 'Report No',
                dataIndex: 'quotation_number',
                sorter: (a, b) => String(a.quotation_number || '').localeCompare(String(b.quotation_number || '')),
              },
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
                title: 'Updated',
                key: 'updated',
                render: (_, r) => timeAgo(r.updated_at || r.created_at),
              },
              {
                title: 'Total',
                dataIndex: 'total',
                render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
              },
              {
                title: 'Actions',
                key: 'actions',
                width: 160,
                render: (_, record) => (
                  <Space size={0}>
                    <Tooltip title="Preview">
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        loading={busyId === record.id}
                        onClick={() => openPreview(record)}
                      />
                    </Tooltip>
                    <PrintMenu
                      loading={busyId === record.id || pdfDownloading}
                      onPdf={() => withContext(record, (c) => downloadPdf(c))}
                      onExcel={() => withContext(record, (c) => downloadExcel(c))}
                    />
                    <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        open={previewOpen}
        onCancel={closePreview}
        title={previewReport?.quotation_number || 'Report preview'}
        width={900}
        centered
        destroyOnClose
        maskClosable={false}
        keyboard={false}
        closable
        closeIcon={<CloseOutlined />}
        footer={(
          <div className="flex justify-end gap-2">
            <Button onClick={closePreview}>Close</Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'pdf',
                    icon: <FilePdfOutlined />,
                    label: 'Download as PDF',
                    onClick: () => previewCtx && downloadPdf(previewCtx),
                  },
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined />,
                    label: 'Download as Excel',
                    onClick: () => previewCtx && downloadExcel(previewCtx),
                  },
                ],
              }}
            >
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={pdfDownloading}
                className="!bg-teal-600 hover:!bg-teal-700"
              >
                Download
              </Button>
            </Dropdown>
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
