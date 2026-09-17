import { useEffect, useRef, useState } from 'react';

/**
 * Measure a table card and return scroll.y so thead stays fixed
 * and only the body scrolls (pagination stays visible below).
 * Pass deps (e.g. pageSize, rowCount) so height remeasures when the table changes.
 */
export function useTableScrollY(bottomReserve = 72, deps = []) {
  const containerRef = useRef(null);
  const [scrollY, setScrollY] = useState(280);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const update = () => {
      const height = el.clientHeight;
      if (height < 80) return;

      const header = el.querySelector('.ant-table-header')?.offsetHeight
        || el.querySelector('.ant-table-thead')?.offsetHeight
        || 47;
      const paginationEl = el.querySelector('.ant-table-pagination');
      const pagination = paginationEl
        ? paginationEl.offsetHeight + 16
        : bottomReserve;
      const available = height - header - pagination - 4;
      setScrollY(Math.max(120, available));
    };

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => requestAnimationFrame(update))
      : null;
    if (ro) ro.observe(el);

    const mo = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => requestAnimationFrame(update))
      : null;
    if (mo) mo.observe(el, { childList: true, subtree: true });

    requestAnimationFrame(update);
    const t1 = setTimeout(update, 50);
    const t2 = setTimeout(update, 200);
    window.addEventListener('resize', update);

    return () => {
      ro?.disconnect();
      mo?.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomReserve, ...deps]);

  return { containerRef, scrollY };
}
