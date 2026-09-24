const STORAGE_KEY = 'qm-organization-column-config';

/** Built-in company fields that can be renamed or hidden from Configuration → Columns. */
export const ORGANIZATION_BUILTIN_DEFS = [
  { field_key: 'website', field_label: 'Website', field_type: 'URL' },
  { field_key: 'tax_number', field_label: 'Tax / GST number', field_type: 'TEXT' },
  { field_key: 'address', field_label: 'Address', field_type: 'TEXTAREA' },
  { field_key: 'notes', field_label: 'Notes', field_type: 'TEXTAREA' },
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

function merge(def) {
  const override = readStore()[def.field_key] || {};
  return {
    id: `builtin:${def.field_key}`,
    field_key: def.field_key,
    field_label: override.field_label || def.field_label,
    field_type: def.field_type,
    is_required: Boolean(override.is_required),
    is_hidden: Boolean(override.is_hidden),
    is_builtin: true,
    entity_type: 'ORGANIZATION',
  };
}

export function getOrganizationBuiltinColumns() {
  return ORGANIZATION_BUILTIN_DEFS.map(merge).filter((c) => !c.is_hidden);
}

export function getAllOrganizationBuiltinColumnsIncludingHidden() {
  return ORGANIZATION_BUILTIN_DEFS.map(merge);
}

export function updateOrganizationBuiltinColumn(fieldKey, patch) {
  const store = readStore();
  store[fieldKey] = { ...(store[fieldKey] || {}), ...patch };
  writeStore(store);
}

export function hideOrganizationBuiltinColumn(fieldKey) {
  updateOrganizationBuiltinColumn(fieldKey, { is_hidden: true });
}
