import { useEffect, useMemo, useState } from 'react';
import {
  Button, Empty, Input, Pagination, Popconfirm, Select, Space, Spin, Tooltip, Typography, message,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, AppstoreOutlined, UnorderedListOutlined, ReloadOutlined,
  StarFilled, StarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, getApiErrorMessage } from '../../config/auth.js';
import ReportTemplateEditor from '../../Components/ReportTemplateEditor';

const PAGE_SIZE = 8;

function timeAgo(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  const mins = dayjs().diff(d, 'minute');
  if (mins < 60) return `Updated ${Math.max(1, mins)}m ago`;
  const hours = dayjs().diff(d, 'hour');
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = dayjs().diff(d, 'day');
  if (days < 14) return `Updated ${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `Updated ${weeks}w ago`;
  return `Updated ${Math.max(1, Math.floor(days / 30))}mo ago`;
}

function TemplatePreviewThumb({ template }) {
  const td = template.template_data || {};
  const page = td.pageSize || 'A4';
  const orient = td.orientation || 'portrait';
  const margins = td.margins || { top: 5, right: 5, bottom: 5, left: 5 };
  const header = td.headerHtml || '';
  const body = td.bodyHtml || '';
  const footer = td.footerHtml || '';
  const hasContent = Boolean(header || body || footer);
  const landscape = orient === 'landscape';
  // Full page at CSS px (~96dpi), then scale to fit card like reference designer cards
  const pageW = landscape ? 900 : 640;
  const pageH = landscape ? 640 : 900;
  const scale = landscape ? 0.42 : 0.34;

  return (
    <div className="template-card-thumb relative aspect-[16/10] overflow-hidden">
      <div className="absolute inset-0 flex items-start justify-center pt-3">
        <div
          className="overflow-hidden bg-white shadow-sm"
          style={{
            width: pageW * scale,
            height: pageH * scale,
          }}
        >
          <div
            className="template-card-preview"
            style={{
              width: pageW,
              minHeight: pageH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              padding: `${margins.top || 5}mm ${margins.right || 5}mm ${margins.bottom || 5}mm ${margins.left || 5}mm`,
              boxSizing: 'border-box',
              fontFamily: `${td.fontFamily || 'Times New Roman'}, Times, serif`,
              fontSize: td.fontSize || '12px',
              background: '#fff',
            }}
          >
            {hasContent ? (
              <>
                {header ? <div dangerouslySetInnerHTML={{ __html: header }} /> : null}
                {body ? (
                  <div
                    style={{
                      marginTop: `${td.headerSpacing || 0}mm`,
                      marginBottom: `${td.footerSpacing || 0}mm`,
                    }}
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                ) : null}
                {footer ? <div dangerouslySetInnerHTML={{ __html: footer }} /> : null}
              </>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: '#0f766e', marginBottom: 8 }}>
                  {template.name || 'Template'}
                </div>
                <div>{page} · {orient}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ t, starringId, onDesign, onStar, onRemove }) {
  const updatedAt = t.updated_at || t.created_at;
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-teal-400 hover:shadow-md">
      <div className="relative cursor-pointer" onClick={() => onDesign(t.id)}>
        <TemplatePreviewThumb template={t} />
        <Tooltip title={t.is_default ? 'Starred — used when generating reports' : 'Star to use for all reports'}>
          <button
            type="button"
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-lg shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onStar(t);
            }}
            disabled={starringId === t.id}
          >
            {t.is_default
              ? <StarFilled className="text-amber-400" />
              : <StarOutlined className="text-slate-400" />}
          </button>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
        <FileTextOutlined className="text-teal-600" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{t.name}</div>
          <Tooltip title={updatedAt ? dayjs(updatedAt).format('DD MMM YYYY, hh:mm A') : ''}>
            <div className="text-[11px] text-slate-500">{timeAgo(updatedAt)}</div>
          </Tooltip>
        </div>
        <Space size={0}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onDesign(t.id)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm title="Delete template?" onConfirm={() => onRemove(t.id)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      </div>
    </div>
  );
}

function TemplateList({ onDesign, onCreate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sortBy, setSortBy] = useState('recent');
  const [starringId, setStarringId] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/quotation-templates').then((r) => r.data);
      setRows(data.items || []);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get('/quotation-templates').then((r) => r.data);
        if (!cancelled) setRows(data.items || []);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load templates'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, view]);

  const remove = async (id) => {
    try {
      await api.delete(`/quotation-templates/${id}`);
      message.success('Deleted');
      load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Delete failed'));
    }
  };

  const setStarred = async (template) => {
    if (template.is_default) {
      message.info('This is already the starred template users will use');
      return;
    }
    setStarringId(template.id);
    try {
      await api.put(`/quotation-templates/${template.id}`, { is_default: true });
      message.success(`“${template.name}” is now the starred template`);
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not set starred template'));
    } finally {
      setStarringId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((t) =>
        (t.name || '').toLowerCase().includes(q)
        || (t.description || '').toLowerCase().includes(q));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (Boolean(a.is_default) !== Boolean(b.is_default)) {
        return Number(b.is_default) - Number(a.is_default);
      }
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'created') {
        return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
      }
      return dayjs(b.updated_at || b.created_at).valueOf() - dayjs(a.updated_at || a.created_at).valueOf();
    });
    return sorted;
  }, [rows, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <Typography.Title level={4} className="!mb-1 !font-sans !text-teal-800">
            Design template
          </Typography.Title>
          <p className="m-0 text-sm text-slate-500">
            Create and manage report templates. Star one template — users generate reports with that template only.
          </p>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={onCreate}>
          Create new template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <Input
          allowClear
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!max-w-xs"
        />
        <div className="flex overflow-hidden rounded-md border border-slate-200">
          <Tooltip title="Grid view">
            <button
              type="button"
              className={`px-2.5 py-1.5 ${view === 'grid' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setView('grid')}
            >
              <AppstoreOutlined />
            </button>
          </Tooltip>
          <Tooltip title="List view">
            <button
              type="button"
              className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setView('list')}
            >
              <UnorderedListOutlined />
            </button>
          </Tooltip>
        </div>
        <Select
          value={sortBy}
          onChange={setSortBy}
          className="!min-w-[200px]"
          options={[
            { value: 'recent', label: 'Sort by recently edited' },
            { value: 'created', label: 'Sort by date created' },
            { value: 'name', label: 'Sort by name' },
          ]}
        />
        <Tooltip title="Refresh">
          <Button type="text" icon={<ReloadOutlined />} onClick={load} loading={loading} />
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {loading && !rows.length ? (
          <div className="grid place-items-center py-20"><Spin /></div>
        ) : filtered.length === 0 ? (
          <Empty
            className="py-16"
            description={search ? 'No templates match your search' : 'No templates yet — create one to get started'}
          >
            {!search && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                Create new template
              </Button>
            )}
          </Empty>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paged.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                starringId={starringId}
                onDesign={onDesign}
                onStar={setStarred}
                onRemove={remove}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {paged.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm hover:border-teal-300"
              >
                <button
                  type="button"
                  className="text-lg"
                  onClick={() => setStarred(t)}
                  disabled={starringId === t.id}
                >
                  {t.is_default
                    ? <StarFilled className="text-amber-400" />
                    : <StarOutlined className="text-slate-400" />}
                </button>
                <FileTextOutlined className="text-teal-600" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onDesign(t.id)}>
                  <div className="truncate font-semibold text-slate-800">{t.name}</div>
                  <div className="text-xs text-slate-500">
                    {(t.template_data?.pageSize || 'A4')} · {timeAgo(t.updated_at || t.created_at)}
                    {t.is_default ? ' · Starred' : ''}
                  </div>
                </button>
                <Space>
                  <Button type="text" icon={<EditOutlined />} onClick={() => onDesign(t.id)} />
                  <Popconfirm title="Delete template?" onConfirm={() => remove(t.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Total {filtered.length} template{filtered.length === 1 ? '' : 's'}
          {rows.some((r) => r.is_default)
            ? ` · Starred: ${rows.find((r) => r.is_default)?.name}`
            : ' · No starred template yet'}
        </div>
        {filtered.length > PAGE_SIZE && (
          <Pagination
            size="small"
            current={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onChange={setPage}
            showSizeChanger={false}
          />
        )}
      </div>
    </div>
  );
}

export default function Templates() {
  const [editorId, setEditorId] = useState(null);
  const [designing, setDesigning] = useState(false);
  const [listKey, setListKey] = useState(0);

  if (designing) {
    return (
      <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0 flex-1 flex-col overflow-hidden">
        <ReportTemplateEditor
          templateId={editorId}
          onBack={() => {
            setDesigning(false);
            setEditorId(null);
            setListKey((k) => k + 1);
          }}
          onSaved={() => setListKey((k) => k + 1)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <TemplateList
        key={listKey}
        onCreate={() => {
          setEditorId(null);
          setDesigning(true);
        }}
        onDesign={(id) => {
          setEditorId(id);
          setDesigning(true);
        }}
      />
    </div>
  );
}
