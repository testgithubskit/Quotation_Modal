import { useEffect } from 'react';
import { Button, Space, Typography, Result, Spin } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../config/auth.jsx';
import { useData } from '../../store/DataContext';
import ReportDocument, { resolveReportNo } from '../../components/ReportDocument';
import { resolveReportTemplate } from '../../utils/reportTemplate';
import { printReportElement } from '../../utils/printReport';

export default function ReportView() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loadingReports, refreshReports, refreshTemplates } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    refreshReports().catch(() => {});
    refreshTemplates().catch(() => {});
  }, [refreshReports, refreshTemplates]);

  const report = data.reports.find((r) => r.id === id);
  const template = resolveReportTemplate(data.templates, report, user);

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

  const handlePrint = () => {
    const el = document.querySelector('.report-view-canvas');
    printReportElement(el, resolveReportNo(report));
  };

  return (
    <div className="report-view-page">
      <div className="report-view-toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/user/reports')}>Back</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>{resolveReportNo(report)}</Typography.Title>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/user/reports/${report.id}/edit`)}>Edit Report</Button>
        </Space>
      </div>

      <div className="report-view-canvas">
        <ReportDocument
          report={report}
          template={template}
          editable={false}
          bodyConfig={report.bodyConfig}
        />
      </div>
    </div>
  );
}
