import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Form, Input, Space, Spin, Typography, message,
} from 'antd';
import { ColumnHeightOutlined, SaveOutlined } from '@ant-design/icons';
import { api, getApiErrorMessage, useAuth } from '../../config/auth.jsx';
import AddColumnModal from '../../components/AddColumnModal';
import { DynamicFormField } from '../../components/DynamicFormField';
import {
  DEFAULT_ORGANIZATION_FIELDS,
  customFieldToSchema,
  toBackendFieldType,
} from '../../utils/fieldSchema';

function pickCustomData(values, customFields) {
  const custom_data = {};
  customFields.forEach((field) => {
    const value = values?.[field.key];
    if (value !== undefined && value !== null && value !== '') {
      custom_data[field.key] = value;
    }
  });
  return custom_data;
}

export default function CompanySettings() {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [fields, setFields] = useState(DEFAULT_ORGANIZATION_FIELDS);
  const [org, setOrg] = useState(null);
  const [form] = Form.useForm();

  const customFields = useMemo(() => fields.filter((f) => !f.builtIn), [fields]);

  const loadCustomFields = async () => {
    const data = await api.get('/custom-fields', {
      params: { page: 1, page_size: 100, entity_type: 'ORGANIZATION' },
    }).then((r) => r.data);
    const custom = (data.items || []).map(customFieldToSchema);
    setFields([...DEFAULT_ORGANIZATION_FIELDS, ...custom]);
    return custom;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [orgData] = await Promise.all([
        api.get('/organizations/me').then((r) => r.data),
        loadCustomFields().catch(() => setFields(DEFAULT_ORGANIZATION_FIELDS)),
      ]);
      setOrg(orgData);
      const values = {
        name: orgData.name,
        code: orgData.code,
        address: orgData.address || '',
        email: orgData.email || '',
        phone: orgData.phone || '',
        website: orgData.website || '',
        tax_number: orgData.tax_number || '',
        notes: orgData.notes || '',
        ...(orgData.custom_data || {}),
      };
      form.setFieldsValue(values);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load company settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const custom_data = pickCustomData(values, customFields);
      const updated = await api.put('/organizations/me', {
        name: values.name?.trim(),
        address: values.address?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        website: values.website?.trim() || null,
        tax_number: values.tax_number?.trim() || null,
        notes: values.notes?.trim() || null,
        custom_data,
      }).then((r) => r.data);
      setOrg(updated);
      await refreshMe?.();
      message.success('Company settings saved');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to save company settings'));
    } finally {
      setSaving(false);
    }
  };

  const addOrgField = async (field) => {
    await api.post('/custom-fields', {
      entity_type: 'ORGANIZATION',
      field_key: field.key,
      field_label: field.label,
      field_type: toBackendFieldType(field.type),
      is_required: Boolean(field.required),
      is_visible: true,
      is_editable: true,
      display_order: fields.length,
    });
    await loadCustomFields();
  };

  const removeOrgField = async (key) => {
    const field = fields.find((f) => f.key === key && !f.builtIn);
    if (field?.id) await api.delete(`/custom-fields/${field.id}`);
    await loadCustomFields();
    form.setFieldValue(key, undefined);
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-scroll-y">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="section-eyebrow">Admin</p>
          <Typography.Title level={3} className="page-title" style={{ margin: 0 }}>
            Company Settings
          </Typography.Title>
          <Typography.Text type="secondary">
            Update organization details from registration, or add extra company fields
          </Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnsOpen(true)}>
            Add Column
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save changes
          </Button>
        </Space>
      </div>

      <Card className="card-shell" styles={{ body: { padding: 24 } }}>
        <Form form={form} layout="vertical" requiredMark="optional" style={{ maxWidth: 720 }}>
          {fields.map((field) => {
            if (field.key === 'code') {
              return (
                <Form.Item
                  key={field.key}
                  name="code"
                  label={field.label}
                  extra="Organization code cannot be changed after registration"
                >
                  <Input disabled />
                </Form.Item>
              );
            }
            if (field.key === 'name') {
              return (
                <Form.Item
                  key={field.key}
                  name="name"
                  label={field.label}
                  rules={[
                    { required: true, message: 'Enter organization name' },
                    { min: 2, message: 'At least 2 characters' },
                  ]}
                >
                  <Input placeholder="Organization name" />
                </Form.Item>
              );
            }
            if (field.key === 'address') {
              return (
                <Form.Item
                  key={field.key}
                  name="address"
                  label={field.label}
                  rules={[{ required: true, message: 'Enter address' }]}
                >
                  <Input.TextArea rows={3} placeholder="Street, city, state, PIN" />
                </Form.Item>
              );
            }
            return (
              <DynamicFormField
                key={field.key}
                field={{
                  ...field,
                  required: Boolean(field.required),
                }}
              />
            );
          })}
        </Form>
        {org?.updated_at ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Last updated {new Date(org.updated_at).toLocaleString()}
          </Typography.Text>
        ) : null}
      </Card>

      <AddColumnModal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Customize Company Columns"
        fields={fields}
        onAdd={async (field) => {
          try {
            await addOrgField(field);
            message.success(`Column "${field.label}" added`);
          } catch (error) {
            message.error(getApiErrorMessage(error, 'Failed to add column'));
          }
        }}
        onRemove={async (key) => {
          try {
            await removeOrgField(key);
            message.success('Column removed');
          } catch (error) {
            message.error(getApiErrorMessage(error, 'Failed to remove column'));
          }
        }}
      />
    </div>
  );
}
