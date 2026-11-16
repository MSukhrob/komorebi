# Komorebi: the complete project guide

*Komorebi* (木漏れ日) is the Japanese word for sunlight filtering through the leaves. The project is a website for people who watch movies, series and cartoons. They keep one list of everything they watch, rate it, follow new releases and film news, and share the list with friends, only as far as they choose.

This guide explains what the project is made of, what every package and file does, and how the pieces work together. It is written so that the author can explain every line in a defence.

- Live site: https://komorebi.uz
- Source code: https://github.com/MSukhrob/komorebi

---

## 1. The project at a glance

| Question | Answer |
|---|---|
| What is it? | A watch-list tracker with friends, privacy settings, statistics, a release radar and film news. |
| Who is it for? | Anyone who watches movies, series and cartoons and wants one place for it. |
| Frontend | Plain HTML, CSS and JavaScript (ES modules). No framework, no build step. |
| Backend | Node.js 22 with Express 5, serving a JSON API and the HTML pages. |
| Database | PostgreSQL 17, running in Docker on port 5433 of the server only. |
| Outside data | TMDB (titles, posters, trailers, release dates) and public RSS feeds (news headlines). |
| Hosting | pm2 runs the app on port 4100, nginx forwards `komorebi.uz` to it, HTTPS from Let's Encrypt. |
| Anime | Not part of the site. Japanese-language animation is filtered out of every list and search. |

**Why no framework?** The goal of a course project is to understand how a website works. Plain HTML, CSS and ES modules are standard browser features, so there is nothing hidden. A reader can open any file and follow it from the top.

---

## 2. How the pieces fit together

```
 Browser                          Server (Node.js + Express)                  Outside
┌──────────────────────┐        ┌─────────────────────────────────┐        ┌──────────────┐
│ HTML pages           │  GET   │ pages.js     pastes the header, │        │ TMDB API     │
│ css/komorebi.css     │───────▶│              footer and head    │        │ (titles,     │
│ js/app.js (shared)   │        │ routes/*.js  JSON API           │───────▶│  posters,    │
│ js/pages/*.js        │  JSON  │ services/    TMDB, news, cache  │        │  trailers)   │
│  one script per page │◀──────▶│ access.js    privacy rules      │        ├──────────────┤
└──────────────────────┘        │ auth.js      sessions, guards   │───────▶│ News RSS     │
                                └───────────────┬─────────────────┘        │ (4 sites)    │
                                                │ SQL                      └──────────────┘
                                        ┌───────▼────────┐
                                        │ PostgreSQL 17  │
                                        │ users, items,  │
                                        │ list_entries,  │
                                        │ friendships,   │
                                        │ user_sessions  │
                                        └────────────────┘
```

**A page load, step by step**

1. The visitor opens `https://komorebi.uz/list`. nginx forwards the request to the Node process on port 4100.
2. Express matches the route `/list` and `pages.js` builds `list.html`: it pastes `partials/head.html`, `header.html` and `footer.html` into the page and rewrites the script and style links to `/v/<version>/...`.
3. The browser loads the CSS and the page's JavaScript module (`js/pages/list.js`), which imports the shared `js/app.js`.
4. `list.js` calls `initPage()`, which asks `/api/auth/me` who is logged in, then fetches `/api/list` and draws the result into the page.
5. Every change (a new rating, a friend request) is a `fetch` call to the JSON API. The server checks the session, validates the input, runs a SQL query and answers with JSON. The browser updates the page and shows a toast.

---

## 3. Folder structure

