import {
  initPage, api, html, raw, $, $$, toast, toastAfterRedirect, draw, posterCard, posterImage, posterSkeletons, stateHtml,
  retryButton, activateTab, placePill, ICONS, TYPE_LABELS, statusChip, avatar, scoreHtml, episodeTag, timeAgo,
} from '../app.js';

const user = await initPage({ nav: 'discover' });

const form = $('#search-form');
const input = $('#q');
const pills = $('.type-pills');
const results = $('#results');
const sections = $('#sections');

// The search state lives in the address bar (?q=coco&type=movie), so a search can be shared.
const params = new URLSearchParams(location.search);
const state = { q: (params.get('q') || '').slice(0, 100), type: params.get('type') || 'all' };
if (!['all', 'movie', 'series', 'cartoon'].includes(state.type)) state.type = 'all';
input.value = state.q;
$$('button', pills).forEach((b) => {
  const on = b.dataset.type === state.type;
  b.classList.toggle('is-active', on);
  b.setAttribute('aria-pressed', String(on));
});
placePill(pills, false);
sections.dataset.filter = state.type;

function syncUrl() {
  const q = new URLSearchParams();
  if (state.q) q.set('q', state.q);
  if (state.type !== 'all') q.set('type', state.type);
  history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
}

/* =====================================================================
   The page is a stack of sections. Each one is drawn empty (with skeletons)
   first and filled when its own data arrives, so one slow source never
   holds up the rest. data-for says which type filters keep the section.
   ===================================================================== */
const SECTIONS = [
  { id: 'continue', for: 'all', only: 'user' },
  { id: 'pick', for: 'all', only: 'user' },
  { id: 'radar', for: 'all' },
  { id: 'movies', for: 'all movie' },
  { id: 'news', for: 'all' },
  { id: 'series', for: 'all series' },
  { id: 'friends', for: 'all', only: 'user' },
  { id: 'cartoons', for: 'all cartoon' },
  { id: 'join', for: 'all', only: 'guest' },
  { id: 'soon', for: 'all' },
];
for (const s of SECTIONS) {
  if ((s.only === 'user' && !user) || (s.only === 'guest' && user)) continue;
  const el = document.createElement('section');
  el.id = `sec-${s.id}`;
  el.dataset.for = s.for;
  sections.append(el);
}
const slot = (id) => $(`#sec-${id}`);

const head = (title, note = '') => html`<div class="section-head"><h2>${title}</h2>${note ? html`<p>${note}</p>` : ''}</div>`;
const shelf = (items, opts) => html`<div class="shelf cascade">${items.map((i) => posterCard(i, opts))}</div>`;
const loadingShelf = (title) => html`${head(title)}<div class="shelf">${posterSkeletons(8)}</div>`;

/* ---------- The hero: one featured title ---------- */
let featured = [];
let current = 0;
const heroImg = $('#hero-img');

