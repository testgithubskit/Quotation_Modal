import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent, mergeAttributes, Node } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import ImageResize from 'tiptap-extension-resize-image';
import { HexColorPicker } from 'react-colorful';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Save, ChevronLeft, Loader2, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Type, Table as TableIcon,
  ZoomIn, ZoomOut, Undo2, Redo2, Image as ImageIcon, Plus, X,
} from 'lucide-react';
import {
  getReportTemplate,
  createReportTemplate,
  updateReportTemplate,
  getAvailableFonts,
} from './lib/api';
import { BUILTIN_PLACEHOLDERS, buildPlaceholderToken } from './lib/reportPlaceholders';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const FALLBACK_FONTS = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Inter', value: 'Inter' },
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '22', '24', '28', '32'];

const PAGE_DIM_MAP = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

const PlaceholderNode = Node.create({
  name: 'placeholder',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-token'),
        renderHTML: (attrs) => (attrs.token ? { 'data-token': attrs.token } : {}),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label'),
        renderHTML: (attrs) => (attrs.label ? { 'data-label': attrs.label } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-token]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'placeholder-chip',
        contenteditable: 'false',
        style: 'user-select:none;display:inline-flex;align-items:center;padding:2px 6px;font-size:11px;font-weight:600;background:rgba(22,50,79,.08);color:#16324F;border:1px dashed rgba(22,50,79,.3);vertical-align:baseline;margin:0 2px;',
      }),
      node.attrs.label || node.attrs.token,
    ];
  },
});

function buildExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    ImageResize,
    PlaceholderNode,
  ];
}

function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-sm border border-transparent',
        active ? 'bg-primary/20 text-primary border-primary/30' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-surface-bright',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}

const defaultPageSettings = () => ({
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 12, right: 12, bottom: 12, left: 12 },
  headerSpacing: 8,
  footerSpacing: 8,
  fontFamily: 'Arial',
  fontSize: 12,
  customPlaceholders: [],
});

