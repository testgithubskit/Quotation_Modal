import { useEffect, useRef, useState } from 'react';

/**
 * Measure a table card and return scroll.y so thead stays fixed
 * and only the body scrolls (pagination stays visible below).
 */
export function useTableScrollY(bottomReserve = 110) {
  const containerRef = useRef(null);
  const [scrollY, setScrollY] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const update = () => {
      const height = el.clientHeight;
      if (height < 80) return;
      // Body scroll area = card height minus thead + pagination footer
      const header = el.querySelector('.ant-table-header')?.offsetHeight
        || el.querySelector('.ant-table-thead')?.offsetHeight
        || 55;
      const pagination = el.querySelector('.ant-table-pagination')?.offsetHeight || bottomReserve;
      const available = height - header - pagination - 8;
      setScrollY(Math.max(160, available));
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(el);
    requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [bottomReserve]);

  return { containerRef, scrollY };
}
