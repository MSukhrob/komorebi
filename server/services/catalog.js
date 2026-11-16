// The catalog. The rest of the app only talks to this file; it hides how
// titles are fetched from TMDB, cached and refreshed.
const db = require('../db');
const tmdb = require('./tmdb');
const { TtlCache } = require('./http');
const { HttpError } = require('../validate');
const hidden = new Set(require('../data/hidden-titles.json').ids);

const TYPES = ['movie', 'series', 'cartoon'];
const ID_RE = /^tmdb-(movie|tv)-\d{1,9}$/;

const searchCache = new TtlCache({ ttlMs: 15 * 60 * 1000, max: 400 });
const homeCache = new TtlCache({ ttlMs: 60 * 60 * 1000, staleMs: 7 * 24 * 60 * 60 * 1000, max: 10 });

const ITEM_FRESH_MS = 7 * 24 * 60 * 60 * 1000; // refetch saved details after a week

// The home page is a shop window, so it leaves out horror movies and the titles listed in
// server/data/hidden-titles.json. Search and the title pages are not affected.
const HORROR = 27; // TMDB genre id
const suitable = (i) => !hidden.has(i.id) && !(i.genreIds || []).includes(HORROR);

// Fields the browser gets for grids (drops internal matching data).
const card = ({ id, type, title, year, posterUrl }) => ({ id, type, title, year, posterUrl });
// A card that also shows when the title comes out (the release radar).
const dated = (item) => ({ ...card(item), releaseDate: item.releaseDate });
// A big hero entry: backdrop picture, short overview, TMDB score.
const feature = (i) => ({
  ...card(i),
  backdropUrl: i.backdropUrl,
  overview: i.overview && i.overview.length > 240 ? `${i.overview.slice(0, 237).replace(/\s+\S*$/, '')}…` : i.overview,
  rating: i.rating,
  releaseDate: i.releaseDate,
});

