-- Komorebi database schema. Safe to run many times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash TEXT         NOT NULL,
  -- who may see this user's list: public | friends | private
  privacy       VARCHAR(10)  NOT NULL DEFAULT 'friends'
                CHECK (privacy IN ('public', 'friends', 'private')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- usernames and emails are unique regardless of letter case
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower    ON users (lower(email));

-- Cached details of every title someone has opened or added.
-- id looks like "tmdb-movie-603" or "tmdb-tv-1396".
CREATE TABLE IF NOT EXISTS items (
  id          VARCHAR(40) PRIMARY KEY,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('movie', 'series', 'cartoon')),
  title       TEXT        NOT NULL,
  year        INTEGER,
  poster_url  TEXT,
  data        JSONB       NOT NULL,          -- the full normalized item
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (user, item) on a personal list.
CREATE TABLE IF NOT EXISTS list_entries (
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     VARCHAR(40) NOT NULL REFERENCES items(id),
  status      VARCHAR(10) NOT NULL CHECK (status IN ('planned', 'watching', 'watched')),
  rating      SMALLINT    CHECK (rating BETWEEN 1 AND 10),
  review      VARCHAR(2000),
  season      SMALLINT    CHECK (season  BETWEEN 0 AND 999),
  episode     SMALLINT    CHECK (episode BETWEEN 0 AND 9999),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS list_entries_item ON list_entries (item_id);

-- A friend request. It becomes a friendship when status = 'accepted'.
-- Declining or cancelling simply deletes the row.
CREATE TABLE IF NOT EXISTS friendships (
  id            SERIAL PRIMARY KEY,
  requester_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
-- only one row per pair of people, whichever direction it was sent in
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- Sessions table used by connect-pg-simple.
CREATE TABLE IF NOT EXISTS user_sessions (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire ON user_sessions (expire);

-- One-time cleanup: Komorebi used to list anime (from Kitsu). Anime was removed,
-- so old Kitsu titles go (with the list entries that pointed at them), and
-- TMDB titles once labelled "anime" are now plain cartoons. Safe to run again.
DELETE FROM list_entries WHERE item_id LIKE 'kitsu-%';
DELETE FROM items WHERE id LIKE 'kitsu-%';
UPDATE items SET type = 'cartoon', data = jsonb_set(data, '{type}', '"cartoon"') WHERE type = 'anime';
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_type_check;
ALTER TABLE items ADD CONSTRAINT items_type_check CHECK (type IN ('movie', 'series', 'cartoon'));
