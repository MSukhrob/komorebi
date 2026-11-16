import { initPage, api, html, $, draw, posterCard, stateHtml, retryButton } from '../app.js';

await initPage({ nav: 'stats', requireLogin: true });
const box = $('#stats');

const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);

function render(d) {
  if (!d.total) {
    draw(box, stateHtml('empty', 'Nothing to count yet', 'Add a few titles to your list and your stats appear here.', html`<a class="btn" href="/">Find something to watch</a>`));
    return;
  }
  const days = d.hours >= 48 ? `, about ${(d.hours / 24).toFixed(1)} days` : '';
  const maxGenre = Math.max(1, ...d.genres.map((g) => g.n));
  const maxType = Math.max(1, ...Object.values(d.byType));
  const maxRate = Math.max(1, ...d.histogram);
  const maxMonth = Math.max(1, ...d.months.map((m) => m.added));
  const TYPE = { movie: 'Movies', series: 'Series', cartoon: 'Cartoons' };
  const STATUS = [['planned', 'Planned'], ['watching', 'Watching'], ['watched', 'Watched']];

  draw(box, html`<div class="stat-tiles">
      <div class="tile"><strong>${d.total}</strong><span>titles on your list</span></div>
      <div class="tile"><strong>${d.hours}</strong><span>hours watched${days}</span></div>
      <div class="tile"><strong>${d.averageRating ? d.averageRating.toFixed(1) : '--'}</strong><span>average rating${d.rated ? ` from ${d.rated} rated` : ''}</span></div>
      <div class="tile"><strong>${d.byStatus.watched}</strong><span>titles finished</span></div>
    </div>

    <div class="stat-grid">
      <section class="stat-card" aria-labelledby="st-status"><h2 id="st-status">Where your titles are</h2>
        <div class="split-bar" role="img" aria-label="Planned ${d.byStatus.planned}, watching ${d.byStatus.watching}, watched ${d.byStatus.watched}">
          ${STATUS.map(([k]) => html`<i class="status-${k}" data-v="${pct(d.byStatus[k], d.total)}"></i>`)}
        </div>
        <ul class="legend">${STATUS.map(([k, label]) => html`<li class="status-${k}">${label} <b>${d.byStatus[k]}</b></li>`)}</ul>
      </section>

      <section class="stat-card" aria-labelledby="st-type"><h2 id="st-type">What you watch</h2>
        <ul class="hbars">${Object.entries(TYPE).map(([k, label]) => html`<li><span>${label}</span>
          <div class="bar"><i data-v="${pct(d.byType[k], maxType)}"></i></div><span class="mono">${d.byType[k]}</span></li>`)}</ul>
      </section>

      <section class="stat-card" aria-labelledby="st-rate"><h2 id="st-rate">How you rate</h2>
        <ol class="columns" aria-label="Number of titles for each rating from 1 to 10">${d.histogram.map((n, i) => html`<li>
          <i data-v="${pct(n, maxRate)}"></i><b>${n || ''}</b><span>${i + 1}</span></li>`)}</ol>
      </section>

      <section class="stat-card" aria-labelledby="st-genres"><h2 id="st-genres">Favourite genres</h2>
        ${d.genres.length
          ? html`<ul class="hbars">${d.genres.map((g) => html`<li><span>${g.name}</span><div class="bar"><i data-v="${pct(g.n, maxGenre)}"></i></div><span class="mono">${g.n}</span></li>`)}</ul>`
          : html`<p class="muted">Genres appear as you add titles.</p>`}
      </section>

      <section class="stat-card wide" aria-labelledby="st-months"><h2 id="st-months">Titles added in the last 12 months</h2>
        <ol class="columns" aria-label="Titles added each month">${d.months.map((m) => html`<li>
          <i data-v="${pct(m.added, maxMonth)}"></i><b>${m.added || ''}</b><span>${m.label}</span></li>`)}</ol>
      </section>

      ${d.favourites.length ? html`<section class="stat-card wide" aria-labelledby="st-fav"><h2 id="st-fav">Your favourites</h2>
        <div class="fav-row">${d.favourites.map((f) => posterCard(f))}</div></section>` : ''}
    </div>`);
}

try {
  render(await api('/api/list/stats'));
} catch (err) {
  draw(box, stateHtml('error', 'Your stats could not load', err.message, retryButton()));
}
