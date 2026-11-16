// Shared code for every page: safe HTML templates, API calls, the header,
// toasts, poster cards, the sliding pill, and the loading / empty / error states.

/* ---------- Safe HTML ----------
   html`...` escapes every ${value} so user text (reviews, usernames) can never
   run as code. Use raw() only for markup we built ourselves.               */
class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
export const raw = (value) => new SafeHtml(String(value));

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toHtml(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(toHtml).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += toHtml(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- API ---------- */
export class ApiError extends Error {
  constructor(message, status, field, data = null) {
    super(message);
    this.status = status;
    this.field = field;
    this.data = data; // the full error body from the server
  }
}

// Every request is JSON. Throws ApiError with a readable message on failure.
export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach Komorebi. Check your connection and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    throw new ApiError((data && data.error) || 'Something went wrong. Please try again.', res.status, data && data.field, data);
  }
  return data;
}

/* ---------- Icons (small inline SVGs, all drawn with currentColor) ---------- */
const SVG = (inner, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;
export const ICONS = {
  leaf: `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M30 6C19 6 12 13 12 24c0 1.5.2 2.6.5 3.5C24 27 30 19 30 6Z"/><path d="M13.5 26.5C17 19 21.5 13.5 27 9.5" stroke="var(--bg-primary)" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  search: SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  // planned: a sprouting seed
  planned: SVG('<path d="M12 21v-9"/><path d="M12 12c0-3.5-2.5-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5Z"/><path d="M12 14.5c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5Z"/><path d="M8 21h8"/>'),
  // watching: an open eye
  watching: SVG('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  // watched: a golden seal with a check mark
  watched: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="currentColor"/><rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="currentColor" transform="rotate(45 12 12)"/><path d="M8.6 12.3l2.5 2.5 4.5-5" fill="none" stroke="var(--bg-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // a film reel: the placeholder when a poster is missing
  reel: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="currentColor"/><g fill="currentColor" opacity=".55"><circle cx="35" cy="24" r="3.5"/><circle cx="27.4" cy="34.5" r="3.5"/><circle cx="15.1" cy="30.5" r="3.5"/><circle cx="15.1" cy="17.5" r="3.5"/><circle cx="27.4" cy="13.5" r="3.5"/></g></svg>`,
  alert: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>`,
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  shuffle: SVG('<path d="M3 7h3.5c5 0 6 10 11 10H21M3 17h3.5c1.8 0 3-1 4-2.5M21 7h-3.5c-1.8 0-3 1-4 2.5"/><path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5"/>'),
  film: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  share: SVG('<circle cx="7" cy="12" r="2.6"/><circle cx="17" cy="6" r="2.6"/><circle cx="17" cy="18" r="2.6"/><path d="m9.3 10.8 5.4-3.6M9.3 13.2l5.4 3.6"/>'),
  chart: SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C12.8 8 16 11.2 22 12C16 12.8 12.8 16 12 22C11.2 16 8 12.8 2 12C8 11.2 11.2 8 12 2Z"/></svg>`,
};

/* ---------- Labels and small formatters ---------- */
export const TYPE_LABELS = { movie: 'Movie', series: 'Series', cartoon: 'Cartoon' };
export const STATUS_LABELS = { planned: 'Planned', watching: 'Watching', watched: 'Watched' };
export const PRIVACY_LABELS = { public: 'Public', friends: 'Friends only', private: 'Private' };
export const RATING_WORDS = ['', 'Awful', 'Bad', 'Weak', 'Meh', 'Okay', 'Decent', 'Good', 'Very good', 'Great', 'Masterpiece'];

const pad = (n) => String(n).padStart(2, '0');
// "S02 · E08", or just "S02" / "E08" when only one is known
export function episodeTag(season, episode) {
  if (season && episode) return `S${pad(season)} · E${pad(episode)}`;
  if (season) return `S${pad(season)}`;
  if (episode) return `E${pad(episode)}`;
  return '';
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-12-04" becomes "Dec 4"
export function shortDate(iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  return m ? `${MONTHS[m - 1]} ${d}` : '';
}
// "today", "tomorrow", "in 12 days", or "3 days ago"
export function daysUntil(iso) {
  const days = Math.round((new Date(`${iso}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
// "5 min ago", "3 h ago", "2 d ago"
export function timeAgo(when) {
  const min = Math.round((Date.now() - new Date(when).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  if (min < 60 * 24 * 14) return `${Math.round(min / 60 / 24)} d ago`;
  return new Date(when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const scoreHtml = (n) => html`<span class="score">${Number(n).toFixed(1)} <small>/ 10</small></span>`;
export const statusChip = (status) =>
  html`<span class="chip-status status-${status}">${raw(ICONS[status])}${STATUS_LABELS[status]}</span>`;

// Avatars: a pastel forest tone picked from the name, so a person always keeps their colour.
const toneOf = (name) => [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 6;
export const avatar = (username, size = '') =>
  html`<span class="avatar ${size} tone-${toneOf(username)}" aria-hidden="true">${username[0]}</span>`;

/* ---------- Toasts ---------- */
let toastBox;
export function toast(message, kind = 'ok') {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts';
    toastBox.setAttribute('role', 'status');
    toastBox.setAttribute('aria-live', 'polite');
    document.body.append(toastBox);
  }
  const ms = kind === 'error' ? 5000 : 3000;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.style.setProperty('--ms', `${ms}ms`); // the shrinking line under the text lasts as long as the toast
  el.innerHTML = ICONS.leaf;
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  toastBox.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

// Remember a toast across a page change (e.g. "Welcome back" after login).
export function toastAfterRedirect(message) {
  try { sessionStorage.setItem('komorebi-toast', message); } catch { /* ignore */ }
}
function showPendingToast() {
  try {
    const msg = sessionStorage.getItem('komorebi-toast');
    if (msg) { sessionStorage.removeItem('komorebi-toast'); toast(msg); }
  } catch { /* ignore */ }
}

/* ---------- States ---------- */
export function stateHtml(kind, title, text = '', action = '') {
  if (kind === 'loading') {
    return html`<div class="state" aria-busy="true"><div class="spinner" aria-hidden="true"></div><p>${title || 'Loading…'}</p></div>`;
  }
  return html`<div class="state ${kind}" ${kind === 'error' ? raw('role="alert"') : ''}>
    <div class="state-mark">${raw(kind === 'error' ? ICONS.alert : ICONS.reel)}</div>
    <h2>${title}</h2>
    ${text ? html`<p>${text}</p>` : ''}
    ${action}
  </div>`;
}

// A "Try again" button; any [data-retry] button reloads the page.
export const retryButton = () => raw('<button class="btn btn-quiet" type="button" data-retry>Try again</button>');
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) location.reload();
});

/* ---------- Drawing into the page ----------
   draw(el, markup) puts markup in el, then:
   - fades poster images in when they finish loading (or swaps in the film reel if one is missing)
   - numbers the children of any .cascade element (--i: 0, 1, 2 ...) so they rise one after another */
export function watchImages(root = document) {
  $$('img[data-fade]', root).forEach((img) => {
    if (img.dataset.watched) return;
    img.dataset.watched = '1';
    const show = () => img.classList.add('is-loaded');
    const missing = () => {
      const box = document.createElement('div');
      box.className = 'poster-empty';
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', `No poster for ${img.dataset.title}`);
      box.innerHTML = ICONS.reel;
      const name = document.createElement('span');
      name.textContent = img.dataset.title;
      box.append(name);
      img.replaceWith(box);
    };
    if (img.complete) { img.naturalWidth ? show() : missing(); return; }
    img.addEventListener('load', show, { once: true });
    img.addEventListener('error', missing, { once: true });
  });
}

export function cascade(el) {
  [...el.children].forEach((child, i) => child.style.setProperty('--i', i));
}

// Elements with data-v="40" get the CSS variable --v: 40 (bars and columns use it for their size).
// It is set here, from JavaScript, because the strict Content-Security-Policy forbids style="" in HTML.
export function setValues(root) {
  $$('[data-v]', root).forEach((el) => el.style.setProperty('--v', el.dataset.v));
}

export function draw(el, markup) {
  el.innerHTML = String(markup);
  watchImages(el);
  setValues(el);
  if (el.classList.contains('cascade')) cascade(el);
  $$('.cascade', el).forEach(cascade);
}

/* ---------- The sliding pill ----------
   A row of links or tabs holds one .pill element. placePill() moves it behind
   whichever child has .is-active, by setting its left and width.            */
export function placePill(nav, animate = true) {
  const pill = $('.pill', nav);
  if (!pill) return;
  const active = $(':scope > .is-active', nav);
  if (!active) { pill.classList.remove('is-on'); return; }
  const box = nav.getBoundingClientRect();
  const tab = active.getBoundingClientRect();
  if (!animate) pill.style.transition = 'none';
  pill.style.left = `${tab.left - box.left}px`;
  pill.style.width = `${tab.width}px`;
  pill.classList.add('is-on');
  if (!animate) { pill.offsetWidth; pill.style.transition = ''; } // reading offsetWidth applies the jump first
}

// Makes `tab` the active one of its row and glides the pill to it.
export function activateTab(nav, tab) {
  $$(':scope > a, :scope > button', nav).forEach((t) => {
    const on = t === tab;
    t.classList.toggle('is-active', on);
    if (t.tagName === 'BUTTON') t.setAttribute('aria-pressed', String(on));
  });
  placePill(nav);
}

// Gives a count badge a small bounce when its number changes.
export function setCount(el, value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('bump');
  el.offsetWidth; // restart the animation
  el.classList.add('bump');
}

window.addEventListener('resize', () => $$('.pill-nav').forEach((nav) => placePill(nav, false)));
if (document.fonts) document.fonts.ready.then(() => $$('.pill-nav').forEach((nav) => placePill(nav, false)));

/* ---------- Header: the island, the dock, the search window ---------- */
function markNav(current) {
  // the dock has no Stats or Settings tab, so those pages light up "Me"
  const dockCurrent = current === 'stats' || current === 'settings' ? 'me' : current;
  $$('.main-nav, .dock').forEach((nav) => {
    const key = nav.classList.contains('dock') ? dockCurrent : current;
    $$(':scope > a', nav).forEach((a) => {
      const on = a.dataset.nav === key;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    placePill(nav, false);
  });
}

// The island shrinks a little once you scroll.
function wireIsland() {
  const island = $('#island');
  if (!island) return;
  const update = () => island.classList.toggle('is-compact', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function wireTheme() {
  const btn = $('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-fade'); // fades every colour over 450ms (see the CSS)
    root.dataset.theme = next;
    try { localStorage.setItem('komorebi-theme', next); } catch { /* ignore */ }
    setTimeout(() => root.classList.remove('theme-fade'), 500);
    sync();
  });
}

function renderAccount(user) {
  const box = $('[data-account]');
  if (!box || !user) return;
  box.innerHTML = html`<div class="account-menu">
      <button type="button" aria-haspopup="true" aria-expanded="false" id="account-btn">
        ${avatar(user.username, 'avatar-sm')}
        <span class="account-name">${user.username}</span>
        <span class="visually-hidden">, account menu</span>
      </button>
      <div role="menu" aria-labelledby="account-btn">
        <a role="menuitem" href="/u/${encodeURIComponent(user.username)}">My profile</a>
        <a role="menuitem" href="/stats">My stats</a>
        <a role="menuitem" href="/settings">Settings</a>
        <hr>
        <button role="menuitem" type="button" data-logout>Log out</button>
      </div>
    </div>`.toString();

  const menu = $('.account-menu', box);
  const btn = $('button', menu);
  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => {
    const open = !menu.classList.contains('open');
    setOpen(open);
    if (open) $('[role="menuitem"]', menu).focus();
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setOpen(false); btn.focus(); }
  });
  $('[data-logout]', menu).addEventListener('click', logout);

  // the dock's last tab becomes "Me", and "Friends" shows how many requests wait
  const me = $('.dock [data-me]');
  if (me) { me.href = `/u/${encodeURIComponent(user.username)}`; $('[data-me-label]', me).textContent = 'Me'; }
  if (user.pendingRequests) {
    $$('[data-friends-badge]').forEach((b) => { b.textContent = String(user.pendingRequests); b.hidden = false; });
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    toastAfterRedirect('You are logged out. See you soon.');
    location.href = '/';
  } catch (err) {
    toast(err.message, 'error');
  }
}

// The search window: press / or Ctrl+K anywhere. Arrow keys move, Enter opens.
function wireSearchDialog() {
  const dialog = $('#search-dialog');
  if (!dialog) return;
  const input = $('#sd-input');
  const list = $('#sd-results');
  let timer;
  let controller;
  let active = -1;

  const rows = () => $$('.sd-row', list);
  const mark = (i) => {
    const all = rows();
    if (!all.length) return;
    active = (i + all.length) % all.length;
    all.forEach((r, n) => r.classList.toggle('is-active', n === active));
    all[active].scrollIntoView({ block: 'nearest' });
  };
  const open = () => { if (!dialog.open) dialog.showModal(); input.focus(); input.select(); };

  $$('.search-open').forEach((b) => b.addEventListener('click', open));
  document.addEventListener('keydown', (e) => {
    const field = document.activeElement;
    const typing = field && (/^(INPUT|TEXTAREA|SELECT)$/.test(field.tagName) || field.isContentEditable);
    const slash = e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey;
    const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    if (slash || ctrlK) { e.preventDefault(); open(); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // a click on the dimmed area

  async function run() {
    const q = input.value.trim();
    if (controller) controller.abort();
    if (q.length < 2) {
      list.innerHTML = '<li class="sd-hint">Type at least two letters. Use the arrow keys and Enter to open a title.</li>';
      return;
    }
    controller = new AbortController();
    try {
      const { items } = await api(`/api/catalog/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      list.innerHTML = (items.length
        ? html`${items.slice(0, 8).map((i) => html`<li><a class="sd-row" href="/item/${i.id}">
            ${i.posterUrl ? html`<img src="${i.posterUrl}" alt="">` : html`<span class="sd-noimg"></span>`}
            <span><b>${i.title}</b><small>${i.year || ''}</small></span>
            <span class="type-dot type-${i.type}">${TYPE_LABELS[i.type]}</span></a></li>`)}`
        : html`<li class="sd-hint">Nothing found for “${q}”.</li>`).toString();
      active = -1;
      mark(0);
    } catch (err) {
      if (err.name === 'AbortError') return;
      list.innerHTML = html`<li class="sd-hint">${err.message}</li>`.toString();
    }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const target = rows()[Math.max(active, 0)];
      if (target) location.href = target.href;
    }
  });
}

/* ---------- Page setup ----------
   Every page calls initPage(). It marks the current page in the header, finds
   out who is logged in, and (if requireLogin) sends guests to the login page. */
export async function initPage({ nav = null, requireLogin = false } = {}) {
  markNav(nav);
  wireIsland();
  wireTheme();
  wireSearchDialog();
  showPendingToast();
  let user = null;
  try {
    ({ user } = await api('/api/auth/me'));
  } catch {
    toast('Could not check your login. Some things may not work.', 'error');
  }
  if (requireLogin && !user) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {}); // stop the page while redirecting
  }
  renderAccount(user);
  return user;
}

