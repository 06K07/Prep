#pragma once
#include <algorithm>
#include <cmath>

class TokenBucket {
    double capacity;
    double refillPerSec;
    double tokens;
    long long lastMs;

    void refill(long long now) {
        long long elapsedSec = (now - lastMs) / 1000;
        tokens = tokens + elapsedSec * refillPerSec;
        lastMs = now;
    }

public:
    TokenBucket(double cap, double rate, long long now)
        : capacity(cap), refillPerSec(rate), tokens(cap), lastMs(now) {}

    bool tryConsume(double cost, long long now) {
        refill(now);
        if (tokens < cost) return false;
        tokens -= cost;
        return true;
    }

    double available(long long now) {
        refill(now);
        return tokens;
    }

    long long retryAfterMs(double cost, long long now) {
        refill(now);
        if (tokens >= cost) return 0;
        return (long long)((cost - tokens) / refillPerSec);
    }

    long long lastSeen() const { return lastMs; }
};
