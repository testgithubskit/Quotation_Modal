import { useState } from 'react';
import { Modal, Form, Input, Select, List, Button, Typography, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { slugifyFieldKey } from '../utils/fieldSchema';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
];

export default function AddColumnModal({
  open,
  onClose,
  title,
  fields,
  onAdd,
  onRemove,
}) {
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const customFields = fields.filter((f) => !f.builtIn);

  const handleAdd = async () => {
    const values = await form.validateFields();
    const key = slugifyFieldKey(values.label, fields.map((f) => f.key));
    onAdd({ key, label: values.label.trim(), type: values.type, builtIn: false });
    form.resetFields();
    setAdding(false);
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => { onClose(); setAdding(false); form.resetFields(); }}
      footer={null}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Built-in columns cannot be removed. Add custom columns to extend the table and forms.
      </Typography.Paragraph>

      <List
        size="small"
        bordered
        dataSource={fields}
        style={{ marginBottom: 16 }}
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
            <span>{field.label}</span>
            {field.builtIn ? <Tag>Built-in</Tag> : <Tag color="blue">Custom</Tag>}
          </List.Item>
        )}
      />

      {adding ? (
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Column Label" rules={[{ required: true, message: 'Enter a column label' }]}>
            <Input placeholder="e.g. GST Code" />
          </Form.Item>
          <Form.Item name="type" label="Field Type" initialValue="text" rules={[{ required: true }]}>
            <Select options={FIELD_TYPES} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setAdding(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleAdd}>Save Column</Button>
          </div>
        </Form>
      ) : (
        <Button type="dashed" block onClick={() => setAdding(true)}>+ Add Column</Button>
      )}
    </Modal>
  );
}