// Only allow redirects to our own pages (prevents ?next=https://evil.example).
export function safeNext(fallback = '/list') {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// Shows a server validation error next to the right field (or at the top).
export function showFormError(form, err) {
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $$('.field-error', form).forEach((el) => { el.textContent = ''; });
  const alertBox = $('.form-alert', form);
  const input = err.field && form.elements[err.field];
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    const msg = $(`#${input.id}-error`, form);
    if (msg) msg.textContent = err.message;
    input.focus();
    if (alertBox) alertBox.hidden = true;
  } else if (alertBox) {
    alertBox.textContent = err.message;
    alertBox.hidden = false;
  } else {
    toast(err.message, 'error');
  }
}

/* ---------- Posters ---------- */
export function posterImage(item, large = false) {
  const src = large ? item.posterLarge || item.posterUrl : item.posterUrl;
  return src
    ? html`<img src="${src}" alt="Poster for ${item.title}" data-fade data-title="${item.title}" loading="lazy" decoding="async" width="342" height="513">`
    : html`<div class="poster-empty" role="img" aria-label="No poster for ${item.title}">${raw(ICONS.reel)}<span>${item.title}</span></div>`;
}

// One poster tile: the poster with its type badge, then the title and year.
// With `date` (the release radar) it also shows when the title comes out.
export function posterCard(item, { status, date = false } = {}) {
  // date: 'soon' shows the date and how far away it is; 'released' shows the date only
  const when = date && item.releaseDate;
  return html`<a class="poster-card" href="/item/${item.id}">
    <div class="poster">
      ${posterImage(item)}
      <span class="badge badge-${item.type}">${TYPE_LABELS[item.type]}</span>
      ${when ? html`<span class="date-badge">${shortDate(item.releaseDate)}</span>` : ''}
      ${status ? statusChip(status) : ''}
    </div>
    <h3 class="poster-title">${item.title}</h3>
    <p class="poster-meta">${date === 'soon' && when ? daysUntil(item.releaseDate) : item.year || ''}</p>
  </a>`;
}

