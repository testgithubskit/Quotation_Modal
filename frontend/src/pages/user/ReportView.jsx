import { useEffect } from 'react';
import { Button, Space, Typography, Result, Spin } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import ReportDocument from '../../components/ReportDocument';

export default function ReportView() {
  const { id } = useParams();
  const { data, loadingReports, refreshReports, refreshTemplates } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    refreshReports().catch(() => {});
    refreshTemplates().catch(() => {});
  }, [refreshReports, refreshTemplates]);

  const report = data.reports.find((r) => r.id === id);
  const template = report && (data.templates.find((t) => t.id === report.templateId) || data.templates[0]);

  if (loadingReports && !report) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return <Result status="404" title="Report not found" extra={<Button onClick={() => navigate('/user/reports')}>Back to Reports</Button>} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/user/reports')}>Back</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>{report.reportNo}</Typography.Title>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/user/reports/${report.id}/edit`)}>Edit Report</Button>
        </Space>
      </div>

      <div style={{ background: '#EFEBE1', padding: '32px 0', borderRadius: 6 }}>
        <ReportDocument report={report} template={report.overrides ? { ...template, ...report.overrides } : template} editable={false} />
      </div>
    </div>
  );
}
