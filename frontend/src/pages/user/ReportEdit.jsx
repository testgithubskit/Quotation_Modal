import { useEffect, useMemo, useState } from 'react';
import {
  Button, Space, Typography, Result, Select, Checkbox, Input, message, Spin, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PrinterOutlined,
  HolderOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { useData } from '../../store/DataContext';
import ReportDocument, { resolveReportNo } from '../../components/ReportDocument';
import { resolveReportTemplate } from '../../utils/reportTemplate';
import { templateHasRichLayout } from '../../utils/templatePlaceholders';
import { printReportElement } from '../../utils/printReport';
import { fieldLabelFromKey } from '../../utils/fieldSchema';
import {
  normalizeColumnConfig,
  normalizeIncluded,
} from '../../utils/reportBodyConfig';

function mergeTemplate(base, overrides = {}) {
  const { headerHtml, footerHtml, ...rest } = overrides || {};
  return {
    ...base,
    ...rest,
    headerHtml: headerHtml !== undefined ? headerHtml : base.headerHtml,
    footerHtml: footerHtml !== undefined ? footerHtml : base.footerHtml,
  };
}

function buildMetaFields(report) {
  if (!report) return [];
  const fields = [
    { key: 'reportNo', label: 'Report No.', value: resolveReportNo(report) },
    { key: 'date', label: 'Report Date', value: report.date || report.customHeader?.date || '—' },
    { key: 'subject', label: 'Subject', value: report.subject || '—' },
    { key: 'customer', label: 'Customer', value: report.customer?.name || '—' },
    { key: 'company', label: 'Company', value: report.customer?.company || '—' },
  ];

  const header = report.customHeader || {};
  Object.entries(header).forEach(([key, val]) => {
    if (key === 'reportNo' || key === 'date') return;
    if (val == null || val === '') return;
    fields.push({ key, label: fieldLabelFromKey(key), value: String(val) });
  });

  if (!Object.keys(header).length) {
    if (report.centre || report.center) {
      fields.push({ key: 'centre', label: 'Centre', value: report.centre || report.center });
    }
    if (report.lab) fields.push({ key: 'lab', label: 'Lab', value: report.lab });
    if (report.enquiryNo) fields.push({ key: 'enquiryNo', label: 'Enquiry No.', value: report.enquiryNo });
  }

  return fields;
}

export default function ReportEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loadingReports, refreshReports, refreshTemplates, updateReport } = useData();
  const navigate = useNavigate();

  const [templateId, setTemplateId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [draft, setDraft] = useState(null);
  const [columns, setColumns] = useState(() => normalizeColumnConfig());
  const [included, setIncluded] = useState(() => normalizeIncluded());
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragKey, setDragKey] = useState(null);

  useEffect(() => {
    refreshReports().catch(() => {});
    refreshTemplates().catch(() => {});
  }, [refreshReports, refreshTemplates]);

  const report = data.reports.find((r) => r.id === id);

  useEffect(() => {
    setHydrated(false);
    setDraft(null);
  }, [id]);

  useEffect(() => {
    if (!report || hydrated) return;
    const resolved = resolveReportTemplate(
      data.templates,
      { ...report, overrides: undefined },
      user,
    );
    const nextId = report.templateId || (resolved?.id !== 'default' ? resolved?.id : null) || null;
    setTemplateId(nextId);
    setOverrides(report.overrides || {});
    setDraft({
      ...report,
      activities: structuredClone(report.activities || []),
    });
    setColumns(normalizeColumnConfig(report.bodyConfig?.columns));
    setIncluded(normalizeIncluded(report.bodyConfig?.included));
    setHydrated(true);
  }, [report, data.templates, user, hydrated]);

  const metaFields = useMemo(() => buildMetaFields(draft || report), [draft, report]);

  if ((loadingReports && !report) || (report && !hydrated) || (report && !draft)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report || !draft) {
    return (
      <Result
        status="404"
        title="Report not found"
        extra={<Button onClick={() => navigate('/user/reports')}>Back to Reports</Button>}
      />
    );
  }

  const selectedBase = resolveReportTemplate(
    data.templates,
    { ...draft, templateId, overrides: undefined },
    user,
  );
  const effective = mergeTemplate(selectedBase, overrides);
  const bodyConfig = { columns, included };
  const templateLabel = selectedBase?.name || 'Default template';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReport(report.id, {
        ...draft,
        templateId,
        overrides,
        bodyConfig,
        activities: draft.activities,
      });
      message.success('Report updated');
      navigate(`/user/reports/${report.id}/view`);
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || 'Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const el = document.querySelector('.report-edit-preview .report-view-canvas');
    printReportElement(el, resolveReportNo(draft));
  };

  const moveColumn = (key, dir) => {
    setColumns((prev) => {
      const list = [...prev];
      const idx = list.findIndex((c) => c.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= list.length) return prev;
      const tmp = list[idx];
      list[idx] = list[next];
      list[next] = tmp;
      return list;
    });
  };

  const onDropColumn = (targetKey) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      return;
    }
    setColumns((prev) => {
      const list = [...prev];
      const from = list.findIndex((c) => c.key === dragKey);
      const to = list.findIndex((c) => c.key === targetKey);
      if (from < 0 || to < 0) return prev;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return list;
    });
    setDragKey(null);
  };

  return (
    <div className="report-edit-workspace">
      <div className="report-edit-topbar">
        <div className="report-edit-topbar-left">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/user/reports/${report.id}/view`)}>
            Back
          </Button>
          <div className="report-edit-title-block">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {resolveReportNo(draft)}
            </Typography.Title>
            <Typography.Text type="secondary" className="report-edit-template-name">
              {templateLabel}
              {templateHasRichLayout(effective) ? ' · designed' : ''}
            </Typography.Text>
          </div>
        </div>

        <Space wrap>
          <Select
            size="middle"
            style={{ minWidth: 200 }}
            value={templateId}
            placeholder="Change template"
            options={data.templates.map((t) => ({
              value: t.id,
              label: templateHasRichLayout(t) ? `${t.name} (designed)` : t.name,
            }))}
            onChange={(v) => {
              setTemplateId(v || null);
              setOverrides({});
            }}
          />
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save config
          </Button>
        </Space>
      </div>

      <div className="report-edit-body">
        <aside className="report-edit-sidebar">
          <section className="report-edit-section">
            <div className="report-edit-section-title">Document metadata</div>
            <div className="report-edit-meta-list">
              {metaFields.map((field) => (
                <label key={field.key} className="report-edit-meta-field">
                  <span>{field.label}</span>
                  <Input size="small" value={field.value} readOnly />
                </label>
              ))}
            </div>
            <Typography.Text type="secondary" className="report-edit-section-hint">
              Header &amp; footer come from the template. Only the body table is editable below.
            </Typography.Text>
          </section>

          <section className="report-edit-section">
            <div className="report-edit-section-title">Included content</div>
            <div className="report-edit-checks">
              <Checkbox
                checked={included.showNotes}
                onChange={(e) => setIncluded((s) => ({ ...s, showNotes: e.target.checked }))}
              >
                Activity notes
              </Checkbox>
              <Checkbox
                checked={included.showTerms}
                onChange={(e) => setIncluded((s) => ({ ...s, showTerms: e.target.checked }))}
              >
                Terms &amp; conditions
              </Checkbox>
              <Checkbox
                checked={included.showCustomerContact}
                onChange={(e) => setIncluded((s) => ({ ...s, showCustomerContact: e.target.checked }))}
              >
                Customer contact
              </Checkbox>
              <Checkbox
                checked={included.showCustomerAddress}
                onChange={(e) => setIncluded((s) => ({ ...s, showCustomerAddress: e.target.checked }))}
              >
                Customer address
              </Checkbox>
            </div>
          </section>

          <section className="report-edit-section">
            <div className="report-edit-section-title">Columns</div>
            <div className="report-edit-columns">
              {columns.map((col, idx) => (
                <div
                  key={col.key}
                  className={`report-edit-column-row${dragKey === col.key ? ' is-dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragKey(col.key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropColumn(col.key)}
                  onDragEnd={() => setDragKey(null)}
                >
                  <HolderOutlined className="report-edit-column-handle" />
                  <Checkbox
                    checked={col.visible !== false}
                    disabled={col.locked}
                    onChange={(e) => {
                      const visible = e.target.checked;
                      setColumns((prev) => prev.map((c) => (
                        c.key === col.key ? { ...c, visible } : c
                      )));
                    }}
                  >
                    {col.label}
                  </Checkbox>
                  <Space size={0} className="report-edit-column-move">
                    <Tooltip title="Move up">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={idx === 0}
                        onClick={() => moveColumn(col.key, -1)}
                      />
                    </Tooltip>
                    <Tooltip title="Move down">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={idx === columns.length - 1}
                        onClick={() => moveColumn(col.key, 1)}
                      />
                    </Tooltip>
                  </Space>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="report-edit-preview">
          <div className="report-view-canvas">
            <ReportDocument
              report={draft}
              template={effective}
              editable={false}
              editableBody
              bodyConfig={bodyConfig}
              onBodyChange={(activities) => setDraft((d) => ({ ...d, activities }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
