import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Space, Spin, Tabs, Typography, message } from 'antd';
import { ColumnHeightOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { useAuth } from '../../config/AuthContext.jsx';
import ManageColumnsModal from '../../Components/ManageColumnsModal';
import Team from './Team';
import AuditLogs from './AuditLogs';
import Customers from './Customers';
import {
  getAllOrganizationBuiltinColumnsIncludingHidden,
  getOrganizationBuiltinColumns,
  hideOrganizationBuiltinColumn,
  updateOrganizationBuiltinColumn,
} from '../../utils/organizationColumns.js';

function OrgDetails() {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState([]);
  const [columnOpen, setColumnOpen] = useState(false);
  const [columnRev, setColumnRev] = useState(0);
  const [form] = Form.useForm();

  const builtinFields = useMemo(
    () => getOrganizationBuiltinColumns(),
    [columnRev],
  );
  const allBuiltinFields = useMemo(
    () => getAllOrganizationBuiltinColumnsIncludingHidden(),
    [columnRev],
  );

  const customFields = useMemo(
    () => fields.filter((f) => f.entity_type === 'ORGANIZATION'),
    [fields],
  );

  const applyOrgToForm = (org, customItems) => {
    setFields(customItems || []);
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
  };

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
        applyOrgToForm(org, custom.items || []);
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
      applyOrgToForm(org, custom.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load company settings'));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const cancelEdit = async () => {
    setEditing(false);
    await load({ quiet: true });
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
      setEditing(false);
      load({ quiet: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {loading ? (
        <div className="grid min-h-0 flex-1 place-items-center">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div>
              <Typography.Text type="secondary">
                Company details used on reports. Add custom columns as needed.
              </Typography.Text>
            </div>
            <Space>
              <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnOpen(true)}>
                Columns
              </Button>
              <Button
                icon={<EditOutlined />}
                disabled={editing}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!editing}
                onClick={save}
              >
                Save
              </Button>
              {editing ? (
                <Button onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </Space>
          </div>

          <div className="admin-scroll-pane min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <Card className="border-0 shadow-none">
            <Form form={form} layout="vertical" disabled={!editing}>
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
                {builtinFields.map((f) => (
                  <Col xs={24} md={12} key={f.field_key}>
                    <Form.Item
                      name={f.field_key}
                      label={f.field_label}
                      rules={f.is_required ? [{ required: true, message: `${f.field_label} is required` }] : undefined}
                    >
                      {f.field_type === 'TEXTAREA' ? <Input.TextArea rows={3} /> : <Input size="large" />}
                    </Form.Item>
                  </Col>
                ))}
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
          </div>
        </>
      )}

      <ManageColumnsModal
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        entityType="ORGANIZATION"
        fields={customFields}
        builtinFields={allBuiltinFields}
        onUpdateBuiltin={updateOrganizationBuiltinColumn}
        onHideBuiltin={hideOrganizationBuiltinColumn}
        onChanged={() => {
          setColumnRev((n) => n + 1);
          load({ quiet: true });
        }}
      />
    </div>
  );
}

export default function Configuration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'org';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        activeKey={['customers', 'org', 'user', 'audit'].includes(tab) ? tab : 'org'}
        onChange={(key) => setSearchParams(key === 'org' ? {} : { tab: key })}
        className="config-tabs min-h-0 flex-1"
        items={[
          { key: 'customers', label: 'Customers', children: <Customers /> },
          { key: 'org', label: 'Organization Details', children: <OrgDetails /> },
          { key: 'user', label: 'User', children: <Team /> },
          { key: 'audit', label: 'Audit logs', children: <AuditLogs /> },
        ]}
      />
    </div>
  );
}