async function addToPlanned(item, btn) {
  if (!user) { location.href = `/login?next=${encodeURIComponent(`/item/${item.id}`)}`; return; }
  btn.disabled = true;
  try {
    const { entry } = await api(`/api/list/${encodeURIComponent(item.id)}`);
    if (entry) {
      toast(`It is already on your list as ${entry.status}.`);
    } else {
      await api(`/api/list/${encodeURIComponent(item.id)}`, { method: 'PUT', body: { status: 'planned' } });
      toast(`Added “${item.title}” to Planned.`);
    }
    btn.textContent = 'On your list';
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
}

function showFeature(index) {
  current = index;
  const i = featured[index];
  heroImg.classList.add('is-fading');
  setTimeout(() => {
    heroImg.src = i.backdropUrl;
    heroImg.onload = () => heroImg.classList.remove('is-fading');
  }, 200);
  const copy = $('#hero-copy');
  copy.innerHTML = html`<div class="hero-meta">
      <span class="type-dot type-${i.type}">${TYPE_LABELS[i.type]}</span>
      ${i.year ? html`<span>${i.year}</span>` : ''}
      ${i.rating ? html`<span class="score-pill">TMDB ${i.rating.toFixed(1)}</span>` : ''}
    </div>
    <h1 id="hero-title">${i.title}</h1>
    <p class="overview">${i.overview}</p>
    <div class="btn-row">
      <a class="btn" href="/item/${i.id}">View details</a>
      <button class="btn btn-glass" type="button" id="hero-add">${raw(ICONS.plus)}Add to planned</button>
    </div>`.toString();
  $('#hero-add').addEventListener('click', (e) => addToPlanned(i, e.currentTarget));
  $$('.hero-pick', $('#hero-picks')).forEach((b, n) => b.setAttribute('aria-pressed', String(n === index)));
}

function setupHero(list) {
  featured = list.filter((i) => i.backdropUrl && i.overview).slice(0, 6);
  if (!featured.length) return;
  $('#hero-picks').innerHTML = html`${featured.map((i, n) => html`<button class="hero-pick" type="button" aria-pressed="false" aria-label="${i.title}"><img src="${i.posterUrl}" alt=""></button>`)}`.toString();
  $('#hero-picks').addEventListener('click', (e) => {
    const b = e.target.closest('.hero-pick');
    if (b) showFeature($$('.hero-pick', $('#hero-picks')).indexOf(b));
  });
  showFeature(0);
}

/* ---------- Trending shelves (movies, series, cartoons) ---------- */
const TREND = {
  movies: ['Trending movies', 'This week on TMDB'],
  series: ['Trending series', 'This week on TMDB'],
  cartoons: ['Popular cartoons', 'Animation, from Pixar to Bluey'],
};
async function loadHome() {
  for (const id of Object.keys(TREND)) draw(slot(id), loadingShelf(TREND[id][0]));
  try {
    const data = await api('/api/catalog/home');
    setupHero(data.featured);
    for (const s of data.sections) {
      const [title, note] = TREND[s.key];
      draw(slot(s.key), html`${head(title, note)}${s.error ? html`<p class="shelf-note">${s.error}</p>` : shelf(s.items)}`);
    }
  } catch (err) {
    for (const id of Object.keys(TREND)) draw(slot(id), html`${head(TREND[id][0])}${stateHtml('error', 'Could not load', err.message, retryButton())}`);
  }
}

/* ---------- Release radar: cinemas, coming soon, TV this week ---------- */
async function loadRadar() {
  draw(slot('radar'), loadingShelf('Release radar'));
  try {
    const { sections: radar } = await api('/api/catalog/radar');
    const tabs = { 'radar-now': 'In cinemas', 'radar-soon': 'Coming soon', 'radar-tv': 'On TV this week' };
    draw(slot('radar'), html`${head('Release radar', 'New movies and episodes, updated every hour')}
      <div class="pill-nav" id="radar-tabs" role="group" aria-label="Release radar"><span class="pill" aria-hidden="true"></span>
        ${radar.map((s, n) => html`<button type="button" data-key="${s.key}" class="${n === 0 ? 'is-active' : ''}" aria-pressed="${String(n === 0)}">${tabs[s.key]}</button>`)}
      </div>
      <div id="radar-shelf"></div>`);
    const nav = $('#radar-tabs');
    const show = (key) => {
      const s = radar.find((x) => x.key === key);
      draw($('#radar-shelf'), s.error ? html`<p class="shelf-note">${s.error}</p>`
        : s.items.length ? shelf(s.items, { date: key === 'radar-soon' ? 'soon' : key === 'radar-now' ? 'released' : false }) : html`<p class="shelf-note">Nothing here yet.</p>`);
    };
    show(radar[0].key);
    placePill(nav, false);
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      activateTab(nav, b);
      show(b.dataset.key);
    });
  } catch (err) {
    draw(slot('radar'), html`${head('Release radar')}${stateHtml('error', 'The radar could not load', err.message, retryButton())}`);
  }
}

/* ---------- Film news ---------- */
async function loadNews() {
  draw(slot('news'), html`${head('Film and TV news', 'Headlines from the trade press, linked to the original articles')}
    <div class="news-grid">${Array.from({ length: 6 }, () => raw('<div class="skeleton" data-tall></div>'))}</div>`);
  try {
    const { items } = await api('/api/catalog/news');
    draw(slot('news'), html`${head('Film and TV news', 'Headlines from the trade press, linked to the original articles')}
      <div class="news-grid cascade">${items.map((n) => html`<a class="news-card" href="${n.url}" target="_blank" rel="noopener noreferrer">
        <h3>${n.title}</h3>
        <div class="news-foot"><b>${n.source}</b><span class="mono">${timeAgo(n.publishedAt)}</span></div></a>`)}</div>`);
  } catch (err) {
    draw(slot('news'), html`${head('Film and TV news')}<p class="shelf-note">${err.message}</p>`);
  }
}

