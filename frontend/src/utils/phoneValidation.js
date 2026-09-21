export const PHONE_MAX_LENGTH = 10;

export function isPhoneLikeField(nameOrLabel) {
  const s = String(nameOrLabel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    s.includes('phone')
    || s.includes('mobile')
    || s.includes('contactno')
    || s.includes('contactnumber')
  );
}

export function digitsOnlyPhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
}

export function isValidPhone(value) {
  if (value == null || value === '') return true;
  return digitsOnlyPhone(value).length === PHONE_MAX_LENGTH;
}

export function phoneFieldRules({ required = false, label = 'number' } = {}) {
  const rules = [];
  if (required) {
    rules.push({ required: true, message: `Enter ${label}` });
  }
  rules.push({
    validator(_, value) {
      if (value == null || value === '') {
        return Promise.resolve();
      }
      if (digitsOnlyPhone(value).length !== PHONE_MAX_LENGTH) {
        return Promise.reject(new Error('Enter a valid 10-digit number'));
      }
      return Promise.resolve();
    },
  });
  return rules;
}

export function phoneInputProps() {
  return {
    maxLength: PHONE_MAX_LENGTH,
    inputMode: 'numeric',
    placeholder: '10-digit number',
  };
}
