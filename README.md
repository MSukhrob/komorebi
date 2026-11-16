# Komorebi

Keep track of everything you watch (movies, series and cartoons) and share your list with friends.

*Komorebi* (木漏れ日) is the Japanese word for sunlight filtering through the leaves. The design is *Editorial Botanical Cinema*: a sunlit indie bookshop by day, an outdoor projector under the trees at night. Warm paper, serif titles, and soft pools of light that drift slowly behind the page.

Production address: **komorebi.uz**

## Features

**Everyday use**
- **Accounts:** register with a username, email and password (at least 8 characters). Log in with either the username or the email, and log out.
- **Home:** a full-width hero with a featured title (TMDB backdrop picture), a live search bar with type filters, and shelves that scroll to the edge of the screen.
- **Release radar:** *In cinemas*, *Coming soon* (with release dates and a countdown) and *On TV this week*, refreshed every hour.
- **Film and TV news:** the newest headlines from Variety, Deadline, The Hollywood Reporter and Collider. Only the headline, source and time are shown, and each links to the original article.
- **Search anywhere:** press `/` or `Ctrl+K` for a search window with arrow-key navigation, or use the big search bar on the home page.
- **Browse:** pick Movies, Series or Cartoons, narrow by genre, sort by popularity, rating or newest, and load more.

**Your list**
- **Title page:** a full-width backdrop, trailer (a YouTube player that loads only after you press the button), cast with photos, director or creator, TMDB score, "More like this", and how many Komorebi users have the title.
- **Personal list:** add a title as Planned, Watching or Watched, rate it from 1 to 10 with ten stars, write a review (up to 2000 characters), and step through the season and episode of shows with a progress bar.
- **Continue watching:** on the home page, your Watching shows with a progress bar and a *Next episode* button (it moves into the next season by itself and marks the show Watched after the last episode).
- **Pick for me:** a random title from your Planned list when you cannot decide.
- **My list:** tabs with counts and a sliding pill, filters by type, sorting by date added, rating or title.
- **My stats:** hours watched, average rating, status split, how you rate, favourite genres, titles added per month and your favourites.
- **Export:** download your whole list as CSV (opens in Excel or Google Sheets) or JSON, from Settings.

**With friends**
- **Profiles:** every user has a page at `/u/<username>` with their list and counts. Each list is *Public*, *Friends only* (the default) or *Private*, and the server enforces it.
- **Friends:** find people by username, then send, accept, decline or cancel requests and remove friends. The Friends tab shows a badge when requests wait for you.
- **Friends are watching:** the latest changes from your friends' lists on the home page (private lists are left out).
- **Friends who watched this:** on every title page, with their status, rating and review.

**Beyond the first version**
- **In the near future (`/roadmap`):** a public roadmap page. The headline item is connecting streaming accounts (Netflix, Disney+, Prime Video and others) to track what you watch automatically. Most services have no public viewing-history API, so the plan starts with importing the history file you can download from the service, then a browser extension you switch on, then official connections.
- **Installable:** a web app manifest lets a phone add Komorebi to its home screen and open it like an app.
- **Presentation and guide (`/presentation`):** a download page for the written project guide (`komorebi-project-guide.md`: components, packages, how everything works) and the project presentation (`public/presentation/komorebi-presentation.pptx`, 19 slides with screenshots and speaker notes).

**Design**
- **Cinema Grade:** a film colourist's palette of deep teal shadows and warm orange highlights, in two themes (light and dark, switched by the sun/moon button; the first visit follows the device).
- **Full width:** content spans the whole screen with a fluid margin; hero pictures and shelves run edge to edge.
- **Floating island navigation** on desktop that shrinks a little when you scroll, and a **floating dock** at the bottom of a phone.
- Every screen handles loading, empty and error states and shows a toast after each action. Keyboard navigation, labelled form fields, alt text and AA colour contrast.

## Tech

| Part | Choice |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript (ES modules). No framework, no build step. |
| Backend | Node.js 20+ with Express 5 |
| Database | PostgreSQL 17 (in Docker, port 5433 on localhost only) |
| Dependencies | `express`, `pg`, `express-session`, `connect-pg-simple`, `bcryptjs`, `helmet`, `express-rate-limit`, `dotenv`, `fast-xml-parser` (reads the news RSS feeds) |

## Install and run

You need Node.js 20+ and Docker.

```bash
cp .env.example .env                 # fill in the values, see the comments in the file
docker compose -p komorebi up -d     # start PostgreSQL
npm install
npm run seed                         # optional: demo accounts with sample lists
npm start                            # creates the tables, then serves http://127.0.0.1:4100
```

`.env` values:

| Name | Meaning |
|---|---|
| `PORT` | Port the app listens on (on 127.0.0.1). Default 4100. |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Password Docker gives the `komorebi` database user (must match `DATABASE_URL`) |
| `SESSION_SECRET` | Long random string for signing session cookies (`openssl rand -hex 32`) |
| `COOKIE_SECURE` | `true` once the site is served over HTTPS |
| `TMDB_API_KEY` | TMDB "API Read Access Token" (or the short v3 API key) |

