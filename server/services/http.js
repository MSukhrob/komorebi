// fetch() with a timeout and one clear error type for outside services.

class SourceError extends Error {
  constructor(source, message) {
    super(`${source}: ${message}`);
    this.source = source;
  }
}

async function fetchJson(source, url, { headers = {}, timeoutMs = 7000 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Komorebi (student project)', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new SourceError(source, err.name === 'TimeoutError' ? 'timed out' : err.message);
  }
  if (res.status === 404) return null; // "no such title" is not a failure
  if (!res.ok) throw new SourceError(source, `HTTP ${res.status}`);
  return res.json();
}

// Tiny in-memory cache with expiry. Expired values are kept a while longer
// so they can be served when the outside service is down ("stale").
class TtlCache {
  constructor({ ttlMs, staleMs = 24 * 60 * 60 * 1000, max = 500 }) {
    Object.assign(this, { ttlMs, staleMs, max, map: new Map() });
  }

  get(key, { allowStale = false } = {}) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    const age = Date.now() - hit.at;
    if (age < this.ttlMs || (allowStale && age < this.ttlMs + this.staleMs)) return hit.value;
    return undefined;
  }

  set(key, value) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value); // drop oldest
    this.map.set(key, { value, at: Date.now() });
  }
}

module.exports = { fetchJson, SourceError, TtlCache };
