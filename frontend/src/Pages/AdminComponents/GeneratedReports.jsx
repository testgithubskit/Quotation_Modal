import { Typography } from 'antd';
import GeneratedReportsTable from '../../Components/GeneratedReportsTable';

export default function GeneratedReports() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Typography.Title level={4} className="!mb-0 shrink-0 !font-sans !text-teal-800">
        Generated Reports
      </Typography.Title>
      <GeneratedReportsTable active />
    </div>
  );
}
