import { Modal, Upload } from 'antd';
import { FileExcelOutlined, InboxOutlined } from '@ant-design/icons';

const DEFAULT_ACCEPT = '.xlsx,.xls,.xlsm,.csv';

/**
 * Guided bulk-upload modal (drag/drop + supported formats + expected columns).
 */
export default function BulkUploadModal({
  open,
  onClose,
  title = 'Bulk upload',
  hint,
  accept = DEFAULT_ACCEPT,
  supportsLabel = '.xlsx, .xls, .xlsm, and .csv',
  dropLabel = 'Click or drag your file here',
  loading = false,
  onFile,
}) {
  return (
    <Modal
      open={open}
      onCancel={loading ? undefined : onClose}
      footer={null}
      destroyOnClose
      centered
      width={560}
      maskClosable={false}
      keyboard={false}
      title={(
        <span className="inline-flex items-center gap-2 text-base font-semibold text-slate-800">
          <FileExcelOutlined className="text-teal-600" />
          {title}
        </span>
      )}
    >
      <div className="space-y-4 pt-1">
        {hint ? (
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
            {hint}
          </div>
        ) : null}

        <Upload.Dragger
          accept={accept}
          multiple={false}
          showUploadList={false}
          disabled={loading}
          beforeUpload={(file) => {
            onFile?.(file);
            return false;
          }}
          className="!rounded-xl"
        >
          <p className="mb-3 flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
              <InboxOutlined className="text-3xl" />
            </span>
          </p>
          <p className="text-base font-semibold text-slate-800">
            {loading ? 'Uploading…' : dropLabel}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Supports
            {' '}
            <span className="font-medium text-slate-700">{supportsLabel}</span>
          </p>
        </Upload.Dragger>
      </div>
    </Modal>
  );
}
