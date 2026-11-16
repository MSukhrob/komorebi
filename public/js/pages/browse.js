import {
  initPage, api, html, $, $$, draw, watchImages, cascade, posterCard, posterSkeletons, stateHtml, retryButton,
  activateTab, placePill,
} from '../app.js';

await initPage({ nav: 'browse' });

const tabs = $('#type-tabs');
const sortSelect = $('#sort');
const genreBox = $('#genres');
const grid = $('#grid');
const moreBtn = $('#more');

const params = new URLSearchParams(location.search);
const state = { type: params.get('type') || 'movie', genre: params.get('genre') || '', sort: params.get('sort') || 'popular', page: 1 };
if (!['movie', 'series', 'cartoon'].includes(state.type)) state.type = 'movie';
if (!['popular', 'rating', 'newest'].includes(state.sort)) state.sort = 'popular';
sortSelect.value = state.sort;
$$('button', tabs).forEach((b) => {
  const on = b.dataset.type === state.type;
  b.classList.toggle('is-active', on);
  b.setAttribute('aria-pressed', String(on));
});
placePill(tabs, false);

let genres = {};

function syncUrl() {
  const q = new URLSearchParams({ type: state.type });
  if (state.genre) q.set('genre', state.genre);
  if (state.sort !== 'popular') q.set('sort', state.sort);
  history.replaceState(null, '', `?${q}`);
}

function drawGenres() {
  const names = genres[state.type] || [];
  if (state.genre && !names.includes(state.genre)) state.genre = '';
  const chip = (name, label) => html`<button class="chip" type="button" data-genre="${name}" aria-pressed="${String(state.genre === name)}">${label}</button>`;
  genreBox.innerHTML = html`${chip('', 'All genres')}${names.map((n) => chip(n, n))}`.toString();
}

let loadId = 0;
async function load(reset) {
  if (reset) {
    state.page = 1;
    syncUrl();
    draw(grid, html`<div class="posters">${posterSkeletons(18)}</div>`);
    moreBtn.hidden = true;
  }
  const myId = ++loadId;
  moreBtn.disabled = true;
  try {
    const q = new URLSearchParams({ type: state.type, sort: state.sort, page: String(state.page) });
    if (state.genre) q.set('genre', state.genre);
    const data = await api(`/api/catalog/browse?${q}`);
    if (myId !== loadId) return; // a newer request replaced this one
    if (reset) {
      if (!data.items.length) { draw(grid, stateHtml('empty', 'Nothing found', 'Try another genre or sort order.')); return; }
      draw(grid, html`<div class="posters cascade" id="posters"></div>`);
    }
    const box = $('#posters');
    const before = box.children.length;
    box.insertAdjacentHTML('beforeend', html`${data.items.map((i) => posterCard(i))}`.toString());
    watchImages(box);
    [...box.children].slice(before).forEach((c, n) => c.style.setProperty('--i', n)); // the new ones cascade in
    moreBtn.hidden = !data.hasMore;
  } catch (err) {
    if (reset) draw(grid, stateHtml('error', 'Browsing did not work', err.message, retryButton()));
    else $('#more').textContent = 'Try again';
  } finally {
    moreBtn.disabled = false;
  }
}

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.type = b.dataset.type;
  activateTab(tabs, b);
  drawGenres();
  load(true);
});
genreBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-genre]');
  if (!b) return;
  state.genre = b.dataset.genre;
  $$('.chip', genreBox).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
  load(true);
});
sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; load(true); });
moreBtn.addEventListener('click', () => { state.page += 1; moreBtn.textContent = 'Load more'; load(false); });

try {
  genres = await api('/api/catalog/genres');
} catch { genres = {}; }
drawGenres();
load(true);