### Demo accounts

After `npm run seed`. The password for every demo account is `komorebi-demo`, except `Sukhrob`, whose password is `SUKHROB_PASSWORD` in `.env`.

| User | List privacy | Friendships | What it shows |
|---|---|---|---|
| `Sukhrob` | Friends only | friends with Michael, James, Alexia, Daniel, Emma and Oliver; requests waiting from Grace and Ryan; a request sent to Linda | The presenter's account: 35 titles, ratings, reviews, progress, stats and a busy friends page |
| `Michael` | Public | friends with Sukhrob, James and Alexia | Anyone, even logged out, can see `/u/Michael` |
| `James` | Friends only | friends with Sukhrob and Michael, request sent to Linda | Michael can see James's list, Linda cannot |
| `Linda` | Private | incoming requests from Sukhrob and James | Nobody but Linda sees the list |
| `Alexia`, `Emma`, `Ryan` | Public | Alexia and Emma are friends of Sukhrob | More lists for the activity feed |
| `Daniel`, `Oliver`, `Grace` | Friends only | Daniel and Oliver are friends of Sukhrob | `/u/Grace` shows the hidden-list gate with a request waiting |

Try it: open `/u/James` logged out (hidden), log in as Michael (visible), then as Linda (hidden, with "Accept request"). Open Arcane while logged in as Sukhrob to see friends' ratings under "Friends who watched this".

### Production (komorebi.uz)

The app runs under pm2 behind nginx:

```bash
pm2 start ecosystem.config.cjs       # starts only the "komorebi" process
sudo cp deploy/nginx/komorebi.uz.conf /etc/nginx/sites-available/komorebi.uz
sudo ln -s /etc/nginx/sites-available/komorebi.uz /etc/nginx/sites-enabled/komorebi.uz
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d komorebi.uz -d www.komorebi.uz    # HTTPS
# then set COOKIE_SECURE=true in .env and: pm2 restart komorebi --update-env
```

## Data sources

