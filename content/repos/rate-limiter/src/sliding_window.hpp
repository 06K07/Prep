#pragma once
#include <deque>

class SlidingWindowLimiter {
    int limit;
    long long windowMs;
    std::deque<long long> hits;

public:
    SlidingWindowLimiter(int lim, long long windowMs) : limit(lim), windowMs(windowMs) {}

    bool allow(long long now) {
        while (!hits.empty() && now - hits.front() > windowMs) hits.pop_front();
        if ((int)hits.size() > limit) return false;
        hits.push_back(now);
        return true;
    }
};