/* ---------- Continue watching (logged in) ---------- */
async function loadContinue() {
  if (!user) return;
  try {
    const { entries } = await api('/api/list?status=watching&sort=added');
    const list = entries.slice(0, 6);
    if (!list.length) { slot('continue').remove(); return; }
    const card = (e) => {
      const isShow = e.item.type !== 'movie';
      return html`<article class="continue-card" data-id="${e.item.id}">
        <a href="/item/${e.item.id}" tabindex="-1" aria-hidden="true"><div class="poster">${posterImage(e.item)}</div></a>
        <div class="continue-body">
          <h3><a href="/item/${e.item.id}">${e.item.title}</a></h3>
          <div>
            <div class="continue-meta"><span data-tag>${episodeTag(e.season, e.episode) || (isShow ? 'Not started' : 'In progress')}</span><span data-pct>${e.progress ? `${e.progress}%` : ''}</span></div>
            ${isShow ? html`<div class="bar"><i data-v="${e.progress || 0}"></i></div>` : ''}
          </div>
          <button class="btn btn-sm" type="button" data-next="${e.item.id}" data-show="${isShow}">${isShow ? 'Next episode' : 'Mark as watched'}</button>
        </div>
      </article>`;
    };
    draw(slot('continue'), html`${head('Continue watching', 'Pick up where you left off')}<div class="continue-grid cascade">${list.map(card)}</div>`);
  } catch (err) {
    draw(slot('continue'), html`${head('Continue watching')}<p class="shelf-note">${err.message}</p>`);
  }
}

