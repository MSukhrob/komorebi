// Session helpers and route guards.
const { HttpError } = require('./validate');
const db = require('./db');

// Loads the logged-in user (if any) into req.user for every request.
async function loadUser(req, res, next) {
  req.user = null;
  if (req.session && req.session.userId) {
    const { rows } = await db.query(
      'SELECT id, username, email, privacy, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    req.user = rows[0] || null;
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Please log in first.');
  next();
}

// Shape of a user we send to the browser (never the password hash).
function publicUser(u) {
  return { id: u.id, username: u.username, privacy: u.privacy, createdAt: u.created_at };
}

module.exports = { loadUser, requireUser, publicUser };
