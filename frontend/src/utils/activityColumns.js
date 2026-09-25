const STORAGE_KEY = 'qm-activity-column-config';

/** Built-in activity columns (data lives on activity record; labels/required/hidden are configurable). */
export const ACTIVITY_BUILTIN_DEFS = [
  { field_key: 'code', field_label: 'Activity Code', field_type: 'TEXT', no_hide: true },
  { field_key: 'name', field_label: 'Name', field_type: 'TEXT' },
  { field_key: 'description', field_label: 'Description', field_type: 'TEXTAREA' },
  { field_key: 'unit', field_label: 'Unit', field_type: 'TEXT' },
  { field_key: 'unit_price', field_label: 'Unit Price', field_type: 'DECIMAL' },
];

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStore(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Merged builtin column list for Manage Columns + table */
export function getActivityBuiltinColumns() {
  const store = readStore();
  return ACTIVITY_BUILTIN_DEFS.map((def) => {
    const override = store[def.field_key] || {};
    return {
      id: `builtin:${def.field_key}`,
      field_key: def.field_key,
      field_label: override.field_label || def.field_label,
      field_type: def.field_type,
      is_required: Boolean(override.is_required),
      is_hidden: Boolean(override.is_hidden),
      is_builtin: true,
      no_hide: Boolean(def.no_hide),
      entity_type: 'ACTIVITY',
    };
  }).filter((c) => !c.is_hidden);
}

export function getAllActivityBuiltinColumnsIncludingHidden() {
  const store = readStore();
  return ACTIVITY_BUILTIN_DEFS.map((def) => {
    const override = store[def.field_key] || {};
    return {
      id: `builtin:${def.field_key}`,
      field_key: def.field_key,
      field_label: override.field_label || def.field_label,
      field_type: def.field_type,
      is_required: Boolean(override.is_required),
      is_hidden: Boolean(override.is_hidden),
      is_builtin: true,
      no_hide: Boolean(def.no_hide),
      entity_type: 'ACTIVITY',
    };
  });
}

export function updateActivityBuiltinColumn(fieldKey, patch) {
  const store = readStore();
  store[fieldKey] = { ...(store[fieldKey] || {}), ...patch };
  writeStore(store);
}

export function hideActivityBuiltinColumn(fieldKey) {
  const def = ACTIVITY_BUILTIN_DEFS.find((d) => d.field_key === fieldKey);
  if (def?.no_hide) return;
  updateActivityBuiltinColumn(fieldKey, { is_hidden: true });
}

export function restoreActivityBuiltinColumn(fieldKey) {
  updateActivityBuiltinColumn(fieldKey, { is_hidden: false });
}

export function readActivityBuiltinValue(record, fieldKey) {
  if (fieldKey === 'code') return record.code;
  if (fieldKey === 'unit_price') return record.unit_price;
  if (fieldKey === 'name') return record.name;
  if (fieldKey === 'description') return record.description;
  if (fieldKey === 'unit') return record.unit;
  return record[fieldKey];
}

/** field_key → display label for bulk import (includes renamed built-ins). */
export function getActivityBuiltinImportLabels() {
  const labels = {};
  getAllActivityBuiltinColumnsIncludingHidden().forEach((col) => {
    labels[col.field_key] = col.field_label;
  });
  return labels;
}

export function builtinAliases(column) {
  const label = column.field_label;
  const key = column.field_key;
  const defaults = {
    code: ['Activity Code', 'activity_code', 'code', 'Code'],
    name: ['name', 'Name', 'Particulars', 'particulars', 'specification', 'Item'],
    description: ['description', 'Description', 'Specifications', 'Specification', 'Scope of Calibration', 'particulars'],
    unit: ['unit', 'Unit'],
    unit_price: [
      'unit_price', 'Unit Price', 'Proposed Charges 2023', 'Proposed Charges',
      'Charges April 2020', 'Charges', 'cost', 'Cost', 'Rate', 'Price',
    ],
  };
  return [label, key, ...(defaults[key] || [])];
}
