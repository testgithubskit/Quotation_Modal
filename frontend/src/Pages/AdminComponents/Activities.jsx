import { useEffect, useMemo, useState } from 'react';
import {
  Button, Dropdown, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tooltip, Upload, message,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DownloadOutlined, ColumnHeightOutlined,
  EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { useAuth } from '../../config/AuthContext.jsx';
import TableToolbar from '../../Components/TableToolbar';
import ManageColumnsModal from '../../Components/ManageColumnsModal';
import BulkReviewModal from '../../Components/BulkReviewModal';
import { slugCode, slNoColumn, recordMatchesSearch } from '../../utils/tableHelpers';
import { datedFilename, downloadReportExcel, downloadReportPdf, parseSpreadsheetFile } from '../../utils/spreadsheet';
import {
  builtinAliases,
  getActivityBuiltinColumns,
  getAllActivityBuiltinColumnsIncludingHidden,
  readActivityBuiltinValue,
} from '../../utils/activityColumns.js';

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

export default function Activities() {
  const { user } = useAuth();
  const orgName = user?.organization_name || 'Organization';
  const [allRows, setAllRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [builtinTick, setBuiltinTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [form] = Form.useForm();

  const customFields = useMemo(
    () => fields.filter((f) => f.entity_type === 'ACTIVITY'),
    [fields],
  );

  const builtinFields = useMemo(
    () => getActivityBuiltinColumns(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builtinTick],
  );

  const allBuiltinForModal = useMemo(
    () => getAllActivityBuiltinColumnsIncludingHidden(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builtinTick],
  );

  const refreshColumns = () => setBuiltinTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [activities, custom] = await Promise.all([
          api.get('/activities').then((r) => r.data),
          api.get('/custom-fields', { params: { entity_type: 'ACTIVITY' } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setAllRows(activities.items || []);
        setFields(custom.items || []);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load activities'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [activities, custom] = await Promise.all([
        api.get('/activities').then((r) => r.data),
        api.get('/custom-fields', { params: { entity_type: 'ACTIVITY' } }).then((r) => r.data),
      ]);
      setAllRows(activities.items || []);
      setFields(custom.items || []);
      refreshColumns();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load activities'));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => allRows.filter((r) => recordMatchesSearch(r, search)),
    [allRows, search],
  );
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const setField = (key, value) => setDraft((s) => ({ ...s, [key]: value }));

  const startEdit = (record) => {
    setEditingId(record.id);
    const next = {
      code: record.code || '',
      name: record.name || '',
      description: record.description || '',
      unit: record.unit || 'Nos',
      unit_price: Number(record.unit_price || 0),
      ...(record.custom_data || {}),
    };
    setDraft(next);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const validateFlexible = (source) => {
    for (const col of [...builtinFields, ...customFields]) {
      if (!col.is_required) continue;
      const val = source[col.field_key];
      if (val == null || String(val).trim() === '') {
        message.error(`${col.field_label} is required`);
        return false;
      }
    }
    return true;
  };

  const buildCustomData = (source) => {
    const custom_data = {};
    customFields.forEach((f) => {
      const val = source[f.field_key];
      if (val != null && val !== '') custom_data[f.field_key] = val;
    });
    return custom_data;
  };

  const saveEdit = async (record) => {
    const code = String(draft.code || '').trim();
    if (!code) {
      message.error('Activity code is required');
      return;
    }
    if (!validateFlexible(draft)) return;
    try {
      await api.put(`/activities/${record.id}`, {
        code,
        name: String(draft.name || '').trim() || code,
        description: draft.description || null,
        unit: draft.unit || 'Nos',
        unit_price: Number(draft.unit_price || 0),
        custom_data: buildCustomData(draft),
      });
      message.success('Activity updated');
      cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Update failed'));
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    if (!validateFlexible(values)) return;
    const code = values.code.trim();
    try {
      await api.post('/activities', {
        code,
        name: values.name?.trim() || code,
        description: values.description || null,
        unit: values.unit || 'Nos',
        unit_price: Number(values.unit_price || 0),
        currency: 'INR',
        is_active: true,
        custom_data: buildCustomData(values),
      });
      message.success('Activity created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/activities/${id}`);
      message.success('Deleted');
      if (editingId === id) cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const mapSheetToPreview = (rawRows) => rawRows.map((row, index) => {
    const mapped = {
      _key: `act-${index}`,
      code: String(pick(
        row,
        'code', 'Code', 'Activity Code', 'activity_code',
        'Sl.No.', 'Sl.No', 'Sl No', 'SL.NO.', 'S.No.', 'S.No', 'SNo',
      )).trim(),
    };
    builtinFields.forEach((col) => {
      const aliases = builtinAliases(col);
      if (col.field_key === 'unit_price') {
        mapped.unit_price = Number(pick(row, ...aliases) || 0);
      } else {
        mapped[col.field_key] = String(pick(row, ...aliases)).trim();
      }
    });
    // Metrology / price-list style headers + defaults
    if (!mapped.name) {
      mapped.name = String(pick(row, 'name', 'Name', 'Particulars', 'particulars', 'Item', 'Description')).trim();
    }
    if (!mapped.description) {
      mapped.description = String(pick(
        row,
        'description', 'Description', 'Specifications', 'Specification',
        'Scope of Calibration', 'particulars',
      )).trim();
    }
    if (!mapped.unit) mapped.unit = String(pick(row, 'unit', 'Unit') || 'Nos').trim();
    if (!mapped.unit_price) {
      mapped.unit_price = Number(pick(
        row,
        'unit_price', 'Unit Price', 'Proposed Charges 2023', 'Proposed Charges',
        'Charges April 2020', 'Charges', 'cost', 'Cost', 'Rate', 'Price',
      ) || 0);
    }

    customFields.forEach((f) => {
      mapped[f.field_key] = pick(row, f.field_label, f.field_key);
    });
    // Keep leftover price-list columns in custom-looking keys for review
    Object.keys(row).forEach((key) => {
      if (key === '_sheet' || key.startsWith('Column_')) return;
      const lower = key.toLowerCase();
      if (
        lower.includes('nabl')
        || lower.includes('increase')
        || lower.includes('scope')
        || lower.includes('charge')
      ) {
        if (mapped[key] == null || mapped[key] === '') mapped[key] = row[key];
      }
    });
    if (!mapped.name) mapped.name = mapped.code;
    if (!mapped.unit) mapped.unit = 'Nos';
    return mapped;
  }).filter((r) => {
    const code = String(r.code || '').trim();
    if (!code) return false;
    const lower = code.toLowerCase();
    return !(lower.includes('sl.no') || lower === 'sl no' || lower === 's.no');
  });

  const onBulkUpload = async (file) => {
    try {
      const parsed = await parseSpreadsheetFile(file);
      const mapped = mapSheetToPreview(parsed);
      if (!mapped.length) {
        message.error('No valid activity rows found (need Activity Code)');
        return false;
      }
      setPreviewRows(mapped);
      setReviewOpen(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to read file'));
    }
    return false;
  };

  const bulkCreate = async (selected) => {
    let created = 0;
    try {
      for (const row of selected) {
        const code = String(row.code || '').trim();
        await api.post('/activities', {
          code: created ? `${slugCode(code)}-${created}`.slice(0, 50) : code.slice(0, 50),
          name: String(row.name || code).trim(),
          description: row.description || null,
          unit: row.unit || 'Nos',
          unit_price: Number(row.unit_price || 0),
          currency: 'INR',
          is_active: true,
          custom_data: buildCustomData(row),
        });
        created += 1;
      }
      message.success(`Created ${created} activit${created === 1 ? 'y' : 'ies'}`);
      setReviewOpen(false);
      setPreviewRows([]);
      setPage(1);
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, `Bulk create stopped after ${created}`));
    }
  };

  const toExportRows = (items) => items.map((r) => {
    const row = { 'Activity Code': r.code };
    builtinFields.forEach((col) => {
      row[col.field_label] = readActivityBuiltinValue(r, col.field_key) ?? '';
    });
    customFields.forEach((f) => {
      row[f.field_label] = r.custom_data?.[f.field_key] ?? '';
    });
    return row;
  });

  const reviewColumns = useMemo(() => [
    { key: 'code', title: 'Activity Code', required: true, width: 140 },
    ...builtinFields.map((col) => ({
      key: col.field_key,
      title: col.field_label,
      required: Boolean(col.is_required),
      type: col.field_key === 'unit_price' ? 'number' : 'text',
      width: 140,
    })),
    ...customFields.map((f) => ({
      key: f.field_key,
      title: f.field_label,
      required: Boolean(f.is_required),
      width: 140,
    })),
  ], [builtinFields, customFields]);

  const renderBuiltinCell = (col, record) => {
    const raw = readActivityBuiltinValue(record, col.field_key);
    if (editingId === record.id) {
      if (col.field_key === 'unit_price') {
        return (
          <InputNumber
            className="w-full"
            min={0}
            value={draft.unit_price}
            onChange={(n) => setField('unit_price', n ?? 0)}
          />
        );
      }
      return (
        <Input
          value={draft[col.field_key] ?? ''}
          onChange={(e) => setField(col.field_key, e.target.value)}
        />
      );
    }
    if (col.field_key === 'unit_price') {
      return `₹${Number(raw || 0).toLocaleString('en-IN')}`;
    }
    return raw || '—';
  };

  const columns = [
    slNoColumn(page, pageSize),
    {
      title: (
        <span>
          Activity Code
          <span className="text-red-500"> *</span>
        </span>
      ),
      dataIndex: 'code',
      fixed: 'left',
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.code} onChange={(e) => setField('code', e.target.value)} />
          : v
      ),
    },
    ...builtinFields.map((col) => ({
      title: (
        <span>
          {col.field_label}
          {col.is_required ? <span className="text-red-500"> *</span> : null}
        </span>
      ),
      key: col.field_key,
      render: (_, record) => renderBuiltinCell(col, record),
    })),
    ...customFields.map((f) => ({
      title: (
        <span>
          {f.field_label}
          {f.is_required ? <span className="text-red-500"> *</span> : null}
        </span>
      ),
      key: f.field_key,
      render: (_, record) => (
        editingId === record.id
          ? (
            <Input
              value={draft[f.field_key] ?? ''}
              onChange={(e) => setField(f.field_key, e.target.value)}
            />
          )
          : (record.custom_data?.[f.field_key] ?? '—')
      ),
    })),
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        editingId === record.id
          ? (
            <Space>
              <Tooltip title="Save"><Button type="text" icon={<CheckOutlined />} onClick={() => saveEdit(record)} /></Tooltip>
              <Tooltip title="Cancel"><Button type="text" icon={<CloseOutlined />} onClick={cancelEdit} /></Tooltip>
            </Space>
          )
          : (
            <Space>
              <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} onClick={() => startEdit(record)} /></Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete activity?" onConfirm={() => remove(record.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            </Space>
          )
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <TableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnOpen(true)}>
              Columns
            </Button>
            <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onBulkUpload}>
              <Button icon={<UploadOutlined />}>Bulk upload</Button>
            </Upload>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined />,
                    label: 'Download as Excel',
                    onClick: () => downloadReportExcel(
                      toExportRows(filtered),
                      datedFilename('activities', 'xls'),
                      { organizationName: orgName, title: 'Activities Report' },
                    ),
                  },
                  {
                    key: 'pdf',
                    icon: <FilePdfOutlined />,
                    label: 'Download as PDF',
                    onClick: () => downloadReportPdf(
                      toExportRows(filtered),
                      datedFilename('activities', 'pdf'),
                      { organizationName: orgName, title: 'Activities Report' },
                    ),
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Download</Button>
            </Dropdown>
          </>
        )}
        addButton={(
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ unit: 'Nos', unit_price: 0 });
              setCreateOpen(true);
            }}
          >
            Add activity
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={paged}
          scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `${t} activities`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
              cancelEdit();
            },
          }}
        />
      </div>

      <Modal
        title="Add activity"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="Save"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ unit: 'Nos', unit_price: 0 }}>
          <Form.Item name="code" label="Activity Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ACT-001" />
          </Form.Item>
          {builtinFields.map((col) => (
            <Form.Item
              key={col.field_key}
              name={col.field_key}
              label={col.field_label}
              rules={col.is_required ? [{ required: true, message: `${col.field_label} is required` }] : undefined}
            >
              {col.field_key === 'unit_price'
                ? <InputNumber className="w-full" min={0} />
                : <Input />}
            </Form.Item>
          ))}
          {customFields.map((f) => (
            <Form.Item
              key={f.field_key}
              name={f.field_key}
              label={f.field_label}
              rules={f.is_required ? [{ required: true, message: `${f.field_label} is required` }] : undefined}
            >
              <Input />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <BulkReviewModal
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          setPreviewRows([]);
        }}
        title="Review Extracted Activities"
        columns={reviewColumns}
        rows={previewRows}
        entityLabel="activities"
        confirmLabel="Bulk Create"
        onConfirm={bulkCreate}
      />

      <ManageColumnsModal
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        entityType="ACTIVITY"
        fields={customFields}
        builtinFields={allBuiltinForModal.filter((c) => !c.is_hidden)}
        onChanged={() => {
          refreshColumns();
          load();
        }}
      />
    </div>
  );
}
