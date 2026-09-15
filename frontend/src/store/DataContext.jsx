import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../config/auth.js';
import { useAuth } from '../config/auth.jsx';
import {
  quotationToFeReport,
  reportToQuotationPayload,
  toBeActivity,
  toBeCustomer,
  toBeTemplate,
  toFeActivity,
  toFeCustomer,
  toFeTemplate,
} from '../utils/mappers';
import {
  DEFAULT_ACTIVITY_FIELDS,
  DEFAULT_CUSTOMER_FIELDS,
  DEFAULT_REPORT_HEADER_FIELDS,
  DEFAULT_REPORT_CUSTOMER_FIELDS,
  DEFAULT_REPORT_TERMS_FIELDS,
  customFieldToSchema,
  mergeSchema,
  normalizeReportHeaderFields,
  toBackendFieldType,
} from '../utils/fieldSchema';

const DataContext = createContext(null);
const SCHEMA_KEY = 'quotation-modal-schema-v1';

const listParams = { page: 1, page_size: 100 };

function loadLocalSchema() {
  try {
    const raw = localStorage.getItem(SCHEMA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        reportHeaderFields: normalizeReportHeaderFields(parsed.reportHeaderFields),
        reportCustomerFields: mergeSchema(parsed.reportCustomerFields, DEFAULT_REPORT_CUSTOMER_FIELDS),
        reportTermsFields: mergeSchema(parsed.reportTermsFields, DEFAULT_REPORT_TERMS_FIELDS),
      };
    }
  } catch {
    // ignore
  }
  return {
    reportHeaderFields: DEFAULT_REPORT_HEADER_FIELDS,
    reportCustomerFields: DEFAULT_REPORT_CUSTOMER_FIELDS,
    reportTermsFields: DEFAULT_REPORT_TERMS_FIELDS,
  };
}

