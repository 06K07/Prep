#pragma once

// Manually driven clock so behaviour is deterministic.
struct Clock {
    long long nowMs = 0;
    long long now() const { return nowMs; }
    void advance(long long ms) { nowMs += ms; }
};
