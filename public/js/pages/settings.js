import { initPage, api, html, $, toast, setBusy, PRIVACY_LABELS } from '../app.js';

const user = await initPage({ requireLogin: true });

const form = $('#privacy-form');
form.querySelector(`input[value="${user.privacy}"]`).checked = true;

$('#account-facts').innerHTML = html`
  <div><dt>Username</dt><dd>${user.username}</dd></div>
  <div><dt>Email</dt><dd>${user.email}</dd></div>
  <div><dt>Profile link</dt><dd><a href="/u/${encodeURIComponent(user.username)}">/u/${user.username}</a></dd></div>`.toString();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = $('button[type="submit"]', form);
  const privacy = form.querySelector('input[name="privacy"]:checked').value;
  setBusy(button, true, 'Saving…');
  try {
    await api('/api/users/me/privacy', { method: 'PUT', body: { privacy } });
    toast(`Saved. Your list is now ${PRIVACY_LABELS[privacy].toLowerCase()}.`);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(button, false);
  }
});
