import dayjs from 'dayjs';

const KEY_PREFIX = 'qm-generate-report-draft';

export function draftStorageKey(userId, organizationId) {
  const uid = userId || 'anonymous';
  const oid = organizationId || 'org';
  return `${KEY_PREFIX}-${oid}-${uid}`;
}

export function saveGenerateReportDraft(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify({
      ...payload,
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadGenerateReportDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGenerateReportDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Serialize ant form values (dayjs → ISO). */
export function serializeFormValues(values, dateKeys = []) {
  const out = { ...values };
  dateKeys.forEach((k) => {
    const v = out[k];
    if (v?.toISOString) out[k] = v.toISOString();
    else if (v?.format && dayjs.isDayjs(v)) out[k] = v.toISOString();
  });
  return out;
}

export function hydrateFormValues(serialized, dateKeys = []) {
  if (!serialized || typeof serialized !== 'object') return {};
  const out = { ...serialized };
  dateKeys.forEach((k) => {
    if (out[k]) out[k] = dayjs(out[k]);
  });
  return out;
}