/* ---------- Search ---------- */
async function search(query, type) {
  const key = `${type}|${query.toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  let found;
  try {
    found = await tmdb.search(query);
  } catch (err) {
    console.warn(err.message);
    throw new HttpError(503, 'Search is not available right now. Please try again in a moment.');
  }

  let items = type === 'all' ? found : found.filter((i) => i.type === type);
  // TMDB already orders by relevance. Titles without a poster are usually
  // obscure entries, so they go after the rest (the sort keeps TMDB's order).
  items = items.map((item, rank) => ({ item, rank }))
    .sort((a, b) => Number(!!b.item.posterUrl) - Number(!!a.item.posterUrl) || a.rank - b.rank)
    .map((x) => x.item);

  const result = { items: items.slice(0, 30).map(card) };
  searchCache.set(key, result);
  return result;
}

/* ---------- Home page ---------- */
async function section(key, title, load) {
  try {
    const items = await load();
    homeCache.set(key, items);
    return { key, title, items };
  } catch (err) {
    console.warn(err.message);
    const stale = homeCache.get(key, { allowStale: true });
    if (stale) return { key, title, items: stale };
    return { key, title, items: [], error: 'This section could not be loaded right now.' };
  }
}

const interleave = (a, b) => a.flatMap((x, i) => (b[i] ? [x, b[i]] : [x])).concat(b.slice(a.length));

async function home() {
  const cached = homeCache.get('home');
  if (cached) return cached;
  const take = (list, type) => list.filter((i) => i.type === type).slice(0, 14).map(card);
  let featured = [];

  const sections = await Promise.all([
    section('movies', 'Trending movies', async () => {
      const list = (await tmdb.trending('movie')).filter(suitable);
      featured.push(...list.filter((i) => i.backdropUrl && i.overview).slice(0, 3));
      return take(list, 'movie');
    }),
    section('series', 'Trending series', async () => {
      const list = (await tmdb.trending('tv')).filter(suitable);
      featured.push(...list.filter((i) => i.backdropUrl && i.overview).slice(0, 3));
      return take(list, 'series');
    }),
    section('cartoons', 'Popular cartoons', async () => {
      const [m, s] = await Promise.all([tmdb.popularAnimation('movie'), tmdb.popularAnimation('tv')]);
      return take(interleave(m.filter(suitable), s.filter(suitable)), 'cartoon');
    }),
  ]);
  featured = featured.sort((a, b) => b.popularity - a.popularity).map(feature);
  const result = { sections, featured };
  if (!sections.some((s) => s.error)) homeCache.set('home', result);
  return result;
}

/* ---------- Release radar: in cinemas, coming soon, on TV this week ---------- */
async function radar() {
  const cached = homeCache.get('radar');
  if (cached) return cached;
  const today = new Date().toISOString().slice(0, 10);
  const popular = (list) => list.filter((i) => i.posterUrl && suitable(i)).sort((a, b) => b.popularity - a.popularity);
  const sections = await Promise.all([
    section('radar-now', 'In cinemas now', async () => popular(await tmdb.nowPlaying()).slice(0, 14).map(dated)),
    section('radar-soon', 'Coming soon', async () =>
      popular((await tmdb.upcoming()).filter((i) => i.releaseDate && i.releaseDate >= today))
        .slice(0, 14).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).map(dated)),
    section('radar-tv', 'On TV this week', async () => popular(await tmdb.airingThisWeek()).slice(0, 14).map(dated)),
  ]);
  const result = { sections };
  if (!sections.some((s) => s.error)) homeCache.set('radar', result);
  return result;
}

/* ---------- Browse by genre ----------
   name -> TMDB genre id for movies and for TV (they differ, and not every genre exists in both). */
const GENRES = [
  { name: 'Action', movie: 28, tv: 10759 }, { name: 'Adventure', movie: 12, tv: 10759 },
  { name: 'Comedy', movie: 35, tv: 35 }, { name: 'Crime', movie: 80, tv: 80 },
  { name: 'Documentary', movie: 99, tv: 99 }, { name: 'Drama', movie: 18, tv: 18 },
  { name: 'Family', movie: 10751, tv: 10751 }, { name: 'Fantasy', movie: 14, tv: 10765 },
  { name: 'Horror', movie: 27, tv: null }, { name: 'Kids', movie: null, tv: 10762 },
  { name: 'Music', movie: 10402, tv: null }, { name: 'Mystery', movie: 9648, tv: 9648 },
  { name: 'Romance', movie: 10749, tv: null }, { name: 'Sci-Fi', movie: 878, tv: 10765 },
  { name: 'Thriller', movie: 53, tv: null }, { name: 'War', movie: 10752, tv: 10768 },
  { name: 'Western', movie: 37, tv: 37 },
];
const SORT_NAMES = ['popular', 'rating', 'newest'];
const genreNamesFor = (type) => GENRES.filter((g) => type === 'cartoon' || g[type === 'movie' ? 'movie' : 'tv']).map((g) => g.name);
const browseCache = new TtlCache({ ttlMs: 15 * 60 * 1000, max: 300 });

async function browse({ type, genre, sort, page }) {
  const key = `${type}|${genre}|${sort}|${page}`;
  const cached = browseCache.get(key);
  if (cached) return cached;
  const g = GENRES.find((x) => x.name === genre);
  let items = [];
  let totalPages = 1;
  try {
    // movies and series are one TMDB call; cartoons are animated movies and animated series together
    const calls = type === 'movie' ? [['movie', false]] : type === 'series' ? [['tv', false]] : [['movie', true], ['tv', true]];
    const results = await Promise.all(calls
      .filter(([m]) => !g || g[m === 'movie' ? 'movie' : 'tv'])
      .map(([m, animation]) => tmdb.discover(m, { genreId: g ? g[m === 'movie' ? 'movie' : 'tv'] : null, sort, page, animation })));
    items = results.length === 2 ? interleave(results[0].items, results[1].items) : results[0]?.items || [];
    totalPages = Math.max(1, ...results.map((r) => r.totalPages));
  } catch (err) {
    console.warn(err.message);
    throw new HttpError(503, 'Browsing is not available right now. Please try again in a moment.');
  }
  const result = { items: items.filter((i) => i.posterUrl && (genre === 'Horror' ? !hidden.has(i.id) : suitable(i))).map(card), page, hasMore: page < totalPages };
  browseCache.set(key, result);
  return result;
}

/* ---------- One item ---------- */
async function fetchFromSource(id) {
  const [, mediaType, num] = id.split('-');
  return tmdb.details(mediaType, num);
}

async function saveItem(item) {
  await db.query(
    `INSERT INTO items (id, type, title, year, poster_url, data, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE
       SET type = EXCLUDED.type, title = EXCLUDED.title, year = EXCLUDED.year,
           poster_url = EXCLUDED.poster_url, data = EXCLUDED.data, fetched_at = now()`,
    [item.id, item.type, item.title, item.year, item.posterUrl, item]
  );
}

// Returns the full item. Uses the saved copy when it is fresh, refreshes it
// when it is old, and falls back to the old copy if the source is down.
async function getItem(id) {
  if (!ID_RE.test(id)) throw new HttpError(404, 'This title does not exist.');
  const { rows } = await db.query('SELECT data, fetched_at FROM items WHERE id = $1', [id]);
  const saved = rows[0];
  // an old saved copy (from before cast, trailer and similar titles existed) is refreshed too
  if (saved && saved.data.dataVersion === tmdb.DATA_VERSION && Date.now() - new Date(saved.fetched_at).getTime() < ITEM_FRESH_MS) return saved.data;

  let fresh;
  try {
    fresh = await fetchFromSource(id);
  } catch (err) {
    console.warn(err.message);
    if (saved) return saved.data;
    throw new HttpError(503, 'The details for this title could not be loaded right now. Please try again in a moment.');
  }
  if (!fresh) throw new HttpError(404, 'This title does not exist.');
  await saveItem(fresh);
  return fresh;
}

/* ---------- Keep saved data current ----------
   TMDB allows caching for at most 6 months. Every hour we refresh a few of
   the oldest saved titles (older than 30 days), gently, one at a time.    */
async function refreshOldItems(limit = 20) {
  const { rows } = await db.query(
    `SELECT id FROM items WHERE fetched_at < now() - interval '30 days' ORDER BY fetched_at LIMIT $1`,
    [limit]
  );
  for (const { id } of rows) {
    try {
      const fresh = await fetchFromSource(id);
      if (fresh) await saveItem(fresh);
    } catch (err) {
      console.warn('refresh', id, err.message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

module.exports = { TYPES, ID_RE, GENRES, SORT_NAMES, genreNamesFor, search, home, radar, browse, getItem, refreshOldItems };
