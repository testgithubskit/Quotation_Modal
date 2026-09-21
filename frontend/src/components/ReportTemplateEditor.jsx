import { useEditor, EditorContent, Extension } from '@tiptap/react';
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
import Placeholder from '@tiptap/extension-placeholder';
import {
  Button, Collapse, Dropdown, Input, InputNumber, Modal, Select, Space, Switch, Tooltip, message,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined,
  StrikethroughOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  TableOutlined, UndoOutlined, RedoOutlined,
  ZoomInOutlined, ZoomOutOutlined, FontColorsOutlined, BgColorsOutlined,
  ClearOutlined, PlusOutlined, DeleteOutlined, InsertRowAboveOutlined,
  InsertRowBelowOutlined, InsertRowLeftOutlined, InsertRowRightOutlined,
  MergeCellsOutlined, SplitCellsOutlined, VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined, VerticalAlignBottomOutlined, PictureOutlined,
  BorderOutlined, BorderTopOutlined, BorderBottomOutlined, BorderLeftOutlined,
  BorderRightOutlined, ColumnWidthOutlined, DownloadOutlined, PrinterOutlined,
  FilePdfOutlined, FileExcelOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api, getApiErrorMessage } from '../config/auth.js';
import {
  DEFAULT_PAGE_SETTINGS,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  PAGE_SIZE_OPTIONS,
  REPORT_PLACEHOLDERS,
  pagePixelSize,
} from '../utils/reportPlaceholders.js';
import { datedFilename, downloadRowsExcel } from '../utils/spreadsheet.js';
import { ResizableImage } from './tiptap/ResizableImage.jsx';
import TableGripControls from './tiptap/TableGripControls.jsx';
import SelectionFormatToolbar from './tiptap/SelectionFormatToolbar.jsx';
import { ReportPlaceholder, hydratePlaceholderChips } from './tiptap/ReportPlaceholder.js';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark('textStyle', { fontSize }),
      unsetFontSize: () => ({ chain }) => chain()
        .setMark('textStyle', { fontSize: null })
        .removeEmptyTextStyle(),
    };
  },
});

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => (attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (el) => el.style.verticalAlign || null,
        renderHTML: (attrs) => (attrs.verticalAlign ? { style: `vertical-align: ${attrs.verticalAlign}` } : {}),
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => (attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (el) => el.style.verticalAlign || null,
        renderHTML: (attrs) => (attrs.verticalAlign ? { style: `vertical-align: ${attrs.verticalAlign}` } : {}),
      },
    };
  },
});

const EDITOR_EXTENSIONS = (placeholder) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: true, handleWidth: 6, cellMinWidth: 48 }),
  TableRow,
  CustomTableHeader,
  CustomTableCell,
  ResizableImage,
  ReportPlaceholder,
  Placeholder.configure({ placeholder }),
];

