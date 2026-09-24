import { useEffect, useMemo, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tooltip, Typography, message,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined, ColumnHeightOutlined,
} from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';
import TableToolbar from '../../Components/TableToolbar';
import ManageColumnsModal from '../../Components/ManageColumnsModal';
import { configTableScroll, recordMatchesSearch, slNoColumn } from '../../utils/tableHelpers';
import {
  digitsOnlyPhone,
  isPhoneLikeField,
  isValidPhone,
  phoneFieldRules,
  phoneInputProps,
} from '../../utils/phoneValidation.js';

export default function Team() {
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [form] = Form.useForm();

  const customFields = useMemo(
    () => fields.filter((f) => f.entity_type === 'USER'),
    [fields],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [data, custom] = await Promise.all([
        api.get('/users').then((r) => r.data),
        api.get('/custom-fields', { params: { entity_type: 'USER' } }).then((r) => r.data),
      ]);
      setRows(data.items || []);
      setFields(custom.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load team'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [data, custom] = await Promise.all([
          api.get('/users').then((r) => r.data),
          api.get('/custom-fields', { params: { entity_type: 'USER' } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setRows(data.items || []);
        setFields(custom.items || []);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load team'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter((r) => recordMatchesSearch(r, search));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const startEdit = (record) => {
    setEditingId(record.id);
    setDraft({
      full_name: record.full_name || '',
      phone: record.phone || '',
      role_name: record.role_name || 'USER',
      ...(record.custom_data || {}),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async (record) => {
    const full_name = String(draft.full_name || '').trim();
    if (full_name.length < 2) {
      message.error('Name is required');
      return;
    }
    if (draft.phone && !isValidPhone(draft.phone)) {
      message.error('Enter a valid 10-digit phone number');
      return;
    }
    const custom_data = {};
    for (const f of customFields) {
      const val = draft[f.field_key];
      if (f.is_required && (val == null || val === '')) {
        message.error(`${f.field_label} is required`);
        return;
      }
      if (
        (isPhoneLikeField(f.field_key) || isPhoneLikeField(f.field_label))
        && val
        && !isValidPhone(val)
      ) {
        message.error(`${f.field_label} must be a valid 10-digit number`);
        return;
      }
      if (val != null && val !== '') custom_data[f.field_key] = val;
    }
    try {
      await api.put(`/users/${record.id}`, {
        full_name,
        phone: draft.phone || null,
        role_name: draft.role_name,
        custom_data,
      });
      message.success('User updated');
      cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Update failed'));
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    const custom_data = {};
    customFields.forEach((f) => {
      if (values[f.field_key] != null && values[f.field_key] !== '') {
        custom_data[f.field_key] = values[f.field_key];
      }
    });
    try {
      await api.post('/users', {
        email: values.email.trim(),
        password: values.password,
        full_name: values.full_name.trim(),
        phone: values.phone || null,
        role_name: values.role_name,
        is_active: true,
        custom_data,
      });
      message.success('User created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Create failed'));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('Deleted');
      if (editingId === id) cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const setField = (key, value) => setDraft((s) => ({ ...s, [key]: value }));

  const columns = [
    slNoColumn(page, pageSize),
    {
      title: 'Name',
      dataIndex: 'full_name',
      sorter: (a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')),
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.full_name} onChange={(e) => setField('full_name', e.target.value)} />
          : v
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      sorter: (a, b) => String(a.email || '').localeCompare(String(b.email || '')),
    },
    {
      title: 'Role',
      dataIndex: 'role_name',
      width: 140,
      sorter: (a, b) => String(a.role_name || '').localeCompare(String(b.role_name || '')),
      render: (v, record) => (
        editingId === record.id
          ? (
            <Select
              className="w-full"
              value={draft.role_name}
              onChange={(val) => setField('role_name', val)}
              options={[
                { value: 'USER', label: 'User' },
                { value: 'ADMIN', label: 'Admin' },
              ]}
            />
          )
          : v
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      sorter: (a, b) => String(a.phone || '').localeCompare(String(b.phone || '')),
      render: (v, record) => (
        editingId === record.id
          ? (
            <Input
              {...phoneInputProps()}
              value={draft.phone}
              onChange={(e) => setField('phone', digitsOnlyPhone(e.target.value))}
            />
          )
          : (v || '—')
      ),
    },
    ...customFields.map((f) => {
      const phoneLike = isPhoneLikeField(f.field_key) || isPhoneLikeField(f.field_label);
      return {
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
                {...(phoneLike ? phoneInputProps() : {})}
                value={draft[f.field_key] ?? ''}
                onChange={(e) => setField(
                  f.field_key,
                  phoneLike ? digitsOnlyPhone(e.target.value) : e.target.value,
                )}
              />
            )
            : (record.custom_data?.[f.field_key] ?? '—')
        ),
      };
    }),
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        editingId === record.id
          ? (
            <Space>
              <Button type="text" icon={<CheckOutlined />} onClick={() => saveEdit(record)} />
              <Button type="text" icon={<CloseOutlined />} onClick={cancelEdit} />
            </Space>
          )
          : (
            <Space>
              <Tooltip title="Edit user">
                <Button type="text" icon={<EditOutlined />} onClick={() => startEdit(record)} />
              </Tooltip>
              {record.role_name !== 'ADMIN' && (
                <Tooltip title="Delete user">
                  <Popconfirm title="Delete user?" onConfirm={() => remove(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>
              )}
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
          <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnOpen(true)}>
            Columns
          </Button>
        )}
        addButton={(
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            Add user
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          dataSource={paged}
          columns={columns}
          scroll={configTableScroll}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `${t} users`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
              cancelEdit();
            },
          }}
        />
      </div>

      <Modal
        title="Add user"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="Create"
        destroyOnHidden
        maskClosable={false}
        keyboard={false}
      >
        <Form form={form} layout="vertical" initialValues={{ role_name: 'USER' }}>
          <Form.Item name="full_name" label="Full name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone"
            rules={phoneFieldRules({ label: 'phone' })}
            getValueFromEvent={(e) => digitsOnlyPhone(e.target.value)}
          >
            <Input {...phoneInputProps()} />
          </Form.Item>
          <Form.Item name="role_name" label="Role" rules={[{ required: true }]}>
            <Select options={[
              { value: 'USER', label: 'User' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
            />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          {customFields.map((f) => {
            const phoneLike = isPhoneLikeField(f.field_key) || isPhoneLikeField(f.field_label);
            return (
              <Form.Item
                key={f.field_key}
                name={f.field_key}
                label={f.field_label}
                rules={phoneLike
                  ? phoneFieldRules({ required: f.is_required, label: f.field_label.toLowerCase() })
                  : (f.is_required ? [{ required: true, message: `${f.field_label} is required` }] : undefined)}
                getValueFromEvent={phoneLike ? (e) => digitsOnlyPhone(e.target.value) : undefined}
              >
                <Input {...(phoneLike ? phoneInputProps() : {})} />
              </Form.Item>
            );
          })}
        </Form>
      </Modal>

      <ManageColumnsModal
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        entityType="USER"
        fields={customFields}
        onChanged={load}
      />
    </div>
  );
}
