#pragma once
#include "clock.hpp"
#include "lru.hpp"

template <class K, class V>
class TtlCache {
    struct Stamped {
        V value;
        long long expiresAt;
    };
    Clock& clock;
    long long defaultTtlMs;
    LruCache<K, Stamped> lru;

public:
    TtlCache(Clock& c, size_t capacity, long long ttlMs)
        : clock(c), defaultTtlMs(ttlMs), lru(capacity) {}

    // ttlMs < 0 means "use the default TTL".
    void put(const K& key, V value, long long ttlMs = -1) {
        long long ttl = ttlMs < 0 ? defaultTtlMs : ttlMs;
        lru.put(key, Stamped{std::move(value), clock.now() + ttl});
    }

    V* get(const K& key) {
        Stamped* s = lru.get(key);
        if (!s) return nullptr;
        if (clock.now() > s->expiresAt) {
            lru.erase(key);
            return nullptr;
        }
        return &s->value;
    }

    size_t size() { return lru.size(); }
};
