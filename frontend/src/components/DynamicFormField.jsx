import { Form, Input, InputNumber, DatePicker } from 'antd';
import dayjs from 'dayjs';

export function DynamicFormField({ field, namePrefix = [] }) {
  const name = [...namePrefix, field.key];
  const rules = [];
  if (field.required) rules.push({ required: true, message: `Enter ${field.label.toLowerCase()}` });
  if (field.type === 'email') rules.push({ type: 'email', message: 'Enter a valid email' });

  let input;
  switch (field.type) {
    case 'number':
      input = <InputNumber min={0} style={{ width: '100%' }} />;
      break;
    case 'textarea':
      input = <Input.TextArea rows={2} placeholder={`Enter ${field.label.toLowerCase()}`} />;
      break;
    case 'date':
      input = <DatePicker style={{ width: '100%' }} format="DD/M/YY" />;
      break;
    case 'email':
      input = <Input type="email" placeholder={`Enter ${field.label.toLowerCase()}`} />;
      break;
    default:
      input = <Input placeholder={`Enter ${field.label.toLowerCase()}`} />;
  }

  return (
    <Form.Item name={name} label={field.label} rules={rules} getValueFromEvent={field.type === 'date' ? undefined : undefined}>
      {input}
    </Form.Item>
  );
}

export function serializeDynamicValues(fields, values = {}) {
  const out = {};
  fields.filter((f) => !f.builtIn).forEach((f) => {
    const val = values[f.key];
    if (val == null || val === '') return;
    out[f.key] = f.type === 'date' && val?.format ? val.format('DD/M/YY') : val;
  });
  return out;
}

export function deserializeDynamicValues(fields, values = {}) {
  const out = {};
  fields.filter((f) => !f.builtIn).forEach((f) => {
    const val = values[f.key];
    if (val == null || val === '') return;
    out[f.key] = f.type === 'date' ? dayjs(val, 'DD/M/YY') : val;
  });
  return out;
}
