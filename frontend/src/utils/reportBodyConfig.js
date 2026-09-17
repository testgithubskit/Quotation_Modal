/** Default body table columns for quotation reports. */
export const BODY_COLUMNS = [
  { key: 'slNo', label: 'Sl. No.', locked: true },
  { key: 'sampleActivity', label: 'Sample/Activity' },
  { key: 'description', label: 'Description' },
  { key: 'specification', label: 'Specification' },
  { key: 'qty', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'unitRate', label: 'Unit Rate' },
  { key: 'total', label: 'Total', locked: true },
];

export const DEFAULT_INCLUDED = {
  showNotes: true,
  showTerms: true,
  showCustomerContact: true,
  showCustomerAddress: true,
};

export function normalizeColumnConfig(saved) {
  const byKey = new Map((saved || []).map((c) => [c.key, c]));
  const ordered = [];
  const seen = new Set();

  (saved || []).forEach((c) => {
    const base = BODY_COLUMNS.find((b) => b.key === c.key);
    if (!base || seen.has(c.key)) return;
    ordered.push({
      key: base.key,
      label: base.label,
      locked: Boolean(base.locked),
      visible: c.visible !== false,
    });
    seen.add(c.key);
  });

  BODY_COLUMNS.forEach((base) => {
    if (seen.has(base.key)) return;
    const prev = byKey.get(base.key);
    ordered.push({
      key: base.key,
      label: base.label,
      locked: Boolean(base.locked),
      visible: prev ? prev.visible !== false : true,
    });
  });

  return ordered;
}

export function normalizeIncluded(saved) {
  return { ...DEFAULT_INCLUDED, ...(saved || {}) };
}

export function visibleColumns(config) {
  return normalizeColumnConfig(config).filter((c) => c.visible !== false);
}
