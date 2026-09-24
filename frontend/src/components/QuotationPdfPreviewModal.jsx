import { Button, Modal, Spin } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

/**
 * Full-width PDF preview (browser PDF viewer in iframe), like Chrome’s built-in viewer.
 */
export default function QuotationPdfPreviewModal({
  open,
  title = 'Report preview',
  loading = false,
  pdfUrl,
  onClose,
  onSubmit,
  submitLoading = false,
  submitLabel = 'Submit',
  onEdit,
  editLabel = 'Edit',
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      width="min(1200px, 98vw)"
      centered
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      closable
      closeIcon={<CloseOutlined />}
      styles={{
        body: { padding: 0, height: 'min(82vh, 860px)', overflow: 'hidden', background: '#525659' },
      }}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          {onEdit ? (
            <Button onClick={onEdit}>{editLabel}</Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
          {onSubmit ? (
            <Button type="primary" loading={submitLoading} onClick={onSubmit}>
              {submitLabel}
            </Button>
          ) : null}
        </div>
      )}
    >
      <div className="relative h-full min-h-[480px] w-full">
        {loading ? (
          <div className="grid h-full place-items-center">
            <Spin size="large" />
          </div>
        ) : pdfUrl ? (
          <iframe
            title={title}
            src={pdfUrl}
            className="h-full w-full border-0 bg-[#525659]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-white/80">
            No preview available
          </div>
        )}
      </div>
    </Modal>
  );
}
