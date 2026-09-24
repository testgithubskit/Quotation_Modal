import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, message,
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
  const [addForm] = Form.useForm();
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftLabels, setDraftLabels] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [typeChoice, setTypeChoice] = useState('TEXT');
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
      addForm.resetFields();
      addForm.setFieldsValue({ field_type: 'TEXT', is_required: false, custom_type: undefined });
      setTypeChoice('TEXT');
    }
    if (!open) setEditingKey(null);
    wasOpen.current = open;
  }, [open, addForm]);

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

  const addColumn = async () => {
    try {
      const values = await addForm.validateFields();
      const field_label = values.field_label.trim();
      const field_key = toKey(field_label);
      if (!field_key) {
        message.error('Enter a valid name');
        return;
      }

      const isOther = values.field_type === OTHER_TYPE;
      const customType = String(values.custom_type || '').trim();
      if (isOther && !customType) {
        message.error('Enter a custom type');
        return;
      }

      const field_type = isOther ? 'TEXT' : (values.field_type || 'TEXT');
      const options = isOther ? { custom_type: customType } : null;

      const builtinKeys = ['name', 'description', 'unit', 'unit_price'];
      if (builtinKeys.includes(field_key) && entityType === 'ACTIVITY') {
        (onUpdateBuiltin || updateActivityBuiltinColumn)(field_key, {
          is_hidden: false,
          field_label,
          is_required: Boolean(values.is_required),
        });
        message.success('Column restored');
        addForm.resetFields();
        addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
        setTypeChoice('TEXT');
        onChanged?.();
        return;
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
          is_required: Boolean(values.is_required),
        });
        message.success('Column restored');
        onChanged?.();
        return;
      }

      setAdding(true);
      await api.post('/custom-fields', {
        entity_type: entityType,
        field_key,
        field_label,
        field_type,
        is_required: Boolean(values.is_required),
        is_visible: true,
        is_editable: true,
        display_order: fieldList.length,
        options,
      });
      message.success('Column added');
      addForm.resetFields();
      addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
      setTypeChoice('TEXT');
      onChanged?.();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, 'Failed to add column'));
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
      width={720}
      destroyOnHidden={false}
      maskClosable={false}
      keyboard={false}
    >
      <Typography.Text type="secondary" className="mb-3 block">
        Rename existing columns with Edit. Mark mandatory or delete. Add a new column below.
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
                  <Popconfirm title="Remove this column from the table?" onConfirm={() => remove(field)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <Typography.Text strong className="mb-3 block">Add column</Typography.Text>
        <Form form={addForm} layout="vertical" initialValues={{ field_type: 'TEXT', is_required: false }}>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Form.Item
              name="field_label"
              label="Column name"
              rules={[{ required: true, message: 'Enter column name' }]}
              className="!mb-2"
            >
              <Input placeholder="e.g. GST Number" />
            </Form.Item>
            <Form.Item name="field_type" label="Type" rules={[{ required: true }]} className="!mb-2">
              <Select
                options={FIELD_TYPES}
                onChange={(v) => {
                  setTypeChoice(v);
                  if (v !== OTHER_TYPE) addForm.setFieldValue('custom_type', undefined);
                }}
              />
            </Form.Item>
            <Form.Item
              name="is_required"
              label="Mandatory"
              valuePropName="checked"
              className="!mb-2"
            >
              <Switch checkedChildren="Required" unCheckedChildren="Optional" />
            </Form.Item>
          </div>
          {typeChoice === OTHER_TYPE ? (
            <Form.Item
              name="custom_type"
              label="Custom type"
              rules={[{ required: true, message: 'Enter custom type' }]}
              className="!mb-2"
            >
              <Input placeholder="e.g. Barcode / Batch No" />
            </Form.Item>
          ) : null}
          <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={addColumn}>
            Add column
          </Button>
        </Form>
      </div>
    </Modal>
  );
}
