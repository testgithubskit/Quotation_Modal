import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined, StrikethroughOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  ClearOutlined, CloseOutlined, FontColorsOutlined, BgColorsOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS } from '../../utils/reportPlaceholders.js';

function Btn({ title, active, onClick, icon }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm transition ${
        active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {icon}
    </button>
  );
}

/** FORMAT TEXT popover — opens on right-click inside the editor. */
export default function SelectionFormatToolbar({ editor }) {
  const [box, setBox] = useState(null);
  const hoveringRef = useRef(false);

  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.view.dom;

    const openAt = (clientX, clientY) => {
      setBox({
        left: clientX,
        top: clientY,
      });
    };

    const onContextMenu = (e) => {
      // Don't steal image right-click (handled by image node)
      if (e.target?.closest?.('.resizable-image-wrap')) return;
      e.preventDefault();
      e.stopPropagation();

      const { view } = editor;
      const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (pos != null) {
        const { empty, from, to } = editor.state.selection;
        const clicked = pos.pos;
        if (empty || clicked < from || clicked > to) {
          editor.chain().focus().setTextSelection(clicked).run();
        } else {
          editor.chain().focus().run();
        }
      } else {
        editor.chain().focus().run();
      }
      openAt(e.clientX, e.clientY);
    };

    const onDocMouseDown = (e) => {
      if (hoveringRef.current) return;
      if (e.target?.closest?.('.selection-format-toolbar')) return;
      setBox(null);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setBox(null);
    };

    dom.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      dom.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editor]);

  if (!box || !editor) return null;

  const attrs = editor.getAttributes('textStyle') || {};
  const fontFamily = attrs.fontFamily || undefined;
  const fontSize = attrs.fontSize || undefined;
  const color = attrs.color || '#000000';

  return createPortal(
    <div
      className="selection-format-toolbar"
      style={{
        position: 'fixed',
        top: box.top,
        left: box.left,
        transform: 'translate(8px, 8px)',
        zIndex: 90,
      }}
      onMouseEnter={() => {
        hoveringRef.current = true;
      }}
      onMouseLeave={() => {
        hoveringRef.current = false;
      }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Format Text
        </span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setBox(null)}
        >
          <CloseOutlined className="text-[10px]" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Select
          size="small"
          className="!w-[132px]"
          popupClassName="designer-font-dropdown"
          placeholder="Font"
          value={fontFamily}
          showSearch
          optionFilterProp="label"
          options={FONT_FAMILY_OPTIONS.filter((o) => o.value !== '__divider__')}
          optionRender={(opt) => (
            <span style={{ fontFamily: String(opt.data?.value || '') }}>{opt.data?.label}</span>
          )}
          onChange={(v) => {
            if (v) editor.chain().focus().setFontFamily(v).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
        />
        <Select
          size="small"
          className="!w-[72px]"
          placeholder="Size"
          value={fontSize}
          options={FONT_SIZE_OPTIONS}
          showSearch
          optionFilterProp="label"
          onChange={(v) => editor.chain().focus().setFontSize(v).run()}
        />
        <Btn title="Bold" active={editor.isActive('bold')} icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn title="Italic" active={editor.isActive('italic')} icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Btn title="Underline" active={editor.isActive('underline')} icon={<UnderlineOutlined />} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Btn title="Strike" active={editor.isActive('strike')} icon={<StrikethroughOutlined />} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="mx-0.5 h-5 w-px bg-slate-200" />
        <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} icon={<AlignLeftOutlined />} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} icon={<AlignCenterOutlined />} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} icon={<AlignRightOutlined />} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-1.5">
        <Btn title="Bullet list" active={editor.isActive('bulletList')} icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-slate-700 hover:bg-slate-100">
          <FontColorsOutlined />
          Color
          <span className="inline-block h-3.5 w-3.5 rounded-sm border border-slate-300" style={{ background: color }} />
          <input
            type="color"
            className="sr-only"
            value={/^#/.test(color) ? color : '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-slate-700 hover:bg-slate-100">
          <BgColorsOutlined />
          Highlight
          <span className="inline-block h-3.5 w-3.5 rounded-sm border border-slate-300 bg-yellow-300" />
          <input
            type="color"
            className="sr-only"
            defaultValue="#fef08a"
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
        <Btn title="Clear formatting" icon={<ClearOutlined />} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
      </div>
    </div>,
    document.body,
  );
}
