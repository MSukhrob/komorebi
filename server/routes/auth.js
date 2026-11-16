// Register, log in, log out, current user.
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { HttpError, str, checkUsername, checkEmail, checkPassword } = require('../validate');
const { publicUser } = require('../auth');

const router = express.Router();

const tooMany = (req, res) =>
  res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });

// At most 10 failed logins per IP every 15 minutes.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, handler: tooMany });
// At most 5 new accounts per IP per hour.
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, handler: tooMany });

// Starts a fresh session for the user (a new id prevents session fixation).
function logIn(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

router.post('/register', registerLimiter, async (req, res) => {
  const username = checkUsername(req.body.username);
  const email = checkEmail(req.body.email);
  const password = checkPassword(req.body.password);

  const taken = await db.query(
    'SELECT lower(username) = lower($1) AS same_name FROM users WHERE lower(username) = lower($1) OR lower(email) = $2',
    [username, email]
  );
  if (taken.rows.length) {
    const field = taken.rows.some((r) => r.same_name) ? 'username' : 'email';
    throw new HttpError(409, field === 'username' ? 'That username is taken.' : 'An account with this email already exists.', { field });
  }

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [username, email, hash]
  );
  await logIn(req, rows[0].id);
  res.status(201).json({ user: publicUser(rows[0]) });
});

router.post('/login', loginLimiter, async (req, res) => {
  // one field accepts either the username or the email
  const login = str(req.body.login);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!login || !password) throw new HttpError(400, 'Enter your username or email and your password.');

  const { rows } = await db.query(
    'SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1',
    [login]
  );
  const user = rows[0];
  // same message for "no such user" and "wrong password", so accounts can't be probed
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Username, email or password is incorrect.');

  await logIn(req, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('komorebi.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  // requests waiting for an answer: shown as a badge on "Friends"
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM friendships WHERE addressee_id = $1 AND status = 'pending'`,
    [req.user.id]
  );
  res.json({ user: { ...publicUser(req.user), email: req.user.email, pendingRequests: rows[0].n } });
});

module.exports = router;
