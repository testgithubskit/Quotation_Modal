import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Select, Switch, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../config/auth.js';
import {
  hideActivityBuiltinColumn,
  updateActivityBuiltinColumn,
} from '../utils/activityColumns.js';

const EMPTY_LIST = [];

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'URL', label: 'URL' },
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

export default function ManageColumnsModal({
  open,
  onClose,
  entityType,
  fields,
  builtinFields,
  onChanged,
}) {
  const [addForm] = Form.useForm();
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftLabels, setDraftLabels] = useState({});
  const wasOpen = useRef(false);

  const fieldList = Array.isArray(fields) ? fields : EMPTY_LIST;
  const builtinList = Array.isArray(builtinFields) ? builtinFields : EMPTY_LIST;

  const allRows = useMemo(
    () => [...builtinList, ...fieldList].filter((f) => f && !f.is_hidden),
    [builtinList, fieldList],
  );

  // Sync rename drafts when column list changes (not on every keystroke in Add form)
  useEffect(() => {
    if (!open) return;
    const next = {};
    allRows.forEach((f, i) => {
      next[rowKey(f, i)] = f.field_label ?? '';
    });
    setDraftLabels(next);
  }, [open, allRows]);

  // Reset Add form only when modal opens (not when typing / selecting type)
  useEffect(() => {
    if (open && !wasOpen.current) {
      addForm.resetFields();
      addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
    }
    wasOpen.current = open;
  }, [open, addForm]);

  const rename = async (field, index) => {
    const key = rowKey(field, index);
    const label = String(draftLabels[key] || '').trim();
    if (!label) {
      message.error('Column name cannot be empty');
      return;
    }
    if (label === field.field_label) return;
    setSavingId(key);
    try {
      if (field.is_builtin) {
        updateActivityBuiltinColumn(field.field_key, { field_label: label });
        message.success('Column renamed');
        onChanged?.();
      } else {
        await api.put(`/custom-fields/${field.id}`, { field_label: label });
        message.success('Column renamed');
        onChanged?.();
      }
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
        updateActivityBuiltinColumn(field.field_key, { is_required: checked });
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
        hideActivityBuiltinColumn(field.field_key);
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
      const field_key = toKey(values.field_label);
      if (!field_key) {
        message.error('Enter a valid name');
        return;
      }

      const builtinKeys = ['name', 'description', 'unit', 'unit_price'];
      if (builtinKeys.includes(field_key) && entityType === 'ACTIVITY') {
        updateActivityBuiltinColumn(field_key, {
          is_hidden: false,
          field_label: values.field_label.trim(),
          is_required: Boolean(values.is_required),
        });
        message.success('Column restored');
        addForm.resetFields();
        addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
        onChanged?.();
        return;
      }

      const hiddenBuiltin = builtinList.find(
        (b) => b?.is_hidden && (
          b.field_key === field_key
          || String(b.field_label || '').toLowerCase() === values.field_label.trim().toLowerCase()
        ),
      );
      if (hiddenBuiltin) {
        updateActivityBuiltinColumn(hiddenBuiltin.field_key, {
          is_hidden: false,
          field_label: values.field_label.trim(),
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
        field_label: values.field_label.trim(),
        field_type: values.field_type || 'TEXT',
        is_required: Boolean(values.is_required),
        is_visible: true,
        is_editable: true,
        display_order: fieldList.length,
      });
      message.success('Column added');
      addForm.resetFields();
      addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
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
    >
      <Typography.Text type="secondary" className="mb-3 block">
        Rename existing columns below. Mark mandatory or delete. Add a new column and it appears in this list to rename.
      </Typography.Text>

      <Table
        size="small"
        rowKey={(record, index) => rowKey(record, index)}
        pagination={false}
        locale={{ emptyText: 'No columns yet — add one below' }}
        dataSource={allRows}
        columns={[
          {
            title: 'Column name',
            key: 'label',
            render: (_, field, index) => {
              const key = rowKey(field, index);
              return (
                <Input
                  value={draftLabels[key] ?? field.field_label ?? ''}
                  onChange={(e) => setDraftLabels((s) => ({ ...s, [key]: e.target.value }))}
                  onBlur={() => rename(field, index)}
                  onPressEnter={() => rename(field, index)}
                  disabled={savingId === key}
                  placeholder="Rename column"
                />
              );
            },
          },
          {
            title: 'Type',
            dataIndex: 'field_type',
            width: 110,
            render: (v) => v || 'TEXT',
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
                  checked={Boolean(field.is_required)}
                  loading={savingId === key}
                  onChange={(checked) => toggleRequired(field, index, checked)}
                />
              );
            },
          },
          {
            title: '',
            key: 'actions',
            width: 64,
            render: (_, field) => (
              <Popconfirm title="Remove this column from the table?" onConfirm={() => remove(field)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <Typography.Text strong className="mb-3 block">Add column</Typography.Text>
        <Form form={addForm} layout="vertical" initialValues={{ field_type: 'TEXT', is_required: false }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Form.Item
              name="field_label"
              label="Column name"
              rules={[{ required: true, message: 'Enter column name' }]}
              className="!mb-2"
            >
              <Input placeholder="e.g. GST Number" />
            </Form.Item>
            <Form.Item name="field_type" label="Type" rules={[{ required: true }]} className="!mb-2">
              <Select options={FIELD_TYPES} />
            </Form.Item>
          </div>
          <Form.Item
            name="is_required"
            label="Mandatory column"
            valuePropName="checked"
            className="!mb-3"
          >
            <Switch checkedChildren="Required" unCheckedChildren="Optional" />
          </Form.Item>
          <Button type="primary" icon={<PlusOutlined />} loading={adding} onClick={addColumn}>
            Add column
          </Button>
        </Form>
      </div>
    </Modal>
  );
}
