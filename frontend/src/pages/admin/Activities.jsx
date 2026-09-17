import { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Space, Modal, Form, Input, InputNumber,
  Upload, message, Popconfirm, Tag, Checkbox, Dropdown,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DeleteOutlined, EditOutlined,
  InboxOutlined, ColumnHeightOutlined, FileTextOutlined,
  ThunderboltOutlined, CloseOutlined, DownloadOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useData } from '../../store/DataContext';
import AddColumnModal from '../../components/AddColumnModal';
import TableToolbar from '../../components/TableToolbar';
import { DynamicFormField } from '../../components/DynamicFormField';
import { formatFieldValue } from '../../utils/fieldSchema';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';
import { useTableScrollY } from '../../hooks/useTableScrollY';
import { mapRowsToActivities, parseSpreadsheetFile } from '../../utils/spreadsheet';
import { downloadTableExcel, downloadTablePdf } from '../../utils/tableExport';
import { palette } from '../../theme';

const { Dragger } = Upload;

let bulkUid = 0;
const nextBulkKey = () => `bulk-${Date.now()}-${bulkUid++}`;

function emptyBulkRow(fieldDefs = []) {
  const row = {
    _key: nextBulkKey(),
    code: '',
    specification: '',
    particulars: '',
    cost: 0,
  };
  fieldDefs.forEach((f) => {
    if (row[f.key] === undefined) row[f.key] = f.type === 'number' ? 0 : '';
  });
  return row;
}

