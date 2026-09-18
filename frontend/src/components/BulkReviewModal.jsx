import { useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd';
import {
  PlusOutlined, DeleteOutlined, CloseOutlined, ThunderboltOutlined, UploadOutlined,
} from '@ant-design/icons';

/**
 * Bulk upload review preview (select rows, edit cells, then create).
 *
 * columns: [{ key, title, type?: 'text'|'number', required?: boolean, width? }]
 */
export default function BulkReviewModal({
  open,
  onClose,
  title = 'Review extracted rows',
  columns = [],
  rows = [],
  onConfirm,
  confirmLabel = 'Bulk Create',
  entityLabel = 'rows',
}) {
  const [draftRows, setDraftRows] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = (rows || []).map((row, index) => ({
      _key: row._key || `row-${index}-${Date.now()}`,
      ...row,
    }));
    setDraftRows(next);
    setSelectedKeys(next.map((r) => r._key));
  }, [open, rows]);

  const selectedCount = selectedKeys.length;

  const updateCell = (key, field, value) => {
    setDraftRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (key) => {
    setDraftRows((prev) => prev.filter((r) => r._key !== key));
    setSelectedKeys((prev) => prev.filter((k) => k !== key));
  };

  const addBlankRow = () => {
    const blank = { _key: `new-${Date.now()}` };
    columns.forEach((c) => {
      blank[c.key] = c.type === 'number' ? 0 : '';
    });
    setDraftRows((prev) => [...prev, blank]);
    setSelectedKeys((prev) => [...prev, blank._key]);
  };

  const tableColumns = useMemo(
    () => [
      ...columns.map((col) => ({
        title: col.required ? (
          <span>
            {col.title}
            <span className="text-red-500"> *</span>
          </span>
        ) : col.title,
        dataIndex: col.key,
        width: col.width,
        render: (value, record) => {
          if (col.type === 'number') {
            return (
              <InputNumber
                className="w-full"
                min={0}
                value={value}
                onChange={(v) => updateCell(record._key, col.key, v ?? 0)}
              />
            );
          }
          return (
            <Input
              value={value ?? ''}
              onChange={(e) => updateCell(record._key, col.key, e.target.value)}
            />
          );
        },
      })),
      {
        title: '',
        key: '_delete',
        width: 56,
        fixed: 'right',
        render: (_, record) => (
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(record._key)} />
        ),
      },
    ],
    [columns],
  );

  const handleConfirm = async () => {
    const selected = draftRows.filter((r) => selectedKeys.includes(r._key));
    if (!selected.length) {
      message.warning('Select at least one row');
      return;
    }
    for (const col of columns.filter((c) => c.required)) {
      const bad = selected.find((r) => {
        const v = r[col.key];
        return v == null || String(v).trim() === '';
      });
      if (bad) {
        message.error(`${col.title} is required on all selected rows`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onConfirm?.(selected.map(({ _key, ...rest }) => rest));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1100px, 96vw)"
      destroyOnHidden
      footer={null}
      closable={false}
      styles={{ body: { paddingTop: 12 } }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={4} className="!mb-0">
              {title}
            </Typography.Title>
            <Tag color="blue">{draftRows.length} rows extracted</Tag>
            <Tag color="purple" icon={<ThunderboltOutlined />}>
              Bulk create
            </Tag>
          </div>
        </div>
        <Typography.Text type="secondary" className="text-sm">
          Click any cell to edit · Select rows to create
        </Typography.Text>
      </div>

      <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200 bg-sky-50/40">
        <Table
          size="small"
          rowKey="_key"
          pagination={false}
          dataSource={draftRows}
          columns={tableColumns}
          scroll={{ x: 'max-content', y: '48vh' }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
          }}
          locale={{ emptyText: 'No rows — add one or re-upload a file' }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Space wrap>
          <Button icon={<UploadOutlined />} onClick={onClose}>
            Re-upload
          </Button>
          <Button icon={<PlusOutlined />} onClick={addBlankRow}>
            Add row
          </Button>
        </Space>

        <Typography.Text type="secondary">
          {selectedCount} {entityLabel} selected for creation
        </Typography.Text>

        <Space wrap>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            Close
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={submitting}
            disabled={!selectedCount}
            onClick={handleConfirm}
          >
            {confirmLabel} {selectedCount} {entityLabel}
          </Button>
        </Space>
      </div>
    </Modal>
  );
}
