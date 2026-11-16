// Profiles, people search and the privacy setting.
const express = require('express');
const db = require('../db');
const { requireUser, publicUser } = require('../auth');
const { relationship, canSeeList } = require('../access');
const { readList, countList, readFilters } = require('./list');
const { HttpError, str, oneOf } = require('../validate');

const router = express.Router();

async function findUser(username) {
  const { rows } = await db.query(
    'SELECT id, username, privacy, created_at FROM users WHERE lower(username) = lower($1)',
    [str(username)]
  );
  return rows[0] || null;
}

// Why a list is hidden, in words the page can show.
function deniedReason(privacy, viewer, rel, name) {
  if (privacy === 'private') return { reason: 'private', message: 'This list is private. Only its owner can see it.' };
  if (!viewer) return { reason: 'login', message: 'This list is visible to friends only. Log in and add this person as a friend to see it.' };
  const message = {
    outgoing: `This list is visible to friends only. Your friend request is waiting for ${name} to accept it.`,
    incoming: `This list is visible to friends only. ${name} sent you a friend request: accept it to see each other's lists.`,
  }[rel] || 'This list is visible to friends only. Send a friend request to see it.';
  return { reason: 'friends', message };
}

// GET /api/users/:username — profile header plus the list if the viewer may see it.
router.get('/:username', async (req, res) => {
  const owner = await findUser(req.params.username);
  if (!owner) throw new HttpError(404, 'There is no one with this username.');

  const rel = await relationship(req.user?.id, owner.id);
  const profile = { ...publicUser(owner), relationship: rel };

  if (!canSeeList(owner.privacy, rel)) {
    // Only the name and the reason are sent, never the list or its counts.
    // (200 instead of 403: a hidden list is a normal page, not a failed request.)
    return res.json({ profile, hidden: true, ...deniedReason(owner.privacy, req.user, rel, owner.username) });
  }
  const filters = readFilters(req.query);
  const [entries, counts] = await Promise.all([readList(owner.id, filters), countList(owner.id, filters.type)]);
  res.json({ profile, entries, counts });
});

// PUT /api/users/me/privacy — change my list privacy.
router.put('/me/privacy', requireUser, async (req, res) => {
  const privacy = oneOf(req.body?.privacy, ['public', 'friends', 'private'], 'privacy', 'Privacy');
  await db.query('UPDATE users SET privacy = $1 WHERE id = $2', [privacy, req.user.id]);
  res.json({ privacy });
});

module.exports = router;
