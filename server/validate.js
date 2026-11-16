// Small input validation helpers. Every route validates on the server,
// whatever the browser already checked.

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function checkUsername(value) {
  const v = str(value);
  if (!USERNAME_RE.test(v)) {
    throw new HttpError(400, 'Username must be 3–30 characters: letters, numbers or underscores.', { field: 'username' });
  }
  return v;
}

function checkEmail(value) {
  const v = str(value).toLowerCase();
  if (v.length > 254 || !EMAIL_RE.test(v)) {
    throw new HttpError(400, 'Enter a valid email address.', { field: 'email' });
  }
  return v;
}

function checkPassword(value) {
  // not trimmed: spaces are allowed in passwords
  const v = typeof value === 'string' ? value : '';
  if (v.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.', { field: 'password' });
  // bcrypt only uses the first 72 bytes, so longer passwords are refused
  if (Buffer.byteLength(v) > 72) throw new HttpError(400, 'Password must be at most 72 characters.', { field: 'password' });
  return v;
}

// Integer in [min, max], or null when empty. Throws when present but invalid.
function optionalInt(value, min, max, field, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${label} must be a whole number from ${min} to ${max}.`, { field });
  }
  return n;
}

function oneOf(value, allowed, field, label) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${label} must be one of: ${allowed.join(', ')}.`, { field });
  }
  return value;
}

module.exports = { HttpError, str, checkUsername, checkEmail, checkPassword, optionalInt, oneOf };
