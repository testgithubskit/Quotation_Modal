import { useState } from 'react';
import {
  Button, Space, Typography, Result, Select, ColorPicker, Tooltip, Divider, message,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import ReportDocument from '../../components/ReportDocument';

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (Sans)' },
  { value: "'Source Serif 4', serif", label: 'Source Serif (Serif)' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
];

export default function ReportEdit() {
  const { id } = useParams();
  const { data, updateReport } = useData();
  const navigate = useNavigate();

  const report = data.reports.find((r) => r.id === id);
  const baseTemplate = report && (data.templates.find((t) => t.id === report.templateId) || data.templates[0]);

  const [templateId, setTemplateId] = useState(report?.templateId || baseTemplate?.id);
  const [overrides, setOverrides] = useState(report?.overrides || {});

  if (!report) {
    return <Result status="404" title="Report not found" extra={<Button onClick={() => navigate('/user/reports')}>Back to Reports</Button>} />;
  }

  const currentBase = data.templates.find((t) => t.id === templateId) || baseTemplate;
  const effective = { ...currentBase, ...overrides };

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/user/reports/${report.id}/view`)}>Back</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>Editing {report.reportNo}</Typography.Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Save Report</Button>
      </div>

      {/* Word-style toolbar */}
      <div className="card-shell" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Space size={6}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>Base template</Typography.Text>
          <Select
            size="small"
            style={{ width: 190 }}
            value={templateId}
            options={data.templates.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => { setTemplateId(v); setOverrides({}); }}
          />
        </Space>

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
      </div>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Click directly on the company name, address, title, or footer text below to edit them, just like a Word document. Click the logo box to upload an image.
      </Typography.Text>

      <div style={{ background: '#EFEBE1', padding: '32px 0', borderRadius: 6 }}>
        <ReportDocument report={report} template={effective} editable onTemplateChange={patch} />
      </div>
    </div>
  );
}
