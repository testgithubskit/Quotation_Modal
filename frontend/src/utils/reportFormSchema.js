export const DEFAULT_REPORT_HEADER_FIELDS = [
  { key: 'reportNo', label: 'Report No', type: 'text', builtIn: true, required: true },
  { key: 'date', label: 'Date', type: 'date', builtIn: true, required: true },
];

export const DEFAULT_REPORT_CUSTOMER_FIELDS = [];

export const DEFAULT_REPORT_TERMS_FIELDS = [
  { key: 'termsAndConditions', label: 'Terms and Conditions', type: 'textarea', builtIn: true },
];

const STORAGE_KEY = 'qm-generate-report-schema';

export function slugifyFieldKey(label, existingKeys = []) {
  let base = String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'field';
  if (!/^[a-z]/.test(base)) base = `f_${base}`;
  let key = base;
  let i = 1;
  while (existingKeys.includes(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

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

function mergeSchema(saved, defaults) {
  if (!saved?.length) return [...defaults];
  const savedKeys = new Set(saved.map((f) => f.key));
  const merged = saved.map((f) => {
    const def = defaults.find((d) => d.key === f.key);
    return def ? { ...def, ...f, builtIn: Boolean(def.builtIn || f.builtIn) } : f;
  });
  defaults.forEach((d) => {
    if (!savedKeys.has(d.key)) merged.push(d);
  });
  return merged;
}

export function loadReportFormSchema() {
  const store = readStore();
  return {
    reportHeaderFields: mergeSchema(store.reportHeaderFields, DEFAULT_REPORT_HEADER_FIELDS),
    reportCustomerFields: mergeSchema(store.reportCustomerFields, DEFAULT_REPORT_CUSTOMER_FIELDS),
    reportTermsFields: mergeSchema(store.reportTermsFields, DEFAULT_REPORT_TERMS_FIELDS),
  };
}

export function saveReportFormSchema(schema) {
  writeStore(schema);
}

export function addSchemaField(listKey, field) {
  const schema = loadReportFormSchema();
  const next = {
    ...schema,
    [listKey]: [...schema[listKey], field],
  };
  saveReportFormSchema(next);
  return next;
}

export function removeSchemaField(listKey, key) {
  const schema = loadReportFormSchema();
  const next = {
    ...schema,
    [listKey]: schema[listKey].filter((f) => f.key !== key || f.builtIn),
  };
  saveReportFormSchema(next);
  return next;
}
