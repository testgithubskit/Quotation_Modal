import { useMemo, useState } from 'react';
import {
  Table, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Upload, message, Popconfirm, Tag,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined,
  InboxOutlined, ColumnHeightOutlined,
} from '@ant-design/icons';
import { useData } from '../../store/DataContext';
import AddColumnModal from '../../components/AddColumnModal';
import TableToolbar from '../../components/TableToolbar';
import { DynamicFormField } from '../../components/DynamicFormField';
import { formatFieldValue } from '../../utils/fieldSchema';
import { enhanceColumns, recordMatchesSearch } from '../../utils/tableHelpers';
import { mapRowsToActivities, parseSpreadsheetFile } from '../../utils/spreadsheet';

const { Dragger } = Upload;

export default function Activities() {
  const {
    data, loading, refresh,
    addActivity, addActivitiesBulk, updateActivity, deleteActivity,
    addActivityField, removeActivityField,
  } = useData();
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();
  const [bulkRows, setBulkRows] = useState([]);
  const [parsing, setParsing] = useState(false);

  const fieldDefs = data.schema.activityFields;
  const searchKeys = useMemo(() => fieldDefs.map((f) => f.key), [fieldDefs]);

  const filtered = useMemo(
    () => (data.activities || []).filter((row) => recordMatchesSearch(row, search, searchKeys)),
    [data.activities, search, searchKeys],
  );

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setAddOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
    setAddOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateActivity(editing.id, values);
        message.success('Activity updated');
      } else {
        await addActivity(values);
        message.success('Activity added');
      }
      setAddOpen(false);
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || error.message || 'Failed to save activity');
    }
  };

  const handleFile = async (file) => {
    setParsing(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      const mapped = mapRowsToActivities(rows);
      setBulkRows(mapped);
      message.info(`${mapped.length} rows detected`);
    } catch (error) {
      setBulkRows([]);
      message.error(error?.message || 'Could not read file');
    } finally {
      setParsing(false);
    }
    return false;
  };

  const fieldTypeByKey = useMemo(
    () => Object.fromEntries(fieldDefs.map((f) => [f.key, f.type])),
    [fieldDefs],
  );

  const columns = useMemo(() => enhanceColumns([
    {
      title: 'Sl.No',
      width: 70,
      render: (_, __, i) => i + 1,
    },
    ...fieldDefs.map((field) => ({
      title: field.label,
      dataIndex: field.key,
      ellipsis: field.type === 'textarea',
      width: field.key === 'code' ? 140 : field.type === 'number' ? 120 : undefined,
      render: (v) => {
        if (field.key === 'cost') return `₹${Number(v || 0).toLocaleString('en-IN')}`;
        return formatFieldValue(field, v);
      },
    })),
    {
      title: 'Actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Delete this activity?"
            onConfirm={async () => {
              try {
                await deleteActivity(record.id);
                message.success('Activity deleted');
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
  ], fieldTypeByKey), [fieldDefs, fieldTypeByKey]);

  return (
    <div>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search activities by any field…"
        onRefresh={() => refresh()}
        refreshing={loading}
        actions={(
          <>
            <Button icon={<ColumnHeightOutlined />} onClick={() => setColumnsOpen(true)}>
              Add Column
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setBulkOpen(true)}>
              Upload Bulk
            </Button>
          </>
        )}
        addButton={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Activity
          </Button>
        )}
      />

      <div className="card-shell">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (t) => `${t} activities` }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Activity' : 'Add Activity'}
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleSave}
        okText={editing ? 'Save Changes' : 'Add Activity'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {fieldDefs.map((field) => (
            field.key === 'cost' ? (
              <Form.Item
                key={field.key}
                name={field.key}
                label={field.label}
                rules={[{ required: true, message: 'Enter the cost' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            ) : (
              <DynamicFormField
                key={field.key}
                field={{ ...field, required: ['code', 'specification', 'particulars', 'cost'].includes(field.key) }}
              />
            )
          ))}
        </Form>
      </Modal>

      <AddColumnModal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Customize Activity Columns"
        fields={fieldDefs}
        onAdd={async (field) => {
          try {
            await addActivityField(field);
            message.success(`Column "${field.label}" added`);
          } catch (error) {
            message.error(error?.response?.data?.error?.detail || 'Failed to add column');
          }
        }}
        onRemove={async (key) => {
          try {
            await removeActivityField(key);
            message.success('Column removed');
          } catch (error) {
            message.error(error?.response?.data?.error?.detail || 'Failed to remove column');
          }
        }}
      />

      <Modal
        title="Upload Bulk Activities"
        open={bulkOpen}
        onCancel={() => { setBulkOpen(false); setBulkRows([]); }}
        onOk={async () => {
          if (bulkRows.length === 0) { message.warning('No valid rows found in file'); return; }
          try {
            await addActivitiesBulk(bulkRows);
            message.success(`${bulkRows.length} activities added`);
            setBulkOpen(false);
            setBulkRows([]);
          } catch (error) {
            message.error(error?.response?.data?.error?.detail || 'Bulk upload failed');
          }
        }}
        okText={`Add ${bulkRows.length || ''} Activities`.trim()}
        okButtonProps={{ disabled: bulkRows.length === 0 || parsing }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Upload Excel or CSV with columns:{' '}
          <Tag>code</Tag><Tag>specification</Tag><Tag>particulars</Tag><Tag>cost</Tag>
        </Typography.Paragraph>
        <Dragger
          accept=".csv,.xlsx,.xls"
          maxCount={1}
          beforeUpload={handleFile}
          onRemove={() => setBulkRows([])}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Click or drag Excel / CSV file to this area</p>
          <p className="ant-upload-hint">Supports .xlsx, .xls, and .csv</p>
        </Dragger>
        {bulkRows.length > 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Preview: {bulkRows.length} activities ready to import
          </Typography.Text>
        ) : null}
      </Modal>
    </div>
  );
}
