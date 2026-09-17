import { templateHasRichLayout } from './templatePlaceholders';

/** Fallback template when org has not created any quotation templates yet. */
export function defaultReportTemplate(organization = null) {
  return {
    id: 'default',
    name: 'Default',
    companyName: organization?.organization_name || organization?.name || 'Your Company Name',
    companyAddress: organization?.organization_address || organization?.address || 'Company address, city, state',
    logo: null,
    primaryColor: '#16324F',
    headerText: 'QUOTATION REPORT',
    footerText: 'This is a computer-generated document and does not require a signature.',
    showLogo: true,
    align: 'left',
    fontFamily: 'Inter, sans-serif',
    isDefault: true,
    headerHtml: '',
    footerHtml: '',
  };
}

function isPlaceholderCompanyName(value) {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'your company name' || v === 'company name';
}

function isPlaceholderAddress(value) {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'company address, city, state' || v === 'company address';
}

function pickBaseTemplate(templates = [], report) {
  const list = templates || [];
  if (report?.templateId) {
    const byId = list.find((t) => t.id === report.templateId);
    if (byId) return byId;
  }

  const richDefaults = list.filter((t) => templateHasRichLayout(t));
  const markedDefault = list.find((t) => t.isDefault);
  if (markedDefault && templateHasRichLayout(markedDefault)) return markedDefault;
  if (richDefaults.length === 1) return richDefaults[0];
  if (markedDefault) return markedDefault;
  if (richDefaults[0]) return richDefaults[0];
  return list[0] || null;
}

/** Merge saved/default template with registered organization details. */
export function resolveReportTemplate(templates = [], report, organization = null) {
  const picked = pickBaseTemplate(templates, report);
  let base = picked || defaultReportTemplate(organization);
  if (report?.overrides) {
    // Keep designed HTML unless override explicitly sets it
    const { headerHtml, footerHtml, ...rest } = report.overrides;
    base = {
      ...base,
      ...rest,
      headerHtml: headerHtml !== undefined ? headerHtml : base.headerHtml,
      footerHtml: footerHtml !== undefined ? footerHtml : base.footerHtml,
    };
  }

  const orgName = organization?.organization_name || organization?.name || '';
  const orgAddress = organization?.organization_address || organization?.address || '';

  return {
    ...base,
    companyName: isPlaceholderCompanyName(base.companyName) && orgName ? orgName : (base.companyName || orgName),
    companyAddress: isPlaceholderAddress(base.companyAddress) && orgAddress
      ? orgAddress
      : (base.companyAddress || orgAddress),
  };
}
