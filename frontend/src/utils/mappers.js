function pickCustomData(values, customKeys = []) {
  const custom_data = {};
  customKeys.forEach((key) => {
    const value = values?.[key];
    if (value !== undefined && value !== null && value !== '') {
      custom_data[key] = value;
    }
  });
  return custom_data;
}

export function toFeActivity(a) {
  if (!a) return null;
  return {
    id: a.id,
    code: a.code,
    specification: a.name,
    particulars: a.description || '',
    cost: Number(a.unit_price ?? 0),
    unit: a.unit,
    currency: a.currency,
    is_active: a.is_active,
    ...(a.custom_data || {}),
  };
}

export function toBeActivity(values, customKeys = []) {
  return {
    code: values.code,
    name: values.specification || values.name,
    description: values.particulars ?? values.description ?? null,
    unit: values.unit || 'unit',
    unit_price: Number(values.cost ?? values.unit_price ?? 0),
    currency: values.currency || 'INR',
    is_active: values.is_active !== false,
    custom_data: pickCustomData(values, customKeys),
  };
}

export function toFeCustomer(c) {
  if (!c) return null;
  const custom = c.custom_data || {};
  return {
    id: c.id,
    customer_code: c.customer_code,
    name: c.name,
    // UI "company" is stored in notes (backend has no company column)
    company: c.notes || '',
    address: c.address || '',
    email: c.email || '',
    // UI "mobile" maps to phone
    mobile: c.phone || '',
    website: c.website,
    tax_number: c.tax_number,
    notes: c.notes,
    is_active: c.is_active,
    ...custom,
  };
}

function slugCode(name) {
  const base = String(name || 'CUST')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'CUST';
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

export function toBeCustomer(values, customKeys = []) {
  return {
    customer_code: values.customer_code || slugCode(values.name),
    name: values.name,
    email: values.email || null,
    phone: values.mobile || values.phone || null,
    website: values.website || null,
    tax_number: values.tax_number || null,
    address: values.address || null,
    notes: values.company || values.notes || null,
    is_active: values.is_active !== false,
    custom_data: pickCustomData(values, customKeys),
  };
}

export function toFeTemplate(t) {
  if (!t) return null;
  const data = t.template_data || {};
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    isDefault: t.is_default,
    isStandard: t.is_standard,
    companyName: data.companyName || '',
    companyAddress: data.companyAddress || '',
    logo: data.logo ?? null,
    primaryColor: data.primaryColor || '#16324F',
    headerText: data.headerText || 'QUOTATION REPORT',
    footerText: data.footerText || '',
    showLogo: data.showLogo !== false,
  };
}

export function toBeTemplate(values) {
  return {
    name: values.name,
    description: values.description || null,
    is_default: Boolean(values.isDefault),
    is_standard: Boolean(values.isStandard),
    template_data: {
      companyName: values.companyName || '',
      companyAddress: values.companyAddress || '',
      logo: values.logo ?? null,
      primaryColor: values.primaryColor || '#16324F',
      headerText: values.headerText || 'QUOTATION REPORT',
      footerText: values.footerText || '',
      showLogo: values.showLogo !== false,
    },
    custom_data: values.custom_data || {},
  };
}

function lineFromActivity(a) {
  return {
    activity_id: a.activityId || null,
    description: a.particulars || a.description || a.sampleActivity || 'Item',
    quantity: Number(a.qty || 1),
    unit: a.unit || 'Nos',
    unit_price: Number(a.unitRate ?? a.cost ?? 0),
    discount: 0,
    tax: 0,
    custom_data: {
      ...(a.customFields || {}),
      specification: a.specification,
      sampleActivity: a.sampleActivity,
      code: a.code,
      key: a.key,
      isSub: a.isSub || false,
      parentKey: a.parentKey,
    },
  };
}

export function reportToQuotationPayload(report) {
  const items = [];
  (report.activities || []).forEach((a) => {
    items.push(lineFromActivity(a));
    (a.subActivities || []).forEach((sa) => {
      items.push(lineFromActivity({ ...sa, isSub: true, parentKey: a.key }));
    });
  });

  return {
    customer_id: report.customer?.id,
    quotation_template_id: report.templateId || null,
    notes: report.subject || null,
    currency: 'INR',
    discount: 0,
    custom_data: {
      reportDocument: report,
      centre: report.centre || report.center,
      lab: report.lab,
      enquiryNo: report.enquiryNo,
      date: report.date,
    },
    items,
  };
}

export function quotationToFeReport(q) {
  if (!q) return null;
  const doc = q.custom_data?.reportDocument;
  if (doc) {
    return {
      ...doc,
      id: q.id,
      reportNo: q.quotation_number || doc.reportNo,
      status: q.status,
      total: Number(q.total ?? 0),
    };
  }

  return {
    id: q.id,
    reportNo: q.quotation_number,
    status: q.status,
    date: q.quotation_date,
    centre: q.custom_data?.centre,
    center: q.custom_data?.centre,
    lab: q.custom_data?.lab,
    enquiryNo: q.custom_data?.enquiryNo,
    subject: q.notes,
    customer: { id: q.customer_id },
    activities: (q.items || []).map((item, i) => ({
      key: item.id || `i${i}`,
      activityId: item.activity_id,
      sampleActivity: item.custom_data?.sampleActivity || item.description,
      description: item.description,
      particulars: item.description,
      specification: item.custom_data?.specification || '',
      qty: Number(item.quantity),
      unit: item.unit,
      unitRate: Number(item.unit_price),
      cost: Number(item.unit_price),
      customFields: item.custom_data || {},
      subActivities: [],
    })),
    activityNotes: [],
    terms: {},
    total: Number(q.total ?? 0),
  };
}
