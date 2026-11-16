// The logged-in user's own list: read, add or change, remove.
const express = require('express');
const db = require('../db');
const catalog = require('../services/catalog');
const { requireUser } = require('../auth');
const { HttpError, optionalInt, oneOf } = require('../validate');

const router = express.Router();
router.use(requireUser);

const STATUSES = ['planned', 'watching', 'watched'];
const SORTS = {
  added: 'e.created_at DESC',
  rating: 'e.rating DESC NULLS LAST, e.updated_at DESC',
  title: 'lower(i.title) ASC',
};

// How far through a show someone is, 0 to 100 (null when the length is unknown or it is a film).
function progressOf(data, season, episode) {
  if (!data || data.format === 'Movie' || (!season && !episode)) return null;
  const seasons = data.seasons || [];
  const total = seasons.reduce((n, s) => n + (s.episodes || 0), 0) || data.episodes;
  if (!total) return null;
  const earlier = seasons.filter((s) => s.number < (season || 1)).reduce((n, s) => n + (s.episodes || 0), 0);
  return Math.min(100, Math.round(((earlier + (episode || 0)) / total) * 100));
}

// Shape of one list row sent to the browser.
function entryJson(r) {
  return {
    item: { id: r.item_id, type: r.type, title: r.title, year: r.year, posterUrl: r.poster_url },
    status: r.status,
    rating: r.rating,
    review: r.review,
    season: r.season,
    episode: r.episode,
    progress: progressOf(r.data, r.season, r.episode),
    addedAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// Reads one user's list with optional filters. Shared with the profile page.
async function readList(userId, { status, type, sort } = {}) {
  const where = ['e.user_id = $1'];
  const params = [userId];
  if (status) { params.push(status); where.push(`e.status = $${params.length}`); }
  if (type) { params.push(type); where.push(`i.type = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT e.*, i.type, i.title, i.year, i.poster_url, i.data
     FROM list_entries e JOIN items i ON i.id = e.item_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${SORTS[sort] || SORTS.added}`,
    params
  );
  return rows.map(entryJson);
}

// Counts per status for the tabs (ignores the status filter, keeps the type filter).
async function countList(userId, type) {
  const params = [userId];
  let typeSql = '';
  if (type) { params.push(type); typeSql = 'AND i.type = $2'; }
  const { rows } = await db.query(
    `SELECT e.status, count(*)::int AS n
     FROM list_entries e JOIN items i ON i.id = e.item_id
     WHERE e.user_id = $1 ${typeSql}
     GROUP BY e.status`,
    params
  );
  const counts = { all: 0, planned: 0, watching: 0, watched: 0 };
  for (const r of rows) { counts[r.status] = r.n; counts.all += r.n; }
  return counts;
}

function readFilters(query) {
  const status = query.status && query.status !== 'all' ? oneOf(query.status, STATUSES, 'status', 'Status') : null;
  const type = query.type && query.type !== 'all' ? oneOf(query.type, catalog.TYPES, 'type', 'Type') : null;
  const sort = query.sort ? oneOf(query.sort, Object.keys(SORTS), 'sort', 'Sort') : 'added';
  return { status, type, sort };
}

router.get('/', async (req, res) => {
  const filters = readFilters(req.query);
  const [entries, counts] = await Promise.all([readList(req.user.id, filters), countList(req.user.id, filters.type)]);
  res.json({ entries, counts });
});

// Numbers about my list for the stats page: counts, hours, rating spread, genres, activity.
router.get('/stats', async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.item_id, e.status, e.rating, e.season, e.episode, e.created_at, i.type, i.title, i.year, i.poster_url, i.data
     FROM list_entries e JOIN items i ON i.id = e.item_id WHERE e.user_id = $1`,
    [req.user.id]
  );
  const byStatus = { planned: 0, watching: 0, watched: 0 };
  const byType = { movie: 0, series: 0, cartoon: 0 };
  const histogram = Array(10).fill(0);
  const genres = new Map();
  let minutes = 0;
  let ratingSum = 0;
  let rated = 0;

  for (const r of rows) {
    byStatus[r.status] += 1;
    byType[r.type] += 1;
    if (r.rating) { histogram[r.rating - 1] += 1; ratingSum += r.rating; rated += 1; }
    for (const g of r.data.genres || []) genres.set(g, (genres.get(g) || 0) + 1);

    // time spent: a watched film counts its length, a show counts the episodes you have seen
    if (r.status === 'planned') continue;
    if (r.data.format === 'Movie') {
      if (r.status === 'watched') minutes += r.data.runtime || 0;
    } else {
      const length = r.data.episodeLength || 45;
      let seen = r.status === 'watched' ? r.data.episodes || 0 : 0;
      if (r.status === 'watching' && (r.season || r.episode)) {
        const earlier = (r.data.seasons || []).filter((s) => s.number < (r.season || 1)).reduce((n, s) => n + (s.episodes || 0), 0);
        seen = earlier + (r.episode || 0);
      }
      minutes += seen * length;
    }
  }

  // titles added in each of the last 12 months
  const months = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()], added: 0 });
  }
  for (const r of rows) {
    const m = months.find((x) => x.key === new Date(r.created_at).toISOString().slice(0, 7));
    if (m) m.added += 1;
  }

  const favourites = rows.filter((r) => r.rating >= 9).sort((a, b) => b.rating - a.rating).slice(0, 6)
    .map((r) => ({ id: r.item_id, type: r.type, title: r.title, year: r.year, posterUrl: r.poster_url, rating: r.rating }));

  res.json({
    total: rows.length,
    byStatus,
    byType,
    hours: Math.round((minutes / 60) * 10) / 10,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
    rated,
    histogram,
    genres: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
    months,
    favourites,
  });
});

// Download my whole list as CSV (opens in Excel or Google Sheets) or JSON.
const csvCell = (v) => {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(t)) t = `'${t}`; // a spreadsheet must never run a cell as a formula
  return `"${t.replace(/"/g, '""')}"`;
};
router.get('/export', async (req, res) => {
  const entries = await readList(req.user.id, { sort: 'added' });
  const stamp = new Date().toISOString().slice(0, 10);
  if (req.query.format === 'json') {
    res.set('Content-Disposition', `attachment; filename="komorebi-list-${stamp}.json"`);
    return res.json({ exportedAt: new Date().toISOString(), entries });
  }
  const head = ['title', 'year', 'type', 'status', 'rating', 'season', 'episode', 'review', 'added', 'tmdb_id'];
  const lines = entries.map((e) => [
    e.item.title, e.item.year, e.item.type, e.status, e.rating, e.season, e.episode, e.review, e.addedAt.toISOString().slice(0, 10), e.item.id,
  ].map(csvCell).join(','));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="komorebi-list-${stamp}.csv"`);
  res.send(`\uFEFF${head.join(',')}\n${lines.join('\n')}\n`);
});

// The viewer's entry for one title (null when it is not on the list).
router.get('/:itemId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.*, i.type, i.title, i.year, i.poster_url, i.data
     FROM list_entries e JOIN items i ON i.id = e.item_id
     WHERE e.user_id = $1 AND e.item_id = $2`,
    [req.user.id, req.params.itemId]
  );
  res.json({ entry: rows[0] ? entryJson(rows[0]) : null });
});

// Add a title or update it. Only the fields sent are changed.
router.put('/:itemId', async (req, res) => {
  const itemId = req.params.itemId;
  const body = req.body || {};
  // makes sure the title exists and is saved in our items table
  const item = await catalog.getItem(itemId);

  const { rows: existingRows } = await db.query(
    'SELECT * FROM list_entries WHERE user_id = $1 AND item_id = $2',
    [req.user.id, itemId]
  );
  const old = existingRows[0];

  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const status = has('status') ? oneOf(body.status, STATUSES, 'status', 'Status') : old?.status;
  if (!status) throw new HttpError(400, 'Choose a status: Planned, Watching or Watched.', { field: 'status' });

  const rating = has('rating') ? optionalInt(body.rating, 1, 10, 'rating', 'Rating') : old?.rating ?? null;
  let review = old?.review ?? null;
  if (has('review')) {
    if (body.review !== null && typeof body.review !== 'string') throw new HttpError(400, 'Review must be text.', { field: 'review' });
    review = (body.review || '').trim() || null;
    if (review && review.length > 2000) throw new HttpError(400, 'Review can be at most 2000 characters.', { field: 'review' });
  }
  // season/episode progress makes sense only for shows, not films
  const isShow = item.format !== 'Movie';
  let season = has('season') ? optionalInt(body.season, 0, 999, 'season', 'Season') : old?.season ?? null;
  let episode = has('episode') ? optionalInt(body.episode, 0, 9999, 'episode', 'Episode') : old?.episode ?? null;
  if (!isShow) { season = null; episode = null; }

  const { rows } = await db.query(
    `INSERT INTO list_entries (user_id, item_id, status, rating, review, season, episode)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, item_id) DO UPDATE
       SET status = EXCLUDED.status, rating = EXCLUDED.rating, review = EXCLUDED.review,
           season = EXCLUDED.season, episode = EXCLUDED.episode, updated_at = now()
     RETURNING *`,
    [req.user.id, itemId, status, rating, review, season, episode]
  );
  const r = { ...rows[0], type: item.type, title: item.title, year: item.year, poster_url: item.posterUrl, data: item };
  res.status(old ? 200 : 201).json({ entry: entryJson(r), created: !old });
});

// "Next episode": moves a show I am watching one episode on (into the next season at a season's end,
// and to Watched after the very last episode).
router.post('/:itemId/next', async (req, res) => {
  const item = await catalog.getItem(req.params.itemId);
  if (item.format === 'Movie') throw new HttpError(400, 'Films have no episodes.');
  const { rows } = await db.query('SELECT * FROM list_entries WHERE user_id = $1 AND item_id = $2', [req.user.id, item.id]);
  const old = rows[0];
  if (!old) throw new HttpError(404, 'This title is not on your list.');

  let season = old.season || 1;
  let episode = (old.episode || 0) + 1;
  let status = 'watching';
  const seasons = item.seasons || [];
  const here = seasons.find((s) => s.number === season)?.episodes;
  const lastSeason = seasons.length ? Math.max(...seasons.map((s) => s.number)) : null;
  if (here && episode > here) {
    if (lastSeason && season >= lastSeason) { episode = here; status = 'watched'; }
    else { season += 1; episode = 1; }
  }
  const { rows: saved } = await db.query(
    `UPDATE list_entries SET season = $3, episode = $4, status = $5, updated_at = now()
     WHERE user_id = $1 AND item_id = $2 RETURNING *`,
    [req.user.id, item.id, season, episode, status]
  );
  const r = { ...saved[0], type: item.type, title: item.title, year: item.year, poster_url: item.posterUrl, data: item };
  res.json({ entry: entryJson(r), finished: status === 'watched' });
});

router.delete('/:itemId', async (req, res) => {
  const { rowCount } = await db.query(
    'DELETE FROM list_entries WHERE user_id = $1 AND item_id = $2',
    [req.user.id, req.params.itemId]
  );
  if (!rowCount) throw new HttpError(404, 'This title is not on your list.');
  res.json({ ok: true });
});

module.exports = { router, readList, countList, readFilters };
