export const REPORT_PLACEHOLDERS = [
  { token: '{{report_no}}', label: 'Report No' },
  { token: '{{date}}', label: 'Report Date' },
  { token: '{{customer_name}}', label: 'Customer Name' },
  { token: '{{company_name}}', label: 'Company' },
  { token: '{{mobile}}', label: 'Mobile' },
  { token: '{{email}}', label: 'Email' },
  { token: '{{subject}}', label: 'Subject' },
  { token: '{{items_table}}', label: 'Items Table' },
  { token: '{{grand_total}}', label: 'Grand Total' },
  { token: '{{terms}}', label: 'Terms' },
  { token: '{{activity_notes}}', label: 'Activity Notes' },
  { token: '{{org_name}}', label: 'Org Name' },
  { token: '{{org_address}}', label: 'Org Address' },
  { token: '{{page_number}}', label: 'Page #' },
  { token: '{{total_pages}}', label: 'Total Pages' },
];

/** Strip {{ }} wrappers → map key used by fillPlaceholders */
export function placeholderKey(tokenOrKey) {
  return String(tokenOrKey || '')
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .trim();
}

export const BUILTIN_PLACEHOLDER_KEYS = new Set([
  ...REPORT_PLACEHOLDERS.map((p) => placeholderKey(p.token)),
  'contact_person', // legacy alias of customer_name (removed from palette)
]);

function humanizeKey(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Field';
}

/** Collect placeholder keys referenced in template HTML (chips + {{tokens}}). */
export function extractPlaceholderKeysFromHtml(html) {
  const keys = new Set();
  const text = String(html || '');
  text.replace(/\bdata-placeholder=["']([^"']+)["']/gi, (_, key) => {
    const k = placeholderKey(key);
    if (k) keys.add(k);
    return '';
  });
  text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const k = placeholderKey(key);
    if (k) keys.add(k);
    return '';
  });
  return keys;
}

/**
 * Extra form fields driven by the starred template:
 * customPlaceholders + any non-built-in tokens used in header/body/footer HTML.
 */
export function resolveTemplateExtraFields(template) {
  const td = template?.template_data || {};
  const byKey = new Map();

  (td.customPlaceholders || []).forEach((p) => {
    const key = placeholderKey(p?.token || p?.key);
    if (!key || BUILTIN_PLACEHOLDER_KEYS.has(key)) return;
    byKey.set(key, {
      key,
      label: p.label || humanizeKey(key),
      type: p.type || 'text',
      token: p.token || `{{${key}}}`,
      required: Boolean(p.required),
    });
  });

  const htmlKeys = new Set([
    ...extractPlaceholderKeysFromHtml(td.headerHtml),
    ...extractPlaceholderKeysFromHtml(td.bodyHtml),
    ...extractPlaceholderKeysFromHtml(td.footerHtml),
  ]);
  htmlKeys.forEach((key) => {
    if (!key || BUILTIN_PLACEHOLDER_KEYS.has(key) || byKey.has(key)) return;
    byKey.set(key, {
      key,
      label: humanizeKey(key),
      type: 'text',
      token: `{{${key}}}`,
      required: false,
    });
  });

  return Array.from(byKey.values());
}

export const PAGE_SIZE_OPTIONS = [
  { value: 'A3', label: 'A3 (297×420mm)', w: 297, h: 420 },
  { value: 'A4', label: 'A4 (210×297mm)', w: 210, h: 297 },
  { value: 'A5', label: 'A5 (148×210mm)', w: 148, h: 210 },
  { value: 'Letter', label: 'Letter (215.9×279.4mm)', w: 215.9, h: 279.4 },
  { value: 'Legal', label: 'Legal (215.9×355.6mm)', w: 215.9, h: 355.6 },
  { value: 'Tabloid', label: 'Tabloid (279.4×431.8mm)', w: 279.4, h: 431.8 },
];

export const PAGE_DIM_MAP = Object.fromEntries(
  PAGE_SIZE_OPTIONS.map((o) => [o.value, { w: o.w, h: o.h }]),
);

export const FONT_SIZE_OPTIONS = [
  '8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72',
].map((s) => ({ value: `${s}px`, label: `${s}px` }));

