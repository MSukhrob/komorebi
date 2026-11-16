import { initPage, api, $, setBusy, showFormError, toastAfterRedirect, safeNext } from '../app.js';

const user = await initPage();
if (user) location.replace(safeNext('/list'));

const form = $('#login-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('button[type="submit"]', form);
  const body = { login: form.login.value.trim(), password: form.password.value };
  if (!body.login || !body.password) {
    showFormError(form, { message: 'Enter your username or email and your password.' });
    return;
  }
  setBusy(button, true, 'Logging in…');
  try {
    const { user: me } = await api('/api/auth/login', { method: 'POST', body });
    toastAfterRedirect(`Welcome back, ${me.username}.`);
    location.href = safeNext('/list');
  } catch (err) {
    showFormError(form, err);
    setBusy(button, false);
  }
});