```
komorebi/
├── server/                     the backend
│   ├── index.js                app setup: security headers, sessions, routes, start-up
│   ├── pages.js                serves HTML pages with shared partials, versioned asset links
│   ├── db.js                   the PostgreSQL connection pool
│   ├── migrate.js              runs schema.sql
│   ├── schema.sql              the tables (and a one-time cleanup)
│   ├── auth.js                 loads the logged-in user, requireUser guard
│   ├── access.js               the privacy rules (one function used everywhere)
│   ├── validate.js             input checks and the HttpError class
│   ├── data/hidden-titles.json titles the home page never shows
│   ├── routes/
│   │   ├── auth.js             register, login, logout, me
│   │   ├── catalog.js          home, radar, news, genres, browse, search, one title
│   │   ├── list.js             the user's own list, stats, export, next episode
│   │   ├── users.js            profiles and the privacy setting
│   │   └── friends.js          requests, friends, activity, people search
│   └── services/
│       ├── tmdb.js             talks to TMDB and converts its data to our format
│       ├── catalog.js          the catalogue: caching, search, radar, browse, saved titles
│       ├── news.js             reads the news RSS feeds
│       └── http.js             fetch with a timeout, and a small in-memory cache
├── public/                     everything the browser receives
│   ├── *.html                  one file per page
│   ├── partials/               head.html, header.html, footer.html (shared)
│   ├── css/komorebi.css        the whole design
│   ├── js/boot.js              sets the colour theme before the page paints
│   ├── js/app.js               shared code used by every page
│   ├── js/pages/*.js           one script per page
│   ├── img/tmdb.svg            the TMDB logo (required by their terms)
│   ├── manifest.webmanifest    lets a phone install the site
│   └── presentation/           the slides and this guide
├── scripts/seed.js             creates the demo accounts and their data
├── deploy/nginx/komorebi.uz.conf   the nginx site configuration
├── docker-compose.yml          the PostgreSQL container
├── ecosystem.config.cjs        the pm2 process definition
├── package.json                dependencies and npm scripts
└── .env                        secrets (never committed)
```

---

## 4. Packages (npm dependencies)

| Package | What it does | Where it is used |
|---|---|---|
| **express** (5) | The web framework. Receives requests, matches routes, sends responses. Version 5 passes errors from `async` handlers to the error handler automatically. | `server/index.js`, all routes |
| **pg** | The PostgreSQL client. A connection `Pool` reuses database connections. Queries use `$1, $2` placeholders so values are never glued into SQL. | `server/db.js` |
| **express-session** | Keeps a login across requests. It stores a random session id in a cookie and the data on the server. | `server/index.js` |
| **connect-pg-simple** | Stores those sessions in PostgreSQL (table `user_sessions`) instead of memory, so logins survive a restart. | `server/index.js` |
| **bcryptjs** | Hashes passwords (cost 12). The database never holds a readable password, and checking a login compares hashes. | `routes/auth.js`, `scripts/seed.js` |
| **helmet** | Sets security headers, above all the strict Content-Security-Policy. | `server/index.js` |
| **express-rate-limit** | Limits requests per visitor: logins, registrations and searches. | `routes/auth.js`, `routes/catalog.js` |
| **dotenv** | Loads the secrets from `.env` into `process.env`. | `server/index.js`, `db.js`, `seed.js` |
| **fast-xml-parser** | Reads the RSS (XML) news feeds. | `services/news.js` |

**Infrastructure tools (not npm packages)**

