// The Movie Database (TMDB): movies, series and cartoons.
// Docs: https://developer.themoviedb.org/docs
const { fetchJson } = require('./http');

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const ANIMATION = 16; // TMDB genre id for animation
const REGION = 'US';  // "in theatres" and "coming soon" are per country

function authHeaders() {
  const key = process.env.TMDB_API_KEY || '';
  // the long "API Read Access Token" is a Bearer token; the short v3 key goes in the URL
  return key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {};
}

function get(path, params = {}) {
  const key = process.env.TMDB_API_KEY || '';
  if (!key) throw new Error('TMDB_API_KEY is not set');
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!key.startsWith('eyJ')) url.searchParams.set('api_key', key);
  url.searchParams.set('language', 'en-US');
  return fetchJson('TMDB', url, { headers: authHeaders() });
}

// Decide our type label from TMDB data: animation is a cartoon,
// everything else is a movie or a series.
function typeOf(mediaType, genreIds) {
  if (genreIds.includes(ANIMATION)) return 'cartoon';
  return mediaType === 'movie' ? 'movie' : 'series';
}

// Anime is not part of Komorebi: Japanese-language animation is left out of every list and search.
// (TMDB has no separate anime label, so the language is the signal.)
const isAnime = (r) => (r.genre_ids || (r.genres || []).map((g) => g.id)).includes(ANIMATION) && (r.original_language === 'ja' || (r.origin_country || []).includes('JP'));

const yearOf = (date) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);
const image = (size, path) => (path ? `${IMG}/${size}${path}` : null);

// Short form used in grids, search results and the hero.
function toSummary(r, mediaType = r.media_type) {
  const isMovie = mediaType === 'movie';
  const releaseDate = (isMovie ? r.release_date : r.first_air_date) || null;
  return {
    id: `tmdb-${isMovie ? 'movie' : 'tv'}-${r.id}`,
    source: 'tmdb',
    type: typeOf(mediaType, r.genre_ids || []),
    title: (isMovie ? r.title : r.name) || 'Untitled',
    originalTitle: (isMovie ? r.original_title : r.original_name) || null,
    year: yearOf(releaseDate),
    releaseDate,
    posterUrl: image('w342', r.poster_path),
    backdropUrl: image('w1280', r.backdrop_path),
    overview: r.overview || null,
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    popularity: r.popularity || 0,
    genreIds: r.genre_ids || [],
    anime: isAnime(r),
  };
}

// Full form for the item page: also cast, trailer and similar titles.
// DATA_VERSION lets the catalog notice saved copies that lack the newer fields.
const DATA_VERSION = 2;

function toDetail(d, mediaType) {
  const isMovie = mediaType === 'movie';
  const genreIds = (d.genres || []).map((g) => g.id);
  const seasons = isMovie
    ? []
    : (d.seasons || [])
        .filter((s) => s.season_number > 0) // season 0 holds "specials"
        .map((s) => ({ number: s.season_number, episodes: s.episode_count || null }));

  const cast = (d.credits?.cast || []).slice(0, 12).map((c) => ({
    name: c.name, character: c.character || null, photoUrl: image('w185', c.profile_path),
  }));
  const makers = isMovie
    ? (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name)
    : (d.created_by || []).map((c) => c.name);
  const videos = (d.videos?.results || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const trailer = videos.find((v) => v.official) || videos[0] || null;
  const similar = (d.recommendations?.results || [])
    .filter((r) => r.poster_path)
    .slice(0, 12)
    .map((r) => toSummary(r, isMovie ? 'movie' : 'tv'))
    .filter((i) => !i.anime);

  return {
    ...toSummary({ ...d, genre_ids: genreIds }, mediaType),
    posterLarge: image('w500', d.poster_path),
    tagline: d.tagline || null,
    votes: d.vote_count || 0,
    genres: (d.genres || []).map((g) => g.name),
    runtime: isMovie ? d.runtime || null : null,
    episodeLength: isMovie ? null : (d.episode_run_time && d.episode_run_time[0]) || null,
    episodes: isMovie ? null : d.number_of_episodes || null,
    seasonCount: isMovie ? null : d.number_of_seasons || null,
    seasons,
    status: d.status || null,
    format: isMovie ? 'Movie' : 'TV series',
    makers: makers.slice(0, 3),
    makersLabel: isMovie ? 'Directed by' : 'Created by',
    cast,
    trailer: trailer ? { key: trailer.key, name: trailer.name } : null,
    similar,
    sourceName: 'TMDB',
    sourceUrl: `https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${d.id}`,
    dataVersion: DATA_VERSION,
  };
}

const summaries = (data, mediaType) => (data?.results || []).map((r) => toSummary(r, mediaType)).filter((i) => !i.anime);

async function search(query) {
  const data = await get('/search/multi', { query, include_adult: 'false', page: '1' });
  return (data?.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => toSummary(r))
    .filter((i) => !i.anime);
}

async function trending(mediaType) {
  return summaries(await get(`/trending/${mediaType}/week`), mediaType);
}

async function popularAnimation(mediaType) {
  return summaries(await get(`/discover/${mediaType}`, {
    with_genres: String(ANIMATION),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    'vote_count.gte': '50',
  }), mediaType);
}

// Release radar: what is in cinemas, what is coming, what airs this week.
async function nowPlaying() {
  return summaries(await get('/movie/now_playing', { region: REGION }), 'movie');
}
async function upcoming() {
  return summaries(await get('/movie/upcoming', { region: REGION }), 'movie');
}
async function airingThisWeek() {
  return summaries(await get('/tv/on_the_air'), 'tv');
}

// Browse by genre. `genreId` may be null. Returns one page of summaries.
const SORTS = { popular: 'popularity.desc', rating: 'vote_average.desc', newest: 'date.desc' };
async function discover(mediaType, { genreId = null, sort = 'popular', page = 1, animation = null }) {
  const isMovie = mediaType === 'movie';
  const today = new Date().toISOString().slice(0, 10);
  const dateField = isMovie ? 'primary_release_date' : 'first_air_date';
  const params = {
    include_adult: 'false',
    page: String(page),
    sort_by: sort === 'newest' ? `${dateField}.desc` : SORTS[sort] || SORTS.popular,
  };
  // movies and series leave out animation, cartoons are only animation (matches typeOf above)
  const genres = [];
  if (genreId) genres.push(genreId);
  if (animation === true) genres.push(ANIMATION);
  if (genres.length) params.with_genres = genres.join(',');
  if (animation === false) params.without_genres = String(ANIMATION);
  if (sort === 'rating') params['vote_count.gte'] = '500';
  if (sort === 'newest') { params[`${dateField}.lte`] = today; params['vote_count.gte'] = '10'; }
  const data = await get(`/discover/${mediaType}`, params);
  return { items: summaries(data, mediaType), totalPages: Math.min(data?.total_pages || 1, 500) };
}

async function details(mediaType, id) {
  const d = await get(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos,recommendations',
    include_video_language: 'en,null',
  });
  return d ? toDetail(d, mediaType) : null;
}

module.exports = { search, trending, popularAnimation, nowPlaying, upcoming, airingThisWeek, discover, details, DATA_VERSION };
