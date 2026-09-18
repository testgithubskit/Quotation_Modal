import { useEffect, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Select, Switch, Table, Typography, message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../config/auth.js';
import {
  hideActivityBuiltinColumn,
  updateActivityBuiltinColumn,
} from '../utils/activityColumns.js';

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

export default function ManageColumnsModal({
  open,
  onClose,
  entityType,
  fields = [],
  builtinFields = [],
  onChanged,
}) {
  const [addForm] = Form.useForm();
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftLabels, setDraftLabels] = useState({});

  const allRows = [...builtinFields, ...fields];

  useEffect(() => {
    if (!open) return;
    const next = {};
    allRows.forEach((f) => {
      next[f.id] = f.field_label;
    });
    setDraftLabels(next);
    addForm.resetFields();
    addForm.setFieldsValue({ field_type: 'TEXT', is_required: false });
  }, [open, fields, builtinFields, addForm]);

  const rename = async (field) => {
    const label = String(draftLabels[field.id] || '').trim();
    if (!label) {
      message.error('Column name cannot be empty');
      return;
    }
    if (label === field.field_label) return;
    setSavingId(field.id);
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

  const toggleRequired = async (field, checked) => {
    setSavingId(field.id);
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
        message.success('Column removed from table (can re-add via Add column with same name)');
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

      // Restore a hidden builtin if the name matches
      const hiddenBuiltin = builtinFields.find(
        (b) => b.is_hidden && (b.field_key === field_key || b.field_label.toLowerCase() === values.field_label.trim().toLowerCase()),
      );
      // Check against ACTIVITY_BUILTIN via field_key match even if not in builtinFields list
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
        display_order: fields.length,
      });
      message.success('Column added — rename it anytime in the list above');
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
      destroyOnHidden
    >
      <Typography.Text type="secondary" className="mb-3 block">
        Rename existing columns below. Mark mandatory or delete. Add a new column and it appears in this list to rename.
      </Typography.Text>

      <Table
        size="small"
        rowKey="id"
        pagination={false}
        locale={{ emptyText: 'No columns yet — add one below' }}
        dataSource={allRows.filter((f) => !f.is_hidden)}
        columns={[
          {
            title: 'Column name',
            key: 'label',
            render: (_, field) => (
              <Input
                value={draftLabels[field.id] ?? field.field_label}
                onChange={(e) => setDraftLabels((s) => ({ ...s, [field.id]: e.target.value }))}
                onBlur={() => rename(field)}
                onPressEnter={() => rename(field)}
                disabled={savingId === field.id}
                placeholder="Rename column"
              />
            ),
          },
          {
            title: 'Type',
            dataIndex: 'field_type',
            width: 110,
          },
          {
            title: 'Mandatory',
            key: 'required',
            width: 110,
            align: 'center',
            render: (_, field) => (
              <Switch
                checked={Boolean(field.is_required)}
                loading={savingId === field.id}
                onChange={(checked) => toggleRequired(field, checked)}
              />
            ),
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
