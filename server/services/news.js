// Film news: headlines from the public RSS feeds of four entertainment sites.
// We show only the headline, the source and the time, and every headline links
// to the original article. The result is cached for 30 minutes (a stale copy is
// served for a day if the sites are down).
const { XMLParser } = require('fast-xml-parser');
const { SourceError, TtlCache } = require('./http');

const FEEDS = [
  { name: 'Variety', url: 'https://variety.com/feed/' },
  { name: 'Deadline', url: 'https://deadline.com/feed/' },
  { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
  { name: 'Collider', url: 'https://collider.com/feed/' },
];

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, htmlEntities: true });
const cache = new TtlCache({ ttlMs: 30 * 60 * 1000, staleMs: 24 * 60 * 60 * 1000, max: 2 });

// Komorebi is about enjoying films, so headlines about crime, abuse, violence or deaths are left out.
const HEAVY = /\b(sexual|assault|rape[sd]?|abuse[sd]?|harass\w*|molest\w*|murder\w*|kill\w*|suicide|dies|died|dead|death|obituary|funeral|arrest\w*|convict\w*|guilt\w*|lawsuit|sues?|sued|trial|charged|allegation\w*|scandal|shooting|overdose)\b/i;

const text = (v) => (typeof v === 'string' ? v : v?.['#text'] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function readFeed({ name, url }) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'Komorebi (student project)', Accept: 'application/rss+xml, text/xml' }, signal: AbortSignal.timeout(7000) });
  } catch (err) {
    throw new SourceError(name, err.name === 'TimeoutError' ? 'timed out' : err.message);
  }
  if (!res.ok) throw new SourceError(name, `HTTP ${res.status}`);
  const rss = parser.parse(await res.text());
  const items = [].concat(rss?.rss?.channel?.item || []);
  return items.map((it) => ({
    title: text(it.title),
    url: text(it.link),
    source: name,
    publishedAt: new Date(text(it.pubDate)).getTime() || 0,
  })).filter((n) => n.title && /^https?:\/\//.test(n.url) && n.publishedAt && !HEAVY.test(n.title));
}

// The newest headlines from all sources, at most two in a row from one source.
async function headlines(limit = 8) {
  const cached = cache.get('news');
  if (cached) return cached;
  const results = await Promise.allSettled(FEEDS.map(readFeed));
  const all = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled') all.push(...r.value.slice(0, 8));
    else console.warn(r.reason.message);
  });
  if (!all.length) {
    const stale = cache.get('news', { allowStale: true });
    if (stale) return stale;
    throw new SourceError('News', 'no feed could be read');
  }
  all.sort((a, b) => b.publishedAt - a.publishedAt);
  const items = [];
  for (const n of all) {
    const lastTwo = items.slice(-2);
    if (lastTwo.length === 2 && lastTwo.every((x) => x.source === n.source)) continue;
    items.push(n);
    if (items.length === limit) break;
  }
  cache.set('news', items);
  return items;
}

module.exports = { headlines, FEEDS };