function ToolBtn({ title, active, danger, onClick, icon, disabled }) {
  return (
    <Tooltip title={title}>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={[
          'designer-tool-btn inline-flex h-8 w-8 items-center justify-center rounded text-sm transition',
          danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100',
          active ? 'bg-teal-600 text-white hover:bg-teal-600' : '',
          disabled ? 'cursor-not-allowed opacity-35' : '',
        ].filter(Boolean).join(' ')}
        aria-label={title}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function SectionEditor({ label, editor, active, onFocus, className = '', pinned }) {
  return (
    <div
      className={[
        'relative border-b border-dashed border-teal-200/70',
        active ? 'ring-1 ring-teal-400/40' : '',
        pinned ? 'mt-auto border-b-0 border-t border-dashed border-teal-200/70' : '',
        className,
      ].filter(Boolean).join(' ')}
      onMouseDown={onFocus}
    >
      <div className="pointer-events-none absolute left-2 top-1 z-10 rounded bg-teal-700/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {label}
      </div>
      <EditorContent editor={editor} className="tiptap-editor min-h-[72px] px-1 pt-8" />
    </div>
  );
}

function FontSelect({ className, value, onChange, placeholder, size }) {
  return (
    <Select
      size={size}
      className={className}
      popupClassName="designer-font-dropdown"
      placeholder={placeholder}
      value={value === undefined ? undefined : value}
      showSearch
      optionFilterProp="label"
      listHeight={280}
      options={FONT_FAMILY_OPTIONS}
      optionRender={(opt) => (
        opt.data?.value === '__divider__' || !opt.data?.value
          ? <span className="text-slate-400">{opt.data?.label}</span>
          : <span style={{ fontFamily: String(opt.data.value) }}>{opt.data.label}</span>
      )}
      labelRender={(opt) => (
        opt.value
          ? <span style={{ fontFamily: String(opt.value) }}>{opt.label}</span>
          : <span>{opt.label}</span>
      )}
      onChange={(v) => {
        if (v === '__divider__') return;
        onChange?.(v);
      }}
    />
  );
}

function DesignerSidebar({
  editor,
  pageSettings,
  setPageSettings,
  isDefault,
  setIsDefault,
  description,
  setDescription,
  placeholders,
  onInsertPlaceholder,
  onAddPlaceholder,
  onRemovePlaceholder,
  onUploadImage,
  selectionTick = 0,
}) {
  const fileRef = useRef(null);
  const [addingPh, setAddingPh] = useState(false);
  const [phDraft, setPhDraft] = useState('');
  const inTable = Boolean(editor?.isActive('table'));
  // Re-read mark attrs whenever the editor selection/content updates
  void selectionTick;
  const textStyle = editor?.getAttributes('textStyle') || {};
  const highlightColor = editor?.getAttributes('highlight')?.color || '#fef08a';

  const setCellAttr = (key, value) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .updateAttributes('tableCell', { [key]: value })
      .updateAttributes('tableHeader', { [key]: value })
      .run();
  };

  const submitPlaceholder = () => {
    const ok = onAddPlaceholder?.(phDraft);
    if (ok !== false) {
      setPhDraft('');
      setAddingPh(false);
    }
  };

  return (
    <aside className="designer-sidebar flex w-[300px] shrink-0 flex-col overflow-auto border-r border-slate-200 bg-white text-slate-800">
      <Collapse
        ghost
        defaultActiveKey={['ph', 'page', 'logo', 'type', 'table']}
        className="designer-collapse"
        items={[
          {
            key: 'ph',
            label: (
              <div className="flex w-full items-center justify-between pr-1">
                <span className="designer-section-label">Placeholders</span>
                <Tooltip title="Add custom placeholder">
                  <button
                    type="button"
                    className="inline-flex h-6 items-center justify-center gap-0.5 rounded bg-teal-600 px-1.5 text-white hover:bg-teal-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingPh(true);
                    }}
                  >
                    <PlusOutlined className="text-[11px]" />
                  </button>
                </Tooltip>
              </div>
            ),
            children: (
              <div className="space-y-2 px-1 pb-2">
                {addingPh ? (
                  <div className="flex gap-1">
                    <Input
                      size="small"
                      autoFocus
                      placeholder="Name (e.g. Approved By)"
                      value={phDraft}
                      onChange={(e) => setPhDraft(e.target.value)}
                      onPressEnter={submitPlaceholder}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAddingPh(false);
                          setPhDraft('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-teal-600 text-white hover:bg-teal-500"
                      title="Add"
                      onClick={submitPlaceholder}
                    >
                      <PlusOutlined />
                    </button>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-1.5">
                  {placeholders.map((p) => {
                    const isCustom = p.custom === true;
                    return (
                      <div
                        key={p.token}
                        className={`group relative flex items-stretch overflow-hidden rounded-md border text-left text-[11px] font-medium transition ${
                          isCustom
                            ? 'border-teal-200 bg-teal-50 text-teal-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate px-2 py-2 text-left"
                          onClick={() => onInsertPlaceholder(p)}
                          title={p.token}
                        >
                          {p.label}
                        </button>
                        {isCustom ? (
                          <button
                            type="button"
                            className="inline-flex w-6 shrink-0 items-center justify-center border-l border-teal-200 text-red-500 hover:bg-red-50"
                            title="Delete placeholder"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemovePlaceholder?.(p.token);
                            }}
                          >
                            <CloseOutlined className="text-[10px]" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          },
          {
            key: 'page',
            label: <span className="designer-section-label">Page setup</span>,
            children: (
              <div className="space-y-3 px-1 pb-2">
                <div>
                  <div className="designer-field-label">Page size</div>
                  <Select
                    className="w-full"
                    value={pageSettings.pageSize}
                    options={PAGE_SIZE_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    onChange={(pageSize) => setPageSettings((s) => ({ ...s, pageSize }))}
                  />
                </div>
                <div>
                  <div className="designer-field-label">Orientation</div>
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
                    {['portrait', 'landscape'].map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`rounded px-2 py-1.5 text-xs font-medium capitalize transition ${
                          pageSettings.orientation === o
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-white'
                        }`}
                        onClick={() => setPageSettings((s) => ({ ...s, orientation: o }))}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="designer-field-label">Margins (mm)</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      ['top', 'T'], ['bottom', 'B'], ['left', 'L'], ['right', 'R'],
                    ].map(([side, short]) => (
                      <InputNumber
                        key={side}
                        size="small"
                        className="!w-full"
                        min={0}
                        max={50}
                        prefix={<span className="text-[10px] text-slate-400">{short}</span>}
                        value={pageSettings.margins[side]}
                        onChange={(v) => setPageSettings((s) => ({
                          ...s,
                          margins: { ...s.margins, [side]: v ?? 5 },
                        }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="designer-field-label">Spacing (mm)</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <InputNumber
                      size="small"
                      className="!w-full"
                      min={0}
                      max={40}
                      prefix={<span className="text-[10px] text-slate-400">HDR</span>}
                      value={pageSettings.headerSpacing}
                      onChange={(v) => setPageSettings((s) => ({ ...s, headerSpacing: v ?? 0 }))}
                    />
                    <InputNumber
                      size="small"
                      className="!w-full"
                      min={0}
                      max={40}
                      prefix={<span className="text-[10px] text-slate-400">FTR</span>}
                      value={pageSettings.footerSpacing}
                      onChange={(v) => setPageSettings((s) => ({ ...s, footerSpacing: v ?? 0 }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-600">Star as default template</span>
                  <Switch checked={isDefault} onChange={setIsDefault} size="small" />
                </div>
                <Input.TextArea
                  rows={2}
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            ),
          },
          {
            key: 'logo',
            label: <span className="designer-section-label">Logo &amp; branding</span>,
            children: (
              <div className="px-1 pb-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadImage(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-7 text-center transition hover:border-teal-400 hover:bg-teal-50/50"
                >
                  <PictureOutlined className="text-2xl text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">Upload Logo / Image</span>
                  <span className="text-[11px] text-slate-500">Click image to resize / align</span>
                </button>
              </div>
            ),
          },
          {
            key: 'type',
            label: <span className="designer-section-label">Typography</span>,
            children: (
              <div className="space-y-2 px-1 pb-2" key={`typo-${selectionTick}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <div onMouseDown={(e) => e.preventDefault()}>
                    <FontSelect
                      size="small"
                      className="w-full"
                      placeholder="Font"
                      value={textStyle.fontFamily || undefined}
                      onChange={(v) => {
                        if (!v || !editor) return;
                        editor.chain().focus().setFontFamily(v).run();
                      }}
                    />
                  </div>
                  <div onMouseDown={(e) => e.preventDefault()}>
                    <Select
                      size="small"
                      className="w-full"
                      placeholder="Size"
                      showSearch
                      optionFilterProp="label"
                      value={textStyle.fontSize || undefined}
                      options={FONT_SIZE_OPTIONS}
                      onChange={(v) => {
                        if (!v || !editor) return;
                        editor.chain().focus().setFontSize(v).run();
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-1">
                  <ToolBtn title="Bold" active={editor?.isActive('bold')} icon={<BoldOutlined />} onClick={() => editor?.chain().focus().toggleBold().run()} />
                  <ToolBtn title="Italic" active={editor?.isActive('italic')} icon={<ItalicOutlined />} onClick={() => editor?.chain().focus().toggleItalic().run()} />
                  <ToolBtn title="Underline" active={editor?.isActive('underline')} icon={<UnderlineOutlined />} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
                  <ToolBtn title="Strike" active={editor?.isActive('strike')} icon={<StrikethroughOutlined />} onClick={() => editor?.chain().focus().toggleStrike().run()} />
                </div>
                <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-1">
                  <ToolBtn title="Align left" active={editor?.isActive({ textAlign: 'left' })} icon={<AlignLeftOutlined />} onClick={() => editor?.chain().focus().setTextAlign('left').run()} />
                  <ToolBtn title="Align center" active={editor?.isActive({ textAlign: 'center' })} icon={<AlignCenterOutlined />} onClick={() => editor?.chain().focus().setTextAlign('center').run()} />
                  <ToolBtn title="Align right" active={editor?.isActive({ textAlign: 'right' })} icon={<AlignRightOutlined />} onClick={() => editor?.chain().focus().setTextAlign('right').run()} />
                  <ToolBtn title="Justify" active={editor?.isActive({ textAlign: 'justify' })} icon={<ColumnWidthOutlined />} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} />
                  <ToolBtn title="Clear formatting" icon={<ClearOutlined />} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                    <FontColorsOutlined />
                    Font color
                    <input
                      type="color"
                      className="ml-auto h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                      value={textStyle.color || '#000000'}
                      onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                    <BgColorsOutlined />
                    Highlight
                    <input
                      type="color"
                      className="ml-auto h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                      value={highlightColor}
                      onChange={(e) => editor?.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                    />
                  </label>
                </div>
              </div>
            ),
          },
          {
            key: 'table',
            label: <span className="designer-section-label">Table</span>,
            children: (
              <div className="space-y-2 px-1 pb-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-500"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  >
                    <TableOutlined />
                    Insert
                  </button>
                  <ToolBtn
                    title="Delete table"
                    danger
                    disabled={!inTable}
                    icon={<DeleteOutlined />}
                    onClick={() => editor?.chain().focus().deleteTable().run()}
                  />
                </div>
                <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-1">
                  <ToolBtn title="Add row above" disabled={!inTable} icon={<InsertRowAboveOutlined />} onClick={() => editor?.chain().focus().addRowBefore().run()} />
                  <ToolBtn title="Add row below" disabled={!inTable} icon={<InsertRowBelowOutlined />} onClick={() => editor?.chain().focus().addRowAfter().run()} />
                  <ToolBtn title="Delete row" danger disabled={!inTable} icon={<CloseOutlined />} onClick={() => editor?.chain().focus().deleteRow().run()} />
                  <ToolBtn title="Add column left" disabled={!inTable} icon={<InsertRowLeftOutlined />} onClick={() => editor?.chain().focus().addColumnBefore().run()} />
                  <ToolBtn title="Add column right" disabled={!inTable} icon={<InsertRowRightOutlined />} onClick={() => editor?.chain().focus().addColumnAfter().run()} />
                  <ToolBtn title="Delete column" danger disabled={!inTable} icon={<CloseOutlined />} onClick={() => editor?.chain().focus().deleteColumn().run()} />
                  <ToolBtn title="Merge cells" disabled={!inTable} icon={<MergeCellsOutlined />} onClick={() => editor?.chain().focus().mergeCells().run()} />
                  <ToolBtn title="Split cell" disabled={!inTable} icon={<SplitCellsOutlined />} onClick={() => editor?.chain().focus().splitCell().run()} />
                </div>
                <div className="flex flex-wrap gap-1 rounded-md bg-slate-50 p-1">
                  <ToolBtn title="All borders" active disabled={!inTable} icon={<BorderOutlined />} onClick={() => {}} />
                  <ToolBtn title="Top border" disabled={!inTable} icon={<BorderTopOutlined />} onClick={() => {}} />
                  <ToolBtn title="Bottom border" disabled={!inTable} icon={<BorderBottomOutlined />} onClick={() => {}} />
                  <ToolBtn title="Left border" disabled={!inTable} icon={<BorderLeftOutlined />} onClick={() => {}} />
                  <ToolBtn title="Right border" disabled={!inTable} icon={<BorderRightOutlined />} onClick={() => {}} />
                </div>
                <div>
                  <div className="designer-field-label">Vertical align</div>
                  <div className="flex gap-1 rounded-md bg-slate-50 p-1">
                    <ToolBtn title="Top" disabled={!inTable} icon={<VerticalAlignTopOutlined />} onClick={() => setCellAttr('verticalAlign', 'top')} />
                    <ToolBtn title="Middle" disabled={!inTable} icon={<VerticalAlignMiddleOutlined />} onClick={() => setCellAttr('verticalAlign', 'middle')} />
                    <ToolBtn title="Bottom" disabled={!inTable} icon={<VerticalAlignBottomOutlined />} onClick={() => setCellAttr('verticalAlign', 'bottom')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                    Cell fill
                    <input
                      type="color"
                      className="ml-auto h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                      disabled={!inTable}
                      onChange={(e) => setCellAttr('backgroundColor', e.target.value)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                    Border
                    <input
                      type="color"
                      className="ml-auto h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                      disabled={!inTable}
                      defaultValue="#cbd5e1"
                      onChange={() => {}}
                    />
                  </label>
                </div>
              </div>
            ),
          },
        ]}
      />
    </aside>
  );
}

export default function ReportTemplateEditor({ templateId = null, onBack, onSaved }) {
  const [name, setName] = useState('Untitled template');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [zoom, setZoom] = useState(0.85);
  const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);
  const [activeSection, setActiveSection] = useState('header');
  const [existingId, setExistingId] = useState(templateId);
  const [placeholders, setPlaceholders] = useState(REPORT_PLACEHOLDERS);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [baselineNonce, setBaselineNonce] = useState(0);
  const [selectionTick, setSelectionTick] = useState(0);
  const refresh = () => setSelectionTick((t) => t + 1);
  const snapshotRef = useRef('');
  const baselineArmedRef = useRef(false);

  const headerEditor = useEditor({
    extensions: EDITOR_EXTENSIONS('Header — click placeholders to insert…'),
    content: '<p></p>',
    onFocus: () => setActiveSection('header'),
    onSelectionUpdate: refresh,
    onUpdate: refresh,
  });
  const bodyEditor = useEditor({
    extensions: EDITOR_EXTENSIONS('Body — click placeholders to insert…'),
    content: '<p></p>',
    onFocus: () => setActiveSection('body'),
    onSelectionUpdate: refresh,
    onUpdate: refresh,
  });
  const footerEditor = useEditor({
    extensions: EDITOR_EXTENSIONS('Footer — click placeholders to insert…'),
    content: '<p></p>',
    onFocus: () => setActiveSection('footer'),
    onSelectionUpdate: refresh,
    onUpdate: refresh,
  });

  const currentEditor = activeSection === 'header'
    ? headerEditor
    : activeSection === 'footer'
      ? footerEditor
      : bodyEditor;

  const buildSnapshot = () => JSON.stringify({
    name: name.trim(),
    description: description || '',
    isDefault: Boolean(isDefault),
    pageSettings,
    header: headerEditor?.getHTML() || '',
    body: bodyEditor?.getHTML() || '',
    footer: footerEditor?.getHTML() || '',
    placeholders: placeholders.map((p) => p.token),
  });

  const takeSnapshot = () => {
    snapshotRef.current = buildSnapshot();
    baselineArmedRef.current = true;
  };

  const isDirty = () => {
    if (!baselineArmedRef.current || !snapshotRef.current) return false;
    return buildSnapshot() !== snapshotRef.current;
  };

  useEffect(() => {
    if (!templateId) {
      if (headerEditor && bodyEditor && footerEditor) {
        setBaselineNonce((n) => n + 1);
      }
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      baselineArmedRef.current = false;
      try {
        const data = await api.get(`/quotation-templates/${templateId}`).then((r) => r.data);
        if (cancelled) return;
        setExistingId(data.id);
        setName(data.name || 'Untitled template');
        setDescription(data.description || '');
        setIsDefault(Boolean(data.is_default));
        const td = data.template_data || {};
        setPageSettings((prev) => ({
          ...prev,
          pageSize: td.pageSize || prev.pageSize,
          orientation: td.orientation || prev.orientation,
          margins: td.margins || prev.margins,
          headerSpacing: td.headerSpacing ?? prev.headerSpacing,
          footerSpacing: td.footerSpacing ?? prev.footerSpacing,
          fontFamily: td.fontFamily || prev.fontFamily,
          fontSize: td.fontSize || prev.fontSize,
        }));
        if (Array.isArray(td.customPlaceholders) && td.customPlaceholders.length) {
          setPlaceholders([
            ...REPORT_PLACEHOLDERS,
            ...td.customPlaceholders.map((p) => ({ ...p, custom: true })),
          ]);
        }
        if (td.headerHtml && headerEditor) {
          headerEditor.commands.setContent(hydratePlaceholderChips(td.headerHtml, [
            ...REPORT_PLACEHOLDERS,
            ...(td.customPlaceholders || []),
          ]));
        } else if (td.headerText && headerEditor) {
          headerEditor.commands.setContent(`<p style="text-align:center"><strong>${td.headerText}</strong></p>`);
        }
        if (td.bodyHtml && bodyEditor) {
          bodyEditor.commands.setContent(hydratePlaceholderChips(td.bodyHtml, [
            ...REPORT_PLACEHOLDERS,
            ...(td.customPlaceholders || []),
          ]));
        }
        if (td.footerHtml && footerEditor) {
          footerEditor.commands.setContent(hydratePlaceholderChips(td.footerHtml, [
            ...REPORT_PLACEHOLDERS,
            ...(td.customPlaceholders || []),
          ]));
        } else if (td.footerText && footerEditor) {
          footerEditor.commands.setContent(`<p>${td.footerText}</p>`);
        }
        if (!cancelled) setBaselineNonce((n) => n + 1);
      } catch (error) {
        if (!cancelled) message.error(getApiErrorMessage(error, 'Failed to load template'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, headerEditor, bodyEditor, footerEditor]);

  // After load/create state settles, lock a clean snapshot
  useEffect(() => {
    if (!baselineNonce || loading) return undefined;
    if (!headerEditor || !bodyEditor || !footerEditor) return undefined;
    const t = setTimeout(() => takeSnapshot(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineNonce, loading, headerEditor, bodyEditor, footerEditor]);

  const pagePx = useMemo(() => pagePixelSize(pageSettings), [pageSettings]);

  const insertPlaceholder = (phOrToken) => {
    const ph = typeof phOrToken === 'string'
      ? placeholders.find((p) => p.token === phOrToken) || {
        token: phOrToken,
        label: String(phOrToken).replace(/[{}]/g, ''),
      }
      : phOrToken;
    const key = String(ph.token || '')
      .replace(/^\{\{|\}\}$/g, '')
      .trim();
    if (!key || !currentEditor) return;
    currentEditor
      .chain()
      .focus()
      .insertContent({
        type: 'reportPlaceholder',
        attrs: { key, label: ph.label || key },
      })
      .run();
  };

  const addPlaceholder = (rawLabel) => {
    const label = String(rawLabel || '').trim();
    if (!label) {
      message.warning('Enter a placeholder name');
      return false;
    }
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
    const token = `{{${key}}}`;
    if (placeholders.some((p) => p.token === token)) {
      message.warning('Placeholder already exists');
      return false;
    }
    setPlaceholders((p) => [...p, { token, label, custom: true }]);
    message.success('Placeholder added — click it to insert');
    return true;
  };

  const removePlaceholder = (token) => {
    setPlaceholders((list) => list.filter((p) => !(p.custom && p.token === token)));
  };

  const uploadImage = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const target = currentEditor || headerEditor;
      if (!target) {
        message.error('Editor not ready');
        return;
      }
      target.chain().focus().setImage({ src, width: 160, align: 'left' }).run();
      message.success('Image inserted — click it to resize or align');
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!name.trim()) {
      message.error('Enter a template name');
      return false;
    }
    setSaving(true);
    try {
      const customPlaceholders = placeholders.filter(
        (p) => !REPORT_PLACEHOLDERS.some((b) => b.token === p.token),
      );
      const payload = {
        name: name.trim(),
        description: description || null,
        is_default: isDefault,
        is_standard: false,
        template_data: {
          ...pageSettings,
          primaryColor: '#0D9488',
          headerText: name.trim(),
          footerText: '',
          headerHtml: headerEditor?.getHTML() || '',
          bodyHtml: bodyEditor?.getHTML() || '',
          footerHtml: footerEditor?.getHTML() || '',
          customPlaceholders,
        },
        custom_data: {},
      };
      let saved;
      if (existingId) {
        saved = await api.put(`/quotation-templates/${existingId}`, payload).then((r) => r.data);
        message.success('Template saved');
      } else {
        saved = await api.post('/quotation-templates', payload).then((r) => r.data);
        setExistingId(saved.id);
        message.success('Template created');
      }
      onSaved?.(saved);
      takeSnapshot();
      return true;
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Save failed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty()) {
      setLeaveOpen(true);
      return;
    }
    onBack?.();
  };

  const handleDiscard = () => {
    setLeaveOpen(false);
    onBack?.();
  };

  const handleSaveAndLeave = async () => {
    const ok = await save();
    if (ok) {
      setLeaveOpen(false);
      onBack?.();
    }
  };

  const buildDocumentHtml = () => {
    const m = pageSettings.margins;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title>
<style>
  @page { size: ${pageSettings.pageSize} ${pageSettings.orientation}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
  body { font-family: ${pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif; font-size: ${pageSettings.fontSize || '12px'}; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; background: #fff; }
  th { background: #fff; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div>${headerEditor?.getHTML() || ''}</div>
  <div style="margin:${pageSettings.headerSpacing}mm 0">${bodyEditor?.getHTML() || ''}</div>
  <div>${footerEditor?.getHTML() || ''}</div>
</body></html>`;
  };

  const exportPrintTemplate = () => {
    const w = window.open('', '_blank');
    if (!w) {
      message.error('Allow pop-ups for print preview');
      return;
    }
    w.document.write(buildDocumentHtml());
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const stripHtml = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html || '';
    return (el.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  };

  const extractTables = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html || '';
    return Array.from(el.querySelectorAll('table')).map((table) => (
      Array.from(table.querySelectorAll('tr')).map((tr) => (
        Array.from(tr.querySelectorAll('th,td')).map((cell) => (cell.innerText || '').trim())
      ))
    ));
  };

  const exportPdf = () => {
    const orient = pageSettings.orientation === 'landscape' ? 'landscape' : 'portrait';
    const sizeKey = String(pageSettings.pageSize || 'A4').toLowerCase();
    const format = ['a3', 'a4', 'a5', 'letter', 'legal'].includes(sizeKey)
      ? sizeKey
      : 'a4';
    const doc = new jsPDF({ orientation: orient, unit: 'mm', format });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = pageSettings.margins;
    const maxW = pageW - m.left - m.right;
    let y = m.top;

    const ensureSpace = (need = 8) => {
      if (y + need > pageH - m.bottom) {
        doc.addPage();
        y = m.top;
      }
    };

    const writeBlock = (title, html) => {
      const text = stripHtml(html);
      if (!text && !extractTables(html).length) return;
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 118, 110);
      doc.text(title, m.left, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      if (text) {
        const lines = doc.splitTextToSize(text, maxW);
        lines.forEach((line) => {
          ensureSpace(6);
          doc.text(line, m.left, y);
          y += 5;
        });
        y += 2;
      }
      extractTables(html).forEach((matrix) => {
        if (!matrix.length) return;
        ensureSpace(20);
        autoTable(doc, {
          startY: y,
          head: matrix[0] ? [matrix[0]] : undefined,
          body: matrix.slice(1),
          margin: { left: m.left, right: m.right },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [13, 148, 136] },
        });
        y = (doc.lastAutoTable?.finalY || y) + 6;
      });
      y += 4;
    };

    writeBlock('Header', headerEditor?.getHTML() || '');
    writeBlock('Body', bodyEditor?.getHTML() || '');
    writeBlock('Footer', footerEditor?.getHTML() || '');

    doc.save(datedFilename(name.replace(/\s+/g, '-').toLowerCase() || 'template', 'pdf'));
    message.success('PDF downloaded');
  };

  const exportExcel = () => {
    const rows = [];
    const pushSection = (section, html) => {
      const text = stripHtml(html);
      if (text) {
        text.split(/\n+/).filter(Boolean).forEach((line) => {
          rows.push({ Section: section, Content: line });
        });
      }
      extractTables(html).forEach((matrix, ti) => {
        matrix.forEach((cells, ri) => {
          const row = { Section: `${section} table ${ti + 1}`, Row: ri + 1 };
          cells.forEach((c, ci) => {
            row[`Col ${ci + 1}`] = c;
          });
          rows.push(row);
        });
      });
    };
    pushSection('Header', headerEditor?.getHTML() || '');
    pushSection('Body', bodyEditor?.getHTML() || '');
    pushSection('Footer', footerEditor?.getHTML() || '');
    placeholders.forEach((p) => {
      rows.push({ Section: 'Placeholder', Content: p.label, Token: p.token });
    });
    downloadRowsExcel(
      rows.length ? rows : [{ Section: '', Content: '' }],
      datedFilename(name.replace(/\s+/g, '-').toLowerCase() || 'template', 'xlsx'),
    );
    message.success('Excel downloaded');
  };

  const exportMenuItems = [
    {
      key: 'header',
      type: 'group',
      label: <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Download as</span>,
      children: [
        {
          key: 'print',
          label: (
            <div className="flex items-start gap-3 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                <PrinterOutlined />
              </span>
              <span>
                <div className="font-medium text-slate-800">Print Template</div>
                <div className="text-xs text-slate-500">Direct print preview</div>
              </span>
            </div>
          ),
          onClick: exportPrintTemplate,
        },
        {
          key: 'pdf',
          label: (
            <div className="flex items-start gap-3 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500">
                <FilePdfOutlined />
              </span>
              <span>
                <div className="font-medium text-slate-800">PDF Document</div>
                <div className="text-xs text-slate-500">.pdf · Print-ready</div>
              </span>
            </div>
          ),
          onClick: exportPdf,
        },
        {
          key: 'excel',
          label: (
            <div className="flex items-start gap-3 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <FileExcelOutlined />
              </span>
              <span>
                <div className="font-medium text-slate-800">Excel Spreadsheet</div>
                <div className="text-xs text-slate-500">.xlsx · Table data</div>
              </span>
            </div>
          ),
          onClick: exportExcel,
        },
      ],
    },
  ];

  if (loading) {
    return <div className="grid h-full place-items-center text-slate-500">Loading designer…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>Back</Button>
        <Input className="!max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
        <Space className="ml-auto" wrap>
          <Tooltip title="Undo"><Button icon={<UndoOutlined />} onClick={() => currentEditor?.chain().focus().undo().run()} /></Tooltip>
          <Tooltip title="Redo"><Button icon={<RedoOutlined />} onClick={() => currentEditor?.chain().focus().redo().run()} /></Tooltip>
          <Tooltip title="Zoom out"><Button icon={<ZoomOutOutlined />} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} /></Tooltip>
          <span className="w-12 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
          <Tooltip title="Zoom in"><Button icon={<ZoomInOutlined />} onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))} /></Tooltip>
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']} placement="bottomRight">
            <Button icon={<DownloadOutlined />}>
              Export
            </Button>
          </Dropdown>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
        </Space>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DesignerSidebar
          editor={currentEditor}
          pageSettings={pageSettings}
          setPageSettings={setPageSettings}
          isDefault={isDefault}
          setIsDefault={setIsDefault}
          description={description}
          setDescription={setDescription}
          placeholders={placeholders}
          onInsertPlaceholder={insertPlaceholder}
          onAddPlaceholder={addPlaceholder}
          onRemovePlaceholder={removePlaceholder}
          onUploadImage={uploadImage}
          selectionTick={selectionTick}
        />

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mx-auto flex justify-center" style={{ minWidth: pagePx.width * zoom + 48 }}>
            <div
              className="origin-top bg-white shadow-xl"
              style={{
                width: pagePx.width,
                minHeight: pagePx.height,
                height: pagePx.height,
                transform: `scale(${zoom})`,
                padding: `${pageSettings.margins.top}mm ${pageSettings.margins.right}mm ${pageSettings.margins.bottom}mm ${pageSettings.margins.left}mm`,
                boxSizing: 'border-box',
                fontFamily: pageSettings.fontFamily || 'Times New Roman',
                fontSize: pageSettings.fontSize || '12px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <SectionEditor label="Header" editor={headerEditor} active={activeSection === 'header'} onFocus={() => setActiveSection('header')} />
              <div
                className="min-h-0 flex-1 overflow-auto"
                style={{ marginTop: `${pageSettings.headerSpacing}mm`, marginBottom: `${pageSettings.footerSpacing}mm` }}
              >
                <SectionEditor label="Body" editor={bodyEditor} active={activeSection === 'body'} onFocus={() => setActiveSection('body')} />
              </div>
              <SectionEditor
                label="Footer"
                editor={footerEditor}
                active={activeSection === 'footer'}
                onFocus={() => setActiveSection('footer')}
                pinned
              />
            </div>
          </div>
        </div>
      </div>

      {headerEditor ? <TableGripControls editor={headerEditor} /> : null}
      {bodyEditor ? <TableGripControls editor={bodyEditor} /> : null}
      {footerEditor ? <TableGripControls editor={footerEditor} /> : null}
      {headerEditor ? <SelectionFormatToolbar editor={headerEditor} /> : null}
      {bodyEditor ? <SelectionFormatToolbar editor={bodyEditor} /> : null}
      {footerEditor ? <SelectionFormatToolbar editor={footerEditor} /> : null}

      <Modal
        open={leaveOpen}
        footer={null}
        closable={false}
        centered
        width={460}
        onCancel={() => setLeaveOpen(false)}
        destroyOnHidden
      >
        <div className="flex gap-3 pr-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl text-orange-500">
            <SaveOutlined />
          </div>
          <div>
            <div className="text-base font-bold uppercase tracking-wide text-slate-900">
              Unsaved Changes
            </div>
            <p className="mt-1 text-sm text-slate-500">
              You haven&apos;t saved this template. Do you want to save your changes before leaving?
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button onClick={() => setLeaveOpen(false)}>Cancel</Button>
          <Button
            danger
            className="!border-red-300 !bg-red-50 !text-red-600 hover:!border-red-400 hover:!bg-red-100"
            onClick={handleDiscard}
          >
            No (Discard)
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            className="!bg-blue-600 hover:!bg-blue-700"
            onClick={handleSaveAndLeave}
          >
            Yes (Save)
          </Button>
        </div>
      </Modal>
    </div>
  );
}
