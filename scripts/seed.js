// Creates demo accounts with realistic lists, friendships and recent activity.
// Run with: npm run seed   (safe to run again: it resets only the demo accounts)
//
//   Sukhrob  the presenter's account: a big list, 6 friends, 2 requests waiting, 1 request sent
//   Michael     Public         James   Friends only       Linda  Private
//   Alexia, Emma, Ryan   Public;   Daniel, Oliver, Grace   Friends only
//
// Passwords: komorebi-demo for everyone, except Sukhrob: SUKHROB_PASSWORD from .env
// (falls back to komorebi-demo if it is not set).
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const db = require('../server/db');
const migrate = require('../server/migrate');
const catalog = require('../server/services/catalog');

const DEMO_PASSWORD = 'komorebi-demo';
const SUKHROB_PASSWORD = process.env.SUKHROB_PASSWORD || DEMO_PASSWORD;

// accounts from earlier versions of this script (removed so they do not linger)
const LEGACY = ['aiko', 'ren', 'mei', 'dilnoza', 'omar', 'sofia', 'timur', 'lena', 'kenji'];

const USERS = [
  { username: 'Sukhrob', privacy: 'friends', password: SUKHROB_PASSWORD },
  { username: 'Michael', privacy: 'public' },
  { username: 'James', privacy: 'friends' },
  { username: 'Linda', privacy: 'private' },
  { username: 'Alexia', privacy: 'public' },
  { username: 'Daniel', privacy: 'friends' },
  { username: 'Emma', privacy: 'public' },
  { username: 'Oliver', privacy: 'friends' },
  { username: 'Grace', privacy: 'friends' },
  { username: 'Ryan', privacy: 'public' },
];

// Shorthand: m(603) is "tmdb-movie-603", t(1396) is "tmdb-tv-1396"
const m = (n) => `tmdb-movie-${n}`;
const t = (n) => `tmdb-tv-${n}`;

