/** Case-insensitive search across any of the given field keys (or all own keys). */
export function recordMatchesSearch(record, search, keys) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const fields = keys?.length ? keys : Object.keys(record || {}).filter((k) => k !== 'id');
  return fields.some((key) => {
    const value = record?.[key];
    if (value == null || value === '') return false;
    return String(value).toLowerCase().includes(q);
  });
}

function compareValues(a, b, dataIndex, type) {
  const av = a?.[dataIndex];
  const bv = b?.[dataIndex];
  if (type === 'number') {
    return Number(av || 0) - Number(bv || 0);
  }
  return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

/** Add column sorter only (global search is in the toolbar). */
export function withSortFilter(column, { type = 'text' } = {}) {
  if (!column.dataIndex || column.key === 'actions' || column.title === 'Actions' || column.title === 'Sl.No') {
    return column;
  }
  const dataIndex = column.dataIndex;
  return {
    ...column,
    sorter: (a, b) => compareValues(a, b, dataIndex, type),
    sortDirections: ['ascend', 'descend'],
  };
}

export function enhanceColumns(columns, fieldTypeByKey = {}) {
  return columns.map((col) => {
    if (!col.dataIndex) return col;
    const type = fieldTypeByKey[col.dataIndex] || (col.dataIndex === 'cost' ? 'number' : 'text');
    return withSortFilter(col, { type });
  });
}
