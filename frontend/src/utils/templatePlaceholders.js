/** Resolve TipTap placeholder chips / {{tokens}} against a report. */

function customerNameOnly(c) {
  if (!c) return '';
  if (c.name) return c.name;
  if (c.details) return c.details.split('\n')[0] || '';
  return '';
}

function customerCompany(c) {
  if (!c) return '';
  if (c.company) return c.company;
  const lines = String(c.details || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) return lines[1];
  return '';
}

function isAutoQuotationNumber(value) {
  return /^QT-\d{4}-\d+$/i.test(String(value || '').trim());
}

function resolveReportNo(report) {
  if (!report) return '';
  const candidates = [
    report.customHeader?.reportNo,
    report.reportNo,
  ].filter((v) => v != null && String(v).trim() !== '');
  const manual = candidates.find((v) => !isAutoQuotationNumber(v));
  return String(manual || candidates[0] || '');
}

function formatMoney(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`;
}

function grandTotal(report) {
  const activities = report?.activities || [];
  return activities.reduce((sum, a) => {
    const rate = Number(a.unitRate ?? a.cost ?? 0);
    const subTotal = (a.subActivities || []).reduce(
      (s, sa) => s + Number(sa.unitRate ?? sa.cost ?? 0) * Number(sa.qty || 1),
      0,
    );
    return sum + rate * Number(a.qty || 1) + subTotal;
  }, 0);
}

export function buildPlaceholderValues(report, template = {}, organization = null) {
  const c = report?.customer || {};
  return {
    '{{report_no}}': resolveReportNo(report),
    '{{date}}': report?.date || report?.customHeader?.date || '',
    '{{customer_name}}': customerNameOnly(c),
    '{{company_name}}': customerCompany(c) || template.companyName || '',
    '{{customer_address}}': c.address || '',
    '{{customer_email}}': c.email || '',
    '{{customer_mobile}}': c.mobile || '',
    '{{subject}}': report?.subject || '',
    '{{org_name}}': organization?.organization_name || organization?.name || template.companyName || '',
    '{{org_address}}': organization?.organization_address || organization?.address || template.companyAddress || '',
    '{{grand_total}}': formatMoney(grandTotal(report)),
  };
}

/** Replace placeholder chips and raw {{tokens}} in HTML. */
export function applyTemplatePlaceholders(html, report, template = {}, organization = null) {
  if (!html) return '';
  const values = buildPlaceholderValues(report, template, organization);
  let out = html;

  // TipTap placeholder chips: <span data-token="{{x}}" ...>Label</span>
  out = out.replace(
    /<span[^>]*data-token="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (match, token) => {
      if (Object.prototype.hasOwnProperty.call(values, token)) {
        return String(values[token] ?? '');
      }
      return match;
    },
  );

  Object.entries(values).forEach(([token, value]) => {
    out = out.split(token).join(String(value ?? ''));
  });

  return out;
}

/** True when template has real TipTap header/footer HTML (not empty paragraphs). */
export function templateHasRichLayout(template) {
  const meaningful = (html) => {
    if (!html || typeof html !== 'string') return false;
    const text = html
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    // images / tables count even without text
    if (/<img\b/i.test(html) || /<table\b/i.test(html)) return true;
    return text.length > 0;
  };
  return meaningful(template?.headerHtml) || meaningful(template?.footerHtml);
}

