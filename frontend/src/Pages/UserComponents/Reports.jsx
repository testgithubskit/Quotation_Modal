import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Popconfirm, Space, Table, Typography, message } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import TableToolbar from '../../Components/TableToolbar';
import { recordMatchesSearch, slNoColumn } from '../../utils/tableHelpers';

function showReportDetail(report, customer, template) {
  Modal.info({
    title: report.quotation_number,
    width: 720,
    content: (
      <div className="space-y-3 text-sm">
        <div>
          <strong>Template:</strong> {template?.name || '—'}
        </div>
        <div>
          <strong>Customer:</strong> {customer?.name || '—'}
          {customer?.notes ? ` (${customer.notes})` : ''}
        </div>
        <div>
          <strong>Status:</strong> {report.status}
        </div>
        <div>
          <strong>Total:</strong> ₹{Number(report.total || 0).toLocaleString('en-IN')}
        </div>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-[#F5F5F5] text-left">
              <th className="border p-2">Description</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Rate</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {(report.items || []).map((item) => (
              <tr key={item.id}>
                <td className="border p-2">{item.description}</td>
                <td className="border p-2">{Number(item.quantity)} {item.unit}</td>
                <td className="border p-2">₹{Number(item.unit_price || 0).toLocaleString('en-IN')}</td>
                <td className="border p-2">₹{Number(item.total || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {template?.template_data?.footerText ? (
          <p className="text-gray-500">{template.template_data.footerText}</p>
        ) : null}
      </div>
    ),
  });
}

export default function Reports() {
  const [rows, setRows] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [templatesById, setTemplatesById] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const [q, c, t] = await Promise.all([
        api.get('/quotations', {
          params: { sort_by: 'created_at', sort_order: 'desc' },
        }).then((r) => r.data),
        api.get('/customers').then((r) => r.data),
        api.get('/quotation-templates').then((r) => r.data),
      ]);
      setRows(q.items || []);
      const cmap = {};
      (c.items || []).forEach((item) => {
        cmap[item.id] = item;
      });
      setCustomersById(cmap);
      const tmap = {};
      (t.items || []).forEach((item) => {
        tmap[item.id] = item;
      });
      setTemplatesById(tmap);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(
    () => rows.map((r) => ({
      ...r,
      customer_name: customersById[r.customer_id]?.name || '—',
      company_name: customersById[r.customer_id]?.notes || '—',
      template_name: r.quotation_template_id
        ? (templatesById[r.quotation_template_id]?.name || '—')
        : '—',
    })),
    [rows, customersById, templatesById],
  );

  const filtered = useMemo(
    () => enriched.filter((r) => recordMatchesSearch(r, search)),
    [enriched, search],
  );

  const remove = async (id) => {
    try {
      await api.delete(`/quotations/${id}`);
      message.success('Deleted');
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <Typography.Title level={3} className="!mb-0 !font-sans !text-teal-800">
        Reports
      </Typography.Title>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={load}
        refreshing={loading}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          scroll={{ x: 'max-content', y: 'calc(100vh - 260px)' }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
          columns={[
            slNoColumn(page, pageSize),
            { title: 'Report No.', dataIndex: 'quotation_number' },
            { title: 'Customer', dataIndex: 'customer_name' },
            { title: 'Company', dataIndex: 'company_name' },
            { title: 'Template', dataIndex: 'template_name' },
            {
              title: 'Date',
              dataIndex: 'quotation_date',
              render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—'),
            },
            { title: 'Status', dataIndex: 'status' },
            {
              title: 'Total',
              dataIndex: 'total',
              render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 100,
              render: (_, record) => (
                <Space>
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={async () => {
                      try {
                        const full = await api.get(`/quotations/${record.id}`).then((r) => r.data);
                        showReportDetail(
                          full,
                          customersById[full.customer_id],
                          templatesById[full.quotation_template_id],
                        );
                      } catch (error) {
                        message.error(getApiErrorMessage(error, 'Failed to open report'));
                      }
                    }}
                  />
                  <Popconfirm title="Delete report?" onConfirm={() => remove(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
