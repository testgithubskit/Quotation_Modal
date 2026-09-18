import { useEffect, useState } from 'react';
import {
  Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Typography, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';

export default function Templates() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/quotation-templates').then((r) => r.data);
      setRows(data.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load templates'));
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
    form.setFieldsValue({
      is_default: false,
      header_text: 'QUOTATION REPORT',
      footer_text: 'Thank you for your business.',
      company_name: '',
    });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    const td = record.template_data || {};
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      is_default: record.is_default,
      company_name: td.companyName || '',
      header_text: td.headerText || 'QUOTATION REPORT',
      footer_text: td.footerText || '',
    });
    setOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name.trim(),
      description: values.description || null,
      is_default: Boolean(values.is_default),
      is_standard: false,
      template_data: {
        companyName: values.company_name || '',
        headerText: values.header_text || 'QUOTATION REPORT',
        footerText: values.footer_text || '',
        primaryColor: '#0D9488',
      },
      custom_data: {},
    };
    try {
      if (editing) {
        await api.put(`/quotation-templates/${editing.id}`, payload);
        message.success('Template updated');
      } else {
        await api.post('/quotation-templates', payload);
        message.success('Template created');
      }
      setOpen(false);
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/quotation-templates/${id}`);
      message.success('Deleted');
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1 !font-sans !text-teal-800">
            Report Templates
          </Typography.Title>
          <Typography.Text type="secondary">
            Templates used when users generate reports.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New template
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
            {
              title: 'Default',
              dataIndex: 'is_default',
              render: (v) => (v ? 'Yes' : 'No'),
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 120,
              render: (_, record) => (
                <Space>
                  <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                  <Popconfirm title="Delete template?" onConfirm={() => remove(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={editing ? 'Edit template' : 'New template'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="Save"
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Template name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="company_name" label="Company name on report">
            <Input />
          </Form.Item>
          <Form.Item name="header_text" label="Header title">
            <Input />
          </Form.Item>
          <Form.Item name="footer_text" label="Footer note">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_default" label="Set as default" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
