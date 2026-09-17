export const BUILTIN_PLACEHOLDERS = [
  { token: '{{report_no}}', label: 'Report No' },
  { token: '{{date}}', label: 'Date' },
  { token: '{{customer_name}}', label: 'Customer Name' },
  { token: '{{company_name}}', label: 'Company Name' },
  { token: '{{customer_address}}', label: 'Customer Address' },
  { token: '{{customer_email}}', label: 'Customer Email' },
  { token: '{{customer_mobile}}', label: 'Customer Mobile' },
  { token: '{{subject}}', label: 'Subject' },
  { token: '{{org_name}}', label: 'Organization Name' },
  { token: '{{org_address}}', label: 'Organization Address' },
  { token: '{{grand_total}}', label: 'Grand Total' },
];

export function buildPlaceholderToken(label) {
  const slug = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `{{${slug || 'custom'}}}`;
}
