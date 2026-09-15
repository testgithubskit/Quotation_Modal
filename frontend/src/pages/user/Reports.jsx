import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Empty, Popconfirm, message } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, BgColorsOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import TableToolbar from '../../components/TableToolbar';
import { resolveReportNo } from '../../components/ReportDocument';
import { enhanceColumns, recordMatchesSearch, serialNoColumn, tablePagination } from '../../utils/tableHelpers';
import { useTableScrollY } from '../../hooks/useTableScrollY';

export default function Reports() {
  const { data, loadingReports, refreshReports, deleteReport } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableScroll = useTableScrollY();

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
    if (c.name) return c.name;
    if (c.details) return c.details.split('\n')[0] || '—';
    return '—';
  };

  const customerCompany = (c) => {
    if (!c) return '—';
    if (c.company) return c.company;
    const lines = String(c.details || '').split('\n').map((s) => s.trim()).filter(Boolean);
    return lines[1] || '—';
  };

  const rows = useMemo(
    () => (data.reports || []).map((r) => ({
      ...r,
      reportNo: resolveReportNo(r),
      customerLabel: customerName(r.customer),
      companyLabel: customerCompany(r.customer),
      totalAmount: total(r),
    })),
    [data.reports],
  );

  const filtered = useMemo(
    () => rows.filter((row) => recordMatchesSearch(row, search, [
      'reportNo', 'customerLabel', 'companyLabel', 'date', 'totalAmount', 'status',
    ])),
    [rows, search],
  );

  const columns = useMemo(() => enhanceColumns([
    serialNoColumn(page, pageSize),
    {
      title: 'Report No.',
      dataIndex: 'reportNo',
      width: 130,
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Customer',
      dataIndex: 'customerLabel',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Company Name',
      dataIndex: 'companyLabel',
      width: 180,
      ellipsis: true,
      render: (v) => v || '—',
    },
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
    <div className="table-page">
      <div className="table-page-toolbar">
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
      </div>

      <div className="table-card" ref={tableScroll.containerRef}>
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
            tableLayout="fixed"
            scroll={{ y: tableScroll.scrollY }}
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
