// Friend requests and friendships.
// Every route works on the pair (me, other user), where "me" always comes
// from the session. So nobody can accept or cancel someone else's request.
const express = require('express');
const db = require('../db');
const { requireUser } = require('../auth');
const { relationship } = require('../access');
const { HttpError, str } = require('../validate');

const router = express.Router();
router.use(requireUser);

const PAIR = `((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`;

async function otherUser(req) {
  const id = Number(req.params.userId);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'This person does not exist.');
  if (id === req.user.id) throw new HttpError(400, 'You cannot do that with yourself.');
  const { rows } = await db.query('SELECT id, username FROM users WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'This person does not exist.');
  return rows[0];
}

// My friends and requests, for the Friends page.
router.get('/', async (req, res) => {
  const me = req.user.id;
  const { rows } = await db.query(
    `SELECT f.requester_id, f.status, f.created_at, u.id, u.username
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE f.requester_id = $1 OR f.addressee_id = $1
     ORDER BY lower(u.username)`,
    [me]
  );
  const out = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const person = { id: r.id, username: r.username, since: r.created_at };
    if (r.status === 'accepted') out.friends.push(person);
    else if (r.requester_id === me) out.outgoing.push(person);
    else out.incoming.push(person);
  }
  res.json(out);
});

// Friends who have this title on their list. Private lists are left out,
// following the same rule as profiles (a friend sees public and friends-only lists).
router.get('/on/:itemId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.username, e.status, e.rating, e.review, e.updated_at
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     JOIN list_entries e ON e.user_id = u.id AND e.item_id = $2
     WHERE (f.requester_id = $1 OR f.addressee_id = $1)
       AND f.status = 'accepted'
       AND u.privacy <> 'private'
     ORDER BY e.updated_at DESC`,
    [req.user.id, req.params.itemId]
  );
  res.json({
    friends: rows.map((r) => ({ username: r.username, status: r.status, rating: r.rating, review: r.review })),
  });
});

// What my friends added or changed lately. Private lists are left out (same rule as profiles).
router.get('/activity', async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.username, e.item_id, e.status, e.rating, e.review, e.updated_at, i.type, i.title, i.year, i.poster_url
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     JOIN list_entries e ON e.user_id = u.id
     JOIN items i ON i.id = e.item_id
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted' AND u.privacy <> 'private'
     ORDER BY e.updated_at DESC
     LIMIT 12`,
    [req.user.id]
  );
  res.json({
    activity: rows.map((r) => ({
      username: r.username, status: r.status, rating: r.rating, review: r.review, at: r.updated_at,
      item: { id: r.item_id, type: r.type, title: r.title, year: r.year, posterUrl: r.poster_url },
    })),
  });
});

// Find people by username (starts with, then contains).
router.get('/search', async (req, res) => {
  const q = str(req.query.q).slice(0, 30);
  if (q.length < 2) return res.json({ people: [] });
  const like = q.replace(/[\\%_]/g, (c) => `\\${c}`); // treat % and _ literally
  const { rows } = await db.query(
    `SELECT id, username FROM users
     WHERE id <> $1 AND username ILIKE $2
     ORDER BY (lower(username) LIKE lower($3)) DESC, lower(username)
     LIMIT 20`,
    [req.user.id, `%${like}%`, `${like}%`]
  );
  const people = await Promise.all(
    rows.map(async (u) => ({ ...u, relationship: await relationship(req.user.id, u.id) }))
  );
  res.json({ people });
});

// Send a friend request. If they already asked me, this accepts it instead.
router.post('/:userId/request', async (req, res) => {
  const other = await otherUser(req);
  const rel = await relationship(req.user.id, other.id);
  if (rel === 'friends') throw new HttpError(409, `You and ${other.username} are already friends.`);
  if (rel === 'outgoing') throw new HttpError(409, `You already sent ${other.username} a request.`);
  if (rel === 'incoming') {
    await db.query(`UPDATE friendships SET status = 'accepted' WHERE requester_id = $2 AND addressee_id = $1`, [req.user.id, other.id]);
    return res.json({ relationship: 'friends', message: `You and ${other.username} are now friends.` });
  }
  await db.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, other.id]);
  res.status(201).json({ relationship: 'outgoing', message: `Friend request sent to ${other.username}.` });
});

// Accept a request that the other person sent to me.
router.post('/:userId/accept', async (req, res) => {
  const other = await otherUser(req);
  const { rowCount } = await db.query(
    `UPDATE friendships SET status = 'accepted'
     WHERE requester_id = $2 AND addressee_id = $1 AND status = 'pending'`,
    [req.user.id, other.id]
  );
  if (!rowCount) throw new HttpError(404, `There is no request from ${other.username} to accept.`);
  res.json({ relationship: 'friends', message: `You and ${other.username} are now friends.` });
});

// Decline their request, cancel mine, or remove a friend: all delete the row for our pair.
router.delete('/:userId', async (req, res) => {
  const other = await otherUser(req);
  const rel = await relationship(req.user.id, other.id);
  if (rel === 'none') throw new HttpError(404, `There is nothing to remove between you and ${other.username}.`);
  await db.query(`DELETE FROM friendships WHERE ${PAIR}`, [req.user.id, other.id]);
  const message = {
    friends: `${other.username} is no longer your friend.`,
    outgoing: `Request to ${other.username} cancelled.`,
    incoming: `Request from ${other.username} declined.`,
  }[rel];
  res.json({ relationship: 'none', message });
});

module.exports = router;