// [itemId, status, rating, review, season, episode, hoursAgo]
// hoursAgo is when it was added (and last changed), so lists have a believable history.
const D = 24;
const LISTS = {
  Sukhrob: [
    // watched, spread over the last year
    [m(278), 'watched', 10, 'Still the best ending of any film I know.', null, null, 330 * D],
    [m(603), 'watched', 9, null, null, null, 318 * D],
    [t(1396), 'watched', 10, 'Five seasons without one weak episode. I started it for a weekend and finished it in nine days.', null, null, 290 * D],
    [m(27205), 'watched', 9, null, null, null, 262 * D],
    [m(155), 'watched', 10, null, null, null, 241 * D],
    [m(157336), 'watched', 10, 'The docking scene is the best thing I have seen in a cinema. The organ music gave me goosebumps.', null, null, 214 * D],
    [m(438631), 'watched', 8, null, null, null, 196 * D],
    [t(87108), 'watched', 10, 'Hard to watch and impossible to look away from.', null, null, 181 * D],
    [t(61222), 'watched', 9, 'Funny for three seasons, then it quietly breaks your heart.', null, null, 163 * D],
    [m(545611), 'watched', 9, null, null, null, 150 * D],
    [m(361743), 'watched', 7, null, null, null, 138 * D],
    [t(76331), 'watched', 9, null, null, null, 127 * D],
    [t(93405), 'watched', 7, null, null, null, 109 * D],
    [m(569094), 'watched', 9, 'Every frame is a different painting. The animation is years ahead of everything else.', null, null, 98 * D],
    [m(872585), 'watched', 8, 'Three hours that felt like ninety minutes. Cillian Murphy carries the whole film.', null, null, 87 * D],
    [t(60625), 'watched', 8, null, null, null, 73 * D],
    [m(354912), 'watched', 9, 'I cried twice: once from sadness and once from joy.', null, null, 58 * D],
    [m(1022789), 'watched', 8, null, null, null, 44 * D],
    [t(94605), 'watched', 10, 'Every frame looks painted, and the music alone is worth the watch.', null, null, 31 * D],
    [t(82728), 'watched', 8, 'Cosy, silly and exactly what I needed after a long week.', null, null, 19 * D],
    // watching, with progress (these fill "Continue watching")
    [t(95396), 'watching', 9, 'Cannot stop thinking about the elevator scene. One episode a week is torture.', 2, 4, 3 * D],
    [t(136315), 'watching', 9, null, 3, 6, 5 * D],
    [t(66732), 'watching', 8, null, 4, 5, 11 * D],
    [t(100088), 'watching', null, null, 2, 3, 1.5 * D],
    [t(126308), 'watching', 9, null, 1, 6, 8 * D],
    [m(693134), 'watching', null, null, null, null, 2 * D],
    // planned (these feed "Pick for me")
    [m(1368337), 'planned', null, null, null, null, 6 * D],
    [m(1084244), 'planned', null, null, null, null, 4 * D],
    [m(335984), 'planned', null, null, null, null, 9 * D],
    [m(76341), 'planned', null, null, null, null, 15 * D],
    [m(98), 'planned', null, null, null, null, 21 * D],
    [t(60574), 'planned', null, null, null, null, 24 * D],
    [t(1399), 'planned', null, null, null, null, 40 * D],
    [m(10681), 'planned', null, null, null, null, 52 * D],
    [m(346698), 'planned', null, null, null, null, 66 * D],
  ],
  Michael: [
    [t(94605), 'watched', 10, 'Every frame looks painted. I watched the whole thing in two evenings.', null, null, 9 * D],
    [m(354912), 'watched', 9, 'Every rewatch shows me a new corner of the Land of the Dead.', null, null, 14 * D],
    [m(157336), 'watched', 10, 'I watched it twice in one week. The second time I just listened.', null, null, 20],
    [t(1396), 'watching', 8, null, 3, 4, 5 * D],
    [m(603), 'watched', 8, null, null, null, 30 * D],
    [t(82728), 'planned', null, null, null, null, 7 * D],
    [m(1368337), 'planned', null, null, null, null, 3 * D],
  ],
  James: [
    [t(94605), 'watching', 9, 'Taking it slowly, one episode a week.', 1, 5, 40],
    [t(1396), 'watched', 10, 'Best ending of any series I have seen.', null, null, 20 * D],
    [m(354912), 'watched', 8, null, null, null, 25 * D],
    [m(1368337), 'planned', null, null, null, null, 2 * D],
  ],
  Linda: [
    [m(603), 'watching', null, null, null, null, 4 * D],
    [t(82728), 'watched', 7, 'Cosy, silly and exactly what I needed.', null, null, 10 * D],
  ],
  Alexia: [
    [t(95396), 'watching', 9, null, 2, 2, 3],
    [m(496243), 'watched', 10, 'Perfect script, perfect cast. I did not look at my phone once.', null, null, 30],
    [m(157336), 'watched', 9, null, null, null, 26],
    [m(354912), 'watched', 8, null, null, null, 4 * D],
    [m(346698), 'watched', 7, null, null, null, 6 * D],
    [t(82728), 'watched', 9, null, null, null, 9 * D],
  ],
  Daniel: [
    [m(438631), 'watched', 9, null, null, null, 2 * D],
    [m(872585), 'watched', 9, 'Nolan at his best. See it in the biggest cinema you can find.', null, null, 4 * D],
    [m(155), 'watched', 10, null, null, null, 6 * D],
    [t(76331), 'watching', 9, null, 3, 5, 8],
    [t(93405), 'watched', 6, null, null, null, 12 * D],
  ],
  Emma: [
    [t(136315), 'watching', 10, null, 3, 3, 5],
    [m(1022789), 'watched', 9, 'Anxiety was my favourite character. I laughed and then I felt seen.', null, null, 2 * D],
    [t(94605), 'watched', 9, null, null, null, 6 * D],
    [m(545611), 'watched', 10, null, null, null, 5 * D],
    [t(66732), 'watched', 8, null, null, null, 15 * D],
  ],
  Oliver: [
    [t(126308), 'watching', 9, null, 1, 8, 11],
    [t(1396), 'watched', 10, 'Best series ever made. I mean it.', null, null, 8 * D],
    [t(87108), 'watched', 9, null, null, null, 9 * D],
    [m(361743), 'watched', 8, null, null, null, 14 * D],
    [m(603), 'watched', 9, null, null, null, 20 * D],
  ],
  Grace: [
    [m(496243), 'watched', 9, null, null, null, 3 * D],
    [t(95396), 'watched', 10, 'Easily the best show of the decade.', null, null, 5 * D],
    [m(346698), 'planned', null, null, null, null, 6 * D],
  ],
  Ryan: [
    [m(278), 'watched', 10, null, null, null, 7 * D],
    [m(27205), 'watched', 9, 'Spinning top. Still not sure if I woke up.', null, null, 9 * D],
    [t(60625), 'watching', 8, null, 5, 3, 4 * D],
  ],
};