export default function Activities() {
  const {
    data, loadingActivities, refreshActivities, refreshCustomFields,
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
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableScroll = useTableScrollY(72, [pageSize, data.activities?.length]);

  useEffect(() => {
    refreshActivities().catch(() => {});
    refreshCustomFields().catch(() => {});
  }, [refreshActivities, refreshCustomFields]);

  useEffect(() => {
    setPage(1);
  }, [search]);

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

  const resetBulk = () => {
    setBulkRows([]);
    setSelectedKeys([]);
  };

  const closeBulk = () => {
    setBulkOpen(false);
    resetBulk();
  };

  const handleFile = async (file) => {
    setParsing(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      const mapped = mapRowsToActivities(rows, fieldDefs).map((row) => ({
        ...row,
        _key: nextBulkKey(),
      }));
      setBulkRows(mapped);
      setSelectedKeys(mapped.map((r) => r._key));
      if (mapped.length === 0) {
        message.warning('No activity rows found. Check that the sheet has headers like Sl.No, Particulars, Specifications, Charges.');
      } else {
        message.success(`${mapped.length} rows extracted`);
      }
    } catch (error) {
      resetBulk();
      message.error(error?.message || 'Could not read file');
    } finally {
      setParsing(false);
    }
    return false;
  };

  const patchBulkRow = (key, field, value) => {
    setBulkRows((prev) => prev.map((row) => (
      row._key === key ? { ...row, [field]: value } : row
    )));
  };

  const removeBulkRow = (key) => {
    setBulkRows((prev) => prev.filter((row) => row._key !== key));
    setSelectedKeys((prev) => prev.filter((k) => k !== key));
  };

  const addBlankBulkRow = () => {
    const row = emptyBulkRow(fieldDefs);
    setBulkRows((prev) => [...prev, row]);
    setSelectedKeys((prev) => [...prev, row._key]);
  };

  const handleBulkCreate = async () => {
    const selected = bulkRows.filter((r) => selectedKeys.includes(r._key));
    if (selected.length === 0) {
      message.warning('Select at least one row to create');
      return;
    }
    setCreating(true);
    try {
      const payload = selected.map(({ _key, ...rest }) => rest);
      await addActivitiesBulk(payload);
      message.success(`${payload.length} activities added`);
      closeBulk();
    } catch (error) {
      message.error(error?.response?.data?.error?.detail || 'Bulk upload failed');
    } finally {
      setCreating(false);
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
  ], fieldTypeByKey), [fieldDefs, fieldTypeByKey, page, pageSize]);

  const reviewColumns = useMemo(() => [
    {
      title: (
        <Checkbox
          checked={bulkRows.length > 0 && selectedKeys.length === bulkRows.length}
          indeterminate={selectedKeys.length > 0 && selectedKeys.length < bulkRows.length}
          onChange={(e) => {
            setSelectedKeys(e.target.checked ? bulkRows.map((r) => r._key) : []);
          }}
        />
      ),
      width: 48,
      fixed: 'left',
      render: (_, record) => (
        <Checkbox
          checked={selectedKeys.includes(record._key)}
          onChange={(e) => {
            setSelectedKeys((prev) => (
              e.target.checked
                ? [...prev, record._key]
                : prev.filter((k) => k !== record._key)
            ));
          }}
        />
      ),
    },
    ...fieldDefs.map((field) => ({
      title: field.label.toUpperCase(),
      dataIndex: field.key,
      width: field.key === 'code' ? 120
        : field.key === 'cost' || field.type === 'number' ? 110
          : field.key === 'particulars' || field.type === 'textarea' ? 220
            : 160,
      render: (value, record) => {
        if (field.type === 'number' || field.key === 'cost') {
          return (
            <InputNumber
              size="small"
              min={0}
              value={Number(value || 0)}
              style={{ width: '100%' }}
              onChange={(v) => patchBulkRow(record._key, field.key, Number(v || 0))}
            />
          );
        }
        return (
          <Input
            size="small"
            value={value ?? ''}
            onChange={(e) => patchBulkRow(record._key, field.key, e.target.value)}
          />
        );
      },
    })),
    {
      title: '',
      width: 52,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeBulkRow(record._key)}
        />
      ),
    },
  ], [fieldDefs, bulkRows, selectedKeys]);

  const handleDownload = ({ key }) => {
    const rows = filtered;
    if (!rows.length) {
      message.warning('No activities to download');
      return;
    }
    try {
      if (key === 'excel') {
        downloadTableExcel({
          rows,
          fieldDefs,
          fileName: `activities-${new Date().toISOString().slice(0, 10)}`,
        });
        message.success('Excel downloaded');
      } else if (key === 'pdf') {
        downloadTablePdf({
          rows,
          fieldDefs,
          title: 'Activities',
          fileName: `activities-${new Date().toISOString().slice(0, 10)}`,
        });
      }
    } catch (error) {
      message.error(error?.message || 'Download failed');
    }
  };

  const reviewMode = bulkRows.length > 0;

  return (
    <div className="table-page">
      <div className="table-page-toolbar">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search activities by any field…"
          onRefresh={() => refreshActivities()}
          refreshing={loadingActivities}
          actions={(
            <>
              <Dropdown
                menu={{
                  items: [
                    { key: 'excel', icon: <FileExcelOutlined />, label: 'Download Excel' },
                    { key: 'pdf', icon: <FilePdfOutlined />, label: 'Download PDF' },
                  ],
                  onClick: handleDownload,
                }}
              >
                <Button icon={<DownloadOutlined />}>Download</Button>
              </Dropdown>
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
      </div>

      <div className="table-card" ref={tableScroll.containerRef}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loadingActivities}
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
        open={bulkOpen}
        onCancel={closeBulk}
        footer={null}
        width={reviewMode ? 1100 : 560}
        destroyOnClose
        closable={false}
        className="bulk-review-modal"
        styles={{ body: { padding: 0 } }}
      >
        {!reviewMode ? (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  <FileTextOutlined style={{ marginRight: 8, color: palette.navy }} />
                  Upload Bulk Activities
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Upload Excel or CSV. Headers like <Tag>Sl.No</Tag><Tag>Particulars</Tag>
                  <Tag>Specifications</Tag><Tag>Proposed Charges</Tag> map automatically.
                  Custom columns are filled when the Excel header matches the column name.
                </Typography.Paragraph>
              </div>
              <Button type="text" icon={<CloseOutlined />} onClick={closeBulk} />
            </div>
            <Dragger
              accept=".csv,.xlsx,.xls"
              maxCount={1}
              beforeUpload={handleFile}
              disabled={parsing}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>Click or drag Excel / CSV file to this area</p>
              <p className="ant-upload-hint">
                {parsing ? 'Extracting rows…' : 'Supports .xlsx, .xls, and .csv — including CMNTM metrology price lists'}
              </p>
            </Dragger>
          </div>
        ) : (
          <div className="bulk-review">
            <div className="bulk-review-header">
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  <FileTextOutlined style={{ marginRight: 8, color: palette.navy }} />
                  Review Extracted Activities
                </Typography.Title>
                <Space size={8} style={{ marginTop: 10 }} wrap>
                  <Tag color="blue">{bulkRows.length} rows extracted</Tag>
                  <Tag color="purple" icon={<ThunderboltOutlined />}>
                    Bulk create — {selectedKeys.length} selected
                  </Tag>
                </Space>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Button type="text" icon={<CloseOutlined />} onClick={closeBulk} />
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  Click any cell to edit · Select rows to create
                </Typography.Text>
              </div>
            </div>

            <div className="bulk-review-table">
              <Table
                size="small"
                rowKey="_key"
                columns={reviewColumns}
                dataSource={bulkRows}
                pagination={false}
                scroll={{ x: 'max-content', y: 420 }}
                rowClassName={(record) => (
                  selectedKeys.includes(record._key) ? 'bulk-review-row-selected' : ''
                )}
              />
            </div>

            <div className="bulk-review-footer">
              <Space>
                <Button onClick={resetBulk}>← Re-upload</Button>
                <Button icon={<PlusOutlined />} onClick={addBlankBulkRow}>Add Activity</Button>
              </Space>
              <Typography.Text type="secondary">
                {selectedKeys.length} row(s) selected for creation
              </Typography.Text>
              <Space>
                <Button onClick={closeBulk}>Close</Button>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={creating}
                  disabled={selectedKeys.length === 0}
                  onClick={handleBulkCreate}
                >
                  Bulk Create {selectedKeys.length} Activities
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