slot('continue')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-next]');
  if (!btn) return;
  const id = btn.dataset.next;
  const cardEl = btn.closest('.continue-card');
  btn.disabled = true;
  try {
    if (btn.dataset.show === 'true') {
      const { entry, finished } = await api(`/api/list/${encodeURIComponent(id)}/next`, { method: 'POST' });
      if (finished) { toast('You finished it. Moved to Watched.'); cardEl.remove(); return; }
      $('[data-tag]', cardEl).textContent = episodeTag(entry.season, entry.episode);
      $('[data-pct]', cardEl).textContent = entry.progress ? `${entry.progress}%` : '';
      $('.bar > i', cardEl).style.setProperty('--v', entry.progress || 0);
      toast(`Now on ${episodeTag(entry.season, entry.episode)}.`);
      btn.disabled = false;
    } else {
      await api(`/api/list/${encodeURIComponent(id)}`, { method: 'PUT', body: { status: 'watched' } });
      toast('Moved to Watched.');
      cardEl.remove();
    }
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

/* ---------- Pick for me (logged in): a random planned title ---------- */
async function loadPick() {
  if (!user) return;
  try {
    const { entries } = await api('/api/list?status=planned');
    if (!entries.length) { slot('pick').remove(); return; }
    draw(slot('pick'), html`<div class="banner">
      <div><h2>Cannot decide what to watch tonight?</h2>
        <p>You have ${entries.length} planned ${entries.length === 1 ? 'title' : 'titles'}. Let Komorebi pick one for you.</p></div>
      <div class="btn-row"><button class="btn" type="button" id="pick-btn">${raw(ICONS.shuffle)}Pick for me</button>
        <a class="btn btn-quiet" href="/list?status=planned">See planned</a></div>
    </div>`);
    $('#pick-btn').addEventListener('click', () => {
      const choice = entries[Math.floor(Math.random() * entries.length)].item;
      toastAfterRedirect(`Tonight's pick: ${choice.title}.`);
      location.href = `/item/${choice.id}`;
    });
  } catch {
    slot('pick').remove();
  }
}

/* ---------- What friends are doing (logged in) ---------- */
const DID = { planned: 'added to Planned', watching: 'started watching', watched: 'finished' };
async function loadFriends() {
  if (!user) return;
  try {
    const { activity } = await api('/api/friends/activity');
    if (!activity.length) {
      draw(slot('friends'), html`${head('Friends are watching')}<p class="shelf-note">Nothing yet. <a class="text-link" href="/friends">Find friends</a> to see what they watch.</p>`);
      return;
    }
    draw(slot('friends'), html`${head('Friends are watching', 'The latest from the people you follow')}
      <div class="activity-grid cascade">${activity.map((a) => html`<a class="activity-card" href="/item/${a.item.id}">
        <div class="poster">${posterImage(a.item)}</div>
        <div class="activity-body">
          <span class="activity-who">${avatar(a.username, 'avatar-sm')}${a.username}</span>
          <span>${DID[a.status]}</span>
          <b class="t">${a.item.title}</b>
          <span>${a.rating ? scoreHtml(a.rating) : ''} <span class="when">${timeAgo(a.at)}</span></span>
        </div></a>`)}</div>`);
  } catch (err) {
    draw(slot('friends'), html`${head('Friends are watching')}<p class="shelf-note">${err.message}</p>`);
  }
}

/* ---------- For guests: what Komorebi does ---------- */
function showJoin() {
  if (user) return;
  draw(slot('join'), html`${head('Your watch list, shared with friends')}
    <div class="perks">
      <div class="perk">${raw(ICONS.film)}<b>Track everything</b><span>Planned, watching and watched, with your season and episode and a progress bar.</span></div>
      <div class="perk">${raw(ICONS.star)}<b>Rate and review</b><span>Ten stars, a few words, and a score that is yours.</span></div>
      <div class="perk">${raw(ICONS.share)}<b>Share with friends</b><span>Public, friends only or private. You decide who sees your list.</span></div>
      <div class="perk">${raw(ICONS.chart)}<b>See your stats</b><span>Hours watched, favourite genres and how you rate.</span></div>
    </div>
    <div class="banner">
      <div><h2>Start your list tonight</h2><p>Free, with no ads. You need a username, an email and a password.</p></div>
      <div class="btn-row"><a class="btn" href="/register">Create a free account</a><a class="btn btn-quiet" href="/login">Log in</a></div>
    </div>`);
}

/* ---------- In the near future ---------- */
function showSoon() {
  draw(slot('soon'), html`<div class="banner">
    <div><h2>In the near future: connect Netflix and other services</h2>
      <p>Komorebi will add what you watch by itself, and remind you of new episodes and premieres. See what is planned.</p></div>
    <div class="btn-row"><a class="btn" href="/roadmap">See the roadmap</a></div>
  </div>`);
}

/* ---------- Live search ---------- */
let timer;
let controller;

function showSearch(on) {
  results.hidden = !on;
  sections.hidden = on;
}

async function runSearch() {
  const q = input.value.trim();
  state.q = q;
  syncUrl();
  if (controller) controller.abort(); // an older request is no longer wanted
  if (q.length < 2) {
    form.classList.remove('is-searching');
    showSearch(false);
    return;
  }
  showSearch(true);
  const mine = (controller = new AbortController());
  form.classList.add('is-searching'); // the little leaf spins
  if (!results.children.length) draw(results, html`<div class="posters">${posterSkeletons(12)}</div>`);
  try {
    const data = await api(`/api/catalog/search?${new URLSearchParams(state)}`, { signal: mine.signal });
    draw(results, data.items.length
      ? html`<div class="results-head"><h2>Results for “${q}”</h2><span class="results-count">${data.items.length} ${data.items.length === 1 ? 'title' : 'titles'}</span></div>
          <div class="posters cascade">${data.items.map((i) => posterCard(i))}</div>`
      : stateHtml('empty', `Nothing found for “${q}”`, 'Check the spelling, or try another type.'));
  } catch (err) {
    if (err.name === 'AbortError') return; // a newer search replaced this one
    draw(results, stateHtml('error', 'Search did not work', err.message, retryButton()));
  } finally {
    if (controller === mine) form.classList.remove('is-searching');
  }
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 300); // wait until typing pauses
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  runSearch();
});
pills.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-type]');
  if (!btn) return;
  state.type = btn.dataset.type;
  sections.dataset.filter = state.type; // CSS hides the sections that do not belong to this type
  activateTab(pills, btn);
  if (input.value.trim().length >= 2) runSearch();
  else syncUrl();
});

// everything loads side by side
showJoin();
showSoon();
await Promise.all([loadHome(), loadRadar(), loadNews(), loadContinue(), loadPick(), loadFriends()]);
if (state.q.length >= 2) runSearch();
