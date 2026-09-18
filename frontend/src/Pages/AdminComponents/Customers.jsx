import { useEffect, useMemo, useState } from 'react';
import {
  Button, Dropdown, Form, Input, Modal, Popconfirm, Space, Table, Tooltip, Upload, message,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DownloadOutlined, ColumnHeightOutlined,
  EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { useAuth } from '../../config/AuthContext.jsx';
import TableToolbar from '../../Components/TableToolbar';
import ManageColumnsModal from '../../Components/ManageColumnsModal';
import BulkReviewModal from '../../Components/BulkReviewModal';
import { slugCode, slNoColumn, recordMatchesSearch } from '../../utils/tableHelpers';
import { datedFilename, downloadReportExcel, downloadReportPdf, parseSpreadsheetFile } from '../../utils/spreadsheet';

function pick(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function toExportRows(items, customFields) {
  return items.map((r) => {
    const row = {
      'Customer Name': r.name,
      'Company Name': r.notes || '',
      Email: r.email || '',
      Phone: r.phone || '',
      Address: r.address || '',
    };
    customFields.forEach((f) => {
      row[f.field_label] = r.custom_data?.[f.field_key] ?? '';
    });
    return row;
  });
}

function mapSheetToPreview(rawRows, customFields) {
  return rawRows.map((row, index) => {
    const mapped = {
      _key: `cust-${index}`,
      name: String(pick(row, 'name', 'Name', 'Customer Name')).trim(),
      company: String(pick(row, 'company', 'Company', 'Company Name', 'notes')).trim(),
      email: String(pick(row, 'email', 'Email')).trim(),
      phone: String(pick(row, 'phone', 'Phone')).trim(),
      address: String(pick(row, 'address', 'Address')).trim(),
    };
    customFields.forEach((f) => {
      mapped[f.field_key] = pick(row, f.field_label, f.field_key);
    });
    return mapped;
  }).filter((r) => r.name);
}

export default function Customers() {
  const { user } = useAuth();
  const orgName = user?.organization_name || 'Organization';
  const [allRows, setAllRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [form] = Form.useForm();

  const customFields = useMemo(
    () => fields.filter((f) => f.entity_type === 'CUSTOMER'),
    [fields],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [customers, custom] = await Promise.all([
        api.get('/customers').then((r) => r.data),
        api.get('/custom-fields', { params: { entity_type: 'CUSTOMER' } }).then((r) => r.data),
      ]);
      setAllRows(customers.items || []);
      setFields(custom.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load customers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [customers, custom] = await Promise.all([
          api.get('/customers').then((r) => r.data),
          api.get('/custom-fields', { params: { entity_type: 'CUSTOMER' } }).then((r) => r.data),
        ]);
        if (cancelled) return;
        setAllRows(customers.items || []);
        setFields(custom.items || []);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load customers'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => allRows.filter((r) => recordMatchesSearch(r, search)),
    [allRows, search],
  );
  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const setField = (key, value) => setDraft((s) => ({ ...s, [key]: value }));

  const startEdit = (record) => {
    setEditingId(record.id);
    setDraft({
      name: record.name || '',
      company: record.notes || '',
      email: record.email || '',
      phone: record.phone || '',
      address: record.address || '',
      ...(record.custom_data || {}),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async (record) => {
    const name = String(draft.name || '').trim();
    const company = String(draft.company || '').trim();
    if (!name) {
      message.error('Customer name is required');
      return;
    }
    if (!company) {
      message.error('Company name is required');
      return;
    }
    const custom_data = {};
    for (const f of customFields) {
      const val = draft[f.field_key];
      if (f.is_required && (val == null || val === '')) {
        message.error(`${f.field_label} is required`);
        return;
      }
      if (val != null && val !== '') custom_data[f.field_key] = val;
    }
    try {
      await api.put(`/customers/${record.id}`, {
        name,
        notes: company || null,
        email: draft.email || null,
        phone: draft.phone || null,
        address: draft.address || null,
        custom_data,
      });
      message.success('Customer updated');
      cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Update failed'));
    }
  };

  const create = async () => {
    const values = await form.validateFields();
    const custom_data = {};
    customFields.forEach((f) => {
      if (values[f.field_key] != null && values[f.field_key] !== '') {
        custom_data[f.field_key] = values[f.field_key];
      }
    });
    try {
      await api.post('/customers', {
        customer_code: slugCode(values.name, 'CUST'),
        name: values.name.trim(),
        notes: values.company?.trim() || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        is_active: true,
        custom_data,
      });
      message.success('Customer created');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success('Deleted');
      if (editingId === id) cancelEdit();
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const onBulkUpload = async (file) => {
    try {
      const parsed = await parseSpreadsheetFile(file);
      const mapped = mapSheetToPreview(parsed, customFields);
      if (!mapped.length) {
        message.error('No valid customer rows found (need Customer Name)');
        return false;
      }
      setPreviewRows(mapped);
      setReviewOpen(true);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to read file'));
    }
    return false;
  };

  const bulkCreate = async (selected) => {
    let created = 0;
    try {
      for (const row of selected) {
        const custom_data = {};
        customFields.forEach((f) => {
          const val = row[f.field_key];
          if (val != null && val !== '') custom_data[f.field_key] = val;
        });
        const name = String(row.name || '').trim();
        await api.post('/customers', {
          customer_code: `${slugCode(name, 'CUST')}-${Date.now()}-${created}`.slice(0, 50),
          name,
          notes: row.company || null,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          is_active: true,
          custom_data,
        });
        created += 1;
      }
      message.success(`Created ${created} customer(s)`);
      setReviewOpen(false);
      setPreviewRows([]);
      setPage(1);
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, `Bulk create stopped after ${created}`));
    }
  };

  const exportRows = () => toExportRows(filtered, customFields);

  const reviewColumns = useMemo(() => [
    { key: 'name', title: 'Customer Name', required: true, width: 160 },
    { key: 'company', title: 'Company Name', required: true, width: 160 },
    { key: 'email', title: 'Email', width: 160 },
    { key: 'phone', title: 'Phone', width: 120 },
    { key: 'address', title: 'Address', width: 180 },
    ...customFields.map((f) => ({
      key: f.field_key,
      title: f.field_label,
      required: Boolean(f.is_required),
      width: 140,
    })),
  ], [customFields]);

  const columns = [
    slNoColumn(page, pageSize),
    {
      title: 'Customer Name',
      dataIndex: 'name',
      fixed: 'left',
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.name} onChange={(e) => setField('name', e.target.value)} />
          : v
      ),
    },
    {
      title: 'Company Name',
      dataIndex: 'notes',
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.company} onChange={(e) => setField('company', e.target.value)} />
          : (v || '—')
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.email} onChange={(e) => setField('email', e.target.value)} />
          : (v || '—')
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      render: (v, record) => (
        editingId === record.id
          ? <Input value={draft.phone} onChange={(e) => setField('phone', e.target.value)} />
          : (v || '—')
      ),
    },
    ...customFields.map((f) => ({
      title: (
        <span>
          {f.field_label}
          {f.is_required ? <span className="text-red-500"> *</span> : null}
        </span>
      ),
      key: f.field_key,
      render: (_, record) => (
        editingId === record.id
          ? (
            <Input
              value={draft[f.field_key] ?? ''}
              onChange={(e) => setField(f.field_key, e.target.value)}
            />
          )
          : (record.custom_data?.[f.field_key] ?? '—')
      ),
    })),
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        editingId === record.id
          ? (
            <Space>
              <Tooltip title="Save"><Button type="text" icon={<CheckOutlined />} onClick={() => saveEdit(record)} /></Tooltip>
              <Tooltip title="Cancel"><Button type="text" icon={<CloseOutlined />} onClick={cancelEdit} /></Tooltip>
            </Space>
          )
          : (
            <Space>
              <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} onClick={() => startEdit(record)} /></Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete customer?" onConfirm={() => remove(record.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            </Space>
          )
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <TableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onRefresh={load}
        refreshing={loading}
        actions={(
          <>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnOpen(true)}>
              Columns
            </Button>
            <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={onBulkUpload}>
              <Button icon={<UploadOutlined />}>Bulk upload</Button>
            </Upload>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined />,
                    label: 'Download as Excel',
                    onClick: () => downloadReportExcel(
                      exportRows(),
                      datedFilename('customers', 'xls'),
                      { organizationName: orgName, title: 'Customers Report' },
                    ),
                  },
                  {
                    key: 'pdf',
                    icon: <FilePdfOutlined />,
                    label: 'Download as PDF',
                    onClick: () => downloadReportPdf(
                      exportRows(),
                      datedFilename('customers', 'pdf'),
                      { organizationName: orgName, title: 'Customers Report' },
                    ),
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Download</Button>
            </Dropdown>
          </>
        )}
        addButton={(
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            Add customer
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={paged}
          scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t) => `${t} customers`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
              cancelEdit();
            },
          }}
        />
      </div>

      <Modal
        title="Add customer"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        okText="Save"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Customer Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label="Company Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          {customFields.map((f) => (
            <Form.Item
              key={f.field_key}
              name={f.field_key}
              label={f.field_label}
              rules={f.is_required ? [{ required: true, message: `${f.field_label} is required` }] : undefined}
            >
              <Input />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <BulkReviewModal
        open={reviewOpen}
        onClose={() => {
          setReviewOpen(false);
          setPreviewRows([]);
        }}
        title="Review Extracted Customers"
        columns={reviewColumns}
        rows={previewRows}
        entityLabel="customers"
        confirmLabel="Bulk Create"
        onConfirm={bulkCreate}
      />

      <ManageColumnsModal
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        entityType="CUSTOMER"
        fields={customFields}
        onChanged={load}
      />
    </div>
  );
}
