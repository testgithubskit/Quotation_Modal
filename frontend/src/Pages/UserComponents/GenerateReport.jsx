import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Select, Space, Typography, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';

let uid = 0;
const nextKey = () => `k${Date.now()}${uid++}`;

function emptyItem() {
  return {
    key: nextKey(),
    activity_id: null,
    description: '',
    quantity: 1,
    unit: 'Nos',
    unit_price: 0,
  };
}

export default function GenerateReport() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, a, t] = await Promise.all([
          api.get('/customers').then((r) => r.data),
          api.get('/activities').then((r) => r.data),
          api.get('/quotation-templates').then((r) => r.data),
        ]);
        if (cancelled) return;
        setCustomers(c.items || []);
        setActivities(a.items || []);
        setTemplates(t.items || []);
        const defaultTpl = (t.items || []).find((x) => x.is_default) || (t.items || [])[0];
        form.setFieldsValue({
          quotation_date: dayjs().format('YYYY-MM-DD'),
          quotation_template_id: defaultTpl?.id,
        });
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load form data'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activityOptions = useMemo(
    () => activities.map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
      activity: a,
    })),
    [activities],
  );

  const customerOptions = useMemo(
    () => customers.map((c) => ({
      value: c.id,
      label: `${c.name}${c.notes ? ` — ${c.notes}` : ''}`,
    })),
    [customers],
  );

  const templateOptions = useMemo(
    () => templates.map((t) => ({
      value: t.id,
      label: t.is_default ? `${t.name} (default)` : t.name,
    })),
    [templates],
  );

  const setItem = (key, patch) => {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const pickActivity = (key, activityId) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) {
      setItem(key, { activity_id: null });
      return;
    }
    setItem(key, {
      activity_id: activity.id,
      description: activity.name,
      unit: activity.unit || 'Nos',
      unit_price: Number(activity.unit_price || 0),
    });
  };

  const grandTotal = items.reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.unit_price || 0),
    0,
  );

  const submit = async () => {
    const values = await form.validateFields();
    if (!items.length || items.every((i) => !i.activity_id && !i.description)) {
      message.error('Add at least one activity line');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: values.customer_id,
        quotation_template_id: values.quotation_template_id || null,
        quotation_number: values.quotation_number || null,
        quotation_date: values.quotation_date ? new Date(values.quotation_date).toISOString() : null,
        notes: values.notes || null,
        currency: 'INR',
        discount: 0,
        custom_data: {
          subject: values.subject || null,
        },
        items: items
          .filter((i) => i.activity_id || i.description)
          .map((i) => ({
            activity_id: i.activity_id || null,
            description: i.description || 'Item',
            quantity: Number(i.quantity || 1),
            unit: i.unit || 'Nos',
            unit_price: Number(i.unit_price || 0),
            discount: 0,
            tax: 0,
            custom_data: {},
          })),
      };
      const created = await api.post('/quotations', payload).then((r) => r.data);
      message.success(`Report ${created.quotation_number} created`);
      navigate('/user/reports');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to create report'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1 !font-sans !text-teal-800">
            Generate Report
          </Typography.Title>
          <Typography.Text type="secondary">
            Uses the report template created by admin.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
          Save report
        </Button>
      </div>

      <Card className="min-h-0 flex-1 overflow-auto border-slate-200 shadow-sm">
        <Form form={form} layout="vertical">
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true, message: 'Select customer' }]}>
              <Select
                showSearch
                options={customerOptions}
                optionFilterProp="label"
                placeholder="Select customer"
              />
            </Form.Item>
            <Form.Item name="quotation_template_id" label="Report template" rules={[{ required: true, message: 'Select template' }]}>
              <Select options={templateOptions} placeholder="Select template" />
            </Form.Item>
            <Form.Item name="quotation_number" label="Report No. (optional)">
              <Input placeholder="Auto if left blank" />
            </Form.Item>
            <Form.Item name="quotation_date" label="Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
          </div>
          <Form.Item name="subject" label="Subject">
            <Input placeholder="Quotation subject" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        <div className="mb-3 flex items-center justify-between">
          <Typography.Title level={5} className="!mb-0">Activities</Typography.Title>
          <Button icon={<PlusOutlined />} onClick={() => setItems((p) => [...p, emptyItem()])}>
            Add line
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F5F5] text-left">
                <th className="border border-slate-200 p-2">#</th>
                <th className="border border-slate-200 p-2">Activity</th>
                <th className="border border-slate-200 p-2">Description</th>
                <th className="border border-slate-200 p-2 w-20">Qty</th>
                <th className="border border-slate-200 p-2 w-24">Unit</th>
                <th className="border border-slate-200 p-2 w-28">Unit Rate</th>
                <th className="border border-slate-200 p-2 w-28">Total</th>
                <th className="border border-slate-200 p-2 w-14" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={row.key}>
                  <td className="border border-slate-200 p-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-200 p-2">
                    <Select
                      showSearch
                      className="w-full"
                      options={activityOptions}
                      optionFilterProp="label"
                      value={row.activity_id}
                      onChange={(id) => pickActivity(row.key, id)}
                      allowClear
                      placeholder="Select activity"
                    />
                  </td>
                  <td className="border border-slate-200 p-2">
                    <Input
                      value={row.description}
                      onChange={(e) => setItem(row.key, { description: e.target.value })}
                    />
                  </td>
                  <td className="border border-slate-200 p-2">
                    <InputNumber
                      className="w-full"
                      min={1}
                      value={row.quantity}
                      onChange={(v) => setItem(row.key, { quantity: v || 1 })}
                    />
                  </td>
                  <td className="border border-slate-200 p-2">
                    <Input
                      value={row.unit}
                      onChange={(e) => setItem(row.key, { unit: e.target.value })}
                    />
                  </td>
                  <td className="border border-slate-200 p-2">
                    <InputNumber
                      className="w-full"
                      min={0}
                      value={row.unit_price}
                      onChange={(v) => setItem(row.key, { unit_price: v || 0 })}
                    />
                  </td>
                  <td className="border border-slate-200 p-2 font-medium">
                    ₹{(Number(row.quantity || 0) * Number(row.unit_price || 0)).toLocaleString('en-IN')}
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={items.length === 1}
                      onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Space>
            <Typography.Text strong>Grand Total:</Typography.Text>
            <Typography.Text strong className="text-lg text-teal-700">
              ₹{grandTotal.toLocaleString('en-IN')}
            </Typography.Text>
          </Space>
        </div>
      </Card>
    </div>
  );
}
