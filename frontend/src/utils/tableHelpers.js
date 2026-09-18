export function recordMatchesSearch(record, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const walk = (value) => {
    if (value == null) return false;
    if (typeof value === 'object') {
      return Object.values(value).some(walk);
    }
    return String(value).toLowerCase().includes(q);
  };
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
