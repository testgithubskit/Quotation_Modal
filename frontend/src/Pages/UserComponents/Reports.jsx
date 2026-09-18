import { Typography } from 'antd';
import GeneratedReportsTable from '../../Components/GeneratedReportsTable';

export default function Reports() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <Typography.Title level={3} className="!mb-0 !font-sans !text-teal-800">
        Reports
      </Typography.Title>
      <GeneratedReportsTable active />
    </div>
  );
}
