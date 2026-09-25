import { useEffect, useMemo, useState } from 'react';
import {
  Button, Dropdown, Empty, Pagination, Popconfirm, Select, Space, Spin, Table, Tag, Tooltip, message,
} from 'antd';
import {
  AppstoreOutlined, DeleteOutlined, DownloadOutlined, EditOutlined,
  EyeOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined, ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminReportActions from './AdminReportActions.jsx';
import ReportReviewModal from './ReportReviewModal.jsx';
import { templateForQuotation } from '../utils/templateSnapshot.js';
import QuotationPdfPreviewModal from './QuotationPdfPreviewModal.jsx';
import useQuotationPdfPreview from '../hooks/useQuotationPdfPreview.js';
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

function workflowStatusLabel(status) {
  if (status === 'ACCEPTED') return 'Accepted';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'SENT') return 'Pending';
  return status || '—';
}

function formatSubmittedAt(iso) {
  if (!iso) return '—';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD MMM YYYY, HH:mm:ss') : '—';
}

function formatReportNo(record) {
  const display = record.report_display_number || record.quotation_number || '—';
  const rev = record.report_revision;
  if (rev && rev > 1) {
    return (
      <span title={`Internal ref: ${record.quotation_number}`}>
        {display}
        <span className="ml-1 text-xs font-normal text-slate-500">(Rev {rev})</span>
      </span>
    );
  }
  return display;
}

function canReviseReport(record) {
  return record?.status === 'REJECTED' && !record?.superseded_by;
}

function formatReviewedAt(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY, hh:mm A') : '';
}

function ReportStatusCell({ status, reviewedAt }) {
  const label = workflowStatusLabel(status);
  const showReviewTime = (status === 'ACCEPTED' || status === 'REJECTED') && reviewedAt;
  const labelClass = status === 'ACCEPTED'
    ? 'font-semibold text-green-600'
    : status === 'REJECTED'
      ? 'font-semibold text-red-600'
      : status === 'SENT'
        ? 'font-medium text-blue-600'
        : 'text-slate-700';

  return (
    <div className="text-center leading-snug">
      <div className={labelClass}>{label}</div>
      {showReviewTime ? (
        <div className="mt-0.5 text-xs text-slate-400">{formatReviewedAt(reviewedAt)}</div>
      ) : null}
    </div>
  );
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
    template: templateForQuotation(full, template),
    organization,
  };
}

function statusTagCompact(status) {
  const map = {
    SENT: ['processing', 'Pending'],
    ACCEPTED: ['success', 'Accepted'],
    REJECTED: ['error', 'Rejected'],
  };
  const [color, label] = map[status] || ['default', workflowStatusLabel(status)];
  return <Tag color={color}>{label}</Tag>;
}

function PrintMenu({ onPdf, onExcel, loading, size = 'small' }) {
  const btnClass = size === 'small'
    ? ''
    : 'flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none !text-teal-700 hover:!bg-slate-100';
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
          size={size}
          className={btnClass || undefined}
          icon={<DownloadOutlined className={size === 'small' ? undefined : 'text-lg'} />}
          loading={loading}
          onClick={(e) => e.stopPropagation()}
        />
      </Tooltip>
    </Dropdown>
  );
}

