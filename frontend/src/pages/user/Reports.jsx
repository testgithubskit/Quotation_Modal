import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Empty, Popconfirm, message } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, BgColorsOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import TableToolbar from '../../components/TableToolbar';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';

export default function Reports() {
  const { data, loadingReports, refreshReports, deleteReport } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    refreshReports().catch(() => {});
  }, [refreshReports]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const total = (r) => (r.activities || []).reduce((sum, a) => {
    const rate = Number(a.unitRate ?? a.cost ?? 0);
    const subTotal = (a.subActivities || []).reduce(
      (s, sa) => s + Number(sa.unitRate ?? sa.cost ?? 0) * Number(sa.qty || 1),
      0,
    );
    return sum + rate * Number(a.qty || 1) + subTotal;
  }, 0);

  const customerName = (c) => {
    if (!c) return '—';
    if (c.details) return c.details.split('\n')[0];
    if (c.name) return `${c.name}${c.company ? ` — ${c.company}` : ''}`;
    return '—';
  };

  const rows = useMemo(
    () => (data.reports || []).map((r) => ({
      ...r,
      customerLabel: customerName(r.customer),
      totalAmount: total(r),
      center: r.center || r.centre || '',
    })),
    [data.reports],
  );

  const filtered = useMemo(
    () => rows.filter((row) => recordMatchesSearch(row, search, [
      'reportNo', 'customerLabel', 'center', 'lab', 'date', 'totalAmount', 'status',
    ])),
    [rows, search],
  );

  const columns = useMemo(() => enhanceColumns([
    serialNoColumn(page, pageSize),
    { title: 'Report No.', dataIndex: 'reportNo', width: 130 },
    { title: 'Customer', dataIndex: 'customerLabel' },
    { title: 'Center', dataIndex: 'center' },
    { title: 'Lab', dataIndex: 'lab' },
    { title: 'Date', dataIndex: 'date', width: 110 },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      width: 120,
      render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Actions',
      width: 150,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/user/reports/${r.id}/view`)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/user/reports/${r.id}/edit`)} />
          <Popconfirm
            title="Delete this report?"
            onConfirm={async () => {
              try {
                await deleteReport(r.id);
                message.success('Report deleted');
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
  ], { totalAmount: 'number' }), [navigate, deleteReport, page, pageSize]);

  return (
    <div>
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reports by any field…"
        onRefresh={() => refreshReports()}
        refreshing={loadingReports}
        actions={(
          <Button icon={<BgColorsOutlined />} onClick={() => navigate('/user/templates')}>
            Design Template
          </Button>
        )}
        addButton={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/user/generate')}>
            Generate Report
          </Button>
        )}
      />

      <div className="card-shell">
        {filtered.length === 0 ? (
          <div style={{ padding: 48 }}>
            <Empty description={search ? 'No reports match your search' : 'No reports generated yet'}>
              {!search ? (
                <Button type="primary" onClick={() => navigate('/user/generate')}>
                  Generate your first report
                </Button>
              ) : null}
            </Empty>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            loading={loadingReports}
            pagination={tablePagination({
              current: page,
              pageSize,
              onChange: (nextPage, nextSize) => {
                setPage(nextPage);
                setPageSize(nextSize);
              },
            })}
          />
        )}
      </div>
    </div>
  );
}
