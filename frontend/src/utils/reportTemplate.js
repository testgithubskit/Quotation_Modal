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

/** Merge saved/default template with registered organization details. */
export function resolveReportTemplate(templates = [], report, organization = null) {
  const list = templates || [];
  const byId = report?.templateId ? list.find((t) => t.id === report.templateId) : null;
  const fallback = list.find((t) => t.isDefault) || list[0] || defaultReportTemplate(organization);
  let base = byId || fallback;
  if (report?.overrides) base = { ...base, ...report.overrides };

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
