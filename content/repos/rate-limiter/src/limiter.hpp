#pragma once
#include <map>
#include <string>
#include "clock.hpp"
#include "token_bucket.hpp"

// One token bucket per key (API key / IP).
class RateLimiter {
    Clock& clock;
    double capacity;
    double rate;
    std::map<std::string, TokenBucket> buckets;

    TokenBucket& bucketFor(const std::string& key) {
        auto it = buckets.find(key);
        if (it == buckets.end()) {
            it = buckets.emplace(key, TokenBucket(capacity, rate, clock.now())).first;
        }
        return it->second;
    }

public:
    RateLimiter(Clock& c, double cap, double refillPerSec)
        : clock(c), capacity(cap), rate(refillPerSec) {}

    bool allow(const std::string& key, double cost = 1) {
        return bucketFor(key).tryConsume(cost, clock.now());
    }

    long long retryAfterMs(const std::string& key, double cost = 1) {
        return bucketFor(key).retryAfterMs(cost, clock.now());
    }

    void evictIdle(long long idleMs) {
        for (auto it = buckets.begin(); it != buckets.end();) {
            if (clock.now() - it->second.lastSeen() < idleMs) it = buckets.erase(it);
            else ++it;
        }
    }

    bool has(const std::string& key) const { return buckets.count(key) > 0; }
    size_t size() const { return buckets.size(); }
};
