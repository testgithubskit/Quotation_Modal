import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Modal, Form, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ColumnHeightOutlined } from '@ant-design/icons';
import { useData } from '../../store/DataContext';
import AddColumnModal from '../../components/AddColumnModal';
import TableToolbar from '../../components/TableToolbar';
import { DynamicFormField } from '../../components/DynamicFormField';
import { formatFieldValue } from '../../utils/fieldSchema';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';
import { useTableScrollY } from '../../hooks/useTableScrollY';

export default function Customers() {
  const {
    data, loadingCustomers, refreshCustomers, refreshCustomFields,
    addCustomer, updateCustomer, deleteCustomer,
    addCustomerField, removeCustomerField,
  } = useData();
  const [open, setOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableScroll = useTableScrollY();

  useEffect(() => {
    refreshCustomers().catch(() => {});
    refreshCustomFields().catch(() => {});
  }, [refreshCustomers, refreshCustomFields]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const fieldDefs = data.schema.customerFields;
  const requiredKeys = ['name', 'company', 'address', 'email', 'mobile'];
  const searchKeys = useMemo(() => fieldDefs.map((f) => f.key), [fieldDefs]);

  const filtered = useMemo(
    () => (data.customers || []).filter((row) => recordMatchesSearch(row, search, searchKeys)),
    [data.customers, search, searchKeys],
  );

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateCustomer(editing.id, values);
        message.success('Customer updated');
      } else {
        await addCustomer(values);
        message.success('Customer added');
      }
      setOpen(false);
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || error.message || 'Failed to save customer');
    }
  };

  const fieldTypeByKey = useMemo(
    () => Object.fromEntries(fieldDefs.map((f) => [f.key, f.type])),
    [fieldDefs],
  );

  const columns = useMemo(() => enhanceColumns([
    serialNoColumn(page, pageSize),
    ...fieldDefs.map((field) => ({
      title: field.label,
      dataIndex: field.key,
      ellipsis: field.type === 'textarea' || field.key === 'address',
      width: field.key === 'mobile' ? 130 : undefined,
      render: (v) => formatFieldValue(field, v),
    })),
    {
      title: 'Actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Delete this customer?"
            onConfirm={async () => {
              try {
                await deleteCustomer(record.id);
                message.success('Customer deleted');
              } catch (error) {
                message.error(error?.response?.data?.error?.detail || 'Failed to delete');
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], fieldTypeByKey), [fieldDefs, fieldTypeByKey, page, pageSize]);

  return (
    <div className="table-page">
      <div className="table-page-toolbar">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search customers by any field…"
          onRefresh={() => refreshCustomers()}
          refreshing={loadingCustomers}
          actions={(
            <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnsOpen(true)}>
              Add Column
            </Button>
          )}
          addButton={(
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Add Customer
            </Button>
          )}
        />
      </div>

      <div className="table-card" ref={tableScroll.containerRef}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loadingCustomers}
          scroll={{ x: 'max-content', y: tableScroll.scrollY }}
          pagination={tablePagination({
            current: page,
            pageSize,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          })}
        />
      </div>

      <Modal
        title={editing ? 'Edit Customer' : 'Add Customer'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        okText={editing ? 'Save Changes' : 'Add Customer'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {fieldDefs.map((field) => (
            <DynamicFormField
              key={field.key}
              field={{
                ...field,
                required: requiredKeys.includes(field.key),
                ...(field.key === 'email' ? { type: 'email' } : {}),
              }}
            />
          ))}
        </Form>
      </Modal>

      <AddColumnModal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Customize Customer Columns"
        fields={fieldDefs}
        onAdd={async (field) => {
          try {
            await addCustomerField(field);
            message.success(`Column "${field.label}" added`);
          } catch (error) {
            message.error(error?.response?.data?.error?.detail || 'Failed to add column');
          }
        }}
        onRemove={async (key) => {
          try {
            await removeCustomerField(key);
            message.success('Column removed');
          } catch (error) {
            message.error(error?.response?.data?.error?.detail || 'Failed to remove column');
          }
        }}
      />
    </div>
  );
}
