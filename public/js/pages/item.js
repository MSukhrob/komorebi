import {
  initPage, api, html, raw, $, $$, toast, draw, posterImage, posterCard, stateHtml, retryButton, setBusy, showFormError,
  ICONS, TYPE_LABELS, STATUS_LABELS, RATING_WORDS, episodeTag, scoreHtml, statusChip, avatar,
} from '../app.js';

const user = await initPage();
const box = $('#item');
const id = decodeURIComponent(location.pathname.split('/').pop());

// "2 h 16 min" or "45 min"
function minutes(m) {
  if (!m) return null;
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}

// The facts row; films show a length, shows show seasons and episodes.
function facts(item) {
  const list = [];
  if (item.year) list.push(['Year', item.year]);
  if (item.format) list.push(['Format', item.format]);
  if (item.runtime) list.push(['Length', minutes(item.runtime)]);
  if (item.seasonCount) list.push(['Seasons', item.seasonCount]);
  if (item.episodes) {
    list.push(['Episodes', item.episodeLength ? `${item.episodes}, ${minutes(item.episodeLength)} each` : item.episodes]);
  }
  if (item.status) list.push(['Status', item.status]);
  return list;
}

function castCard(c) {
  return html`<div class="cast-card">
    ${c.photoUrl ? html`<img src="${c.photoUrl}" alt="${c.name}" loading="lazy" width="104" height="104">` : avatar(c.name, 'avatar-lg')}
    <b>${c.name}</b>${c.character ? html`<span>${c.character}</span>` : ''}</div>`;
}

