# LRU Cache with TTL (pre-prod)

Read-through cache for a profile service: LRU eviction, per-entry expiry, negative caching.

Layers: tests/test.cpp -> src/cached_loader.hpp -> src/ttl_cache.hpp -> src/lru.hpp (+ src/clock.hpp)

Rules:
- `LruCache`: holds at most `capacity` entries. `get` and updating an existing key with `put` both make
  the entry the most recently used. Updating an existing key never evicts another entry. Inserting a new key
  into a full cache evicts the least recently used one.
- `TtlCache`: an entry expires when `now >= expiresAt` (exactly at the deadline it is already gone).
  Expired entries are removed on access and never counted by `size()`.
- `CachedLoader`: read-through. A found value is cached for `ttlMs`; a missing value (loader returns nothing)
  is cached for the shorter `negativeTtlMs`. `stats.hits` counts cache hits, `stats.misses` counts calls that
  had to call the loader, `stats.loads` counts loader calls.

Task: run run.sh and make all tests pass without editing tests/.
