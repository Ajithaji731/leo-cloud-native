// High-Speed In-Memory Cache for Sub-Millisecond AI Retrieval
class FastMemoryCache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttlSeconds = 60) {
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(key) {
    if (!this.store.has(key)) return null;
    const expiry = this.ttls.get(key);
    if (Date.now() > expiry) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key);
  }

  invalidate(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
    this.ttls.clear();
  }
}

const memoryCache = new FastMemoryCache();
module.exports = memoryCache;
