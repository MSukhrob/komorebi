// Privacy rules, in one place, used by every route that shows a list.
//
// A viewer can see a user's list when:
//   - it is the viewer's own list, or
//   - the list is public, or
//   - the list is friends-only and the two are accepted friends.
// A private list is visible only to its owner.
const db = require('./db');

// 'self' | 'friends' | 'incoming' | 'outgoing' | 'none'
async function relationship(viewerId, ownerId) {
  if (!viewerId) return 'none';
  if (viewerId === ownerId) return 'self';
  const { rows } = await db.query(
    `SELECT requester_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [viewerId, ownerId]
  );
  const f = rows[0];
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester_id === viewerId ? 'outgoing' : 'incoming';
}

function canSeeList(privacy, rel) {
  if (rel === 'self') return true;
  if (privacy === 'public') return true;
  if (privacy === 'friends') return rel === 'friends';
  return false; // private
}

module.exports = { relationship, canSeeList };
