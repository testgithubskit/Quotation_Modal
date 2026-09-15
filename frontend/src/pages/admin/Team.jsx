import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { useAuth } from '../../config/auth.jsx';
import TableToolbar from '../../components/TableToolbar';
import { enhanceColumns, recordMatchesSearch } from '../../utils/tableHelpers';

const ROLE_OPTIONS = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
];

const ROLE_COLOR = {
  ADMIN: 'gold',
  SUPERVISOR: 'blue',
  USER: 'cyan',
};

export default function AdminTeam() {
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/users', {
        params: { page: 1, page_size: 100, sort_by: 'created_at', sort_order: 'desc' },
      }).then((r) => r.data);
      setUsers(data.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role_name: 'SUPERVISOR', is_active: true });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      full_name: record.full_name,
      email: record.email,
      phone: record.phone,
      role_name: record.role_name,
      is_active: record.is_active,
      password: undefined,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        const patch = {
          full_name: values.full_name,
          phone: values.phone || null,
          role_name: values.role_name,
          is_active: values.is_active,
        };
        if (values.password) patch.password = values.password;
        await api.patch(`/users/${editing.id}`, patch);
        message.success('User updated');
      } else {
        await api.post('/users', {
          email: values.email.trim(),
          password: values.password,
          full_name: values.full_name.trim(),
          phone: values.phone?.trim() || null,
          role_name: values.role_name,
          is_active: values.is_active !== false,
        });
        message.success('User created');
      }
      setOpen(false);
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to save user'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('User deleted');
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to delete user'));
    }
  };

  const filtered = useMemo(
    () => users.filter((row) => recordMatchesSearch(row, search, [
      'full_name', 'email', 'role_name', 'phone',
    ])),
    [users, search],
  );

  const columns = useMemo(() => enhanceColumns([
    { title: 'Name', dataIndex: 'full_name' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Role',
      dataIndex: 'role_name',
      width: 130,
      render: (r) => <Tag color={ROLE_COLOR[r] || 'default'}>{r}</Tag>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      width: 140,
      render: (v) => v || '—',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: 'Actions',
      width: 110,
      render: (_, record) => {
        const isSelf = me?.id === record.id;
        return (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            <Popconfirm
              title="Delete this user?"
              disabled={isSelf}
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={isSelf} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ]), [me?.id]);

  return (
    <div>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search team by name, email, role…"
        onRefresh={load}
        refreshing={loading}
        addButton={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add member
          </Button>
        )}
      />
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {users.filter((u) => u.role_name === 'SUPERVISOR').length} supervisors ·{' '}
        {users.filter((u) => u.role_name === 'USER').length} users ·{' '}
        {users.filter((u) => u.role_name === 'ADMIN').length} admins
      </Typography.Text>

      <div className="card-shell">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} members` }}
        />
      </div>

      <Modal
        title={editing ? 'Edit team member' : 'Add team member'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        okText={editing ? 'Save changes' : 'Create user'}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} requiredMark="optional">
          <Form.Item
            name="full_name"
            label="Full name"
            rules={[{ required: true, message: 'Enter full name' }, { min: 2 }]}
          >
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Enter email' },
              { type: 'email', message: 'Valid email required' },
            ]}
          >
            <Input placeholder="email@company.com" disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Optional phone" />
          </Form.Item>
          <Form.Item
            name="role_name"
            label="Role"
            rules={[{ required: true, message: 'Select a role' }]}
          >
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'New password (optional)' : 'Password'}
            rules={
              editing
                ? [{ min: 8, message: 'At least 8 characters' }]
                : [
                    { required: true, message: 'Create a password' },
                    { min: 8, message: 'At least 8 characters' },
                  ]
            }
          >
            <Input.Password placeholder="Min 8 characters" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