export function posterSkeletons(count = 6) {
  return html`${Array.from({ length: count }, () => raw('<div class="poster-card" aria-hidden="true"><div class="skeleton poster-skeleton"></div></div>'))}`;
}

/* ---------- List rows (My list and profiles) ---------- */
// One list entry. With `editable`, it gets a status menu and a Remove button.
export function entryRow(e, { editable = false } = {}) {
  const item = e.item;
  const progress = episodeTag(e.season, e.episode);
  return html`<li class="entry" data-id="${item.id}">
    <a href="/item/${item.id}" tabindex="-1" aria-hidden="true"><div class="poster">${posterImage(item)}</div></a>
    <div class="entry-body">
      <a class="entry-title" href="/item/${item.id}">${item.title}</a>
      <div class="entry-meta">
        <span class="type-dot type-${item.type}">${TYPE_LABELS[item.type]}</span>
        ${item.year ? html`<span>${item.year}</span>` : ''}
        ${editable ? '' : statusChip(e.status)}
        ${e.rating ? scoreHtml(e.rating) : ''}
        ${progress ? html`<span>${progress}</span>` : ''}
      </div>
      ${e.progress ? html`<div class="bar" role="progressbar" aria-label="Progress through ${item.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${e.progress}"><i data-v="${e.progress}"></i></div>` : ''}
      ${e.review ? html`<p class="review">${e.review}</p>` : ''}
      ${editable ? html`<div class="entry-actions">
        <label class="visually-hidden" for="st-${item.id}">Status for ${item.title}</label>
        <select class="select" id="st-${item.id}" data-action="status">
          ${Object.entries(STATUS_LABELS).map(([v, label]) => html`<option value="${v}" ${v === e.status ? raw('selected') : ''}>${label}</option>`)}
        </select>
        <button class="btn btn-danger btn-sm" type="button" data-action="remove">Remove<span class="visually-hidden"> ${item.title}</span></button>
      </div>` : ''}
    </div>
  </li>`;
}