// [requester, addressee, status]
const FRIENDSHIPS = [
  ['Sukhrob', 'Michael', 'accepted'],
  ['James', 'Sukhrob', 'accepted'],
  ['Sukhrob', 'Alexia', 'accepted'],
  ['Daniel', 'Sukhrob', 'accepted'],
  ['Sukhrob', 'Emma', 'accepted'],
  ['Oliver', 'Sukhrob', 'accepted'],
  ['Grace', 'Sukhrob', 'pending'],   // waiting for Sukhrob to accept
  ['Ryan', 'Sukhrob', 'pending'],  // waiting for Sukhrob to accept
  ['Sukhrob', 'Linda', 'pending'],    // Sukhrob asked, Linda has not answered
  ['Michael', 'James', 'accepted'],
  ['James', 'Linda', 'pending'],
  ['Michael', 'Alexia', 'accepted'],
  ['Daniel', 'Oliver', 'accepted'],
];

// runs fn over the items, a few at a time (TMDB is polite about it)
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function seed() {
  await migrate();
  const names = USERS.map((u) => u.username.toLowerCase());

  // reset demo accounts (lists and friendships go with them via ON DELETE CASCADE)
  await db.query('DELETE FROM users WHERE lower(username) = ANY($1)', [[...names, ...LEGACY]]);
  const ids = {};
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password || DEMO_PASSWORD, 12);
    const { rows } = await db.query(
      'INSERT INTO users (username, email, password_hash, privacy, created_at) VALUES ($1, $2, $3, $4, now() - interval \'14 months\') RETURNING id',
      [u.username, `${u.username.toLowerCase()}@demo.komorebi.uz`, hash, u.privacy]
    );
    ids[u.username] = rows[0].id;
  }

  // fetch and save every title once
  const titles = new Map();
  const wanted = [...new Set(Object.values(LISTS).flat().map((e) => e[0]))];
  await inBatches(wanted, 5, async (id) => {
    const item = await catalog.getItem(id);
    titles.set(id, item.title);
  });

  for (const [username, entries] of Object.entries(LISTS)) {
    for (const [itemId, status, rating, review, season, episode, hoursAgo] of entries) {
      await db.query(
        `INSERT INTO list_entries (user_id, item_id, status, rating, review, season, episode, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(hours => $8::int), now() - make_interval(hours => $8::int))`,
        [ids[username], itemId, status, rating, review, season, episode, Math.round(hoursAgo)]
      );
    }
    console.log(`  ${username}: ${entries.length} titles`);
  }

  for (const [a, b, status] of FRIENDSHIPS) {
    await db.query('INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)', [ids[a], ids[b], status]);
  }

  console.log(`\nDemo accounts ready: ${names.join(', ')}`);
  console.log('Password: komorebi-demo (Sukhrob: SUKHROB_PASSWORD from .env)');
}

seed()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  });
