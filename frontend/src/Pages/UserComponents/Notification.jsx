import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Space, Table, Tooltip, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../config/auth.js';
import { recordMatchesSearch, slNoColumn } from '../../utils/tableHelpers';

const REPORTS_PATH = '/user/reports';

function workflowStatusLabel(status) {
  if (status === 'ACCEPTED') return 'Accepted';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'SENT') return 'Pending';
  return status || '—';
}

function formatReviewedAt(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY, hh:mm A') : '';
}

function NotificationStatusCell({ status, reviewedAt }) {
  const label = workflowStatusLabel(status);
  const showReviewTime = (status === 'ACCEPTED' || status === 'REJECTED') && reviewedAt;
  const labelClass = status === 'ACCEPTED'
    ? 'font-semibold text-green-600'
    : status === 'REJECTED'
      ? 'font-semibold text-red-600'
      : status === 'SENT'
        ? 'font-medium text-blue-600'
        : 'text-slate-700';

  return (
    <div className="text-center leading-snug">
      <div className={labelClass}>{label}</div>
      {showReviewTime ? (
        <div className="mt-0.5 text-xs text-slate-400">{formatReviewedAt(reviewedAt)}</div>
      ) : null}
    </div>
  );
}

function AcknowledgeCell({ acknowledgedAt, onAcknowledge, notificationId }) {
  if (acknowledgedAt) {
    const d = dayjs(acknowledgedAt);
    return (
      <div className="text-center leading-snug">
        <div className="font-semibold text-green-600">Acknowledged</div>
        {d.isValid() ? (
          <div className="mt-0.5 text-xs text-slate-400">{d.format('DD/MM/YYYY, HH:mm:ss')}</div>
        ) : null}
      </div>
    );
  }
  return (
    <Button size="small" type="primary" ghost onClick={() => onAcknowledge([notificationId])}>
      Acknowledge
    </Button>
  );
}

const NOTIFICATION_SEARCH_KEYS = [
  'quotation_number',
  'customer_name',
  'review_remark',
  'message',
  (r) => workflowStatusLabel(r.quotation_status),
  (r) => (r.submitted_at ? dayjs(r.submitted_at).format('DD MMM YYYY, HH:mm:ss') : ''),
  (r) => (r.reviewed_at ? formatReviewedAt(r.reviewed_at) : ''),
  (r) => (r.acknowledged_at ? dayjs(r.acknowledged_at).format('DD/MM/YYYY, HH:mm:ss') : ''),
  (r) => (r.acknowledged_at ? 'Acknowledged' : 'Acknowledge'),
];

export default function Notification() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', {
        params: { page: 1, page_size: 200 },
      });
      setRows(data?.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, customerFilter]);

  const acknowledge = useCallback(async (ids) => {
    if (!ids?.length) return;
    try {
      await api.post('/notifications/acknowledge', { ids });
      message.success('Acknowledged');
      setSelected([]);
      await load();
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Acknowledge failed'));
    }
  }, [load]);

  const customerOptions = useMemo(() => {
    const names = new Set();
    rows.forEach((r) => {
      const name = (r.customer_name || '').trim();
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({
      label: name,
      value: name,
    }));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (customerFilter.length) {
      const set = new Set(customerFilter);
      list = list.filter((r) => set.has(r.customer_name));
    }
    if (search.trim()) {
      list = list.filter((r) => recordMatchesSearch(r, search, NOTIFICATION_SEARCH_KEYS));
    }
    return list;
  }, [rows, search, customerFilter]);

  const columns = useMemo(() => [
    slNoColumn(page, pageSize),
    {
      title: 'Report No',
      dataIndex: 'quotation_number',
      render: (v, r) => (
        <button
          type="button"
          className="text-teal-700 hover:underline"
          onClick={() => navigate(REPORTS_PATH, { state: { focusQuotationId: r.quotation_id } })}
        >
          {v || '—'}
        </button>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      render: (v) => v || '—',
    },
    {
      title: 'Submitted at',
      dataIndex: 'submitted_at',
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY, HH:mm:ss') : '—'),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      align: 'center',
      render: (_, r) => (
        <NotificationStatusCell status={r.quotation_status} reviewedAt={r.reviewed_at} />
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'review_remark',
      ellipsis: true,
      render: (v) => (v ? <span title={v}>{v}</span> : '—'),
    },
    {
      title: 'Acknowledge',
      key: 'ack',
      width: 160,
      align: 'center',
      render: (_, r) => (
        <AcknowledgeCell
          acknowledgedAt={r.acknowledged_at}
          notificationId={r.id}
          onAcknowledge={acknowledge}
        />
      ),
    },
  ], [page, pageSize, navigate, acknowledge]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pendingIds = filtered.filter((r) => !r.acknowledged_at).map((r) => r.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex shrink-0 flex-nowrap items-center gap-3">
          <div className="flex w-72 overflow-hidden rounded-lg border border-slate-300 bg-white">
            <Input
              allowClear
              variant="borderless"
              placeholder="Search any field…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button
              type="default"
              className="!h-auto !rounded-none !border-0 !border-l !border-slate-300"
              icon={<SearchOutlined />}
              aria-label="Search"
            />
          </div>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Filter by customer"
            className="w-56 shrink-0"
            value={customerFilter}
            onChange={setCustomerFilter}
            options={customerOptions}
            optionFilterProp="label"
            maxTagCount="responsive"
          />
        </div>
        <Space wrap className="shrink-0">
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={load}
              aria-label="Refresh"
            />
          </Tooltip>
          <Button
            type="primary"
            disabled={!pendingIds.length}
            onClick={() => acknowledge(selected.length ? selected : pendingIds)}
          >
            Acknowledge {selected.length ? 'selected' : 'all pending'}
          </Button>
        </Space>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          dataSource={paged}
          columns={columns}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (r) => ({ disabled: Boolean(r.acknowledged_at) }),
          }}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </div>
    </div>
  );
}
