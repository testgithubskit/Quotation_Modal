export const DEFAULT_ACTIVITY_FIELDS = [
  { key: 'code', label: 'Activity Code', type: 'text', builtIn: true },
  { key: 'specification', label: 'Specification', type: 'text', builtIn: true },
  { key: 'particulars', label: 'Particulars', type: 'textarea', builtIn: true },
  { key: 'cost', label: 'Cost (₹)', type: 'number', builtIn: true },
];

export const DEFAULT_CUSTOMER_FIELDS = [
  { key: 'name', label: 'Customer Name', type: 'text', builtIn: true },
  { key: 'company', label: 'Company', type: 'text', builtIn: true },
  { key: 'address', label: 'Address', type: 'textarea', builtIn: true },
  { key: 'email', label: 'Email', type: 'email', builtIn: true },
  { key: 'mobile', label: 'Mobile Number', type: 'text', builtIn: true },
];

export const DEFAULT_USER_FIELDS = [
  { key: 'full_name', label: 'Full Name', type: 'text', builtIn: true },
  { key: 'email', label: 'Email', type: 'email', builtIn: true },
  { key: 'role_name', label: 'Role', type: 'text', builtIn: true },
  { key: 'phone', label: 'Phone', type: 'text', builtIn: true },
  { key: 'is_active', label: 'Status', type: 'text', builtIn: true },
];

/** Built-in header fields on Generate Report; more can be added via Add Field. */
export const DEFAULT_REPORT_HEADER_FIELDS = [
  { key: 'reportNo', label: 'Report No', type: 'text', builtIn: true, required: true },
  { key: 'date', label: 'Date', type: 'date', builtIn: true, required: true },
];

/** Extra customer fields on Generate Report — add via Add Column. */
export const DEFAULT_REPORT_CUSTOMER_FIELDS = [];

/** One built-in terms field; everything else is custom via Add Column. */
export const DEFAULT_REPORT_TERMS_FIELDS = [
  { key: 'termsAndConditions', label: 'Terms and Conditions', type: 'textarea', builtIn: true },
];

/** Old built-ins that were removed from defaults (keep custom copies if user added them). */
const LEGACY_REPORT_HEADER_KEYS = new Set(['centre', 'lab', 'enquiryNo']);

export function slugifyFieldKey(label, existingKeys = []) {
  let base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'field';
  // Backend requires: ^[a-z][a-z0-9_]*$
  if (!/^[a-z]/.test(base)) base = `f_${base}`;
  let key = base;
  let i = 1;
  while (existingKeys.includes(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

const FE_TO_BE_FIELD_TYPE = {
  text: 'TEXT',
  textarea: 'TEXTAREA',
  number: 'NUMBER',
  email: 'EMAIL',
  date: 'DATE',
};

const BE_TO_FE_FIELD_TYPE = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  DECIMAL: 'number',
  EMAIL: 'email',
  DATE: 'date',
  DATETIME: 'date',
  BOOLEAN: 'text',
  SELECT: 'text',
  MULTISELECT: 'text',
  URL: 'text',
};

export function toBackendFieldType(feType) {
  return FE_TO_BE_FIELD_TYPE[feType] || 'TEXT';
}

export function toFrontendFieldType(beType) {
  return BE_TO_FE_FIELD_TYPE[beType] || 'text';
}

export function customFieldToSchema(def) {
  return {
    id: def.id,
    key: def.field_key,
    label: def.field_label,
    type: toFrontendFieldType(def.field_type),
    builtIn: false,
    required: Boolean(def.is_required),
  };
}

export function mergeSchema(saved, defaults) {
  if (!saved?.length) return defaults;
  const savedKeys = new Set(saved.map((f) => f.key));
  const merged = saved.map((f) => {
    const def = defaults.find((d) => d.key === f.key);
    return def ? { ...def, ...f, builtIn: true } : f;
  });
  defaults.forEach((d) => {
    if (!savedKeys.has(d.key)) merged.push(d);
  });
  return merged;
}

export function normalizeReportHeaderFields(saved) {
  const defaultKeys = new Set(DEFAULT_REPORT_HEADER_FIELDS.map((f) => f.key));
  return mergeSchema(saved, DEFAULT_REPORT_HEADER_FIELDS)
    .filter((f) => !(f.builtIn && LEGACY_REPORT_HEADER_KEYS.has(f.key) && !defaultKeys.has(f.key)));
}

export function formatFieldValue(field, value) {
  if (value == null || value === '') return '—';
  if (field.type === 'number') return Number(value).toLocaleString('en-IN');
  return String(value);
}

export function fieldLabelFromKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
