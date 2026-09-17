import { useEffect, useState } from 'react';
import {
  Button, Space, Typography, Result, Select, ColorPicker, Tooltip, Divider, message, Spin,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { useData } from '../../store/DataContext';
import ReportDocument, { resolveReportNo } from '../../components/ReportDocument';
import { resolveReportTemplate } from '../../utils/reportTemplate';
import { templateHasRichLayout } from '../../utils/templatePlaceholders';

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (Sans)' },
  { value: "'Source Serif 4', serif", label: 'Source Serif (Serif)' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
];

function mergeTemplate(base, overrides = {}) {
  const { headerHtml, footerHtml, ...rest } = overrides || {};
  return {
    ...base,
    ...rest,
    headerHtml: headerHtml !== undefined ? headerHtml : base.headerHtml,
    footerHtml: footerHtml !== undefined ? footerHtml : base.footerHtml,
  };
}

export default function ReportEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loadingReports, refreshReports, refreshTemplates, updateReport } = useData();
  const navigate = useNavigate();

  const [templateId, setTemplateId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    refreshReports().catch(() => {});
    refreshTemplates().catch(() => {});
  }, [refreshReports, refreshTemplates]);

  const report = data.reports.find((r) => r.id === id);

  useEffect(() => {
    if (!report) return;
    const resolved = resolveReportTemplate(
      data.templates,
      { ...report, overrides: undefined },
      user,
    );
    // Prefer report's saved template; otherwise auto-pick designed/default
    const nextId = report.templateId || (resolved?.id !== 'default' ? resolved?.id : null) || null;
    setTemplateId(nextId);
    setOverrides(report.overrides || {});
    setHydrated(true);
  }, [report?.id, data.templates, user]);

  if ((loadingReports && !report) || (report && !hydrated)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return <Result status="404" title="Report not found" extra={<Button onClick={() => navigate('/user/reports')}>Back to Reports</Button>} />;
  }

  const selectedBase = resolveReportTemplate(
    data.templates,
    { ...report, templateId, overrides: undefined },
    user,
  );
  const effective = mergeTemplate(selectedBase, overrides);
  const isRich = templateHasRichLayout(effective);

  const patch = (p) => setOverrides((o) => ({ ...o, ...p }));

  const handleSave = async () => {
    try {
      await updateReport(report.id, { templateId, overrides });
      message.success('Report updated');
      navigate(`/user/reports/${report.id}/view`);
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || 'Failed to update report');
    }
  };

  return (
    <div className="report-view-page">
      <div className="report-view-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/user/reports/${report.id}/view`)}>Back</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>Editing {resolveReportNo(report)}</Typography.Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save Report</Button>
      </div>

      <div className="card-shell report-edit-tools">
        <Space size={6}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>Base template</Typography.Text>
          <Select
            size="small"
            style={{ width: 220 }}
            value={templateId}
            placeholder="Select designed template"
            options={data.templates.map((t) => ({
              value: t.id,
              label: templateHasRichLayout(t) ? `${t.name} (designed)` : t.name,
            }))}
            onChange={(v) => {
              setTemplateId(v || null);
              setOverrides({});
            }}
          />
        </Space>

        <Divider type="vertical" />

        <Button
          size="small"
          icon={<BgColorsOutlined />}
          onClick={() => navigate(templateId ? `/user/templates/edit/${templateId}` : '/user/templates')}
        >
          {isRich ? 'Edit design' : 'Design template'}
        </Button>

        {!isRich ? (
          <>
            <Divider type="vertical" />

            <Space size={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>Font</Typography.Text>
              <Select size="small" style={{ width: 180 }} value={effective.fontFamily || FONTS[0].value} options={FONTS} onChange={(v) => patch({ fontFamily: v })} />
            </Space>

            <Divider type="vertical" />

            <Space size={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12.5, marginRight: 4 }}>Header align</Typography.Text>
              <Tooltip title="Left"><Button size="small" type={effective.align === 'left' || !effective.align ? 'primary' : 'default'} icon={<AlignLeftOutlined />} onClick={() => patch({ align: 'left' })} /></Tooltip>
              <Tooltip title="Center"><Button size="small" type={effective.align === 'center' ? 'primary' : 'default'} icon={<AlignCenterOutlined />} onClick={() => patch({ align: 'center' })} /></Tooltip>
              <Tooltip title="Right"><Button size="small" type={effective.align === 'right' ? 'primary' : 'default'} icon={<AlignRightOutlined />} onClick={() => patch({ align: 'right' })} /></Tooltip>
            </Space>

            <Divider type="vertical" />

            <Space size={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>Accent color</Typography.Text>
              <ColorPicker size="small" value={effective.primaryColor} onChangeComplete={(c) => patch({ primaryColor: c.toHexString() })} />
            </Space>

            <Divider type="vertical" />

            <Button size="small" onClick={() => patch({ showLogo: effective.showLogo === false ? true : false })}>
              {effective.showLogo === false ? 'Show Logo' : 'Hide Logo'}
            </Button>
          </>
        ) : null}
      </div>

      <Typography.Text type="secondary" className="report-edit-hint">
        {isRich
          ? 'This report uses your designed template header/footer. Change the base template above, or open Design Template to edit the layout.'
          : 'No designed template selected yet — pick one above, or create one in Design Template. Until then you can edit company name, address, title, and footer below.'}
      </Typography.Text>

      <div className="report-view-canvas">
        <ReportDocument report={report} template={effective} editable={!isRich} onTemplateChange={patch} />
      </div>
    </div>
  );
}