export default function GeneratedReportsTable({
  active = true,
  showSubmittedBy = false,
  enableReview = false,
  allowDelete = true,
  revisePath = '/user/generate',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [highlightId, setHighlightId] = useState(null);
  const [rows, setRows] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState([]);
  const [view, setView] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [cardCtxById, setCardCtxById] = useState({});
  const pdfPreview = useQuotationPdfPreview();
  const [reviewModal, setReviewModal] = useState(null);

  const mergeReviewFromDetail = (row, updated) => {
    if (!updated?.id) return row;
    return {
      ...row,
      status: updated.status ?? row.status,
      review_remark: updated.review_remark ?? row.review_remark,
      reviewed_at: updated.reviewed_at ?? row.reviewed_at,
    };
  };

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
  }, [search, sortBy, view, customerFilter]);

  useEffect(() => {
    const focusId = location.state?.focusQuotationId;
    if (!focusId) return;
    setHighlightId(String(focusId));
    setView('list');
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => recordMatchesSearch(r, search, [
      'quotation_number',
      'status',
      'notes',
      'review_remark',
      'created_by_name',
      (row) => customersById[row.customer_id]?.name,
      (row) => customersById[row.customer_id]?.company,
      (row) => customersById[row.customer_id]?.email,
      (row) => templatesById[row.quotation_template_id]?.name,
      (row) => (row.created_at ? dayjs(row.created_at).format('DD MMM YYYY, HH:mm:ss') : ''),
      (row) => String(row.total ?? ''),
      (row) => `₹${Number(row.total || 0).toLocaleString('en-IN')}`,
    ]));
    if (customerFilter.length) {
      const allowed = new Set(customerFilter);
      list = list.filter((r) => allowed.has(customersById[r.customer_id]?.name));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') {
        return String(a.quotation_number || '').localeCompare(String(b.quotation_number || ''));
      }
      if (sortBy === 'total') {
        return Number(b.total || 0) - Number(a.total || 0);
      }
      return dayjs(b.created_at || 0).valueOf() - dayjs(a.created_at || 0).valueOf();
    });
    return sorted;
  }, [rows, search, customerFilter, customersById, templatesById, sortBy]);

  const customerOptions = useMemo(() => {
    const names = new Set();
    Object.values(customersById).forEach((c) => {
      const name = String(c?.name || '').trim();
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({
      label: name,
      value: name,
    }));
  }, [customersById]);

  useEffect(() => {
    if (!highlightId || !filtered.length) return;
    const idx = filtered.findIndex((r) => String(r.id) === String(highlightId));
    if (idx >= 0) {
      const effectivePageSize = view === 'grid' ? PAGE_SIZE_GRID : pageSize;
      setPage(Math.floor(idx / effectivePageSize) + 1);
    }
  }, [highlightId, filtered, view, pageSize]);

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

  const gridPageSize = PAGE_SIZE_GRID;
  const effectivePageSize = view === 'grid' ? gridPageSize : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);

  const isHighlighted = (record) => highlightId && String(record.id) === String(highlightId);

  useEffect(() => {
    if (!highlightId || view !== 'list') return undefined;
    const timer = window.setTimeout(() => {
      document
        .querySelector(`tr[data-row-key="${highlightId}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [highlightId, safePage, view]);

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

  const openPreview = (record) => {
    withContext(record, (ctx) => pdfPreview.openPreview(ctx));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <div className="flex w-72 overflow-hidden rounded-lg border border-slate-300 bg-white">
            <input
              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
              placeholder="Search by any field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Filter by customer"
            className="w-56 shrink-0"
            value={customerFilter}
            onChange={setCustomerFilter}
            options={customerOptions}
            optionFilterProp="label"
            maxTagCount="responsive"
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
            { value: 'date', label: 'Submitted at' },
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

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
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
              return (
                <div
                  key={record.id}
                  className={`flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:border-teal-400 hover:shadow-md ${
                    isHighlighted(record)
                      ? 'report-row-highlight border-teal-300 ring-2 ring-teal-200'
                      : 'border-slate-200'
                  }`}
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
                      <div className="truncate text-[11px] text-slate-500">
                        {customersById[record.customer_id]?.name || '—'}
                        {showSubmittedBy && record.created_by_name ? (
                          <>
                            {' · '}
                            {record.created_by_name}
                          </>
                        ) : null}
                        {' · '}
                        {statusTagCompact(record.status)}
                      </div>
                    </button>
                    <Space size={0} onClick={(e) => e.stopPropagation()}>
                      {enableReview ? (
                        <AdminReportActions
                          record={record}
                          showReview
                          viewLoading={busyId === record.id}
                          onView={() => openPreview(record)}
                          onApprove={() => setReviewModal({ quotation: record, decision: 'ACCEPTED' })}
                          onReject={() => setReviewModal({ quotation: record, decision: 'REJECTED' })}
                        />
                      ) : (
                        <PrintMenu
                          loading={busyId === record.id || pdfDownloading}
                          onPdf={() => withContext(record, (c) => downloadPdf(c))}
                          onExcel={() => withContext(record, (c) => downloadExcel(c))}
                        />
                      )}
                      {!enableReview ? (
                        <Tooltip title="Preview">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            loading={busyId === record.id}
                            onClick={() => openPreview(record)}
                          />
                        </Tooltip>
                      ) : null}
                      {canReviseReport(record) && !allowDelete ? (
                        <Tooltip title="Revise & resubmit">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${revisePath}?edit=${record.id}`);
                            }}
                          />
                        </Tooltip>
                      ) : null}
                      {allowDelete ? (
                        <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ) : null}
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
            rowClassName={(record) => (isHighlighted(record) ? 'report-row-highlight' : '')}
            scroll={{ x: 'max-content' }}
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
                sorter: (a, b) => String(a.report_display_number || a.quotation_number || '')
                  .localeCompare(String(b.report_display_number || b.quotation_number || '')),
                render: (_, r) => formatReportNo(r),
              },
              {
                title: 'Customer',
                key: 'customer',
                render: (_, r) => customersById[r.customer_id]?.name || '—',
              },
              ...(showSubmittedBy ? [{
                title: 'Submitted by',
                key: 'submitted_by',
                sorter: (a, b) => String(a.created_by_name || '').localeCompare(String(b.created_by_name || '')),
                render: (_, r) => r.created_by_name || '—',
              }] : []),
              {
                title: 'Submitted at',
                key: 'submitted_at',
                sorter: (a, b) => dayjs(a.created_at || 0).valueOf() - dayjs(b.created_at || 0).valueOf(),
                render: (_, r) => formatSubmittedAt(r.created_at),
              },
              {
                title: 'Status',
                key: 'status',
                width: 160,
                render: (_, r) => (
                  <ReportStatusCell status={r.status} reviewedAt={r.reviewed_at} />
                ),
              },
              {
                title: 'Remarks',
                key: 'remarks',
                ellipsis: true,
                render: (_, r) => (
                  r.review_remark
                    ? <span title={r.review_remark}>{r.review_remark}</span>
                    : '—'
                ),
              },
              {
                title: 'Total',
                dataIndex: 'total',
                render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
              },
              {
                title: 'Actions',
                key: 'actions',
                fixed: 'right',
                width: enableReview ? 200 : 160,
                className: 'report-actions-col',
                render: (_, record) => (
                  <Space size={0} wrap={false} className="report-actions-cell">
                    {enableReview ? (
                      <>
                        <AdminReportActions
                          record={record}
                          showReview
                          viewLoading={busyId === record.id}
                          onView={() => openPreview(record)}
                          onApprove={() => setReviewModal({ quotation: record, decision: 'ACCEPTED' })}
                          onReject={() => setReviewModal({ quotation: record, decision: 'REJECTED' })}
                        />
                        <PrintMenu
                          size="middle"
                          loading={busyId === record.id || pdfDownloading}
                          onPdf={() => withContext(record, (c) => downloadPdf(c))}
                          onExcel={() => withContext(record, (c) => downloadExcel(c))}
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                    {canReviseReport(record) && !allowDelete ? (
                      <Tooltip title="Revise & resubmit">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => navigate(`${revisePath}?edit=${record.id}`)}
                        />
                      </Tooltip>
                    ) : null}
                    {allowDelete ? (
                      <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ) : null}
                  </Space>
                ),
              },
            ]}
          />
        </div>
      )}
      </div>

      <ReportReviewModal
        open={Boolean(reviewModal)}
        quotation={reviewModal?.quotation}
        decision={reviewModal?.decision || 'ACCEPTED'}
        onClose={() => setReviewModal(null)}
        onDone={async (updated) => {
          if (updated?.id) {
            setRows((prev) => prev.map((r) => (
              String(r.id) === String(updated.id) ? mergeReviewFromDetail(r, updated) : r
            )));
          }
          await load();
        }}
      />

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
