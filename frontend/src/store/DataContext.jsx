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
  const [loading, setLoading] = useState(false);
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

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setActivities([]);
      setCustomers([]);
      setReports([]);
      setTemplates([]);
      setSchema((s) => ({
        ...s,
        activityFields: DEFAULT_ACTIVITY_FIELDS,
        customerFields: DEFAULT_CUSTOMER_FIELDS,
      }));
      return;
    }

    setLoading(true);
    try {
      const [acts, custs, quots, tmpls, fields] = await Promise.all([
        api.get('/activities', { params: listParams }).then((r) => r.data),
        api.get('/customers', { params: listParams }).then((r) => r.data),
        api.get('/quotations', { params: listParams }).then((r) => r.data),
        api.get('/quotation-templates', { params: listParams }).then((r) => r.data),
        api.get('/custom-fields', { params: listParams }).then((r) => r.data),
      ]);

      applyCustomFieldDefs(fields.items || []);
      setActivities((acts.items || []).map(toFeActivity));
      setCustomers((custs.items || []).map(toFeCustomer));

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
      setTemplates((tmpls.items || []).map(toFeTemplate));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, applyCustomFieldDefs]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const updateSchema = (updater) => setSchema((s) => updater(s));

  const store = {
    data: { activities, customers, reports, templates, schema },
    loading,
    refresh,
    getApiErrorMessage,

    addActivity: async (activity) => {
      await api.post('/activities', toBeActivity(activity, customKeysFrom(schema.activityFields)));
      await refresh();
    },
    addActivitiesBulk: async (rows) => {
      const keys = customKeysFrom(schema.activityFields);
      for (const row of rows) {
        await api.post('/activities', toBeActivity(row, keys));
      }
      await refresh();
    },
    updateActivity: async (id, patch) => {
      const current = activities.find((a) => a.id === id) || {};
      await api.patch(
        `/activities/${id}`,
        toBeActivity({ ...current, ...patch }, customKeysFrom(schema.activityFields)),
      );
      await refresh();
    },
    deleteActivity: async (id) => {
      await api.delete(`/activities/${id}`);
      await refresh();
    },

    addCustomer: async (customer) => {
      await api.post('/customers', toBeCustomer(customer, customKeysFrom(schema.customerFields)));
      await refresh();
    },
    updateCustomer: async (id, patch) => {
      const current = customers.find((c) => c.id === id) || {};
      await api.patch(
        `/customers/${id}`,
        toBeCustomer({ ...current, ...patch }, customKeysFrom(schema.customerFields)),
      );
      await refresh();
    },
    deleteCustomer: async (id) => {
      await api.delete(`/customers/${id}`);
      await refresh();
    },

    addReport: async (report) => {
      const created = await api.post('/quotations', reportToQuotationPayload(report)).then((r) => r.data);
      await refresh();
      return created.id;
    },
    updateReport: async (id, patch) => {
      const current = reports.find((r) => r.id === id) || {};
      const merged = { ...current, ...patch };
      await api.patch(`/quotations/${id}`, reportToQuotationPayload(merged));
      await refresh();
    },
    deleteReport: async (id) => {
      await api.delete(`/quotations/${id}`);
      await refresh();
    },

    addTemplate: async (template) => {
      await api.post('/quotation-templates', toBeTemplate(template));
      await refresh();
    },
    updateTemplate: async (id, patch) => {
      const current = templates.find((t) => t.id === id) || {};
      await api.patch(`/quotation-templates/${id}`, toBeTemplate({ ...current, ...patch }));
      await refresh();
    },
    deleteTemplate: async (id) => {
      await api.delete(`/quotation-templates/${id}`);
      await refresh();
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
      await refresh();
    },
    removeActivityField: async (key) => {
      const field = schema.activityFields.find((f) => f.key === key && !f.builtIn);
      if (field?.id) await api.delete(`/custom-fields/${field.id}`);
      await refresh();
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
      await refresh();
    },
    removeCustomerField: async (key) => {
      const field = schema.customerFields.find((f) => f.key === key && !f.builtIn);
      if (field?.id) await api.delete(`/custom-fields/${field.id}`);
      await refresh();
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