/** Common Word / Windows fonts — labels render in their own face in the picker */
const SYSTEM_FONT_NAMES = [
  'Agency FB', 'Algerian', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
  'Bahnschrift', 'Bahnschrift Condensed', 'Bahnschrift Light', 'Bahnschrift SemiBold',
  'Baskerville Old Face', 'Bauhaus 93', 'Bell MT', 'Berlin Sans FB', 'Bernard MT Condensed',
  'Blackadder ITC', 'Bodoni MT', 'Book Antiqua', 'Bookman Old Style', 'Bookshelf Symbol 7',
  'Bradley Hand ITC', 'Britannic Bold', 'Broadway', 'Brush Script MT', 'Calibri', 'Calibri Light',
  'Californian FB', 'Calisto MT', 'Cambria', 'Cambria Math', 'Candara', 'Castellar', 'Centaur',
  'Century', 'Century Gothic', 'Century Schoolbook', 'Chiller', 'Colonna MT', 'Comic Sans MS',
  'Consolas', 'Constantia', 'Cooper Black', 'Copperplate Gothic Bold', 'Copperplate Gothic Light',
  'Corbel', 'Courier New', 'Curlz MT', 'Dubai', 'Ebrima', 'Edwardian Script ITC', 'Elephant',
  'Engravers MT', 'Eras Bold ITC', 'Eras Demi ITC', 'Eras Light ITC', 'Eras Medium ITC',
  'Felix Titling', 'Footlight MT Light', 'Forte', 'Franklin Gothic Book', 'Franklin Gothic Demi',
  'Franklin Gothic Heavy', 'Franklin Gothic Medium', 'Freestyle Script', 'French Script MT',
  'Gabriola', 'Gadugi', 'Garamond', 'Georgia', 'Gigi', 'Gill Sans MT', 'Gloucester MT Extra Condensed',
  'Goudy Old Style', 'Goudy Stout', 'Haettenschweiler', 'Harlow Solid Italic', 'Harrington',
  'High Tower Text', 'HoloLens MDL2 Assets', 'Impact', 'Imprint MT Shadow', 'Informal Roman',
  'Ink Free', 'Javanese Text', 'Jokerman', 'Juice ITC', 'Kristen ITC', 'Kunstler Script',
  'Leelawadee', 'Leelawadee UI', 'Lucida Bright', 'Lucida Calligraphy', 'Lucida Console',
  'Lucida Fax', 'Lucida Handwriting', 'Lucida Sans', 'Lucida Sans Unicode', 'Magneto',
  'Maiandra GD', 'Malgun Gothic', 'Matura MT Script Capitals', 'Microsoft Himalaya',
  'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif',
  'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mistral',
  'Modern No. 20', 'Mongolian Baiti', 'Monotype Corsiva', 'MS Gothic', 'MS Outlook',
  'MS PGothic', 'MS Reference Sans Serif', 'MS Reference Specialty', 'MT Extra', 'MV Boli',
  'Myanmar Text', 'Niagara Engraved', 'Niagara Solid', 'Nirmala UI', 'OCR A Extended',
  'Old English Text MT', 'Onyx', 'Palace Script MT', 'Palatino Linotype', 'Papyrus',
  'Parchment', 'Perpetua', 'Perpetua Titling MT', 'Playbill', 'Poor Richard', 'Pristina',
  'Rage Italic', 'Ravie', 'Rockwell', 'Rockwell Condensed', 'Rockwell Extra Bold',
  'Script MT Bold', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI',
  'Segoe UI Black', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Light', 'Segoe UI Semibold',
  'Segoe UI Symbol', 'Showcard Gothic', 'SimSun', 'Sitka Banner', 'Sitka Display', 'Sitka Heading',
  'Sitka Small', 'Sitka Subheading', 'Sitka Text', 'Snap ITC', 'Stencil', 'Sylfaen', 'Symbol',
  'Tahoma', 'Tempus Sans ITC', 'Times New Roman', 'Trebuchet MS', 'Tw Cen MT', 'Verdana',
  'Viner Hand ITC', 'Vivaldi', 'Vladimir Script', 'Webdings', 'Wide Latin', 'Wingdings',
  'Wingdings 2', 'Wingdings 3', 'Yu Gothic', 'Yu Gothic UI',
  'Inter', 'Helvetica', 'Helvetica Neue', 'Roboto', 'Open Sans', 'Noto Sans',
];

export const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default Font' },
  { value: '__divider__', label: '— System Fonts —', disabled: true },
  ...SYSTEM_FONT_NAMES.map((name) => ({
    value: name,
    label: name,
  })),
];

export const DEFAULT_PAGE_SETTINGS = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 5, bottom: 5, left: 5, right: 5 },
  headerSpacing: 0,
  footerSpacing: 0,
  fontFamily: 'Times New Roman',
  fontSize: '12px',
};

export function pagePixelSize(settings) {
  const dim = PAGE_DIM_MAP[settings.pageSize] || PAGE_DIM_MAP.A4;
  const wMm = settings.orientation === 'portrait' ? dim.w : dim.h;
  const hMm = settings.orientation === 'portrait' ? dim.h : dim.w;
  return { width: wMm * 3.78, height: hMm * 3.78, wMm, hMm };
}