/* ---------- Friend buttons (profile, people search, friends page) ---------- */
// Buttons for the viewer's relationship with `person` ({ id, username, relationship }).
export function friendButtons(person, { loggedIn = true, addLabel = 'Add friend' } = {}) {
  if (!loggedIn) {
    return html`<a class="btn btn-sm" href="/login?next=${encodeURIComponent(location.pathname)}">Log in to add a friend</a>`;
  }
  const b = (action, label, kind = '') =>
    html`<button class="btn btn-sm ${kind}" type="button" data-friend="${action}" data-user="${person.id}" data-name="${person.username}">${label}</button>`;
  switch (person.relationship) {
    case 'self': return html`<a class="btn btn-quiet btn-sm" href="/settings">Change privacy</a>`;
    case 'friends': return html`<span class="chip-status status-watching">Friends</span>${b('remove', 'Remove friend', 'btn-danger')}`;
    case 'outgoing': return html`<span class="btn btn-sm btn-sent" role="status">Request sent ✓</span>${b('cancel', 'Cancel request', 'btn-quiet')}`;
    case 'incoming': return html`${b('accept', 'Accept request')}${b('decline', 'Decline', 'btn-quiet')}`;
    default: return b('add', addLabel);
  }
}

const FRIEND_CALLS = {
  add: (id) => api(`/api/friends/${id}/request`, { method: 'POST' }),
  accept: (id) => api(`/api/friends/${id}/accept`, { method: 'POST' }),
  cancel: (id) => api(`/api/friends/${id}`, { method: 'DELETE' }),
  decline: (id) => api(`/api/friends/${id}`, { method: 'DELETE' }),
  remove: (id) => api(`/api/friends/${id}`, { method: 'DELETE' }),
};

// Handles clicks on any [data-friend] button inside `root`; calls onDone(result, userId) after success.
export function wireFriendButtons(root, onDone) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-friend]');
    if (!btn) return;
    const { friend: action, user: id, name } = btn.dataset;
    if (action === 'remove' && !confirm(`Remove ${name} from your friends?`)) return;
    btn.disabled = true;
    try {
      const result = await FRIEND_CALLS[action](id);
      toast(result.message);
      onDone(result, Number(id));
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

// One person on the friends page or in people search.
export function personRow(p, opts) {
  return html`<li>
    <a class="person" href="/u/${encodeURIComponent(p.username)}">${avatar(p.username)}<span>${p.username}</span></a>
    <span class="person-actions">${friendButtons(p, opts)}</span>
  </li>`;
}
