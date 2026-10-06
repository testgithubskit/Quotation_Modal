import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import {
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  VerticalAlignTopOutlined, VerticalAlignBottomOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function AlignBtn({ title, active, onClick, icon }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded ${
        active ? 'bg-teal-600 text-white' : 'bg-transparent text-slate-700 hover:bg-slate-100'
      }`}
    >
      {icon}
    </button>
  );
}

function placementStyle(align, fitCell) {
  if (fitCell) {
    return {
      float: 'none',
      display: 'block',
      width: '100%',
      maxWidth: '100%',
      margin: 0,
    };
  }
  switch (align) {
    case 'top':
      return {
        float: 'none',
        display: 'block',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 0,
        marginBottom: 12,
      };
    case 'bottom':
      return {
        float: 'none',
        display: 'block',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 24,
        marginBottom: 0,
      };
    case 'right':
      return {
        float: 'right',
        marginLeft: 12,
        marginRight: 0,
        marginBottom: 6,
        marginTop: 0,
      };
    case 'center':
      return {
        float: 'none',
        display: 'block',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 8,
        marginBottom: 8,
      };
    case 'left':
    default:
      return {
        float: 'left',
        marginRight: 12,
        marginLeft: 0,
        marginBottom: 6,
        marginTop: 0,
      };
  }
}

function ImageAlignToolbarPortal({ anchorEl, children, visible }) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    if (!visible || !anchorEl) {
      setBox(null);
      return undefined;
    }
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const toolbarH = 40;
      const gap = 8;
      const spaceAbove = r.top;
      const placeBelow = spaceAbove < toolbarH + gap + 4;
      setBox({
        left: r.left + r.width / 2,
        top: placeBelow ? r.bottom + gap : r.top - gap,
        below: placeBelow,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [visible, anchorEl]);

  if (!visible || !box) return null;

  return createPortal(
    <div
      className="image-align-toolbar-portal"
      contentEditable={false}
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        transform: box.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        zIndex: 120,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

function ResizableImageView({ node, updateAttributes, selected, editor, getPos }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const startRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { src, alt, title, width, height, align, fitCell } = node.attrs;
  const showToolbar = selected || menuOpen;
  const currentAlign = align || 'left';
  const isFit = Boolean(fitCell);

  useEffect(() => {
    if (!selected) setMenuOpen(false);
  }, [selected]);

  useLayoutEffect(() => {
    const el = imgRef.current?.closest?.('.resizable-image-wrap') || imgRef.current?.parentElement;
    wrapRef.current = el;
    setAnchorEl(el || null);
  }, [showToolbar, selected, width, height, isFit, currentAlign]);

  const onResizeStart = useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.attrs.fitCell) {
      updateAttributes({ fitCell: false });
    }
    const img = imgRef.current;
    if (!img) return;
    const startW = img.offsetWidth;
    const startH = img.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    startRef.current = { startW, startH, startX, startY, corner, ratio: startW / Math.max(startH, 1) };

    const onMove = (ev) => {
      const s = startRef.current;
      if (!s) return;
      const dx = ev.clientX - s.startX;
      let nextW = s.startW;
      if (corner.includes('e')) nextW = s.startW + dx;
      if (corner.includes('w')) nextW = s.startW - dx;
      nextW = Math.max(48, Math.min(nextW, 900));
      const nextH = Math.round(nextW / s.ratio);
      updateAttributes({ width: nextW, height: nextH, fitCell: false });
    };

    const onUp = () => {
      startRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [node.attrs.fitCell, updateAttributes]);

  const setAlign = (next) => {
    updateAttributes({ align: next, fitCell: false });
  };

  const fitToCell = () => {
    const wrap = wrapRef.current;
    const cell = wrap?.closest?.('td, th');
    let cellW = null;
    if (cell) {
      const cs = window.getComputedStyle(cell);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      cellW = Math.max(48, Math.floor(cell.clientWidth - padL - padR));
    }
    updateAttributes({
      fitCell: true,
      align: 'center',
      width: cellW || null,
      height: null,
    });
  };

  return (
    <NodeViewWrapper
      as="div"
      className={`resizable-image-wrap ${selected ? 'is-selected' : ''} align-${currentAlign} ${isFit ? 'is-fit-cell' : ''}`}
      style={{
        width: isFit ? '100%' : (width ? `${width}px` : 'fit-content'),
        maxWidth: '100%',
        cursor: 'grab',
        ...placementStyle(currentAlign, isFit),
      }}
      data-drag-handle
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(true);
        try {
          const pos = typeof getPos === 'function' ? getPos() : null;
          if (pos != null && editor) {
            editor.chain().focus().setNodeSelection(pos).run();
          }
        } catch {
          /* ignore */
        }
      }}
    >
      <ImageAlignToolbarPortal anchorEl={anchorEl} visible={showToolbar}>
        <AlignBtn
          title="Align top"
          active={!isFit && currentAlign === 'top'}
          icon={<VerticalAlignTopOutlined />}
          onClick={() => setAlign('top')}
        />
        <AlignBtn
          title="Align left"
          active={!isFit && currentAlign === 'left'}
          icon={<AlignLeftOutlined />}
          onClick={() => setAlign('left')}
        />
        <AlignBtn
          title="Align center"
          active={!isFit && currentAlign === 'center'}
          icon={<AlignCenterOutlined />}
          onClick={() => setAlign('center')}
        />
        <AlignBtn
          title="Align right"
          active={!isFit && currentAlign === 'right'}
          icon={<AlignRightOutlined />}
          onClick={() => setAlign('right')}
        />
        <AlignBtn
          title="Align bottom"
          active={!isFit && currentAlign === 'bottom'}
          icon={<VerticalAlignBottomOutlined />}
          onClick={() => setAlign('bottom')}
        />
        <span className="mx-0.5 h-5 w-px bg-slate-300" />
        <AlignBtn
          title="Fit to cell (full width)"
          active={isFit}
          icon={<ExpandOutlined />}
          onClick={fitToCell}
        />
      </ImageAlignToolbarPortal>

      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        title={title || 'Drag to move · Fit to cell for full width'}
        draggable={false}
        style={{
          width: isFit ? '100%' : (width ? `${width}px` : 'auto'),
          height: isFit ? 'auto' : (height ? `${height}px` : 'auto'),
          maxWidth: '100%',
          display: 'block',
          pointerEvents: 'auto',
          objectFit: isFit ? 'contain' : undefined,
        }}
      />
      {selected && !isFit && (
        <>
          {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((corner) => (
            <span
              key={corner}
              className={`image-resize-handle handle-${corner}`}
              contentEditable={false}
              onMouseDown={(e) => onResizeStart(e, corner)}
            />
          ))}
        </>
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: 'image',
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          if (el.getAttribute('data-fit-cell') === 'true') return null;
          const w = el.getAttribute('width') || el.style.width;
          if (!w || String(w).includes('%')) return null;
          const n = parseInt(String(w), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => {
          if (attrs.fitCell) return { style: 'width: 100%; max-width: 100%;' };
          return attrs.width ? { width: attrs.width, style: `width: ${attrs.width}px` } : {};
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = el.getAttribute('height') || el.style.height;
          if (!h) return null;
          const n = parseInt(String(h), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => (attrs.fitCell || !attrs.height ? {} : { height: attrs.height }),
      },
      align: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-align') || 'left',
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
      fitCell: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-fit-cell') === 'true',
        renderHTML: (attrs) => (attrs.fitCell ? { 'data-fit-cell': 'true' } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({
  allowBase64: true,
  inline: false,
});
