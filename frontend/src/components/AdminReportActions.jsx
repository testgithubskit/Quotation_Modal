import { Button, Space, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';

const actionBtnClass =
  'flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 shadow-none';

/** View + Approve + Reject (admin). Approve/Reject disabled unless status is SENT. */
export default function AdminReportActions({
  record,
  viewLoading,
  onView,
  onApprove,
  onReject,
  showReview = false,
}) {
  const status = record?.status?.value ?? record?.status;
  const canReview = showReview && status === 'SENT';

  return (
    <Space size={4} className="report-admin-actions">
      <Tooltip title="View">
        <Button
          type="text"
          className={`${actionBtnClass} !text-[#1677ff] hover:!bg-slate-100`}
          icon={<EyeOutlined className="text-lg" />}
          loading={viewLoading}
          onClick={onView}
        />
      </Tooltip>
      {showReview ? (
        <>
          <Tooltip title={canReview ? 'Approve' : 'Already reviewed'}>
            <Button
              type="text"
              disabled={!canReview}
              className={`${actionBtnClass} ${canReview ? '!text-green-600 hover:!bg-slate-100' : '!text-slate-300'}`}
              icon={<CheckOutlined className="text-base font-bold" />}
              onClick={onApprove}
            />
          </Tooltip>
          <Tooltip title={canReview ? 'Reject' : 'Already reviewed'}>
            <Button
              type="text"
              disabled={!canReview}
              className={`${actionBtnClass} ${canReview ? '!text-red-500 hover:!bg-slate-100' : '!text-slate-300'}`}
              icon={<CloseOutlined className="text-base font-bold" />}
              onClick={onReject}
            />
          </Tooltip>
        </>
      ) : null}
    </Space>
  );
}
