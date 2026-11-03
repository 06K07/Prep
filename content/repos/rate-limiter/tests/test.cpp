#include <cmath>
#include <functional>
#include <iostream>
#include "limiter.hpp"
#include "sliding_window.hpp"
using namespace std;

int fails = 0;
// Each test is isolated: an uncaught exception counts as FAIL, not a crash.
void T(const string& name, function<bool()> f) {
    bool ok = false;
    try { ok = f(); } catch (...) { ok = false; }
    cout << (ok ? "PASS " : "FAIL ") << name << endl;
    if (!ok) fails++;
}
bool near(double a, double b) { return fabs(a - b) < 1e-6; }

int main() {
    T("allows_burst_up_to_capacity", [] {
        Clock c; RateLimiter rl(c, 3, 1);
        return rl.allow("u") && rl.allow("u") && rl.allow("u"); });

    T("rejects_after_capacity_is_used", [] {
        Clock c; RateLimiter rl(c, 2, 1);
        rl.allow("u"); rl.allow("u");
        return !rl.allow("u"); });

    T("refill_counts_fractions_of_a_second", [] {
        Clock c; TokenBucket b(10, 2, 0);
        b.tryConsume(10, 0);
        return near(b.available(500), 1.0); });

    T("refill_is_capped_at_capacity", [] {
        Clock c; TokenBucket b(5, 1, 0);
        b.tryConsume(2, 0);
        return near(b.available(60000), 5.0); });

    T("keys_are_independent", [] {
        Clock c; RateLimiter rl(c, 1, 1);
        rl.allow("a");
        return rl.allow("b") && !rl.allow("a"); });

    T("cost_greater_than_capacity_never_allowed", [] {
        Clock c; RateLimiter rl(c, 3, 1);
        c.advance(100000);
        return !rl.allow("u", 4); });

    T("retry_after_is_zero_when_allowed", [] {
        Clock c; RateLimiter rl(c, 3, 1);
        return rl.retryAfterMs("u") == 0; });

    T("retry_after_is_in_milliseconds_rounded_up", [] {
        Clock c; RateLimiter rl(c, 1, 1);
        rl.allow("u");
        return rl.retryAfterMs("u") == 1000; });

    T("sliding_window_rejects_over_limit", [] {
        SlidingWindowLimiter w(2, 1000);
        bool a = w.allow(0), b = w.allow(1), third = w.allow(2);
        return a && b && !third; });

    T("sliding_window_hit_exactly_window_old_expires", [] {
        SlidingWindowLimiter w(2, 1000);
        w.allow(0); w.allow(0);
        bool blocked = !w.allow(999);
        return blocked && w.allow(1000); });

    T("evict_idle_removes_only_idle_keys", [] {
        Clock c; RateLimiter rl(c, 1, 1);
        rl.allow("old");
        c.advance(10000);
        rl.allow("fresh");
        rl.evictIdle(5000);
        return rl.size() == 1 && rl.has("fresh") && !rl.has("old"); });

    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
