import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Space, Spin, Typography, message } from 'antd';
import { ColumnHeightOutlined, SaveOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { useAuth } from '../../config/AuthContext.jsx';
import ManageColumnsModal from '../../Components/ManageColumnsModal';

export default function Configuration() {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState([]);
  const [columnOpen, setColumnOpen] = useState(false);
  const [form] = Form.useForm();

  const customFields = useMemo(
    () => fields.filter((f) => f.entity_type === 'ORGANIZATION'),
    [fields],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [org, custom] = await Promise.all([
          api.get('/organizations/me').then((r) => r.data),
          api.get('/custom-fields', { params: { entity_type: 'ORGANIZATION' } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setFields(custom.items || []);
        form.setFieldsValue({
          name: org.name,
          code: org.code,
          email: org.email,
          phone: org.phone,
          website: org.website,
          tax_number: org.tax_number,
          address: org.address,
          notes: org.notes,
          ...(org.custom_data || {}),
        });
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load company settings'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [org, custom] = await Promise.all([
        api.get('/organizations/me').then((r) => r.data),
        api.get('/custom-fields', { params: { entity_type: 'ORGANIZATION' } }).then((r) => r.data),
      ]);
      setFields(custom.items || []);
      form.setFieldsValue({
        name: org.name,
        code: org.code,
        email: org.email,
        phone: org.phone,
        website: org.website,
        tax_number: org.tax_number,
        address: org.address,
        notes: org.notes,
        ...(org.custom_data || {}),
      });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load company settings'));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const save = async () => {
    const values = await form.validateFields();
    const custom_data = {};
    customFields.forEach((f) => {
      if (values[f.field_key] != null && values[f.field_key] !== '') {
        custom_data[f.field_key] = values[f.field_key];
      }
    });
    setSaving(true);
    try {
      await api.put('/organizations/me', {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        website: values.website || null,
        tax_number: values.tax_number || null,
        address: values.address || null,
        notes: values.notes || null,
        custom_data,
      });
      await refreshMe();
      message.success('Company details saved');
      load({ quiet: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {loading ? (
        <div className="grid h-full place-items-center">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Typography.Title level={3} className="!mb-1 !font-sans !text-teal-800">
                Configuration
              </Typography.Title>
              <Typography.Text type="secondary">
                Company details used on reports. Add custom columns as needed.
              </Typography.Text>
            </div>
            <Space>
              <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnOpen(true)}>
                Columns
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                Save
              </Button>
            </Space>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <Form form={form} layout="vertical">
              <Row gutter={[24, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="Company name" rules={[{ required: true }]}>
                    <Input size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="code" label="Organization code">
                    <Input size="large" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="email" label="Email"><Input size="large" /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="phone" label="Phone"><Input size="large" /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="website" label="Website"><Input size="large" /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="tax_number" label="Tax / GST number"><Input size="large" /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="address" label="Address">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="notes" label="Notes">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
                {customFields.map((f) => (
                  <Col xs={24} md={12} key={f.field_key}>
                    <Form.Item
                      name={f.field_key}
                      label={f.field_label}
                      rules={f.is_required ? [{ required: true, message: `${f.field_label} is required` }] : undefined}
                    >
                      <Input size="large" />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          </Card>
        </>
      )}

      <ManageColumnsModal
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        entityType="ORGANIZATION"
        fields={customFields}
        onChanged={() => load({ quiet: true })}
      />
    </div>
  );
}
