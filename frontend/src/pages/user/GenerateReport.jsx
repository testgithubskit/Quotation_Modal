import { useEffect, useMemo, useState } from 'react';
import {
  Typography, Form, Row, Col, Card, Button, Space,
  Input, InputNumber, Select, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ColumnHeightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '../../config/auth.js';
import { useData } from '../../store/DataContext';
import AddColumnModal from '../../components/AddColumnModal';
import { DynamicFormField } from '../../components/DynamicFormField';
import { serializeDynamicValues } from '../../components/DynamicFormField';

const UNIT_OPTIONS = ['Nos', 'Set', 'Each', 'Parameter', 'Hour', 'Day'];
const BUILT_IN_ITEM_KEYS = new Set(['code', 'specification', 'particulars', 'cost']);

let uid = 0;
const nextKey = () => `k${Date.now()}${uid++}`;

function emptyItem() {
  return {
    key: nextKey(),
    activityId: null,
    sampleActivity: '',
    description: '',
    specification: '',
    qty: 1,
    unit: 'Nos',
    unitRate: 0,
    customFields: {},
    subActivities: [],
  };
}

export default function GenerateReport() {
  const {
    data, addReport,
    refreshActivities, refreshCustomers, refreshTemplates, refreshCustomFields,
    addReportHeaderField, removeReportHeaderField,
    addReportCustomerField, removeReportCustomerField,
    addReportTermsField, removeReportTermsField,
  } = useData();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    refreshActivities().catch(() => {});
    refreshCustomers().catch(() => {});
    refreshTemplates().catch(() => {});
    refreshCustomFields().catch(() => {});
  }, [refreshActivities, refreshCustomers, refreshTemplates, refreshCustomFields]);

  useEffect(() => {
    form.setFieldsValue({
      date: form.getFieldValue('date') || dayjs(),
    });
  }, [form]);

  const [items, setItems] = useState([emptyItem()]);
  const [activeKey, setActiveKey] = useState(items[0].key);
  const [headerFieldsOpen, setHeaderFieldsOpen] = useState(false);
  const [customerFieldsOpen, setCustomerFieldsOpen] = useState(false);
  const [termsFieldsOpen, setTermsFieldsOpen] = useState(false);
  const [activityNotes, setActivityNotes] = useState([
    { key: nextKey(), value: 'Quoted price are per each qty / Parameter.' },
  ]);

  const headerFields = data.schema.reportHeaderFields;
  const reportCustomerFields = data.schema.reportCustomerFields;
  const termsFieldDefs = data.schema.reportTermsFields;
  const activityFieldDefs = data.schema.activityFields;

  const customTermsFields = useMemo(
    () => termsFieldDefs.filter((f) => !f.builtIn),
    [termsFieldDefs],
  );

  const customActivityFields = useMemo(
    () => activityFieldDefs.filter((f) => !BUILT_IN_ITEM_KEYS.has(f.key)),
    [activityFieldDefs],
  );

  const activityOptions = useMemo(
    () => data.activities.map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.specification}`,
    })),
    [data.activities],
  );

  const customerOptions = useMemo(
    () => data.customers.map((c) => ({
      value: c.id,
      label: `${c.name} — ${c.company}`,
    })),
    [data.customers],
  );

  const findActivity = (id) => data.activities.find((a) => a.id === id);
  const findCustomer = (id) => data.customers.find((c) => c.id === id);

  const pickCustomActivityFields = (activity) => {
    const customFields = {};
    customActivityFields.forEach((f) => {
      if (activity[f.key] != null && activity[f.key] !== '') customFields[f.key] = activity[f.key];
    });
    return customFields;
  };

  const handleCustomerSelect = (customerId) => {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const mobile = customer.mobile ?? customer.mobileNumber ?? customer.phone ?? '';
    const patch = {
      contactPerson: customer.name,
      companyName: customer.company || '',
      mobileNumber: mobile,
      emailId: customer.email,
    };
    reportCustomerFields.forEach((f) => {
      patch[f.key] = customer[f.key];
    });
    form.setFieldsValue(patch);
  };

  const setItemField = (key, patch) => {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const setSubField = (itemKey, subKey, patch) => {
    setItems((rows) => rows.map((r) => (r.key === itemKey
      ? { ...r, subActivities: r.subActivities.map((s) => (s.key === subKey ? { ...s, ...patch } : s)) }
      : r)));
  };

  const selectActivityForItem = (key, activityId) => {
    const a = findActivity(activityId);
    if (!a) return;
    setItemField(key, {
      activityId,
      sampleActivity: `${a.code} — ${a.specification}`,
      description: a.particulars,
      specification: a.specification,
      unitRate: a.cost,
      customFields: pickCustomActivityFields(a),
    });
  };

  const selectActivityForSub = (itemKey, subKey, activityId) => {
    const a = findActivity(activityId);
    if (!a) return;
    setSubField(itemKey, subKey, {
      activityId,
      sampleActivity: `${a.code} — ${a.specification}`,
      description: a.particulars,
      specification: a.specification,
      unitRate: a.cost,
      customFields: pickCustomActivityFields(a),
    });
  };

  const setItemCustomField = (key, fieldKey, value, isSub, parentKey) => {
    setItems((rows) => rows.map((r) => {
      if (isSub) {
        if (r.key !== parentKey) return r;
        return {
          ...r,
          subActivities: r.subActivities.map((s) => (s.key === key
            ? { ...s, customFields: { ...(s.customFields || {}), [fieldKey]: value } }
            : s)),
        };
      }
      if (r.key !== key) return r;
      return { ...r, customFields: { ...(r.customFields || {}), [fieldKey]: value } };
    }));
  };

  const addItem = () => {
    const item = emptyItem();
    setItems((rows) => [...rows, item]);
    setActiveKey(item.key);
  };

  const addSubActivity = () => {
    if (items.length === 0) {
      message.warning('Add an item first');
      return;
    }
    const target = items.find((r) => r.key === activeKey) || items[items.length - 1];
    const sub = {
      key: nextKey(),
      activityId: null,
      sampleActivity: '',
      description: '',
      specification: '',
      qty: 1,
      unit: 'Nos',
      unitRate: 0,
      customFields: {},
    };
    setItems((rows) => rows.map((r) => (r.key === target.key
      ? { ...r, subActivities: [...r.subActivities, sub] }
      : r)));
  };

  const deleteItem = (key) => {
    setItems((rows) => {
      const next = rows.filter((r) => r.key !== key);
      if (next.length === 0) {
        const item = emptyItem();
        setActiveKey(item.key);
        return [item];
      }
      if (activeKey === key) setActiveKey(next[0].key);
      return next;
    });
  };

  const deleteSub = (itemKey, subKey) => {
    setItems((rows) => rows.map((r) => (r.key === itemKey
      ? { ...r, subActivities: r.subActivities.filter((s) => s.key !== subKey) }
      : r)));
  };

  const addNote = () => setActivityNotes((notes) => [...notes, { key: nextKey(), value: '' }]);
  const updateNote = (key, value) => setActivityNotes((notes) => notes.map((n) => (n.key === key ? { ...n, value } : n)));
  const removeNote = (key) => setActivityNotes((notes) => (notes.length > 1 ? notes.filter((n) => n.key !== key) : notes));

  const headerValuesFromForm = (values) => {
    const out = {};
    headerFields.forEach((f) => {
      const val = values[f.key];
      if (val == null || val === '') return;
      out[f.key] = val?.format ? val.format('DD/M/YY') : val;
    });
    return out;
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const validItems = items.filter((r) => r.sampleActivity || r.activityId);
    if (validItems.length === 0) {
      message.error('Please add at least one item');
      return;
    }

    const selectedCustomer = findCustomer(values.customerId);
    if (!selectedCustomer) {
      message.error('Please select a customer');
      return;
    }

    const headerData = headerValuesFromForm(values);

    try {
      const id = await addReport({
        reportNo: headerData.reportNo,
        centre: headerData.centre,
        center: headerData.centre,
        lab: headerData.lab,
        enquiryNo: headerData.enquiryNo,
        date: headerData.date,
        customHeader: headerData,
          customer: {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          company: values.companyName || selectedCustomer.company,
          address: selectedCustomer.address,
          details: [
            selectedCustomer.name,
            values.companyName || selectedCustomer.company,
            selectedCustomer.address,
          ].filter(Boolean).join('\n'),
          contactPerson: values.contactPerson,
          mobile: values.mobileNumber || selectedCustomer.mobile,
          email: values.emailId,
          customFields: serializeDynamicValues(reportCustomerFields, values),
        },
        subject: values.subject,
        activityNotes: activityNotes.map((n) => n.value).filter(Boolean),
        terms: {
          termsAndConditions: values.termsAndConditions,
          customFields: serializeDynamicValues(customTermsFields, values),
        },
        activities: validItems.map((r) => ({
          key: r.key,
          activityId: r.activityId,
          code: r.sampleActivity.split(' — ')[0] || '',
          sampleActivity: r.sampleActivity,
          particulars: r.description,
          description: r.description,
          specification: r.specification,
          qty: r.qty,
          unit: r.unit,
          cost: r.unitRate,
          unitRate: r.unitRate,
          customFields: r.customFields || {},
          subActivities: r.subActivities
            .filter((s) => s.sampleActivity || s.activityId)
            .map((s) => ({
              key: s.key,
              activityId: s.activityId,
              code: s.sampleActivity.split(' — ')[0] || '',
              sampleActivity: s.sampleActivity,
              particulars: s.description,
              description: s.description,
              specification: s.specification,
              qty: s.qty,
              unit: s.unit,
              cost: s.unitRate,
              unitRate: s.unitRate,
              customFields: s.customFields || {},
            })),
        })),
        templateId: data.templates.find((t) => t.isDefault)?.id || data.templates[0]?.id,
      });

      message.success('Quotation submitted');
      navigate(`/user/reports/${id}/view`);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to submit quotation'));
    }
  };

  const renderCustomFieldCell = (row, field, isSub, parentKey) => {
    const val = row.customFields?.[field.key] ?? '';
    if (field.type === 'number') {
      return (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => setItemCustomField(row.key, field.key, v, isSub, parentKey)}
        />
      );
    }
    return (
      <Input
        size="small"
        value={val}
        placeholder={field.label}
        onChange={(e) => setItemCustomField(row.key, field.key, e.target.value, isSub, parentKey)}
      />
    );
  };

  const renderItemRow = (row, siNo, isSub, parentKey) => {
    const total = Number(row.qty || 0) * Number(row.unitRate || 0);
    const rowKey = isSub ? `${parentKey}-${row.key}` : row.key;

    return (
      <tr
        key={rowKey}
        className={isSub ? 'items-table-sub-row' : 'items-table-row'}
        onClick={() => !isSub && setActiveKey(row.key)}
        style={{
          background: !isSub && activeKey === row.key ? '#f0f7ff' : undefined,
          cursor: isSub ? 'default' : 'pointer',
        }}
      >
        <td className="items-table-cell items-table-si">{siNo}</td>
        <td className="items-table-cell">
          <Select
            showSearch
            size="small"
            style={{ width: '100%' }}
            placeholder="Search calibration items"
            options={activityOptions}
            filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
            value={row.activityId}
            onChange={(id) => (isSub
              ? selectActivityForSub(parentKey, row.key, id)
              : selectActivityForItem(row.key, id))}
            allowClear
            onClear={() => (isSub
              ? setSubField(parentKey, row.key, {
                activityId: null, sampleActivity: '', description: '', specification: '', unitRate: 0, customFields: {},
              })
              : setItemField(row.key, {
                activityId: null, sampleActivity: '', description: '', specification: '', unitRate: 0, customFields: {},
              }))}
          />
        </td>
        <td className="items-table-cell">
          <Input
            size="small"
            placeholder="Enter description"
            value={row.description}
            onChange={(e) => (isSub
              ? setSubField(parentKey, row.key, { description: e.target.value })
              : setItemField(row.key, { description: e.target.value }))}
          />
        </td>
        <td className="items-table-cell">
          <Input
            size="small"
            placeholder="Enter specification"
            value={row.specification}
            onChange={(e) => (isSub
              ? setSubField(parentKey, row.key, { specification: e.target.value })
              : setItemField(row.key, { specification: e.target.value }))}
          />
        </td>
        {customActivityFields.map((field) => (
          <td key={field.key} className="items-table-cell">
            {renderCustomFieldCell(row, field, isSub, parentKey)}
          </td>
        ))}
        <td className="items-table-cell items-table-qty">
          <InputNumber
            min={1}
            size="small"
            style={{ width: '100%' }}
            placeholder="Qty"
            value={row.qty}
            onChange={(v) => (isSub
              ? setSubField(parentKey, row.key, { qty: v || 1 })
              : setItemField(row.key, { qty: v || 1 }))}
          />
        </td>
        <td className="items-table-cell items-table-unit">
          <Select
            size="small"
            style={{ width: '100%' }}
            options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
            value={row.unit}
            onChange={(v) => (isSub
              ? setSubField(parentKey, row.key, { unit: v })
              : setItemField(row.key, { unit: v }))}
          />
        </td>
        <td className="items-table-cell items-table-rate">
          <InputNumber
            min={0}
            size="small"
            style={{ width: '100%' }}
            placeholder="Rate"
            value={row.unitRate}
            onChange={(v) => (isSub
              ? setSubField(parentKey, row.key, { unitRate: v || 0 })
              : setItemField(row.key, { unitRate: v || 0 }))}
          />
        </td>
        <td className="items-table-cell items-table-total">
          <Input
            size="small"
            readOnly
            placeholder="Total"
            value={total ? total.toLocaleString('en-IN') : ''}
          />
        </td>
        <td className="items-table-cell items-table-action">
          <Button
            size="small"
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              if (isSub) deleteSub(parentKey, row.key);
              else deleteItem(row.key);
            }}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="page-scroll">
      <div className="page-scroll-header">
        <p className="section-eyebrow">User</p>
        <Typography.Title level={3} className="page-title" style={{ margin: 0, marginBottom: 4 }}>
          Generate Report
        </Typography.Title>
        <Typography.Text type="secondary">Fill in the quotation details below</Typography.Text>
      </div>

      <Card className="card-shell page-scroll-card" styles={{ body: { paddingBottom: 32 } }}>
        <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Title level={5} className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
              Report Details
            </Typography.Title>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setHeaderFieldsOpen(true)}>Add Field</Button>
          </div>
          <Row gutter={16}>
            {headerFields.map((field) => (
              <Col xs={24} sm={12} md={6} key={field.key}>
                <DynamicFormField field={field} />
              </Col>
            ))}
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Title level={5} className="form-section-title">Customer Information</Typography.Title>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setCustomerFieldsOpen(true)}>Add Field</Button>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="customerId"
                label="Customer Details"
                rules={[{ required: true, message: 'Select a customer' }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Select customer"
                  options={customerOptions}
                  filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                  onChange={(id) => {
                    if (id) handleCustomerSelect(id);
                    else form.setFieldsValue({
                      contactPerson: undefined,
                      companyName: undefined,
                      mobileNumber: undefined,
                      emailId: undefined,
                      ...Object.fromEntries(reportCustomerFields.map((f) => [f.key, undefined])),
                    });
                  }}
                  notFoundContent="No customers found — ask supervisor to add customers"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="contactPerson" label="Contact Person">
                <Input placeholder="Enter contact person name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="companyName" label="Company Name">
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="mobileNumber" label="Mobile Number">
                <Input placeholder="Enter mobile number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="emailId" label="Email ID">
                <Input placeholder="Enter email id" />
              </Form.Item>
            </Col>
          </Row>

          {reportCustomerFields.length > 0 && (
            <Row gutter={16}>
              {reportCustomerFields.map((field) => (
                <Col xs={24} sm={12} md={6} key={field.key}>
                  <DynamicFormField field={field} />
                </Col>
              ))}
            </Row>
          )}

          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Enter subject' }]}
          >
            <Input placeholder="e.g. Quotation for the Calibration charges of Slip Gauges, Angle Gauges" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography.Title level={5} className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
              Items/Activities
            </Typography.Title>
            <Space>
              <Button icon={<PlusOutlined />} onClick={addSubActivity}>Add Sub Activity</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
            </Space>
          </div>

          <div className="items-table-wrap">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Sl No</th>
                  <th>Sample/Activity</th>
                  <th>Description</th>
                  <th>Specification</th>
                  {customActivityFields.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit Rate (₹)</th>
                  <th>Total Cost (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const rows = [renderItemRow(item, idx + 1, false, item.key)];
                  item.subActivities.forEach((sub, subIdx) => {
                    rows.push(renderItemRow(sub, `${idx + 1}.${subIdx + 1}`, true, item.key));
                  });
                  return rows;
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Typography.Title level={5} className="form-section-title">Activity Notes</Typography.Title>
            <Button icon={<PlusOutlined />} onClick={addNote}>Add Note</Button>
          </div>

          {activityNotes.map((note, idx) => (
            <div key={note.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input
                style={{ flex: 1 }}
                placeholder={idx === 0 ? 'Quoted price are per each qty / Parameter.' : 'Enter activity note'}
                value={note.value}
                onChange={(e) => updateNote(note.key, e.target.value)}
              />
              {activityNotes.length > 1 && (
                <Button danger icon={<DeleteOutlined />} onClick={() => removeNote(note.key)} />
              )}
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Title level={5} className="form-section-title">Terms &amp; Conditions</Typography.Title>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setTermsFieldsOpen(true)}>Add Field</Button>
          </div>

          <Form.Item name="termsAndConditions" label="Terms and Conditions">
            <Input.TextArea rows={3} placeholder="Enter terms and conditions" />
          </Form.Item>

          {customTermsFields.length > 0 && (
            <Row gutter={16}>
              {customTermsFields.map((field) => (
                <Col xs={24} sm={12} md={8} key={field.key}>
                  <DynamicFormField field={field} />
                </Col>
              ))}
            </Row>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmit}>
              Submit Quotation
            </Button>
            <Button size="large" onClick={() => navigate('/user/reports')}>Cancel</Button>
          </div>
        </Form>
      </Card>

      <AddColumnModal
        open={headerFieldsOpen}
        onClose={() => setHeaderFieldsOpen(false)}
        title="Customize Report Fields"
        fields={headerFields}
        onAdd={(field) => { addReportHeaderField(field); message.success(`Field "${field.label}" added`); }}
        onRemove={(key) => { removeReportHeaderField(key); message.success('Field removed'); }}
      />

      <AddColumnModal
        open={customerFieldsOpen}
        onClose={() => setCustomerFieldsOpen(false)}
        title="Customize Customer Fields"
        fields={reportCustomerFields}
        onAdd={(field) => { addReportCustomerField(field); message.success(`Column "${field.label}" added`); }}
        onRemove={(key) => { removeReportCustomerField(key); message.success('Column removed'); }}
      />

      <AddColumnModal
        open={termsFieldsOpen}
        onClose={() => setTermsFieldsOpen(false)}
        title="Customize Terms & Conditions"
        fields={termsFieldDefs}
        onAdd={(field) => { addReportTermsField(field); message.success(`Column "${field.label}" added`); }}
        onRemove={(key) => { removeReportTermsField(key); message.success('Column removed'); }}
      />
    </div>
  );
}
