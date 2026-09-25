import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../config/auth.js';

const REMARK_MAX = 500;

export default function ReportReviewModal({
  open,
  quotation,
  decision = 'ACCEPTED',
  onClose,
  onDone,
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isApprove = decision === 'ACCEPTED';

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ remark: '' });
    }
  }, [open, form, decision]);

  const submit = async () => {
    const values = await form.validateFields();
    const remark = values.remark?.trim() || '';
    if (!isApprove && !remark) {
      message.error('Remark is required when rejecting');
      return;
    }
    setSaving(true);
    try {
      const { data: updated } = await api.post(`/quotations/${quotation.id}/status`, {
        status: decision,
        remark: remark || null,
      });
      message.success(isApprove ? 'Report approved' : 'Report rejected');
      if (onDone) await onDone(updated);
      onClose?.();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Review failed'));
    } finally {
      setSaving(false);
    }
  };

  const reportLabel = quotation?.quotation_number || 'this report';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={480}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={saving}
            onClick={submit}
            className={isApprove ? '!border-green-600 !bg-green-600 hover:!bg-green-700' : '!border-red-600 !bg-red-600 hover:!bg-red-700'}
          >
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </div>
      )}
      title={(
        <div className="flex items-center gap-2">
          <span
            className={`grid h-8 w-8 place-items-center rounded-md text-white ${isApprove ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {isApprove ? <CheckOutlined /> : <CloseOutlined />}
          </span>
          <span className="font-semibold text-slate-800">
            {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
          </span>
        </div>
      )}
    >
      <p className="mb-4 text-sm text-slate-600">
        {isApprove
          ? `Are you sure you want to approve report ${reportLabel}?`
          : `Are you sure you want to reject report ${reportLabel}?`}
      </p>
      <Form form={form} layout="vertical">
        <Form.Item
          name="remark"
          label={(
            <span>
              <strong>Remarks</strong>
              {isApprove ? ' (optional)' : ' (required)'}
            </span>
          )}
          rules={
            isApprove
              ? [{ max: REMARK_MAX, message: `Maximum ${REMARK_MAX} characters` }]
              : [
                { required: true, message: 'Remarks are required when rejecting' },
                { max: REMARK_MAX, message: `Maximum ${REMARK_MAX} characters` },
              ]
          }
        >
          <Input.TextArea
            rows={4}
            maxLength={REMARK_MAX}
            showCount
            placeholder="Enter your remarks here..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
