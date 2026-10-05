import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../config/auth.js';
import {
  hideActivityBuiltinColumn,
  updateActivityBuiltinColumn,
} from '../utils/activityColumns.js';

const EMPTY_LIST = [];
const OTHER_TYPE = '__OTHER__';

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DECIMAL', label: 'Decimal' },
  { value: 'DATE', label: 'Date' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'URL', label: 'URL' },
  { value: OTHER_TYPE, label: 'Other' },
];

let draftUid = 0;
const nextDraftKey = () => `draft-${Date.now()}-${draftUid++}`;

function emptyDraft() {
  return {
    key: nextDraftKey(),
    field_label: '',
    field_type: 'TEXT',
    custom_type: '',
    is_required: false,
  };
}

function toKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([^a-z])/, 'f_$1')
    .slice(0, 100);
}

function rowKey(field, index) {
  return String(field?.id ?? field?.field_key ?? `col-${index}`);
}

function displayType(field) {
  const custom = field?.options?.custom_type;
  if (custom) return String(custom);
  return field?.field_type || 'TEXT';
}

export default function ManageColumnsModal({
  open,
  onClose,
  entityType,
  fields,
  builtinFields,
  onChanged,
  onUpdateBuiltin,
  onHideBuiltin,
}) {
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftLabels, setDraftLabels] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [draftRows, setDraftRows] = useState([emptyDraft()]);
  const wasOpen = useRef(false);

  const fieldList = Array.isArray(fields) ? fields : EMPTY_LIST;
  const builtinList = Array.isArray(builtinFields) ? builtinFields : EMPTY_LIST;

  const allRows = useMemo(
    () => [...builtinList, ...fieldList].filter((f) => f && !f.is_hidden),
    [builtinList, fieldList],
  );

  useEffect(() => {
    if (!open) return;
    const next = {};
    allRows.forEach((f, i) => {
      next[rowKey(f, i)] = f.field_label ?? '';
    });
    setDraftLabels(next);
    setEditingKey(null);
  }, [open, allRows]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraftRows([emptyDraft()]);
    }
    if (!open) setEditingKey(null);
    wasOpen.current = open;
  }, [open]);

  const rename = async (field, index) => {
    const key = rowKey(field, index);
    const label = String(draftLabels[key] || '').trim();
    if (!label) {
      message.error('Column name cannot be empty');
      return;
    }
    if (label === field.field_label) {
      setEditingKey(null);
      return;
    }
    setSavingId(key);
    try {
      if (field.is_builtin) {
        (onUpdateBuiltin || updateActivityBuiltinColumn)(field.field_key, { field_label: label });
        message.success('Column renamed');
        onChanged?.();
      } else {
        await api.put(`/custom-fields/${field.id}`, { field_label: label });
        message.success('Column renamed');
        onChanged?.();
      }
      setEditingKey(null);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Rename failed'));
    } finally {
      setSavingId(null);
    }
  };

  const toggleRequired = async (field, index, checked) => {
    const key = rowKey(field, index);
    setSavingId(key);
    try {
      if (field.is_builtin) {
        (onUpdateBuiltin || updateActivityBuiltinColumn)(field.field_key, { is_required: checked });
        message.success(checked ? 'Marked mandatory' : 'Marked optional');
        onChanged?.();
      } else {
        await api.put(`/custom-fields/${field.id}`, { is_required: checked });
        message.success(checked ? 'Marked mandatory' : 'Marked optional');
        onChanged?.();
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Update failed'));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (field) => {
    try {
      if (field.no_hide || field.field_key === 'code') {
        message.warning('This column cannot be removed');
        return;
      }
      if (field.is_builtin) {
        (onHideBuiltin || hideActivityBuiltinColumn)(field.field_key);
        message.success('Column removed from table');
        onChanged?.();
        return;
      }
      await api.delete(`/custom-fields/${field.id}`);
      message.success('Column deleted');
      onChanged?.();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const updateDraft = (key, patch) => {
    setDraftRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addDraftRow = () => setDraftRows((rows) => [...rows, emptyDraft()]);
  const removeDraftRow = (key) => {
    setDraftRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  };

  const restoreOrCreateColumn = async (draft, displayOrder) => {
    const field_label = String(draft.field_label || '').trim();
    const field_key = toKey(field_label);
    if (!field_key) {
      throw new Error('Enter a valid name');
    }

    const isOther = draft.field_type === OTHER_TYPE;
    const customType = String(draft.custom_type || '').trim();
    if (isOther && !customType) {
      throw new Error(`Enter a custom type for "${field_label}"`);
    }

    const field_type = isOther ? 'TEXT' : (draft.field_type || 'TEXT');
    const options = isOther ? { custom_type: customType } : null;
    const is_required = Boolean(draft.is_required);

    const builtinKeys = ['name', 'description', 'unit', 'unit_price'];
    if (builtinKeys.includes(field_key) && entityType === 'ACTIVITY') {
      (onUpdateBuiltin || updateActivityBuiltinColumn)(field_key, {
        is_hidden: false,
        field_label,
        is_required,
      });
      return 'restored';
    }

    const hiddenBuiltin = builtinList.find(
      (b) => b?.is_hidden && (
        b.field_key === field_key
        || String(b.field_label || '').toLowerCase() === field_label.toLowerCase()
      ),
    );
    if (hiddenBuiltin) {
      (onUpdateBuiltin || updateActivityBuiltinColumn)(hiddenBuiltin.field_key, {
        is_hidden: false,
        field_label,
        is_required,
      });
      return 'restored';
    }

    await api.post('/custom-fields', {
      entity_type: entityType,
      field_key,
      field_label,
      field_type,
      is_required,
      is_visible: true,
      is_editable: true,
      display_order: displayOrder,
      options,
    });
    return 'created';
  };

  const addColumns = async () => {
    const filled = draftRows.filter((r) => String(r.field_label || '').trim());
    if (!filled.length) {
      message.error('Enter at least one column name');
      return;
    }

    const labels = filled.map((r) => String(r.field_label).trim().toLowerCase());
    if (new Set(labels).size !== labels.length) {
      message.error('Duplicate column names in the draft list');
      return;
    }

    setAdding(true);
    let created = 0;
    let restored = 0;
    try {
      for (let i = 0; i < filled.length; i += 1) {
        const result = await restoreOrCreateColumn(filled[i], fieldList.length + i);
        if (result === 'restored') restored += 1;
        else created += 1;
      }
      const parts = [];
      if (created) parts.push(`${created} added`);
      if (restored) parts.push(`${restored} restored`);
      message.success(parts.join(', ') || 'Columns saved');
      setDraftRows([emptyDraft()]);
      onChanged?.();
    } catch (error) {
      message.error(error?.message || getApiErrorMessage(error, 'Failed to add columns'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      title="Manage columns"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={760}
      destroyOnHidden={false}
      maskClosable={false}
      keyboard={false}
    >
      <Typography.Text type="secondary" className="mb-3 block">
        Rename existing columns with Edit. Mark mandatory or delete. Add one or more new columns below.
      </Typography.Text>

      <Table
        className="app-data-table manage-columns-table"
        size="small"
        rowKey={(record, index) => rowKey(record, index)}
        pagination={false}
        locale={{ emptyText: 'No columns yet — add one below' }}
        dataSource={allRows}
        scroll={{ y: 5 * 48 }}
        columns={[
          {
            title: 'Column name',
            key: 'label',
            render: (_, field, index) => {
              const key = rowKey(field, index);
              const editing = editingKey === key;
              if (!editing) {
                return <span className="font-medium text-slate-800">{field.field_label || '—'}</span>;
              }
              return (
                <Input
                  autoFocus
                  value={draftLabels[key] ?? field.field_label ?? ''}
                  onChange={(e) => setDraftLabels((s) => ({ ...s, [key]: e.target.value }))}
                  onPressEnter={() => rename(field, index)}
                  disabled={savingId === key}
                  placeholder="Rename column"
                />
              );
            },
          },
          {
            title: 'Type',
            key: 'type',
            width: 120,
            render: (_, field) => (
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {displayType(field)}
              </span>
            ),
          },
          {
            title: 'Mandatory',
            key: 'required',
            width: 110,
            align: 'center',
            render: (_, field, index) => {
              const key = rowKey(field, index);
              return (
                <Switch
                  size="small"
                  checked={Boolean(field.is_required)}
                  loading={savingId === key}
                  onChange={(checked) => toggleRequired(field, index, checked)}
                />
              );
            },
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 96,
            align: 'center',
            render: (_, field, index) => {
              const key = rowKey(field, index);
              const editing = editingKey === key;
              return (
                <Space size={0}>
                  {editing ? (
                    <Button
                      type="link"
                      size="small"
                      loading={savingId === key}
                      onClick={() => rename(field, index)}
                    >
                      Save
                    </Button>
                  ) : (
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setEditingKey(key)}
                    />
                  )}
                  {field.no_hide || field.field_key === 'code' ? null : (
                    <Popconfirm title="Remove this column from the table?" onConfirm={() => remove(field)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Typography.Text strong>Add column</Typography.Text>
          <Button icon={<PlusOutlined />} onClick={addDraftRow}>
            Add row
          </Button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-3">
          {draftRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 items-end gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_140px_auto_auto]"
            >
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Column name</div>
                <Input
                  placeholder="e.g. GST Number"
                  value={row.field_label}
                  onChange={(e) => updateDraft(row.key, { field_label: e.target.value })}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Type</div>
                <Select
                  className="w-full"
                  value={row.field_type}
                  options={FIELD_TYPES}
                  onChange={(v) => updateDraft(row.key, {
                    field_type: v,
                    custom_type: v === OTHER_TYPE ? row.custom_type : '',
                  })}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Mandatory</div>
                <Switch
                  checked={row.is_required}
                  checkedChildren="Required"
                  unCheckedChildren="Optional"
                  onChange={(checked) => updateDraft(row.key, { is_required: checked })}
                />
              </div>
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                disabled={draftRows.length <= 1}
                onClick={() => removeDraftRow(row.key)}
              />
              {row.field_type === OTHER_TYPE ? (
                <div className="sm:col-span-4">
                  <div className="mb-1 text-xs font-medium text-slate-600">Custom type</div>
                  <Input
                    placeholder="e.g. Barcode / Batch No"
                    value={row.custom_type}
                    onChange={(e) => updateDraft(row.key, { custom_type: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <Button
          type="primary"
          className="mt-3"
          icon={<PlusOutlined />}
          loading={adding}
          onClick={addColumns}
        >
          Add column
        </Button>
      </div>
    </Modal>
  );
}
