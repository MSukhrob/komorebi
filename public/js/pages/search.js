import { initPage, api, html, $, posterCard, posterSkeletons, stateHtml, retryButton } from '../app.js';

await initPage({ nav: 'search' });

const form = $('#search-form');
const input = $('#q');
const results = $('#results');
const TYPE_WORDS = { all: 'titles', movie: 'movies', series: 'series', cartoon: 'cartoons', anime: 'anime' };

// Start from the address bar (?q=...&type=...), so searches can be shared.
const params = new URLSearchParams(location.search);
input.value = params.get('q') || '';
const startType = params.get('type');
if (startType && form.querySelector(`input[name="type"][value="${CSS.escape(startType)}"]`)) {
  form.querySelector(`input[name="type"][value="${CSS.escape(startType)}"]`).checked = true;
}

const currentType = () => form.querySelector('input[name="type"]:checked').value;

let timer;
let controller;

async function runSearch() {
  const q = input.value.trim();
  const type = currentType();

  // keep the address bar in sync without adding history entries
  const url = new URL(location.href);
  url.search = new URLSearchParams({ ...(q && { q }), ...(type !== 'all' && { type }) }).toString();
  history.replaceState(null, '', url);

  if (controller) controller.abort(); // a newer search replaces the older one
  if (q.length < 2) {
    results.innerHTML = stateHtml('empty', 'What would you like to find?',
      `Type at least two letters to search ${TYPE_WORDS[type]}.`).toString();
    return;
  }

  controller = new AbortController();
  results.setAttribute('aria-busy', 'true');
  results.innerHTML = html`<div class="posters">${posterSkeletons(12)}</div>`.toString();
  try {
    const data = await api(`/api/catalog/search?${new URLSearchParams({ q, type })}`, { signal: controller.signal });
    const warnings = data.warnings.map((w) => html`<p class="notice">${w}</p>`);
    results.innerHTML = (data.items.length
      ? html`${warnings}<p class="results-count">${data.items.length} ${data.items.length === 1 ? 'result' : 'results'} for “${q}”</p>
          <div class="posters">${data.items.map((i) => posterCard(i))}</div>`
      : html`${warnings}${stateHtml('empty', `Nothing found for “${q}”`, 'Check the spelling, try the original title, or choose a different type.')}`
    ).toString();
  } catch (err) {
    if (err.name === 'AbortError') return;
    results.innerHTML = stateHtml('error', 'Search did not work', err.message, retryButton()).toString();
  } finally {
    results.removeAttribute('aria-busy');
  }
}

// Wait until typing pauses, so we don't send a request for every key.
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 350);
});
form.addEventListener('change', (e) => { if (e.target.name === 'type') runSearch(); });
form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); runSearch(); });

if (!input.value) input.focus();
runSearch();
