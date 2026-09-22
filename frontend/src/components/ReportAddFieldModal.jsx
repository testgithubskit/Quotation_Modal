import { useState } from 'react';
import { Modal, Form, Input, Select, List, Button, Typography, Tag, Switch, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { slugifyFieldKey } from '../utils/reportFormSchema.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
];

export default function ReportAddFieldModal({
  open,
  onClose,
  title,
  fields,
  onAdd,
  onRemove,
}) {
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const values = await form.validateFields();
    const key = slugifyFieldKey(values.label, fields.map((f) => f.key));
    onAdd({
      key,
      label: values.label.trim(),
      type: values.type,
      required: Boolean(values.required),
      builtIn: false,
    });
    form.resetFields();
    setAdding(false);
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => {
        onClose();
        setAdding(false);
        form.resetFields();
      }}
      footer={null}
      destroyOnHidden
      maskClosable={false}
      keyboard={false}
    >
      <Typography.Paragraph type="secondary" className="!mt-2">
        Built-in fields cannot be removed. Add custom fields to extend the form.
      </Typography.Paragraph>

      <List
        size="small"
        bordered
        dataSource={fields}
        className="mb-4"
        locale={{ emptyText: 'No fields yet' }}
        renderItem={(field) => (
          <List.Item
            actions={!field.builtIn ? [
              <Button
                key="remove"
                size="small"
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={() => onRemove(field.key)}
              />,
            ] : []}
          >
            <Space size={8} wrap>
              <span>{field.label}</span>
              {field.builtIn ? <Tag>Built-in</Tag> : <Tag color="blue">Custom</Tag>}
              {field.required ? <Tag color="orange">Mandatory</Tag> : null}
            </Space>
          </List.Item>
        )}
      />

      {adding ? (
        <Form form={form} layout="vertical" initialValues={{ type: 'text', required: false }}>
          <Form.Item name="label" label="Field label" rules={[{ required: true, message: 'Enter a label' }]}>
            <Input placeholder="e.g. Enquiry No" />
          </Form.Item>
          <Form.Item name="type" label="Field type" rules={[{ required: true }]}>
            <Select options={FIELD_TYPES} />
          </Form.Item>
          <Form.Item name="required" label="Mandatory" valuePropName="checked" className="!mb-4">
            <Switch size="small" checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setAdding(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleAdd}>Save field</Button>
          </div>
        </Form>
      ) : (
        <Button type="dashed" block onClick={() => setAdding(true)}>+ Add field</Button>
      )}
    </Modal>
  );
}
