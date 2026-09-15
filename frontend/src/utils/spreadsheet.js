import * as XLSX from 'xlsx';

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function sheetToObjects(workbook) {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function parseCsvText(text) {
  const workbook = XLSX.read(text, { type: 'string' });
  return sheetToObjects(workbook);
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
  const workbook = XLSX.read(buffer, { type: 'array' });
  return sheetToObjects(workbook);
}

/**
 * Map spreadsheet rows to activity payloads.
 * Accepts headers like code, specification/name, particulars/description, cost/unit_price.
 */
export function mapRowsToActivities(rows) {
  return (rows || [])
    .map((row, index) => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[normalizeHeader(key)] = value;
      });

      const code = String(
        normalized.code
        || normalized.activity_code
        || normalized.activitycode
        || '',
      ).trim();
      const specification = String(
        normalized.specification
        || normalized.name
        || normalized.activity
        || '',
      ).trim();
      const particulars = String(
        normalized.particulars
        || normalized.description
        || '',
      ).trim();
      const costRaw = normalized.cost ?? normalized.unit_price ?? normalized.price ?? 0;
      const cost = Number(String(costRaw).replace(/[^0-9.-]/g, '')) || 0;

      if (!code && !specification && !particulars) return null;

      return {
        code: code || `ACT-${Date.now()}${index}`,
        specification,
        particulars,
        cost,
      };
    })
    .filter(Boolean);
}
