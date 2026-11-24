const { bad } = require('./errors');

function str(body, key, { required = true, max = 200 } = {}) {
  const raw = body?.[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    if (required) throw bad(`${key} is required`);
    return null;
  }
  const value = String(raw).trim();
  if (value.length > max) throw bad(`${key} is too long`);
  return value;
}

// Indian mobile numbers: 10 digits starting 6-9, optional +91 / 91 / 0 prefix.
function phone(body, key, opts) {
  const value = str(body, key, opts);
  if (value === null) return null;
  const digits = value.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw bad(`${key} must be a valid 10-digit mobile number`);
  return digits;
}

function password(body, key = 'password') {
  const value = str(body, key, { max: 128 });
  if (value.length < 6) throw bad('Password must be at least 6 characters');
  return value;
}

module.exports = { str, phone, password };