function render(item, community) {
  document.title = `${item.title} | Komorebi`;
  const f = facts(item);
  const trailer = item.trailer && /^[\w-]{6,20}$/.test(item.trailer.key) ? item.trailer : null;
  draw(box, html`<section class="title-hero ${item.backdropUrl ? '' : 'no-bg'}" aria-labelledby="title-h">
      ${item.backdropUrl ? html`<div class="hero-bg"><img src="${item.backdropUrl}" alt=""></div>` : ''}
      <div class="wrap title-grid">
        <div class="poster">${posterImage(item, true)}<span class="badge badge-${item.type}">${TYPE_LABELS[item.type]}</span></div>
        <div class="title-info">
          <div class="title-meta">
            <span class="type-dot type-${item.type}">${TYPE_LABELS[item.type]}</span>
            ${item.year ? html`<span>${item.year}</span>` : ''}
            ${item.runtime ? html`<span>${minutes(item.runtime)}</span>` : ''}
            ${item.seasonCount ? html`<span>${item.seasonCount} ${item.seasonCount === 1 ? 'season' : 'seasons'}</span>` : ''}
            ${item.rating ? html`<span class="score-pill">TMDB ${item.rating.toFixed(1)}</span>` : ''}
          </div>
          <h1 id="title-h">${item.title}</h1>
          ${item.tagline ? html`<p class="tagline">${item.tagline}</p>` : ''}
          ${item.genres?.length ? html`<ul class="genres" aria-label="Genres">${item.genres.map((g) => html`<li>${g}</li>`)}</ul>` : ''}
          ${item.makers?.length ? html`<p class="makers">${item.makersLabel} <b>${item.makers.join(', ')}</b></p>` : ''}
          <div class="btn-row">
            ${trailer ? html`<button class="btn" type="button" id="play-trailer">${raw(ICONS.play)}Watch trailer</button>` : ''}
            <a class="btn btn-glass" href="#list-panel">${raw(ICONS.plus)}Add to my list</a>
          </div>
        </div>
      </div>
    </section>

    <div class="wrap title-body">
      <div class="title-main">
        <section aria-labelledby="overview-h"><h2 class="block-title" id="overview-h">Overview</h2>
          <p class="overview">${item.overview || 'No description is available for this title yet.'}</p></section>
        ${f.length ? html`<dl class="facts">${f.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>` : ''}
        ${item.cast?.length ? html`<section aria-labelledby="cast-h"><h2 class="block-title" id="cast-h">Cast</h2>
          <div class="cast">${item.cast.map(castCard)}</div></section>` : ''}
        ${item.similar?.length ? html`<section aria-labelledby="similar-h"><h2 class="block-title" id="similar-h">More like this</h2>
          <div class="shelf cascade">${item.similar.map((i) => posterCard(i))}</div></section>` : ''}
        <p class="source-note"><img src="/img/tmdb.svg" alt="TMDB" width="92" height="12">
          <span>Details from <a class="text-link" href="${item.sourceUrl}" rel="noopener" target="_blank">${item.sourceName}</a>. This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</span></p>
      </div>
      <aside class="title-aside" id="panels" aria-label="Your list and friends">
        <section class="panel" aria-labelledby="community-h"><h2 id="community-h">On Komorebi</h2>
          <div class="community">
            <div><strong>${community.onLists}</strong><span>on lists</span></div>
            <div><strong>${community.watched}</strong><span>watched</span></div>
            <div><strong>${community.average ? community.average.toFixed(1) : '--'}</strong><span>average score</span></div>
          </div></section>
      </aside>
    </div>`);

  if (trailer) {
    const dialog = $('#trailer');
    const frame = $('#trailer-frame');
    $('#play-trailer').addEventListener('click', () => {
      // the video loads only now, after the click, so nothing is sent to YouTube before
      frame.innerHTML = html`<iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0" title="${trailer.name}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`.toString();
      dialog.showModal();
    });
    const stop = () => { frame.innerHTML = ''; };
    dialog.addEventListener('close', stop);
    $('.trailer-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }
}

/* =====================================================================
   Your list panel. It is drawn once; saving changes what it shows in place,
   so the little animations (the stamp, the stars, the bar) can play.
   ===================================================================== */
function listPanelHtml(item) {
  const isShow = item.format !== 'Movie'; // progress only for series and cartoon series
  const stamp = (v) => html`<label class="stamp status-${v}">
    <input type="radio" name="status" value="${v}"><span>${raw(ICONS[v])}${STATUS_LABELS[v]}</span></label>`;
  return html`<section class="panel" id="list-panel" aria-labelledby="list-title">
    <div class="panel-head">
      <h2 id="list-title">Add to your list</h2>
      <p class="muted" id="list-sub">Choose where it goes. You can rate it and write a review after.</p>
    </div>
    <form id="status-form"><fieldset class="stamps"><legend class="visually-hidden">Status</legend>
      ${stamp('planned')}${stamp('watching')}${stamp('watched')}
    </fieldset></form>

    <form class="details" id="details-form" novalidate hidden>
      <p class="form-alert" role="alert" hidden></p>
      <fieldset class="rating" id="rating">
        <legend>Your rating, from 1 to 10</legend>
        <div class="stars" id="stars">
          ${Array.from({ length: 10 }, (_, i) => html`<label class="star"><input type="radio" name="rating" value="${i + 1}" aria-label="${i + 1} out of 10">${raw(ICONS.star)}</label>`)}
        </div>
        <div class="rating-read"><span class="rating-num mono" id="rating-num"></span><span class="rating-word" id="rating-word"></span>
          <button class="link-btn" type="button" id="clear-rating" hidden>Clear rating</button></div>
      </fieldset>

      ${isShow ? html`<div class="progress-card" id="progress-card">
        <div class="steppers">
          ${['season', 'episode'].map((part) => html`<div class="stepper">
            <span class="stepper-label" id="${part}-label">${part === 'season' ? 'Season' : 'Episode'}</span>
            <div class="stepper-row" role="group" aria-labelledby="${part}-label">
              <button class="step-btn" type="button" data-step="${part}" data-by="-1" aria-label="Previous ${part}">&minus;</button>
              <output class="step-value mono" id="${part}-value" aria-live="polite">--</output>
              <button class="step-btn" type="button" data-step="${part}" data-by="1" aria-label="Next ${part}">+</button>
            </div>
          </div>`)}
        </div>
        <div class="progress-line"><span id="progress-tag"></span><span id="progress-pct"></span></div>
        <div class="progress-track" role="progressbar" aria-label="How far you are" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-fill" id="progress-fill"></div></div>
      </div>` : ''}

      <div class="field">
        <label for="review">Your review <span class="hint">(optional)</span></label>
        <textarea id="review" name="review" maxlength="2000" aria-describedby="review-count"></textarea>
        <p class="char-count" id="review-count"></p>
        <p class="field-error" id="review-error"></p>
      </div>
      <div class="btn-row">
        <button class="btn" type="submit">Save rating and review</button>
        <button class="btn btn-danger" type="button" id="remove-btn">Remove from list</button>
      </div>
    </form>
  </section>`;
}

function setupListPanel(item) {
  const isShow = item.format !== 'Movie';
  const panel = $('#list-panel');
  const statusForm = $('#status-form');
  const details = $('#details-form');
  const review = $('#review');
  let entry = null;       // the saved entry, or null when the title is not on the list
  let rating = 0;         // the chosen rating (0 = none)
  const progress = { season: 0, episode: 0 };

  /* ----- stars ----- */
  const stars = $$('.star', panel);
  stars.forEach((s, i) => s.style.setProperty('--i', i)); // each star waits i * 30ms (see the CSS)
  const paintStars = (n) => stars.forEach((s, i) => s.classList.toggle('lit', i < n));
  function readout(n) {
    $('#rating-num').textContent = n ? String(n) : '';
    $('#rating-word').textContent = n ? `— ${RATING_WORDS[n]}` : 'Not rated yet';
  }
  const showRating = (n) => { paintStars(n); readout(n); };
  const starsBox = $('#stars');
  starsBox.addEventListener('pointerover', (e) => {
    const star = e.target.closest('.star');
    if (star) showRating(stars.indexOf(star) + 1);     // preview while hovering
  });
  starsBox.addEventListener('pointerleave', () => showRating(rating));
  starsBox.addEventListener('change', (e) => { rating = Number(e.target.value); showRating(rating); $('#clear-rating').hidden = false; });
  $('#clear-rating').addEventListener('click', (e) => {
    rating = 0;
    $$('input', starsBox).forEach((r) => { r.checked = false; });
    showRating(0);
    e.target.hidden = true;
  });

  /* ----- season and episode stepper ----- */
  const seasons = item.seasons || [];
  const maxSeason = seasons.length ? Math.max(...seasons.map((s) => s.number)) : 999;
  const episodesIn = (n) => seasons.find((s) => s.number === n)?.episodes || null;

  function percent() {
    const { season, episode } = progress;
    if (!season && !episode) return 0;
    const total = seasons.reduce((n, s) => n + (s.episodes || 0), 0) || item.episodes;
    if (!total) return null; // we do not know how long the show is
    const before = seasons.length
      ? seasons.filter((s) => s.number < (season || 1)).reduce((n, s) => n + (s.episodes || 0), 0)
      : 0;
    return Math.min(100, Math.round(((before + episode) / total) * 100));
  }

  function showProgress() {
    if (!isShow) return;
    const { season, episode } = progress;
    $('#season-value').textContent = season ? String(season).padStart(2, '0') : '--';
    $('#episode-value').textContent = episode ? String(episode).padStart(2, '0') : '--';
    const limit = episodesIn(season);
    $$('[data-step]', panel).forEach((b) => {
      const by = Number(b.dataset.by);
      if (b.dataset.step === 'season') b.disabled = by < 0 ? season <= 0 : season >= maxSeason;
      else b.disabled = by < 0 ? episode <= 0 : !!limit && episode >= limit;
    });
    const pct = percent();
    $('#progress-tag').textContent = episodeTag(season, episode) || 'Not started';
    $('#progress-pct').textContent = pct === null ? '' : `${pct}% watched`;
    $('#progress-fill').style.width = `${pct || 0}%`; // the bar glides to its new width
    $('.progress-track', panel).setAttribute('aria-valuenow', String(pct || 0));
  }

  let saveTimer;
  function step(part, by) {
    if (part === 'season') {
      progress.season = Math.max(0, Math.min(maxSeason, progress.season + by));
      progress.episode = progress.season ? 1 : 0; // a new season starts at its first episode
    } else {
      if (!progress.season && by > 0) progress.season = 1; // an episode needs a season
      progress.episode = Math.max(0, progress.episode + by);
      const limit = episodesIn(progress.season);
      if (limit) progress.episode = Math.min(limit, progress.episode);
    }
    showProgress();
    clearTimeout(saveTimer); // save once, shortly after the last click
    saveTimer = setTimeout(() => save({ season: progress.season || null, episode: progress.episode || null }, 'Progress saved.'), 700);
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b && !b.disabled) step(b.dataset.step, Number(b.dataset.by));
  });

  /* ----- review ----- */
  const count = () => { $('#review-count').textContent = `${review.value.length} / 2000`; };
  review.addEventListener('input', count);

  /* ----- what the panel shows ----- */
  function applyEntry(next) {
    entry = next;
    $('#list-title').textContent = entry ? 'On your shelf' : 'Add to your list';
    $('#list-sub').textContent = entry
      ? `Marked as ${STATUS_LABELS[entry.status].toLowerCase()}. Rate it, note where you are and write a few words.`
      : 'Choose where it goes. You can rate it and write a review after.';
    $$('input[name="status"]', statusForm).forEach((r) => { r.checked = !!entry && r.value === entry.status; });
    details.hidden = !entry;
    rating = entry?.rating || 0;
    $$('input', starsBox).forEach((r) => { r.checked = Number(r.value) === rating; });
    $('#clear-rating').hidden = !rating;
    showRating(rating);
    progress.season = entry?.season || 0;
    progress.episode = entry?.episode || 0;
    showProgress();
    review.value = entry?.review || '';
    count();
  }

  // Sends a change to the server and shows the saved entry.
  async function save(body, message, form) {
    const wasNew = !entry;
    try {
      const { entry: saved } = await api(`/api/list/${encodeURIComponent(item.id)}`, { method: 'PUT', body });
      toast(message);
      if (wasNew) applyEntry(saved);
      else entry = saved; // changed in place: the panel already shows it
      return true;
    } catch (err) {
      if (form) showFormError(form, err); else toast(err.message, 'error');
      applyEntry(entry); // put the panel back to what is really saved
      return false;
    }
  }

  statusForm.addEventListener('change', async (e) => {
    const stamp = e.target.closest('.stamp');
    stamp.classList.add('pressed'); // a little bounce
    stamp.addEventListener('animationend', () => stamp.classList.remove('pressed'), { once: true });
    const status = e.target.value;
    const message = entry ? `Moved to ${STATUS_LABELS[status]}.` : `Added to ${STATUS_LABELS[status]}.`;
    if (await save({ status }, message) && entry) {
      $('#list-sub').textContent = `Marked as ${STATUS_LABELS[status].toLowerCase()}. Rate it, note where you are and write a few words.`;
    }
  });

  details.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('button[type="submit"]', details);
    const body = { rating: rating || null, review: review.value };
    if (isShow) { body.season = progress.season || null; body.episode = progress.episode || null; }
    setBusy(button, true, 'Saving…');
    await save(body, 'Rating and review saved.', details);
    setBusy(button, false);
  });

  $('#remove-btn').addEventListener('click', async (e) => {
    if (!confirm(`Remove “${item.title}” from your list? Your rating and review will be deleted.`)) return;
    setBusy(e.target, true, 'Removing…');
    try {
      await api(`/api/list/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      toast('Removed from your list.');
      applyEntry(null);
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(e.target, false);
  });

  return { applyEntry };
}

async function showListPanel(item) {
  const holder = document.createElement('div');
  $('#panels').prepend(holder);
  if (!user) {
    holder.innerHTML = html`<section class="panel" aria-labelledby="list-title">
      <div class="panel-head"><h2 id="list-title">Your list</h2>
      <p class="muted">Log in to add this ${TYPE_LABELS[item.type].toLowerCase()} to your list, rate it and write a review.</p></div>
      <div class="btn-row"><a class="btn" href="/login?next=${encodeURIComponent(location.pathname)}">Log in to add it</a>
      <a class="btn btn-quiet" href="/register">Create an account</a></div></section>`.toString();
    return;
  }
  holder.innerHTML = listPanelHtml(item).toString();
  const panel = setupListPanel(item);
  panel.applyEntry(null);
  try {
    const { entry } = await api(`/api/list/${encodeURIComponent(item.id)}`);
    panel.applyEntry(entry);
  } catch (err) {
    holder.insertAdjacentHTML('afterbegin', html`<p class="notice">Your list could not be checked. ${err.message}</p>`.toString());
  }
}

/* ---------- Friends who have this title ---------- */
async function showFriendsPanel(item) {
  if (!user) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-labelledby', 'friends-title');
  $('#panels').append(panel);
  const head = html`<div class="panel-head"><h2 id="friends-title">Friends who watched this</h2></div>`;
  panel.innerHTML = html`${head}${stateHtml('loading', 'Looking at your friends’ lists…')}`.toString();
  try {
    const { friends } = await api(`/api/friends/on/${encodeURIComponent(item.id)}`);
    draw(panel, html`${head}${friends.length
      ? html`<div class="friends-shelf cascade">${friends.map((f) => html`<article class="friend-card">
          <div class="friend-top">
            ${avatar(f.username)}
            <a class="who" href="/u/${encodeURIComponent(f.username)}">${f.username}</a>
            ${statusChip(f.status)}
            ${f.rating ? scoreHtml(f.rating) : ''}
          </div>
          ${f.review ? html`<p class="review">${f.review}</p>` : ''}
        </article>`)}</div>`
      : html`<p class="muted">None of your friends have this on their list yet. <a class="text-link" href="/friends">Find friends</a></p>`}`);
  } catch (err) {
    panel.innerHTML = html`${head}<p class="notice">${err.message}</p>`.toString();
  }
}

/* ---------- Start ---------- */
box.innerHTML = html`<div class="wrap page">${stateHtml('loading', 'Loading title…')}</div>`.toString();
let item = null;
let community = null;
try {
  ({ item, community } = await api(`/api/catalog/items/${encodeURIComponent(id)}`));
} catch (err) {
  box.innerHTML = html`<div class="wrap page">${err.status === 404
    ? stateHtml('empty', 'This title is not here', 'The link may be wrong, or the title was removed from the source.', html`<a class="btn" href="/">Back to Home</a>`)
    : stateHtml('error', 'This title could not load', err.message, retryButton())}</div>`.toString();
}
if (item) {
  render(item, community);
  showListPanel(item);
  showFriendsPanel(item);
}
