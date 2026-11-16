import {
  initPage, api, html, $, $$, toast, toastAfterRedirect, draw, stateHtml, retryButton, entryRow,
  STATUS_LABELS, activateTab, placePill, setCount, posterSkeletons,
} from '../app.js';

const user = await initPage({ nav: 'list', requireLogin: true });

$('#list-share').innerHTML = html`Your profile link: <a class="text-link" href="/u/${encodeURIComponent(user.username)}">${location.host}/u/${user.username}</a>`.toString();

const box = $('#entries');
const tabs = $('#tabs');
const filters = $('#filters');
const state = { status: 'all', type: 'all', sort: 'added' };

// read the starting filters from the address bar
const params = new URLSearchParams(location.search);
for (const key of Object.keys(state)) if (params.get(key)) state[key] = params.get(key);
filters.type.value = state.type;
filters.sort.value = state.sort;
if (!filters.type.value) filters.type.value = state.type = 'all';
if (!filters.sort.value) filters.sort.value = state.sort = 'added';
$$('button', tabs).forEach((b) => {
  const on = b.dataset.status === state.status;
  b.classList.toggle('is-active', on);
  b.setAttribute('aria-pressed', String(on));
});
placePill(tabs, false);

function syncUrl() {
  const q = new URLSearchParams();
  if (state.status !== 'all') q.set('status', state.status);
  if (state.type !== 'all') q.set('type', state.type);
  if (state.sort !== 'added') q.set('sort', state.sort);
  history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
}

function showCounts(counts) {
  $$('button', tabs).forEach((b) => setCount($('.count', b), counts[b.dataset.status]));
  placePill(tabs); // the numbers change the tabs' widths
}

function emptyState(counts) {
  if (!counts.all && state.type === 'all') {
    return stateHtml('empty', 'Your list is empty', 'Find something you watched or want to watch, then add it here.',
      html`<a class="btn" href="/">Search titles</a>`);
  }
  const where = state.status === 'all' ? 'here' : `in ${STATUS_LABELS[state.status]}`;
  return stateHtml('empty', `Nothing ${where} yet`, 'Try another tab or type, or add a new title.');
}

let loadId = 0;
async function load() {
  syncUrl();
  const myId = ++loadId;
  if (!box.children.length) draw(box, stateHtml('loading', 'Loading your list…'));
  try {
    const q = new URLSearchParams(state);
    const { entries, counts } = await api(`/api/list?${q}`);
    if (myId !== loadId) return; // a newer load started
    showCounts(counts);
    draw(box, entries.length
      ? html`<ul class="entries cascade">${entries.map((e) => entryRow(e, { editable: true }))}</ul>`
      : emptyState(counts));
  } catch (err) {
    draw(box, stateHtml('error', 'Your list could not load', err.message, retryButton()));
  }
}

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.status = b.dataset.status;
  activateTab(tabs, b); // the pill glides to the new tab
  load();
});
filters.addEventListener('change', () => {
  state.type = filters.type.value;
  state.sort = filters.sort.value;
  load();
});

// Quick actions on each row
box.addEventListener('change', async (e) => {
  if (e.target.dataset.action !== 'status') return;
  const id = e.target.closest('.entry').dataset.id;
  e.target.disabled = true;
  try {
    await api(`/api/list/${encodeURIComponent(id)}`, { method: 'PUT', body: { status: e.target.value } });
    toast(`Moved to ${STATUS_LABELS[e.target.value]}.`);
    load();
  } catch (err) {
    toast(err.message, 'error');
    e.target.disabled = false;
  }
});
box.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="remove"]');
  if (!btn) return;
  const row = btn.closest('.entry');
  const title = $('.entry-title', row).textContent;
  if (!confirm(`Remove “${title}” from your list? Your rating and review will be deleted.`)) return;
  btn.disabled = true;
  try {
    await api(`/api/list/${encodeURIComponent(row.dataset.id)}`, { method: 'DELETE' });
    toast(`Removed “${title}”.`);
    load();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

load();

// "Pick one for me": a random title from the planned list.
$('#pick').addEventListener('click', async () => {
  try {
    const { entries } = await api('/api/list?status=planned');
    if (!entries.length) { toast('Your planned list is empty. Add something first.'); return; }
    const choice = entries[Math.floor(Math.random() * entries.length)].item;
    toastAfterRedirect(`Tonight's pick: ${choice.title}.`);
    location.href = `/item/${choice.id}`;
  } catch (err) {
    toast(err.message, 'error');
  }
});