export default function ReportTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('Untitled Template');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('header');
  const [pageSettings, setPageSettings] = useState(defaultPageSettings);
  const [systemFonts, setSystemFonts] = useState(FALLBACK_FONTS);
  const [zoom, setZoom] = useState(0.85);
  const [colorOpen, setColorOpen] = useState(false);
  const [fontColor, setFontColor] = useState('#000000');
  const [customLabel, setCustomLabel] = useState('');
  const [successToast, setSuccessToast] = useState(null);
  const imageInputRef = useRef(null);
  const loadedRef = useRef(false);

  const onUpdate = useCallback(() => {}, []);

  const headerEditor = useEditor({
    extensions: buildExtensions(),
    content: '<p></p>',
    immediatelyRender: false,
    onUpdate,
    editorProps: {
      attributes: { class: 'focus:outline-none min-h-[80px]' },
    },
  });

  const footerEditor = useEditor({
    extensions: buildExtensions(),
    content: '<p></p>',
    immediatelyRender: false,
    onUpdate,
    editorProps: {
      attributes: { class: 'focus:outline-none min-h-[60px]' },
    },
  });

  const currentEditor = activeSection === 'footer' ? footerEditor : headerEditor;

  useEffect(() => {
    getAvailableFonts()
      .then((fonts) => setSystemFonts(fonts.map((f) => ({ label: f, value: f }))))
      .catch(() => setSystemFonts(FALLBACK_FONTS));
  }, []);

  useEffect(() => {
    if (!id || !headerEditor || !footerEditor || loadedRef.current) {
      if (!id) setLoading(false);
      return;
    }
    loadedRef.current = true;
    getReportTemplate(id)
      .then((data) => {
        setName(data.name || 'Untitled Template');
        setIsDefault(Boolean(data.is_default));
        try {
          if (data.description) {
            const s = JSON.parse(data.description);
            setPageSettings((prev) => ({ ...prev, ...s }));
          }
        } catch { /* ignore */ }
        headerEditor.commands.setContent(data.header_html || '<p></p>');
        footerEditor.commands.setContent(data.footer_html || '<p></p>');
      })
      .catch(() => alert('Failed to load template'))
      .finally(() => setLoading(false));
  }, [id, headerEditor, footerEditor]);

  useEffect(() => {
    if (!successToast) return undefined;
    const t = setTimeout(() => setSuccessToast(null), 3000);
    return () => clearTimeout(t);
  }, [successToast]);

  const placeholders = useMemo(
    () => [...BUILTIN_PLACEHOLDERS, ...(pageSettings.customPlaceholders || [])],
    [pageSettings.customPlaceholders],
  );

  const insertPlaceholder = (placeholder) => {
    if (!currentEditor) return;
    currentEditor
      .chain()
      .focus()
      .insertContent({
        type: 'placeholder',
        attrs: { token: placeholder.token, label: placeholder.label },
      })
      .run();
  };

  const addCustomPlaceholder = () => {
    const label = customLabel.trim();
    if (!label) return;
    const token = buildPlaceholderToken(label);
    if (placeholders.some((p) => p.token === token || p.label.toLowerCase() === label.toLowerCase())) {
      alert('Placeholder already exists');
      return;
    }
    setPageSettings((prev) => ({
      ...prev,
      customPlaceholders: [...(prev.customPlaceholders || []), { token, label }],
    }));
    setCustomLabel('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: JSON.stringify(pageSettings),
        header_html: headerEditor?.getHTML() || '',
        footer_html: footerEditor?.getHTML() || '',
        is_default: isDefault,
      };
      if (id) {
        await updateReportTemplate(id, payload);
        setSuccessToast('Template updated');
      } else {
        const created = await createReportTemplate(payload);
        setSuccessToast('Template saved');
        if (created?.id) navigate(`/user/templates/edit/${created.id}`, { replace: true });
      }
    } catch {
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentEditor) {
      if (!currentEditor) alert('Click inside the header or footer first, then upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result;
      if (!src) return;
      currentEditor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
  };

  const dim = PAGE_DIM_MAP[pageSettings.pageSize] || PAGE_DIM_MAP.A4;
  const pageW = (pageSettings.orientation === 'portrait' ? dim.w : dim.h) * 3.78;
  const pageH = (pageSettings.orientation === 'portrait' ? dim.h : dim.w) * 3.78;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface text-on-surface">
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant bg-surface-container-low">
        <button
          type="button"
          onClick={() => navigate('/user/templates')}
          className="w-8 h-8 flex items-center justify-center rounded-sm text-on-surface-variant hover:text-surface-bright hover:bg-surface-container-highest"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 max-w-md h-8 px-2 rounded-sm bg-surface-container-lowest border border-outline-variant text-sm font-semibold text-surface-bright outline-none focus:border-primary/40"
        />
        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-on-surface-variant font-black">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Default
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-8 px-4 rounded-sm bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {id ? 'Update' : 'Save'}
        </button>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-1 px-3 py-2 border-b border-outline-variant bg-surface-container">
        <ToolBtn title="Undo" onClick={() => currentEditor?.chain().focus().undo().run()}>
          <Undo2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => currentEditor?.chain().focus().redo().run()}>
          <Redo2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-outline-variant mx-1" />
        <select
          value={pageSettings.fontFamily}
          onChange={(e) => {
            const v = e.target.value;
            setPageSettings((p) => ({ ...p, fontFamily: v }));
            currentEditor?.chain().focus().setFontFamily(v).run();
          }}
          className="h-7 text-[11px] px-1 rounded-sm bg-surface-container-lowest border border-outline-variant text-on-surface outline-none"
        >
          {systemFonts.map((f) => (
            <option key={f.value || f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
        <select
          value={String(pageSettings.fontSize)}
          onChange={(e) => {
            const size = Number(e.target.value);
            setPageSettings((p) => ({ ...p, fontSize: size }));
            currentEditor?.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
          }}
          className="h-7 w-14 text-[11px] px-1 rounded-sm bg-surface-container-lowest border border-outline-variant text-on-surface outline-none"
        >
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <ToolBtn title="Bold" active={currentEditor?.isActive('bold')} onClick={() => currentEditor?.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Italic" active={currentEditor?.isActive('italic')} onClick={() => currentEditor?.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Underline" active={currentEditor?.isActive('underline')} onClick={() => currentEditor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Strike" active={currentEditor?.isActive('strike')} onClick={() => currentEditor?.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="relative">
          <ToolBtn title="Text color" onClick={() => setColorOpen((v) => !v)}>
            <Type className="w-3.5 h-3.5" style={{ color: fontColor }} />
          </ToolBtn>
          {colorOpen ? (
            <div className="absolute z-30 top-8 left-0 p-2 bg-surface-container-highest border border-outline-variant rounded-sm shadow-lg">
              <HexColorPicker
                color={fontColor}
                onChange={(c) => {
                  setFontColor(c);
                  currentEditor?.chain().focus().setColor(c).run();
                }}
              />
              <button type="button" className="mt-2 text-[10px] text-on-surface-variant" onClick={() => setColorOpen(false)}>Close</button>
            </div>
          ) : null}
        </div>
        <div className="w-px h-5 bg-outline-variant mx-1" />
        <ToolBtn title="Align left" onClick={() => currentEditor?.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Align center" onClick={() => currentEditor?.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Align right" onClick={() => currentEditor?.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Justify" onClick={() => currentEditor?.chain().focus().setTextAlign('justify').run()}>
          <AlignJustify className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="w-px h-5 bg-outline-variant mx-1" />
        <ToolBtn
          title="Insert table"
          onClick={() => currentEditor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn title="Upload image" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon className="w-3.5 h-3.5" />
        </ToolBtn>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <ToolBtn title="Clear formatting" onClick={() => currentEditor?.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Eraser className="w-3.5 h-3.5" />
        </ToolBtn>
        <div className="ml-auto flex items-center gap-1">
          <ToolBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </ToolBtn>
          <span className="text-[10px] w-10 text-center text-on-surface-variant">{Math.round(zoom * 100)}%</span>
          <ToolBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </ToolBtn>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-64 shrink-0 border-r border-outline-variant bg-surface-container-low overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Placeholders</p>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => insertPlaceholder(p)}
                  className="px-2 py-1 text-[10px] rounded-sm border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Custom label"
                className="flex-1 h-7 px-2 text-[11px] rounded-sm bg-surface-container-lowest border border-outline-variant outline-none"
              />
              <button type="button" onClick={addCustomPlaceholder} className="w-7 h-7 flex items-center justify-center rounded-sm bg-primary text-white">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Page setup</p>
            <label className="block text-[10px] text-on-surface-variant mb-1">Size</label>
            <select
              value={pageSettings.pageSize}
              onChange={(e) => setPageSettings((p) => ({ ...p, pageSize: e.target.value }))}
              className="w-full h-8 mb-2 text-[11px] px-2 rounded-sm bg-surface-container-lowest border border-outline-variant outline-none"
            >
              {Object.keys(PAGE_DIM_MAP).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <div className="flex gap-1 mb-2">
              {['portrait', 'landscape'].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setPageSettings((p) => ({ ...p, orientation: o }))}
                  className={cn(
                    'flex-1 h-7 text-[10px] uppercase tracking-wider rounded-sm border',
                    pageSettings.orientation === o ? 'bg-primary/20 border-primary text-primary' : 'border-outline-variant text-on-surface-variant',
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
            {['top', 'right', 'bottom', 'left'].map((side) => (
              <div key={side} className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-on-surface-variant capitalize">{side} (mm)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={pageSettings.margins[side]}
                  onChange={(e) => setPageSettings((p) => ({
                    ...p,
                    margins: { ...p.margins, [side]: Number(e.target.value) || 0 },
                  }))}
                  className="w-16 h-7 px-1 text-[11px] rounded-sm bg-surface-container-lowest border border-outline-variant outline-none"
                />
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 overflow-auto bg-[#EFEBE1] p-6">
          <div
            className="mx-auto bg-white text-black shadow-2xl origin-top"
            style={{
              width: `${pageW}px`,
              minHeight: `${pageH}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              fontFamily: pageSettings.fontFamily,
              fontSize: `${pageSettings.fontSize}px`,
            }}
          >
            <div
              className={cn('template-editor-content border-b border-dashed border-zinc-200', activeSection === 'header' && 'ring-2 ring-primary/40')}
              style={{
                padding: `${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.headerSpacing}mm ${pageSettings.margins.left}mm`,
              }}
              onMouseDown={() => setActiveSection('header')}
            >
              <p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1 select-none">Header</p>
              <EditorContent editor={headerEditor} />
            </div>

            <div className="px-8 py-10 text-center text-zinc-400 text-xs border-b border-dashed border-zinc-200 select-none">
              Quotation body (activities, totals) is filled when generating a report
            </div>

            <div
              className={cn('template-editor-content', activeSection === 'footer' && 'ring-2 ring-primary/40')}
              style={{
                padding: `${pageSettings.footerSpacing}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm`,
              }}
              onMouseDown={() => setActiveSection('footer')}
            >
              <p className="text-[9px] uppercase tracking-widest text-zinc-400 mb-1 select-none">Footer</p>
              <EditorContent editor={footerEditor} />
            </div>
          </div>
        </div>
      </div>

      {successToast ? (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-sm bg-emerald-600 text-white text-xs shadow-lg">
          {successToast}
          <button type="button" onClick={() => setSuccessToast(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : null}
    </div>
  );
}
