import { Typography } from 'antd';
import GeneratedReportsTable from '../../Components/GeneratedReportsTable';

export default function Reports() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <GeneratedReportsTable active />
    </div>
  );
}