| Source | Used for | Key | Terms and limits |
|---|---|---|---|
| [TMDB](https://www.themoviedb.org/) | movies, series, cartoons, posters, descriptions | free API key | Non-commercial use only. Every app must show the TMDB logo (less prominent than its own) and the notice "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." TMDB data may be cached for **at most 6 months**. There is no fixed public rate limit; "excessive" use is forbidden. |

**News.** The home page also reads the public RSS feeds of Variety, Deadline, The Hollywood Reporter and Collider (cached for 30 minutes). Komorebi shows the headline, the source and the time only, always links to the original article, and credits the sources in the footer and on the credits page.

The TMDB logo and notice are in the footer of every page, on every item page and on the credits page (`/credits`).

**Why TMDB only?** It is the most complete free source for films and TV, including animation, and one source keeps the code simple. Komorebi used to list anime from Kitsu too; anime was removed from the site (see Decisions).

### How titles are shown

- The backend turns TMDB data into one format (`id, type, title, year, posterUrl, overview, genres, runtime, episodes, ...`). The browser never sees TMDB's own field names.
- **Ids:** `tmdb-movie-603`, `tmdb-tv-1396`.
- **Types:** TMDB titles with the Animation genre are *Cartoons*, other films are *Movies*, other TV shows are *Series*.
- **Search:** TMDB's results keep TMDB's relevance order, except that titles without a poster go last. If TMDB cannot be reached, the visitor sees a friendly message.

### Caching

- **Item details** are saved in PostgreSQL (`items` table) the first time someone opens or adds a title. A saved copy is used for a week before it is refreshed. If the source is down, the old copy is still shown.
- **TMDB 6-month limit:** a background job refreshes up to 20 of the oldest saved titles every hour (anything older than 30 days), so no TMDB data is kept unrefreshed for long.
- **Search results** are cached in memory for 15 minutes. **Home page sections** are cached for 1 hour, and a stale copy is served for up to a week if a source is down.
- The browser waits until typing pauses (350 ms) before searching, cancels outdated requests, and the server allows at most 60 searches per minute per IP.

## Security

- Passwords are hashed with **bcrypt** (cost 12) and never stored in readable form.
- **Sessions** are stored in PostgreSQL. The cookie is `HttpOnly` and `SameSite=Lax`, and `Secure` with HTTPS. The session id is regenerated at login, and the session is destroyed at logout.
- **Brute force protection:** at most 10 failed logins per IP every 15 minutes and 5 new accounts per IP per hour.
- **Cross-site requests:** every state-changing API call must be JSON (`Content-Type: application/json`), so a form on another site cannot trigger it.
- **Validation** of every input happens on the server (`server/validate.js`). Database queries are always parameterised.
- **User text** (reviews, usernames) is escaped by the `html` template helper in `public/js/app.js`. A strict Content-Security-Policy (no inline scripts) is the second line of defence.
- **Authorisation:** list and friend routes always act on the logged-in user taken from the session, never on an id sent by the browser. Nobody can change someone else's list or accept a request meant for another user.
- **Privacy rules** live in one function (`server/access.js`) and are applied on the server for profiles and for "Friends with this title".
- **Secrets** live in `.env`, which is not committed. `.env.example` has no real values.

## Project structure

```
server/
  index.js            app setup, security headers, sessions, page routes
  db.js, schema.sql   PostgreSQL pool and tables (created automatically at start)
  auth.js, access.js  login guard and privacy rules
  validate.js         input checks
  routes/             auth, catalog, list, users (profiles, privacy), friends
  services/           tmdb.js, catalog.js (types, search, radar, browse, caching), news.js (RSS), http.js
  pages.js            serves the HTML pages with the shared partials pasted in
public/
  *.html              one file per page (index, browse, item, list, stats, profile, friends, settings, login, register, credits, 404)
  partials/           the <head> links, header and footer, shared by every page
  css/komorebi.css    the whole design: tokens, both themes, island and dock navigation, components
  js/boot.js          sets the theme before the page paints
  js/app.js           shared code: safe HTML, API calls, header, toasts, posters, sliding pill, icons
  js/pages/*.js       one script per page
scripts/seed.js       demo accounts
deploy/nginx/         nginx site config
```

## Decisions

These are the choices I made where the spec left room:

- **No anime.** The spec listed anime as a fourth type; it was built (with Kitsu as a second source) and then removed on request. Old anime titles and the list entries pointing at them are deleted by the migration in `server/schema.sql`. TMDB does not label anime separately, so Japanese-language animation is recognised by its language and left out of every list, search and recommendation.
- **No framework, no build step.** The frontend is plain HTML, CSS and ES modules, so every line can be read and explained. The header and footer live once in `public/partials/` and the server pastes them into each page (`server/pages.js`).
- **Design tokens in one place.** Colours, fonts and the single easing curve `cubic-bezier(0.22, 1, 0.36, 1)` are CSS variables at the top of `komorebi.css`. Dark mode only changes the variables.
- **Palette:** teal and orange, the classic film colour grade. The orange is only for the main action and the rating; teal is for links and focus. The colours were first compared with the palettes the taste-skill design tool suggests, then chosen for a cinema feel.
- **Two fonts:** Host Grotesk (titles and interface) and JetBrains Mono (years, episodes like `S02 · E08`, scores like `9.0 / 10`).
- **Type badges:** a dark glass pill with a coloured dot (Movie coral, Series teal, Cartoon amber), so the label is readable on any poster.
- **News and trailers:** headlines are fetched by the server (not the browser) and cached. The trailer player is a YouTube privacy-enhanced embed (`youtube-nocookie.com`) added to the page only after the visitor presses *Watch trailer*; it is the only external frame the Content-Security-Policy allows.
- **"In cinemas" and "Coming soon"** use the United States release calendar of TMDB (`REGION` in `server/services/tmdb.js`).
- **Hours watched** are an estimate: a watched film counts its length, a show counts the episodes you have seen times the episode length.
- **Demo data for the presentation.** `npm run seed` builds a believable world: the presenter account `Sukhrob` with 35 titles spread over a year, six friends, two requests waiting and one sent, plus friends with recent activity. Friend names are plain English first names on purpose. The `Sukhrob` password is `SUKHROB_PASSWORD` in `.env`.
- **A tidy shop window.** The home page, the hero and the release radar leave out horror movies and the titles in `server/data/hidden-titles.json` (edit that file to hide one more). Search, browse by genre and title pages are not affected.
- **A strict Content-Security-Policy,** so there are no inline `style=""` attributes. Values that change (the stagger `--i`, the sliding pill position) are set from JavaScript.
- **The ten-star rating** is ten hidden radio buttons, so the keyboard (arrow keys) and screen readers work. Hovering previews, clicking saves, and a word describes the number (7 is Good, 10 is Masterpiece).
- **Episode stepper:** the + and - buttons change the season and episode, a progress bar shows how far through the series you are (from TMDB's episode counts), and the change is saved automatically a moment after the last click.
- **A hidden list shows a "shoji gate"** instead of an error: calm words, and the friend button changes to "Request sent ✓" in place. The API answers `200` with `hidden: true` instead of `403`, so the page has no console errors for a normal situation. The list and its counts are never sent.
- **PostgreSQL in Docker:** the server already runs MySQL, and PostgreSQL was not installed. A container keeps Komorebi's database separate, needs no system changes, and listens only on localhost (port 5433).
- **Port 4100** for the app, on 127.0.0.1 only. nginx forwards `komorebi.uz` to it.
- **Login field** accepts the username or the email.
- **Password maximum is 72 characters,** because bcrypt ignores anything longer.
- **Usernames** are 3–30 letters, numbers or underscores, unique regardless of case. They are used in profile links.
- **Crossed friend requests:** if you send a request to someone who already sent you one, you simply become friends.
- **Declining or cancelling a request** deletes it, so the person can ask again later.
- **"Friends who watched this"** follows the profile rules: friends' Public and Friends-only lists are shown, Private lists are not.
- **Season and episode progress** is only offered for shows, not films.
- **Removing a title** asks for confirmation, because the rating and review are deleted with it.
