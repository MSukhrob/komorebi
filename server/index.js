// Komorebi web server: serves the static frontend and the JSON API.
require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const db = require('./db');
const migrate = require('./migrate');
const { loadUser } = require('./auth');
const catalog = require('./services/catalog');
const { HttpError } = require('./validate');
const { sendPage } = require('./pages');

const PORT = Number(process.env.PORT) || 4100;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-me') {
  console.error('SESSION_SECRET is missing in .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// nginx runs on the same machine; trust X-Forwarded-* only from localhost
app.set('trust proxy', 'loopback');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://image.tmdb.org'],
        connectSrc: ["'self'"],
        // the trailer player (loaded only after the visitor presses Play)
        frameSrc: ['https://www.youtube-nocookie.com'],
        upgradeInsecureRequests: process.env.COOKIE_SECURE === 'true' ? [] : null,
      },
    },
  })
);

app.use(express.json({ limit: '20kb' }));

app.use(
  session({
    name: 'komorebi.sid',
    store: new PgSession({ pool: db.pool, tableName: 'user_sessions' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // not readable from JavaScript
      sameSite: 'lax', // not sent on cross-site form posts
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Cross-site request protection: every state-changing API call must be JSON.
// A plain HTML form on another site cannot send that without a CORS preflight.
app.use('/api', (req, res, next) => {
  const isJson = (req.get('content-type') || '').toLowerCase().startsWith('application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isJson) {
    return res.status(415).json({ error: 'Requests must be sent as JSON.' });
  }
  next();
});

app.use(loadUser);

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/list', require('./routes/list').router);
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- Pages ----------
// Search lives on the home page now; old /search links keep working.
app.get('/search', (req, res) => res.redirect(301, `/${req.url.slice('/search'.length).replace(/^\/?/, '')}`));

// Clean URLs map to the static HTML files; the page's JS loads its data.
const pages = {
  '/': 'index.html',
  '/browse': 'browse.html',
  '/stats': 'stats.html',
  '/item/:id': 'item.html',
  '/list': 'list.html',
  '/u/:username': 'profile.html',
  '/friends': 'friends.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/settings': 'settings.html',
  '/credits': 'credits.html',
  '/roadmap': 'roadmap.html',
  '/presentation': 'presentation.html',
};
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => sendPage(res, file));
}

// pages are only served through the routes above (with their partials pasted in)
app.use((req, res, next) => {
  if (req.path.startsWith('/partials/') || req.path.endsWith('.html')) return sendPage(res, '404.html', 404);
  next();
});
// Versioned files (see pages.js) never change under their URL, so they may be cached for a long time.
app.use('/v/:version', express.static(PUBLIC_DIR, { index: false, extensions: [], maxAge: '30d', immutable: true }));

// Files are revalidated on every visit (a quick "not modified" answer when nothing changed),
// so a visitor never sees a new page with old scripts or styles after an update.
app.use(express.static(PUBLIC_DIR, { index: false, extensions: [], setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));

app.use((req, res) => sendPage(res, '404.html', 404));

// ---------- Errors ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, field: err.field });
  }
  if (err.status === 404 && !req.path.startsWith('/api')) {
    return sendPage(res, '404.html', 404);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

migrate()
  .then(() => {
    app.listen(PORT, '127.0.0.1', () => console.log(`Komorebi running on http://127.0.0.1:${PORT}`));
    // keep saved title details current (see services/catalog.js)
    setInterval(() => catalog.refreshOldItems().catch((e) => console.warn(e.message)), 60 * 60 * 1000);
  })
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exit(1);
  });
