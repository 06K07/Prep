#pragma once
#include <functional>
#include <optional>
#include <string>
#include "ttl_cache.hpp"

struct LoaderStats {
    long hits = 0;
    long misses = 0;
    long loads = 0;
};

template <class V>
class CachedLoader {
public:
    using Loader = std::function<std::optional<V>(const std::string&)>;

private:
    TtlCache<std::string, std::optional<V>> cache;
    Loader loader;
    long long negativeTtlMs;

public:
    LoaderStats stats;

    CachedLoader(Clock& clock, size_t capacity, long long ttlMs, long long negativeTtl, Loader fn)
        : cache(clock, capacity, ttlMs), loader(std::move(fn)), negativeTtlMs(negativeTtl) {}

    std::optional<V> get(const std::string& key) {
        if (auto* cached = cache.get(key)) {
            stats.hits++;
            return *cached;
        }
        stats.misses++;
        std::optional<V> value = loader(key);
        stats.loads++;
        cache.put(key, value);
        return value;
    }

    size_t size() { return cache.size(); }
};