| Tool | Role |
|---|---|
| **Node.js 22** | Runs the server. It has `fetch` built in, so no HTTP library is needed. |
| **PostgreSQL 17 in Docker** | The database. A container keeps it separate from the server's other databases, and it listens on `127.0.0.1:5433` only. |
| **pm2** | Keeps the Node process running, restarts it if it crashes, and starts it after a reboot. |
| **nginx** | Receives traffic on ports 80 and 443 and forwards `komorebi.uz` to port 4100. |
| **certbot (Let's Encrypt)** | Provides the HTTPS certificate. |

The frontend has **no packages at all**. Fonts (Host Grotesk and JetBrains Mono) come from Google Fonts.

**npm scripts:** `npm start` runs the server, `npm run dev` restarts it on file changes, `npm run migrate` creates the tables, `npm run seed` creates the demo data.

---

## 5. The database

Five tables, defined in `server/schema.sql` (safe to run many times).

| Table | Holds | Notes |
|---|---|---|
| `users` | username, email, password hash, privacy, created date | Username and email are unique regardless of letter case. `privacy` is `public`, `friends` (default) or `private`. |
| `items` | a saved copy of every title someone opened or added | `id` looks like `tmdb-movie-603` or `tmdb-tv-1396`. `type` is `movie`, `series` or `cartoon`. `data` is the full title as JSON. `fetched_at` tells when it was last refreshed. |
| `list_entries` | one row per (user, title) | status (`planned`, `watching`, `watched`), rating 1 to 10, review up to 2000 characters, season, episode, timestamps. The primary key is `(user_id, item_id)`, so a title is on a list at most once. |
| `friendships` | a friend request, or an accepted friendship | A unique index on the pair of people (in either direction) allows one row per pair. Declining or cancelling deletes the row. |
| `user_sessions` | login sessions | Used by connect-pg-simple. |

Deleting a user deletes their entries and friendships (`ON DELETE CASCADE`).

**Why save titles in our own table?** It makes pages fast, keeps the site working when TMDB is slow, and lets list pages join entries with titles in one query. TMDB's terms allow caching for at most six months, so saved titles are refreshed (see section 8).

---

## 6. The backend, file by file

### `server/index.js`: the application
Creates the Express app and sets everything up, in this order:
1. **Helmet** with a strict Content-Security-Policy: scripts and styles only from the site itself, fonts from Google, pictures from TMDB, and one frame (the YouTube player, shown only after a click).
2. **JSON body parsing** (limited to 20 KB).
3. **Sessions**: a cookie named `komorebi.sid`, `HttpOnly` (JavaScript cannot read it), `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true`, valid for 30 days.
4. **Cross-site protection**: every state-changing `/api` request must be `application/json`. A form on another website cannot send that without a CORS preflight, so it cannot trigger an action.
5. `loadUser` puts the logged-in user into `req.user`.
6. The **API routes** under `/api/...`, then the **page routes**, then static files.
7. An **error handler** that turns `HttpError`s into JSON and hides the details of unexpected errors.
8. At start-up it runs the migration, listens on `127.0.0.1:4100` and starts an hourly job that refreshes old saved titles.

### `server/pages.js`: pages and shared parts
Reads an HTML page, replaces the markers `<!-- @head -->`, `<!-- @header -->` and `<!-- @footer -->` with the files in `public/partials/`, and rewrites `/css/` and `/js/` links to `/v/<version>/css/...`. The version changes at every server start, so a browser never mixes a new page with old scripts. Versioned files are cached for 30 days. Pages themselves are never cached.

### `server/auth.js`
`loadUser` reads the session and loads the user. `requireUser` answers 401 when nobody is logged in. `publicUser` is the shape of a user sent to the browser (never the hash).

### `server/access.js`: the privacy rules
Two functions, used by every route that shows a list:
- `relationship(viewerId, ownerId)` returns `self`, `friends`, `incoming`, `outgoing` or `none`.
- `canSeeList(privacy, relationship)`: the owner can always see the list; a public list is visible to everyone; a friends-only list only to accepted friends; a private list only to its owner.

Keeping the rule in one place means it cannot be forgotten in one route.

### `server/validate.js`
`HttpError(status, message, {field})` is an error that carries an HTTP status and the name of the form field. The helpers check usernames (3 to 30 letters, digits or underscores), emails, passwords (8 to 72 bytes, because bcrypt ignores the rest), numbers and allowed values. Every input is checked on the server, even if the browser already checked it.

### Routes (`server/routes/`)

**`auth.js`**
| Endpoint | Does |
|---|---|
| `POST /api/auth/register` | Validates, checks the name and email are free, hashes the password, creates the user and logs them in. Limited to 5 per hour per IP. |
| `POST /api/auth/login` | Accepts a username or an email. The same message is returned for an unknown user and a wrong password, so accounts cannot be probed. A new session id is created at login. Limited to 10 failures per 15 minutes. |
| `POST /api/auth/logout` | Destroys the session and clears the cookie. |
| `GET /api/auth/me` | The current user, plus the number of friend requests waiting (shown as a badge). |

**`catalog.js`** (read-only)
| Endpoint | Does |
|---|---|
| `GET /api/catalog/home` | Trending movies, trending series, popular cartoons, and the featured titles for the hero. |
| `GET /api/catalog/radar` | In cinemas, coming soon, on TV this week. |
| `GET /api/catalog/news` | Film and TV headlines. |
| `GET /api/catalog/genres`, `/browse` | Genres per type, and one page of titles by type, genre and sort. |
| `GET /api/catalog/search?q=&type=` | Live search. Limited to 60 per minute per IP. |
| `GET /api/catalog/items/:id` | One title in full, plus how many Komorebi users have it and their average rating (totals only, never who). |

**`list.js`** (always the logged-in user's own list)
| Endpoint | Does |
|---|---|
| `GET /api/list` | The list, with filters (status, type, sort) and the counts for the tabs. |
| `GET /api/list/stats` | Totals, hours watched, rating spread, genres, titles per month, favourites. |
| `GET /api/list/export?format=csv\|json` | Downloads the whole list. CSV cells that start with `=`, `+`, `-` or `@` get a leading `'` so a spreadsheet never runs them as formulas. |
| `GET/PUT/DELETE /api/list/:itemId` | Read, add or change (only the fields sent are changed), and remove one entry. |
| `POST /api/list/:itemId/next` | Moves a show one episode on; into the next season at a season's end; to Watched after the last episode. |

**`users.js`**
| Endpoint | Does |
|---|---|
| `GET /api/users/:username` | A profile. If the viewer may not see the list the answer is `200` with `hidden: true` and only the name and the reason, never the list or its counts. |
| `PUT /api/users/me/privacy` | Changes the privacy setting. |

**`friends.js`** (every route works on the pair *(logged-in user, other user)*, so nobody can accept or cancel a request meant for someone else)
| Endpoint | Does |
|---|---|
| `GET /api/friends` | My friends, requests for me, requests I sent. |
| `GET /api/friends/search?q=` | Find people by username (the `%` and `_` characters are escaped). |
| `POST /api/friends/:userId/request` | Sends a request. If the other person already asked me, both become friends. |
| `POST /api/friends/:userId/accept` | Accepts a request sent to me. |
| `DELETE /api/friends/:userId` | Declines, cancels or removes. |
| `GET /api/friends/on/:itemId` | Friends who have this title (private lists left out). |
| `GET /api/friends/activity` | The latest changes on friends' lists (private lists left out). |

### Services (`server/services/`)

**`tmdb.js`** is the only file that knows TMDB's format. It sends the API key as a bearer token, and converts TMDB data to Komorebi's own shape:
- **Types:** the Animation genre means *cartoon*, other films are *movie*, other TV shows are *series*.
- **Anime** (animation in the Japanese language) is dropped from every list, search and recommendation.
- A title gets a short form (cards, search) or a full form (title page: cast, director or creator, trailer, similar titles, episode counts per season).

**`catalog.js`** is the only file the routes use for titles.
- **Search:** asks TMDB, filters by type and puts titles without a poster last. Cached for 15 minutes.
- **Home and radar:** cached for one hour; if TMDB fails, an old copy (up to a week) is served.
- **Shop window:** the home page leaves out horror movies and the titles in `server/data/hidden-titles.json`.
- **Browse:** maps genre names to TMDB genre ids (movies and TV use different ids); cartoons combine animated movies and animated series.
- **Saved titles:** `getItem(id)` returns the saved copy if it is fresh (less than a week old), refreshes it otherwise, and falls back to the old copy if TMDB is down.
- **Refresh job:** every hour, up to 20 titles older than 30 days are refreshed, so nothing stays longer than TMDB's six-month limit.

**`news.js`** reads four public RSS feeds (Variety, Deadline, The Hollywood Reporter, Collider) in parallel, keeps the headline, source, link and time, drops heavy headlines (crime, violence, deaths), and mixes the sources. Cached for 30 minutes, with a stale copy for a day if the sites are down. Only headlines are shown, and each links to the original article.

**`http.js`** has `fetchJson` (a `fetch` with a 7-second timeout and one clear error type) and `TtlCache` (a small in-memory cache with an expiry and a longer "stale" period).

---

## 7. The frontend

### Pages
Each page is an HTML file plus one script of the same name.

| Page | Script | What it does |
|---|---|---|
| `/` Home | `index.js` | Hero with featured titles, live search, type filters, and sections (continue watching, pick for me, release radar, trending shelves, news, friends activity, roadmap banner). |
| `/browse` | `browse.js` | Type, genre and sort, with "Load more". |
| `/item/:id` | `item.js` | Backdrop, trailer, cast, similar titles, community numbers, and the tracking panel (status, ten stars, season and episode stepper, review). |
| `/list` | `list.js` | Tabs with counts, filters, sorting, quick actions, "Pick one for me". |
| `/stats` | `stats.js` | Numbers and bar charts drawn with plain HTML and CSS. |
| `/u/:username` | `profile.js` | A profile, or the "shoji gate" when the list is hidden. |
| `/friends` | `friends.js` | Requests, friends, people search. |
| `/settings` | `settings.js` | Privacy choice, data export. |
| `/login`, `/register` | `login.js`, `register.js` | Forms with checks in the browser and on the server. |
| `/roadmap`, `/credits`, `/presentation`, 404 | small scripts | Static content. |

### `js/app.js`: the shared code
- **`html` template tag:** escapes every inserted value, so user text (reviews, usernames) can never run as code. `raw()` marks markup we built ourselves.
- **`api()`:** every request is JSON; failures become an `ApiError` with a readable message and the field name.
- **`initPage()`:** marks the current page in the navigation, finds out who is logged in, redirects guests from private pages, draws the account menu and the friends badge, wires the theme switch, the scroll behaviour of the island and the search window.
- **Search window:** opens with `/` or `Ctrl+K`, uses the native `<dialog>` element, arrow keys and Enter.
- **Poster cards:** fade in when the image loads, show a film-reel placeholder if there is no poster, and carry a type badge.
- **Sliding pill:** `placePill()` moves one highlight behind the active tab by setting its left and width.
- **Toasts, states** (loading, empty, error), **icons**, small formatters (`S02 · E08`, `9.0 / 10`, "in 12 days").
- **`draw()`:** puts markup into an element, starts image fades, sets stagger delays (`--i`) and bar sizes (`--v`) from JavaScript. This is needed because the strict Content-Security-Policy forbids `style=""` attributes in HTML.

### `css/komorebi.css`: the design
- **Tokens:** colours, fonts and one easing curve are CSS variables at the top. The dark theme only changes the variables.
- **Palette "Cinema Grade":** deep teal shadows and warm orange highlights, in a light and a dark theme.
- **Full width:** content spans the screen with a fluid margin; hero pictures and shelves run to the edges.
- **Navigation:** a floating "island" bar on desktop that shrinks when you scroll; on phones (below 1100 px) a slim top bar plus a floating dock at the bottom.
- **Motion:** hover lifts, a sunbeam sweep on posters, a sun-to-moon theme switch, staggered entrances; everything respects `prefers-reduced-motion`.

### `js/boot.js`
A tiny script in `<head>` that sets the saved (or device) theme before the page paints, so the page never flashes the wrong colours.

---

## 8. Key features and how they work

**Tracking.** Choosing a status sends `PUT /api/list/:id`. The server fetches the title first (so it is saved), merges the new fields with the old row, and answers with the entry. The page updates in place and shows a toast. Season and episode only apply to shows.

**The ten stars.** Ten hidden radio buttons, so the keyboard and screen readers work. Hovering previews, clicking selects; a word (Awful … Masterpiece) describes the number.

**Progress.** The percentage is the episodes before the current season plus the current episode, divided by all episodes, using TMDB's episode counts. Next episode (`POST /next`) rolls into the next season and marks Watched at the end.

**Continue watching and Pick for me.** The home page reads your Watching list with progress bars; Pick for me chooses a random Planned title.

**Release radar.** TMDB's now-playing, upcoming (United States release calendar) and on-the-air lists, refreshed hourly.

**News.** Headlines from four RSS feeds, fetched by the server and cached.

**Friends and activity.** Requests are rows in `friendships`. Activity is a SQL join of accepted friends' latest list changes, excluding private lists.

**Privacy and the shoji gate.** The server decides with `canSeeList`. A hidden profile returns only the name and a reason; the page draws a calm paper-screen illustration and a friend-request button that changes to "Request sent" without reloading.

**Statistics.** Computed on the server from the user's entries: counts, hours (a film's length, or episodes seen times episode length), rating histogram, genres, titles added per month, favourites (rated 9 or 10).

**Export.** CSV or JSON download of the whole list.

**Themes.** `data-theme="light|dark"` on `<html>`; the toggle stores the choice in `localStorage` and fades the colours over 450 ms.

---

## 9. Security

| Measure | Detail |
|---|---|
| Passwords | bcrypt, cost 12. Maximum 72 bytes. |
| Sessions | Stored in PostgreSQL; `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS; new id at login; destroyed at logout. |
| Brute force | 10 failed logins per 15 minutes and 5 registrations per hour per IP; 60 searches per minute. |
| Cross-site requests | Every state-changing API call must be JSON, plus SameSite cookies. |
| Content-Security-Policy | Scripts only from the site, no inline scripts or styles, pictures only from TMDB, one external frame (YouTube, after a click). |
| Injection | All SQL is parameterised; all user text is escaped by the `html` tag. |
| Validation | Every input is checked on the server. |
| Authorisation | Routes always use the logged-in user from the session, never an id from the browser. |
| Privacy | One function (`access.js`) decides who sees a list; hidden data is never sent. |
| Secrets | In `.env`, never committed. |
| Spreadsheet safety | CSV cells that could be formulas are neutralised. |

---

## 10. External services and their rules

- **TMDB:** non-commercial use; the TMDB logo and the statement "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." appear in the footer and on title pages; data is cached for at most six months.
- **News feeds:** only the headline, source and time are shown, always linked to the original article, and credited in the footer.
- **YouTube:** the trailer player is the privacy-enhanced `youtube-nocookie.com` embed and is added to the page only after the visitor presses play.

---

## 11. Setup and deployment

```bash
cp .env.example .env                 # fill in the values
docker compose -p komorebi up -d     # start PostgreSQL
npm install
npm run seed                         # optional: demo accounts and data
npm start                            # http://127.0.0.1:4100
```

`.env` values: `PORT`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `COOKIE_SECURE` (`true` once HTTPS works), `TMDB_API_KEY`, and `SUKHROB_PASSWORD` for the presenter demo account.

**Production:** `pm2 start ecosystem.config.cjs`, copy `deploy/nginx/komorebi.uz.conf` into nginx, run certbot for HTTPS, set `COOKIE_SECURE=true`, then `pm2 restart komorebi --update-env` and `pm2 save`.

**Demo data (`npm run seed`):** the account `Sukhrob` with 35 titles over a year, nine friends with their own lists, two requests waiting and one sent. It also creates the accounts `Michael` (public), `James` (friends only) and `Linda` (private) for showing the privacy rules.

---

## 12. Decisions worth explaining

- **No framework:** every line can be read and explained.
- **One catalogue, one source:** anime and a second data source were removed to keep the data model simple.
- **Saved titles:** speed, resilience and respect for TMDB's rules.
- **Versioned asset URLs:** after an update, browsers cannot mix old scripts with new pages.
- **No inline styles:** the strict Content-Security-Policy is kept, and dynamic values are set from JavaScript.
- **Privacy in one function:** a hidden list is never sent to the browser.
- **200 with `hidden: true` instead of 403:** a hidden list is a normal situation, not a failed request.
- **Live data is curated for the shop window:** horror and a hide-list are filtered on the home page, and heavy news headlines are dropped.
- **Friend names in demo data** are plain first names, not tied to any country.

---

## 13. Future work

See https://komorebi.uz/roadmap. The main idea is connecting streaming accounts (Netflix, Disney+, Prime Video and others) to track viewing automatically. Because most services have no public viewing-history API, the plan starts with importing the history file a service lets you download, then a browser extension the user switches on, then official connections. Also planned: where to watch, new-episode reminders, a release calendar, custom lists, watching together, recommendations, Uzbek and Russian translations, offline use and push messages.
