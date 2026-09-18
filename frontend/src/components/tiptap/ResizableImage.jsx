import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined } from '@ant-design/icons';
import { useCallback, useRef } from 'react';

function AlignBtn({ title, active, onClick, icon, label }) {
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
      className={`inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-medium ${
        active ? 'bg-teal-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ResizableImageView({ node, updateAttributes, selected }) {
  const imgRef = useRef(null);
  const startRef = useRef(null);
  const { src, alt, title, width, height, align } = node.attrs;

  const onResizeStart = useCallback((e, corner) => {
    e.preventDefault();
    e.stopPropagation();
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
      updateAttributes({ width: nextW, height: nextH });
    };

    const onUp = () => {
      startRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [updateAttributes]);

  const setAlign = (next) => {
    updateAttributes({ align: next });
  };

  const floatStyle = align === 'right'
    ? { float: 'right', marginLeft: 12, marginBottom: 6 }
    : align === 'center'
      ? { display: 'block', marginLeft: 'auto', marginRight: 'auto', float: 'none', textAlign: 'center' }
      : { float: 'left', marginRight: 12, marginBottom: 6 };

  return (
    <NodeViewWrapper
      as="div"
      className={`resizable-image-wrap ${selected ? 'is-selected' : ''} align-${align || 'left'}`}
      style={{
        width: width ? `${width}px` : 'fit-content',
        maxWidth: '100%',
        ...floatStyle,
      }}
    >
      {selected && (
        <div className="image-align-toolbar" contentEditable={false}>
          <AlignBtn
            title="Align left"
            label="Left"
            active={align === 'left' || !align}
            icon={<AlignLeftOutlined />}
            onClick={() => setAlign('left')}
          />
          <AlignBtn
            title="Align center"
            label="Center"
            active={align === 'center'}
            icon={<AlignCenterOutlined />}
            onClick={() => setAlign('center')}
          />
          <AlignBtn
            title="Align right"
            label="Right"
            active={align === 'right'}
            icon={<AlignRightOutlined />}
            onClick={() => setAlign('right')}
          />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt || ''}
        title={title || ''}
        draggable={false}
        style={{
          width: width ? `${width}px` : 'auto',
          height: height ? `${height}px` : 'auto',
          maxWidth: '100%',
          display: 'block',
        }}
      />
      {selected && (
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
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute('width') || el.style.width;
          if (!w) return null;
          const n = parseInt(String(w), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width, style: `width: ${attrs.width}px` } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = el.getAttribute('height') || el.style.height;
          if (!h) return null;
          const n = parseInt(String(h), 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      align: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-align') || 'left',
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
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
