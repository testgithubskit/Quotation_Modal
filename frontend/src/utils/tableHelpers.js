export function recordMatchesSearch(record, search, keys) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const walk = (value) => {
    if (value == null) return false;
    if (typeof value === 'function') return false;
    if (typeof value === 'object') {
      return Object.values(value).some(walk);
    }
    return String(value).toLowerCase().includes(q);
  };
  if (Array.isArray(keys) && keys.length) {
    return keys.some((key) => {
      if (typeof key === 'function') return walk(key(record));
      return walk(record?.[key]);
    });
  }
  return walk(record);
}

export function slugCode(text, fallback = 'ITEM') {
  const base = String(text || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base || fallback;
}

/** Standalone admin pages (e.g. Activities) — navbar, toolbar, pagination, footer. */
export const activitiesTableScroll = {
  x: 'max-content',
  y: 'calc(100vh - 300px)',
};

/** Configuration tabs — extra tab bar above the table; leave room for pagination. */
export const configTableScroll = {
  x: 'max-content',
  y: 'calc(100vh - 380px)',
};

/** Serial number column for paginated Ant Design tables */
export function slNoColumn(page = 1, pageSize = 20) {
  return {
    title: 'Sl No',
    key: 'sl_no',
    width: 72,
    fixed: 'left',
    render: (_, __, index) => (page - 1) * pageSize + index + 1,
  };
}