function customKeysFrom(fields = []) {
  return fields.filter((f) => !f.builtIn).map((f) => f.key);
}

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [activities, setActivities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schema, setSchema] = useState(() => ({
    activityFields: DEFAULT_ACTIVITY_FIELDS,
    customerFields: DEFAULT_CUSTOMER_FIELDS,
    ...loadLocalSchema(),
  }));

  useEffect(() => {
    localStorage.setItem(
      SCHEMA_KEY,
      JSON.stringify({
        reportHeaderFields: schema.reportHeaderFields,
        reportCustomerFields: schema.reportCustomerFields,
        reportTermsFields: schema.reportTermsFields,
      }),
    );
  }, [schema.reportHeaderFields, schema.reportCustomerFields, schema.reportTermsFields]);

  const applyCustomFieldDefs = useCallback((items) => {
    const activityCustom = (items || [])
      .filter((f) => f.entity_type === 'ACTIVITY')
      .map(customFieldToSchema);
    const customerCustom = (items || [])
      .filter((f) => f.entity_type === 'CUSTOMER')
      .map(customFieldToSchema);

    setSchema((s) => ({
      ...s,
      activityFields: [...DEFAULT_ACTIVITY_FIELDS, ...activityCustom],
      customerFields: [...DEFAULT_CUSTOMER_FIELDS, ...customerCustom],
    }));
  }, []);

  const clearAll = useCallback(() => {
    setActivities([]);
    setCustomers([]);
    setReports([]);
    setTemplates([]);
    setSchema((s) => ({
      ...s,
      activityFields: DEFAULT_ACTIVITY_FIELDS,
      customerFields: DEFAULT_CUSTOMER_FIELDS,
    }));
  }, []);

  const refreshActivities = useCallback(async () => {
    if (!isAuthenticated) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    try {
      const data = await api.get('/activities', { params: listParams }).then((r) => r.data);
      setActivities((data.items || []).map(toFeActivity));
    } finally {
      setLoadingActivities(false);
    }
  }, [isAuthenticated]);

  const refreshCustomers = useCallback(async () => {
    if (!isAuthenticated) {
      setCustomers([]);
      return;
    }
    setLoadingCustomers(true);
    try {
      const data = await api.get('/customers', { params: listParams }).then((r) => r.data);
      setCustomers((data.items || []).map(toFeCustomer));
    } finally {
      setLoadingCustomers(false);
    }
  }, [isAuthenticated]);

  const refreshReports = useCallback(async () => {
    if (!isAuthenticated) {
      setReports([]);
      return;
    }
    setLoadingReports(true);
    try {
      const quots = await api.get('/quotations', { params: listParams }).then((r) => r.data);
      const listItems = quots.items || [];
      const detailed = await Promise.all(
        listItems.map(async (q) => {
          try {
            const full = await api.get(`/quotations/${q.id}`).then((r) => r.data);
            return quotationToFeReport(full);
          } catch {
            return quotationToFeReport(q);
          }
        }),
      );
      setReports(detailed.filter(Boolean));
    } finally {
      setLoadingReports(false);
    }
  }, [isAuthenticated]);

  const refreshTemplates = useCallback(async () => {
    if (!isAuthenticated) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    try {
      const data = await api.get('/quotation-templates', { params: listParams }).then((r) => r.data);
      setTemplates((data.items || []).map(toFeTemplate));
    } finally {
      setLoadingTemplates(false);
    }
  }, [isAuthenticated]);

  const refreshCustomFields = useCallback(async () => {
    if (!isAuthenticated) {
      setSchema((s) => ({
        ...s,
        activityFields: DEFAULT_ACTIVITY_FIELDS,
        customerFields: DEFAULT_CUSTOMER_FIELDS,
      }));
      return;
    }
    const data = await api.get('/custom-fields', { params: listParams }).then((r) => r.data);
    applyCustomFieldDefs(data.items || []);
  }, [isAuthenticated, applyCustomFieldDefs]);

  useEffect(() => {
    if (!isAuthenticated) clearAll();
  }, [isAuthenticated, clearAll]);

  const updateSchema = (updater) => setSchema((s) => updater(s));

  const store = {
    data: { activities, customers, reports, templates, schema },
    loading: loadingActivities || loadingCustomers || loadingReports || loadingTemplates,
    loadingActivities,
    loadingCustomers,
    loadingReports,
    loadingTemplates,
    refreshActivities,
    refreshCustomers,
    refreshReports,
    refreshTemplates,
    refreshCustomFields,
    getApiErrorMessage,

    addActivity: async (activity) => {
      await api.post('/activities', toBeActivity(activity, customKeysFrom(schema.activityFields)));
      await refreshActivities();
    },
    addActivitiesBulk: async (rows) => {
      const keys = customKeysFrom(schema.activityFields);
      for (const row of rows) {
        await api.post('/activities', toBeActivity(row, keys));
      }
      await refreshActivities();
    },
    updateActivity: async (id, patch) => {
      const current = activities.find((a) => a.id === id) || {};
      await api.put(
        `/activities/${id}`,
        toBeActivity({ ...current, ...patch }, customKeysFrom(schema.activityFields)),
      );
      await refreshActivities();
    },
    deleteActivity: async (id) => {
      await api.delete(`/activities/${id}`);
      await refreshActivities();
    },

    addCustomer: async (customer) => {
      await api.post('/customers', toBeCustomer(customer, customKeysFrom(schema.customerFields)));
      await refreshCustomers();
    },
    updateCustomer: async (id, patch) => {
      const current = customers.find((c) => c.id === id) || {};
      await api.put(
        `/customers/${id}`,
        toBeCustomer({ ...current, ...patch }, customKeysFrom(schema.customerFields)),
      );
      await refreshCustomers();
    },
    deleteCustomer: async (id) => {
      await api.delete(`/customers/${id}`);
      await refreshCustomers();
    },

    addReport: async (report) => {
      const created = await api.post('/quotations', reportToQuotationPayload(report)).then((r) => r.data);
      await refreshReports();
      return created.id;
    },
    updateReport: async (id, patch) => {
      const current = reports.find((r) => r.id === id) || {};
      const merged = { ...current, ...patch };
      await api.put(`/quotations/${id}`, reportToQuotationPayload(merged));
      await refreshReports();
    },
    deleteReport: async (id) => {
      await api.delete(`/quotations/${id}`);
      await refreshReports();
    },

    addTemplate: async (template) => {
      await api.post('/quotation-templates', toBeTemplate(template));
      await refreshTemplates();
    },
    updateTemplate: async (id, patch) => {
      const current = templates.find((t) => t.id === id) || {};
      await api.put(`/quotation-templates/${id}`, toBeTemplate({ ...current, ...patch }));
      await refreshTemplates();
    },
    deleteTemplate: async (id) => {
      await api.delete(`/quotation-templates/${id}`);
      await refreshTemplates();
    },

    addActivityField: async (field) => {
      await api.post('/custom-fields', {
        entity_type: 'ACTIVITY',
        field_key: field.key,
        field_label: field.label,
        field_type: toBackendFieldType(field.type),
        is_required: false,
        is_visible: true,
        is_editable: true,
        display_order: schema.activityFields.length,
      });
      await refreshCustomFields();
    },
    removeActivityField: async (key) => {
      const field = schema.activityFields.find((f) => f.key === key && !f.builtIn);
      if (field?.id) await api.delete(`/custom-fields/${field.id}`);
      await refreshCustomFields();
    },
    addCustomerField: async (field) => {
      await api.post('/custom-fields', {
        entity_type: 'CUSTOMER',
        field_key: field.key,
        field_label: field.label,
        field_type: toBackendFieldType(field.type),
        is_required: false,
        is_visible: true,
        is_editable: true,
        display_order: schema.customerFields.length,
      });
      await refreshCustomFields();
    },
    removeCustomerField: async (key) => {
      const field = schema.customerFields.find((f) => f.key === key && !f.builtIn);
      if (field?.id) await api.delete(`/custom-fields/${field.id}`);
      await refreshCustomFields();
    },

    addReportHeaderField: (field) => updateSchema((s) => ({
      ...s,
      reportHeaderFields: [...s.reportHeaderFields, field],
    })),
    removeReportHeaderField: (key) => updateSchema((s) => ({
      ...s,
      reportHeaderFields: s.reportHeaderFields.filter((f) => f.key !== key),
    })),
    addReportCustomerField: (field) => updateSchema((s) => ({
      ...s,
      reportCustomerFields: [...s.reportCustomerFields, field],
    })),
    removeReportCustomerField: (key) => updateSchema((s) => ({
      ...s,
      reportCustomerFields: s.reportCustomerFields.filter((f) => f.key !== key),
    })),
    addReportTermsField: (field) => updateSchema((s) => ({
      ...s,
      reportTermsFields: [...s.reportTermsFields, field],
    })),
    removeReportTermsField: (key) => updateSchema((s) => ({
      ...s,
      reportTermsFields: s.reportTermsFields.filter((f) => f.key !== key || f.builtIn),
    })),
  };

  return <DataContext.Provider value={store}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
