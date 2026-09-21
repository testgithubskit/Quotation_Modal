import { useEffect, useMemo, useState } from 'react';
import {
  Typography, Form, Row, Col, Card, Button, Space,
  Input, InputNumber, Select, Tooltip, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ColumnHeightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import ReportAddFieldModal from '../../Components/ReportAddFieldModal';
import { DynamicFormField, serializeDynamicValues } from '../../Components/DynamicFormField';
import {
  loadReportFormSchema,
  addSchemaField,
  removeSchemaField,
} from '../../utils/reportFormSchema.js';
import {
  digitsOnlyPhone,
  phoneFieldRules,
  phoneInputProps,
} from '../../utils/phoneValidation.js';

const UNIT_OPTIONS = ['Nos', 'Set', 'Each', 'Parameter', 'Hour', 'Day'];
const UNIT_SELECT_OPTIONS = [
  ...UNIT_OPTIONS.map((u) => ({ value: u, label: u })),
  { value: 'Other', label: 'Other' },
];

let uid = 0;
const nextKey = () => `k${Date.now()}${uid++}`;

function emptyItem() {
  return {
    key: nextKey(),
    activityId: null,
    sampleActivity: '',
    description: '',
    specification: '',
    qty: 0,
    unit: 'Nos',
    unitRate: 0,
    customFields: {},
    subActivities: [],
  };
}

export default function GenerateReport() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [starredTemplate, setStarredTemplate] = useState(null);
  const [activityCustomFields, setActivityCustomFields] = useState([]);
  const [schema, setSchema] = useState(() => loadReportFormSchema());
  const [items, setItems] = useState([emptyItem()]);
  const [activeKey, setActiveKey] = useState(() => items[0]?.key);
  const [saving, setSaving] = useState(false);
  const [headerFieldsOpen, setHeaderFieldsOpen] = useState(false);
  const [customerFieldsOpen, setCustomerFieldsOpen] = useState(false);
  const [termsFieldsOpen, setTermsFieldsOpen] = useState(false);
  const [activityNotes, setActivityNotes] = useState([
    { key: nextKey(), value: 'Quoted price are per each qty / Parameter.' },
  ]);

  const headerFields = schema.reportHeaderFields;
  const reportCustomerFields = schema.reportCustomerFields;
  const termsFieldDefs = schema.reportTermsFields;
  const customTermsFields = useMemo(
    () => termsFieldDefs.filter((f) => !f.builtIn),
    [termsFieldDefs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, a, t, af] = await Promise.all([
          api.get('/customers').then((r) => r.data),
          api.get('/activities').then((r) => r.data),
          api.get('/quotation-templates').then((r) => r.data),
          api.get('/custom-fields', { params: { entity_type: 'ACTIVITY' } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setCustomers(c.items || []);
        setActivities(a.items || []);
        const defaultTpl = (t.items || []).find((x) => x.is_default) || null;
        setStarredTemplate(defaultTpl);
        setActivityCustomFields(
          (af.items || []).map((f) => ({
            key: f.field_key,
            label: f.field_label,
            type: String(f.field_type || 'TEXT').toLowerCase() === 'number'
              || String(f.field_type || '').toLowerCase() === 'decimal'
              ? 'number'
              : 'text',
            required: Boolean(f.is_required),
          })),
        );
        form.setFieldsValue({
          date: dayjs(),
        });
        if (!defaultTpl) {
          message.warning('No starred template set. Ask an admin to star a template in Report Design.');
        }
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
      label: a.code ? `${a.code} — ${a.name}` : (a.name || 'Activity'),
      code: a.code || '',
      name: a.name || '',
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

  const itemsTotals = useMemo(() => {
    let qty = 0;
    let cost = 0;
    items.forEach((item) => {
      const q = Number(item.qty || 0);
      const rate = Number(item.unitRate || 0);
      qty += q;
      cost += q * rate;
      (item.subActivities || []).forEach((s) => {
        const sq = Number(s.qty || 0);
        const sr = Number(s.unitRate || 0);
        qty += sq;
        cost += sq * sr;
      });
    });
    return { qty, cost };
  }, [items]);

  const itemsLabelColSpan = 4 + activityCustomFields.length;

  const findActivity = (id) => activities.find((a) => a.id === id);
  const findCustomer = (id) => customers.find((c) => c.id === id);

  const pickCustomActivityFields = (activity) => {
    const customFields = {};
    activityCustomFields.forEach((f) => {
      const val = activity.custom_data?.[f.key];
      if (val != null && val !== '') customFields[f.key] = val;
    });
    return customFields;
  };

  const handleCustomerSelect = (customerId) => {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const patch = {
      contactPerson: customer.name,
      companyName: customer.notes || '',
      mobileNumber: customer.phone || '',
      emailId: customer.email || '',
    };
    reportCustomerFields.forEach((f) => {
      patch[f.key] = customer.custom_data?.[f.key];
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
      sampleActivity: a.name || '',
      description: a.description || a.name || '',
      specification: a.name || '',
      qty: 1,
      unit: a.unit || 'Nos',
      unitRate: Number(a.unit_price || 0),
      customFields: pickCustomActivityFields(a),
    });
  };

  const selectActivityForSub = (itemKey, subKey, activityId) => {
    const a = findActivity(activityId);
    if (!a) return;
    setSubField(itemKey, subKey, {
      activityId,
      sampleActivity: a.name || '',
      description: a.description || a.name || '',
      specification: a.name || '',
      qty: 1,
      unit: a.unit || 'Nos',
      unitRate: Number(a.unit_price || 0),
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

  const addSubActivity = (itemKey) => {
    if (items.length === 0) {
      message.warning('Add an item first');
      return;
    }
    const targetKey = itemKey || activeKey || items[items.length - 1]?.key;
    const target = items.find((r) => r.key === targetKey) || items[items.length - 1];
    if (!target) return;
    const sub = {
      key: nextKey(),
      activityId: null,
      sampleActivity: '',
      description: '',
      specification: '',
      qty: 0,
      unit: 'Nos',
      unitRate: 0,
      customFields: {},
    };
    setActiveKey(target.key);
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

  const flattenItemsForApi = (validItems) => {
    const lines = [];
    validItems.forEach((r) => {
      lines.push({
        activity_id: r.activityId || null,
        description: r.description || r.sampleActivity || 'Item',
        quantity: Number(r.qty ?? 0),
        unit: r.unit || 'Nos',
        unit_price: Number(r.unitRate || 0),
        discount: 0,
        tax: 0,
        custom_data: {
          specification: r.specification || '',
          sampleActivity: r.sampleActivity || '',
          ...(r.customFields || {}),
        },
      });
      (r.subActivities || [])
        .filter((s) => s.sampleActivity || s.activityId)
        .forEach((s) => {
          lines.push({
            activity_id: s.activityId || null,
            description: s.description || s.sampleActivity || 'Sub item',
            quantity: Number(s.qty ?? 0),
            unit: s.unit || 'Nos',
            unit_price: Number(s.unitRate || 0),
            discount: 0,
            tax: 0,
            custom_data: {
              specification: s.specification || '',
              sampleActivity: s.sampleActivity || '',
              is_sub_activity: true,
              parent_key: r.key,
              ...(s.customFields || {}),
            },
          });
        });
    });
    return lines;
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const validItems = items.filter((r) => r.sampleActivity || r.activityId);
    if (validItems.length === 0) {
      message.error('Please add at least one item');
      return;
    }
    if (!values.customerId) {
      message.error('Please select a customer');
      return;
    }
    if (!starredTemplate?.id) {
      message.error('No starred template. Ask an admin to star a template in Report Design.');
      return;
    }

    const headerData = headerValuesFromForm(values);
    const dateIso = values.date?.toDate
      ? values.date.toDate().toISOString()
      : (values.date ? new Date(values.date).toISOString() : new Date().toISOString());

    setSaving(true);
    try {
      const payload = {
        customer_id: values.customerId,
        quotation_template_id: starredTemplate.id,
        quotation_number: headerData.reportNo || null,
        quotation_date: dateIso,
        notes: values.termsAndConditions || null,
        currency: 'INR',
        discount: 0,
        custom_data: {
          subject: values.subject || null,
          header: headerData,
          contactPerson: values.contactPerson || null,
          companyName: values.companyName || null,
          mobileNumber: values.mobileNumber || null,
          emailId: values.emailId || null,
          customerFields: serializeDynamicValues(reportCustomerFields, values),
          activityNotes: activityNotes.map((n) => n.value).filter(Boolean),
          termsAndConditions: values.termsAndConditions || null,
          termsFields: serializeDynamicValues(customTermsFields, values),
          activities: validItems.map((r) => ({
            key: r.key,
            activityId: r.activityId,
            sampleActivity: r.sampleActivity,
            description: r.description,
            specification: r.specification,
            qty: r.qty,
            unit: r.unit,
            unitRate: r.unitRate,
            customFields: r.customFields || {},
            subActivities: (r.subActivities || [])
              .filter((s) => s.sampleActivity || s.activityId)
              .map((s) => ({
                key: s.key,
                activityId: s.activityId,
                sampleActivity: s.sampleActivity,
                description: s.description,
                specification: s.specification,
                qty: s.qty,
                unit: s.unit,
                unitRate: s.unitRate,
                customFields: s.customFields || {},
              })),
          })),
        },
        items: flattenItemsForApi(validItems),
      };

      const created = await api.post('/quotations', payload).then((r) => r.data);
      message.success(`Quotation ${created.quotation_number} submitted`);
      navigate('/user/reports');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to submit quotation'));
    } finally {
      setSaving(false);
    }
  };

  const renderCustomFieldCell = (row, field, isSub, parentKey) => {
    const val = row.customFields?.[field.key] ?? '';
    if (field.type === 'number') {
      return (
        <InputNumber
          size="small"
          className="w-full"
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
          background: !isSub && activeKey === row.key ? '#f0fdfa' : undefined,
          cursor: isSub ? 'default' : 'pointer',
        }}
      >
        <td className="items-table-cell w-12 text-center text-slate-500">{siNo}</td>
        <td className="items-table-cell">
          <Select
            showSearch
            size="small"
            className="w-full"
            placeholder="Search calibration items"
            options={activityOptions}
            filterOption={(input, option) => {
              const q = String(input || '').toLowerCase();
              return (
                String(option?.label || '').toLowerCase().includes(q)
                || String(option?.code || '').toLowerCase().includes(q)
              );
            }}
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
        {activityCustomFields.map((field) => (
          <td key={field.key} className="items-table-cell">
            {renderCustomFieldCell(row, field, isSub, parentKey)}
          </td>
        ))}
        <td className="items-table-cell w-[72px]">
          <InputNumber
            min={1}
            size="small"
            className="w-full"
            placeholder="Qty"
            value={row.qty}
            onChange={(v) => (isSub
              ? setSubField(parentKey, row.key, { qty: v ?? 0 })
              : setItemField(row.key, { qty: v ?? 0 }))}
          />
        </td>
        <td className="items-table-cell w-[110px]">
          {(() => {
            const unitSelectValue = UNIT_OPTIONS.includes(row.unit) ? row.unit : 'Other';
            const setUnit = (patch) => (isSub
              ? setSubField(parentKey, row.key, patch)
              : setItemField(row.key, patch));
            return (
              <div className="flex flex-col gap-1">
                <Select
                  size="small"
                  className="w-full"
                  options={UNIT_SELECT_OPTIONS}
                  value={unitSelectValue || 'Nos'}
                  onChange={(v) => {
                    if (v === 'Other') setUnit({ unit: '' });
                    else setUnit({ unit: v });
                  }}
                />
                {unitSelectValue === 'Other' && (
                  <Input
                    size="small"
                    placeholder="Type unit"
                    value={row.unit || ''}
                    onChange={(e) => setUnit({ unit: e.target.value })}
                  />
                )}
              </div>
            );
          })()}
        </td>
        <td className="items-table-cell w-[100px]">
          <InputNumber
            min={0}
            size="small"
            className="w-full"
            placeholder="Rate"
            value={row.unitRate}
            onChange={(v) => (isSub
              ? setSubField(parentKey, row.key, { unitRate: v || 0 })
              : setItemField(row.key, { unitRate: v || 0 }))}
          />
        </td>
        <td className="items-table-cell w-[100px]">
          <Input
            size="small"
            readOnly
            placeholder="Total"
            value={total ? total.toLocaleString('en-IN') : ''}
          />
        </td>
        <td className="items-table-cell w-[96px] text-center">
          <Space size={0}>
            {!isSub && (
              <Tooltip title="Add sub activity">
                <Button
                  size="small"
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    addSubActivity(row.key);
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title={isSub ? 'Delete sub activity' : 'Delete activity'}>
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
            </Tooltip>
          </Space>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <Typography.Title level={3} className="!mb-1 !font-sans !text-teal-800">
          Generate Report
        </Typography.Title>
        <Typography.Text type="secondary">Fill in the quotation details below</Typography.Text>
      </div>

      <Card
        className="generate-report-card min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        styles={{ body: { paddingBottom: 32 } }}
      >
        <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
          <div className="mb-2 flex items-center justify-between">
            <Typography.Title level={5} className="!mb-0 !text-[15px] !font-semibold !text-slate-800">
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

          <div className="mt-4 flex items-center justify-between">
            <Typography.Title level={5} className="!mb-0 !border-b !border-slate-200 !pb-2 !text-[15px] !font-semibold !text-slate-800">
              Customer Information
            </Typography.Title>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setCustomerFieldsOpen(true)}>Add Field</Button>
          </div>

          <Row gutter={16} className="mt-2">
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
                    else {
                      form.setFieldsValue({
                        contactPerson: undefined,
                        companyName: undefined,
                        mobileNumber: undefined,
                        emailId: undefined,
                        ...Object.fromEntries(reportCustomerFields.map((f) => [f.key, undefined])),
                      });
                    }
                  }}
                  notFoundContent="No customers found — ask an admin to add customers"
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
              <Form.Item
                name="mobileNumber"
                label="Mobile Number"
                rules={phoneFieldRules({ label: 'mobile number' })}
                getValueFromEvent={(e) => digitsOnlyPhone(e.target.value)}
              >
                <Input {...phoneInputProps()} />
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

          <div className="mb-3 flex items-center justify-between">
            <Typography.Title level={5} className="!mb-0 !text-[15px] !font-semibold !text-slate-800">
              Items/Activities
            </Typography.Title>
            <Space>
              <Button icon={<PlusOutlined />} onClick={addSubActivity}>Add Sub Activity</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
            </Space>
          </div>

          <div className="mb-2 overflow-x-auto">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Sl No</th>
                  <th>Sample/Activity</th>
                  <th>Description</th>
                  <th>Specification</th>
                  {activityCustomFields.map((field) => (
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
              <tfoot>
                <tr className="items-table-total-row">
                  <td
                    className="items-table-cell font-semibold"
                    colSpan={itemsLabelColSpan}
                  >
                    Total
                  </td>
                  <td className="items-table-cell text-center font-semibold">
                    {itemsTotals.qty}
                  </td>
                  <td className="items-table-cell" />
                  <td className="items-table-cell" />
                  <td className="items-table-cell text-center font-semibold">
                    ₹{itemsTotals.cost.toLocaleString('en-IN')}
                  </td>
                  <td className="items-table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mb-3 mt-6 flex items-center justify-between gap-4">
            <Typography.Title level={5} className="!mb-0 !text-[15px] !font-semibold !text-slate-800">
              Activity Notes
            </Typography.Title>
            <Button icon={<PlusOutlined />} onClick={addNote}>Add Note</Button>
          </div>

          {activityNotes.map((note, idx) => (
            <div key={note.key} className="mb-2 flex gap-2">
              <Input
                className="flex-1"
                placeholder={idx === 0 ? 'Quoted price are per each qty / Parameter.' : 'Enter activity note'}
                value={note.value}
                onChange={(e) => updateNote(note.key, e.target.value)}
              />
              {activityNotes.length > 1 && (
                <Button danger icon={<DeleteOutlined />} onClick={() => removeNote(note.key)} />
              )}
            </div>
          ))}

          <div className="mb-3 mt-6 flex items-center justify-between gap-4">
            <Typography.Title level={5} className="!mb-0 !text-[15px] !font-semibold !text-slate-800">
              Terms &amp; Conditions
            </Typography.Title>
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

          <div className="mt-2 flex gap-3">
            <Button type="primary" size="large" icon={<SaveOutlined />} loading={saving} onClick={handleSubmit}>
              Submit Quotation
            </Button>
            <Button size="large" onClick={() => navigate('/user/reports')}>Cancel</Button>
          </div>
        </Form>
      </Card>

      <ReportAddFieldModal
        open={headerFieldsOpen}
        onClose={() => setHeaderFieldsOpen(false)}
        title="Customize Report Fields"
        fields={headerFields}
        onAdd={(field) => {
          setSchema(addSchemaField('reportHeaderFields', field));
          message.success(`Field "${field.label}" added`);
        }}
        onRemove={(key) => {
          setSchema(removeSchemaField('reportHeaderFields', key));
          message.success('Field removed');
        }}
      />

      <ReportAddFieldModal
        open={customerFieldsOpen}
        onClose={() => setCustomerFieldsOpen(false)}
        title="Customize Customer Fields"
        fields={reportCustomerFields}
        onAdd={(field) => {
          setSchema(addSchemaField('reportCustomerFields', field));
          message.success(`Field "${field.label}" added`);
        }}
        onRemove={(key) => {
          setSchema(removeSchemaField('reportCustomerFields', key));
          message.success('Field removed');
        }}
      />

      <ReportAddFieldModal
        open={termsFieldsOpen}
        onClose={() => setTermsFieldsOpen(false)}
        title="Customize Terms & Conditions"
        fields={termsFieldDefs}
        onAdd={(field) => {
          setSchema(addSchemaField('reportTermsFields', field));
          message.success(`Field "${field.label}" added`);
        }}
        onRemove={(key) => {
          setSchema(removeSchemaField('reportTermsFields', key));
          message.success('Field removed');
        }}
      />
    </div>
  );
}
