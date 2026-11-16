import { initPage, api, $, setBusy, showFormError, toastAfterRedirect, safeNext } from '../app.js';

const user = await initPage();
if (user) location.replace('/list');

const form = $('#register-form');

// Quick checks in the browser; the server checks everything again.
function check() {
  const u = form.username.value.trim();
  if (!/^[A-Za-z0-9_]{3,30}$/.test(u)) return { field: 'username', message: 'Username must be 3–30 characters: letters, numbers or underscores.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) return { field: 'email', message: 'Enter a valid email address.' };
  if (form.password.value.length < 8) return { field: 'password', message: 'Password must be at least 8 characters.' };
  return null;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const problem = check();
  if (problem) { showFormError(form, problem); return; }
  const button = $('button[type="submit"]', form);
  setBusy(button, true, 'Creating account…');
  try {
    const { user: me } = await api('/api/auth/register', {
      method: 'POST',
      body: { username: form.username.value.trim(), email: form.email.value.trim(), password: form.password.value },
    });
    toastAfterRedirect(`Account created. Welcome, ${me.username}.`);
    location.href = safeNext('/');
  } catch (err) {
    showFormError(form, err);
    setBusy(button, false);
  }
});
