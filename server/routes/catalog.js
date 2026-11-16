// Read-only catalog: home sections, search, one title.
const express = require('express');
const rateLimit = require('express-rate-limit');
const catalog = require('../services/catalog');
const news = require('../services/news');
const db = require('../db');
const { HttpError, str } = require('../validate');

const router = express.Router();

// Protects the outside APIs from one browser sending too many searches.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  handler: (req, res) => res.status(429).json({ error: 'You are searching very fast. Wait a few seconds and try again.' }),
});

router.get('/home', async (req, res) => {
  res.json(await catalog.home());
});

router.get('/radar', async (req, res) => {
  res.json(await catalog.radar());
});

router.get('/news', async (req, res) => {
  try {
    res.json({ items: await news.headlines() });
  } catch (err) {
    console.warn(err.message);
    throw new HttpError(503, 'The film news could not be loaded right now.');
  }
});

router.get('/genres', (req, res) => {
  res.json(Object.fromEntries(['movie', 'series', 'cartoon'].map((t) => [t, catalog.genreNamesFor(t)])));
});

// Browse by type and genre, one page at a time.
router.get('/browse', async (req, res) => {
  const type = str(req.query.type) || 'movie';
  if (!catalog.TYPES.includes(type)) throw new HttpError(400, 'Unknown type.');
  const genre = str(req.query.genre);
  if (genre && !catalog.genreNamesFor(type).includes(genre)) throw new HttpError(400, 'Unknown genre.');
  const sort = str(req.query.sort) || 'popular';
  if (!catalog.SORT_NAMES.includes(sort)) throw new HttpError(400, 'Unknown sort.');
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 50);
  res.json(await catalog.browse({ type, genre, sort, page }));
});

router.get('/search', searchLimiter, async (req, res) => {
  const q = str(req.query.q).slice(0, 100);
  const type = str(req.query.type) || 'all';
  if (!['all', ...catalog.TYPES].includes(type)) throw new HttpError(400, 'Unknown type filter.');
  if (q.length < 2) return res.json({ items: [], warnings: [] });
  res.json(await catalog.search(q, type));
});

router.get('/items/:id', async (req, res) => {
  const item = await catalog.getItem(req.params.id);
  // how many Komorebi users have it, and their average rating (only totals, never who)
  const { rows } = await db.query(
    `SELECT count(*)::int AS on_lists, count(*) FILTER (WHERE status = 'watched')::int AS watched,
            round(avg(rating)::numeric, 1)::float AS average
     FROM list_entries WHERE item_id = $1`,
    [item.id]
  );
  res.json({ item, community: { onLists: rows[0].on_lists, watched: rows[0].watched, average: rows[0].average } });
});

module.exports = router;
