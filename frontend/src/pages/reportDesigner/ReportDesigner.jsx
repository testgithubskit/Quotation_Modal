import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, FileEdit, Trash2, Star, LayoutGrid, List as ListIcon, RefreshCw, ChevronLeft,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  getReportTemplates,
  deleteReportTemplate,
  updateReportTemplate,
} from './lib/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function formatTimeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return d.toLocaleDateString();
}

function TemplatePreview({ template }) {
  return (
    <div className="w-full h-full bg-white text-black overflow-hidden pointer-events-none scale-[0.35] origin-top-left w-[285%] h-[285%]">
      <div
        className="p-4 text-[10px] leading-snug"
        dangerouslySetInnerHTML={{ __html: template.header_html || '<p class="text-zinc-400">Empty header</p>' }}
      />
      <div className="mx-4 border-t border-dashed border-zinc-200" />
      <div
        className="p-4 text-[10px] leading-snug"
        dangerouslySetInnerHTML={{ __html: template.footer_html || '<p class="text-zinc-400">Empty footer</p>' }}
      />
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, templateName }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-sm border border-outline-variant p-6">
        <h3 className="text-lg font-display font-black text-surface-bright uppercase">Confirm Deletion</h3>
        <p className="text-sm text-on-surface-variant mt-2">
          Are you sure you want to delete <span className="text-primary font-bold">&quot;{templateName}&quot;</span>?
        </p>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-sm text-[10px] font-display font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest border border-outline-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 rounded-sm bg-red-500 text-white text-[10px] font-display font-black uppercase tracking-widest hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportDesigner() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => String(t.name || '').toLowerCase().includes(q));
  }, [templates, search]);

  const handleSetDefault = async (id, val) => {
    try {
      await updateReportTemplate(id, { is_default: val });
      await load();
    } catch {
      alert('Failed to update default template');
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteReportTemplate(templateToDelete.id);
      setTemplateToDelete(null);
      await load();
    } catch {
      alert('Failed to delete template');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-8 space-y-4 max-w-[1600px] mx-auto w-full min-h-0 overflow-auto">
      <div className="flex items-end justify-between px-1">
        <div>
          <button
            type="button"
            onClick={() => navigate('/user/reports')}
            className="flex items-center gap-1.5 mb-3 text-[10px] font-display font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-surface-bright"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-4xl font-display font-black text-surface-bright leading-none tracking-tight">
            Design Template
          </h1>
          <p className="text-xs font-body text-on-surface-variant/60 mt-1.5 max-w-lg">
            Create and manage quotation report templates with custom headers and footers
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/user/templates/new')}
          className="flex items-center gap-2.5 px-6 py-2.5 rounded-sm bg-primary text-white font-display font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/90 group active:scale-95"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 duration-300" />
          Create New Template
        </button>
      </div>

      <div className="flex-1 flex flex-col rounded-sm overflow-hidden border border-outline-variant bg-surface-container-lowest min-h-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-low/50">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full h-8 px-9 rounded-sm text-xs font-body bg-surface-container-lowest border border-outline-variant text-surface-bright placeholder:text-on-surface-variant/20 outline-none focus:border-primary/40 font-medium"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="w-8 h-8 flex items-center justify-center rounded-sm border border-outline-variant text-on-surface-variant hover:text-surface-bright"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
          <div className="flex items-center rounded-sm border border-outline-variant bg-surface-container-lowest overflow-hidden ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn('w-8 h-8 flex items-center justify-center', viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-on-surface-variant')}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn('w-8 h-8 flex items-center justify-center', viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-on-surface-variant')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-surface-container-lowest/30 min-h-0">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading templates…</p>
          ) : filtered.length === 0 ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-on-surface-variant/50 gap-2">
              <p className="text-xl font-display font-black uppercase tracking-[0.3em]">No Templates Found</p>
              <p className="text-xs">Create a new template to get started</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((template) => (
                <div
                  key={template.id}
                  className="group border border-outline-variant rounded-sm bg-surface-container overflow-hidden hover:border-primary/40 cursor-pointer"
                  onClick={() => navigate(`/user/templates/edit/${template.id}`)}
                >
                  <div className="h-40 bg-[#EFEBE1] relative overflow-hidden border-b border-outline-variant">
                    <TemplatePreview template={template} />
                  </div>
                  <div className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-display font-black text-surface-bright truncate group-hover:text-primary">
                        {template.name}
                      </p>
                      <p className="text-[10px] text-on-surface-variant mt-1">
                        {formatTimeAgo(template.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Set default"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(template.id, !template.is_default);
                        }}
                        className={cn(
                          'w-7 h-7 flex items-center justify-center rounded-sm',
                          template.is_default ? 'text-yellow-500 bg-yellow-500/10' : 'text-on-surface-variant hover:text-yellow-500',
                        )}
                      >
                        <Star className={cn('w-3.5 h-3.5', template.is_default && 'fill-current')} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user/templates/edit/${template.id}`);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-sm text-on-surface-variant hover:text-surface-bright"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTemplateToDelete(template);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-sm text-red-500/60 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-sm border border-outline-variant bg-surface-container hover:border-primary/40 cursor-pointer"
                  onClick={() => navigate(`/user/templates/edit/${template.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-display font-black text-surface-bright truncate">{template.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{formatTimeAgo(template.updated_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(template.id, !template.is_default);
                    }}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-sm',
                      template.is_default ? 'text-yellow-500 bg-yellow-500/10' : 'text-on-surface-variant',
                    )}
                  >
                    <Star className={cn('w-4 h-4', template.is_default && 'fill-current')} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTemplateToDelete(template);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-sm text-red-500/60 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-outline-variant text-[10px] text-on-surface-variant">
          Total <span className="text-surface-bright">{filtered.length}</span> templates
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(templateToDelete)}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={handleDelete}
        templateName={templateToDelete?.name}
      />
    </div>
  );
}
