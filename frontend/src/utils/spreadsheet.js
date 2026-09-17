import * as XLSX from 'xlsx';

export function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, ' percent ')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function cellText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function isLikelyHeaderCell(text) {
  const n = normalizeHeader(text);
  if (!n) return false;
  return (
    n.includes('particular')
    || n.includes('specification')
    || n === 'specs'
    || n.includes('sl_no')
    || n === 'slno'
    || n === 'code'
    || n.includes('activity')
    || n.includes('charge')
    || n.includes('cost')
    || n.includes('price')
    || n.includes('scope')
    || n.includes('machine')
  );
}

/** Find the header row in a sheet (skips title / revision rows). */
export function findHeaderRowIndex(aoa) {
  const rows = aoa || [];
  let bestIdx = -1;
  let bestScore = 0;
  const scan = Math.min(rows.length, 25);
  for (let i = 0; i < scan; i += 1) {
    const row = rows[i] || [];
    const cells = row.map(cellText).filter(Boolean);
    if (cells.length < 2) continue;
    const score = cells.filter(isLikelyHeaderCell).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : (rows.length ? 0 : -1);
}

function uniqueHeaders(rawHeaders) {
  const seen = {};
  return rawHeaders.map((h, idx) => {
    let base = normalizeHeader(h) || `column_${idx + 1}`;
    if (seen[base] == null) {
      seen[base] = 0;
      return base;
    }
    seen[base] += 1;
    return `${base}_${seen[base]}`;
  });
}

function sheetToNormalizedRows(sheet) {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!aoa.length) return [];
  const headerIdx = findHeaderRowIndex(aoa);
  if (headerIdx < 0) return [];

  const headerRow = aoa[headerIdx] || [];
  const headers = uniqueHeaders(headerRow.map(cellText));
  const rows = [];

  for (let r = headerIdx + 1; r < aoa.length; r += 1) {
    const line = aoa[r] || [];
    const obj = {};
    let nonEmpty = 0;
    headers.forEach((key, c) => {
      const val = cellText(line[c]);
      obj[key] = val;
      if (val) nonEmpty += 1;
    });
    if (nonEmpty === 0) continue;
    // Skip note / section-only rows
    const joined = Object.values(obj).join(' ').toLowerCase();
    if (joined.startsWith('note') && nonEmpty <= 2) continue;
    rows.push(obj);
  }
  return rows;
}

const SKIP_SHEETS = new Set(['notes', 'justification', 'sheet1', 'sheet2']);

function parseCsvText(text) {
  const workbook = XLSX.read(text, { type: 'string' });
  return parseWorkbook(workbook);
}

function parseWorkbook(workbook) {
  const all = [];
  (workbook.SheetNames || []).forEach((name) => {
    const trimmed = String(name || '').trim();
    if (SKIP_SHEETS.has(trimmed.toLowerCase())) return;
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet['!ref']) return;
    const rows = sheetToNormalizedRows(sheet);
    rows.forEach((row) => {
      all.push({ ...row, __sheet: trimmed });
    });
  });
  return all;
}

async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/** Parse .xlsx / .xls / .csv into row objects keyed by normalized headers. */
export async function parseSpreadsheetFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await readFileAsText(file);
    return parseCsvText(text);
  }

  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parseWorkbook(workbook);
}

function firstMatch(normalized, candidates) {
  for (const key of candidates) {
    if (normalized[key] != null && String(normalized[key]).trim() !== '') {
      return String(normalized[key]).trim();
    }
  }
  // fuzzy: any key that includes a candidate token
  const keys = Object.keys(normalized);
  for (const cand of candidates) {
    const hit = keys.find((k) => k === cand || k.includes(cand));
    if (hit && String(normalized[hit]).trim() !== '') {
      return String(normalized[hit]).trim();
    }
  }
  return '';
}

function parseCost(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  if (/actual|deputation|na|n\/a/i.test(text)) return 0;
  const num = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

const CODE_KEYS = ['code', 'activity_code', 'activitycode', 'sl_no', 'slno', 'sl_no_', 's_no', 'sno'];
const SPEC_KEYS = ['specification', 'specifications', 'specs', 'spec'];
const PART_KEYS = [
  'particulars', 'particular', 'description', 'activity', 'name',
  'machine_equipment', 'machineequipment', 'equipment',
];
const COST_KEYS = [
  'proposed_charges_april_2023',
  'proposed_charges_2023',
  'proposed_charges',
  'charges_april_2023',
  'unit_price',
  'price',
  'cost',
  'charges',
];
const SCOPE_KEYS = ['scope_of_calibration', 'scope', 'scope_'];

const BUILTIN_ACTIVITY_KEYS = new Set(['code', 'specification', 'particulars', 'cost']);

/**
 * Map spreadsheet rows to activity payloads.
 * Extra / custom columns from fieldDefs are filled when Excel headers match key or label.
 */
export function mapRowsToActivities(rows, fieldDefs = []) {
  const customFields = (fieldDefs || []).filter((f) => f && !BUILTIN_ACTIVITY_KEYS.has(f.key));
  let lastCode = '';

  return (rows || [])
    .map((row, index) => {
      const normalized = { ...(row || {}) };
      // already normalized keys from parser; still normalize any leftovers
      Object.entries(row || {}).forEach(([key, value]) => {
        if (key === '__sheet') return;
        normalized[normalizeHeader(key)] = value;
      });

      let code = firstMatch(normalized, CODE_KEYS);
      if (!code && lastCode) code = lastCode;
      if (code) lastCode = code;

      let specification = firstMatch(normalized, SPEC_KEYS);
      let particulars = firstMatch(normalized, PART_KEYS);
      const scope = firstMatch(normalized, SCOPE_KEYS);
      if (scope) {
        particulars = particulars ? `${particulars} — ${scope}` : scope;
      }

      const costRaw = firstMatch(normalized, COST_KEYS);
      const cost = parseCost(costRaw);

      if (!code && !specification && !particulars) return null;
      // Skip pure header echoes
      if (/^sl\.?\s*no/i.test(code) || /^particular/i.test(particulars)) return null;

      const activity = {
        code: code || `ACT-${Date.now()}${index}`,
        specification: specification || '',
        particulars: particulars || '',
        cost,
      };

      customFields.forEach((field) => {
        const aliases = [
          normalizeHeader(field.key),
          normalizeHeader(field.label),
        ].filter(Boolean);
        const value = firstMatch(normalized, aliases);
        if (value !== '') {
          activity[field.key] = field.type === 'number' ? parseCost(value) : value;
        }
      });

      // Also keep any unmatched non-empty columns that match custom field keys loosely
      return activity;
    })
    .filter(Boolean);
}
