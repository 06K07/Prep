#include <functional>
#include <iostream>
#include "cached_loader.hpp"
using namespace std;

int fails = 0;
// Each test is isolated: an uncaught exception counts as FAIL, not a crash.
void T(const string& name, function<bool()> f) {
    bool ok = false;
    try { ok = f(); } catch (...) { ok = false; }
    cout << (ok ? "PASS " : "FAIL ") << name << endl;
    if (!ok) fails++;
}
bool has(LruCache<string, int>& c, const string& k) { return c.get(k) != nullptr; }

int main() {
    T("put_and_get_roundtrip", [] {
        LruCache<string, int> c(2);
        c.put("a", 1);
        int* v = c.get("a");
        return v && *v == 1 && c.get("zzz") == nullptr; });

    T("evicts_least_recently_used_when_full", [] {
        LruCache<string, int> c(2);
        c.put("a", 1); c.put("b", 2); c.put("c", 3);
        return !has(c, "a") && has(c, "b") && has(c, "c") && c.size() == 2; });

    T("get_promotes_entry", [] {
        LruCache<string, int> c(2);
        c.put("a", 1); c.put("b", 2);
        c.get("a");
        c.put("c", 3);
        return has(c, "a") && !has(c, "b"); });

    T("put_existing_key_promotes_entry", [] {
        LruCache<string, int> c(3);
        c.put("a", 1); c.put("b", 2);
        c.put("a", 10);
        c.put("c", 3);
        c.put("d", 4);
        return has(c, "a") && !has(c, "b") && *c.get("a") == 10; });

    T("updating_existing_key_does_not_evict_others", [] {
        LruCache<string, int> c(2);
        c.put("a", 1); c.put("b", 2);
        c.put("b", 20);
        return has(c, "a") && has(c, "b") && c.size() == 2; });

    T("entry_is_a_miss_after_ttl", [] {
        Clock clock; TtlCache<string, int> c(clock, 4, 1000);
        c.put("a", 1);
        clock.advance(1500);
        return c.get("a") == nullptr; });

    T("entry_is_still_valid_before_ttl", [] {
        Clock clock; TtlCache<string, int> c(clock, 4, 1000);
        c.put("a", 1);
        clock.advance(999);
        return c.get("a") != nullptr; });

    T("entry_expires_exactly_at_deadline", [] {
        Clock clock; TtlCache<string, int> c(clock, 4, 1000);
        c.put("a", 1);
        clock.advance(1000);
        return c.get("a") == nullptr; });

    T("size_excludes_expired_entries", [] {
        Clock clock; TtlCache<string, int> c(clock, 4, 1000);
        c.put("a", 1); c.put("b", 2);
        clock.advance(2000);
        return c.size() == 0; });

    T("loader_is_called_once_for_repeated_reads", [] {
        Clock clock; int calls = 0;
        CachedLoader<string> cl(clock, 4, 1000, 100, [&](const string& k) { calls++; return optional<string>("user-" + k); });
        cl.get("7"); cl.get("7"); auto v = cl.get("7");
        return calls == 1 && v && *v == "user-7" && cl.stats.hits == 2 && cl.stats.misses == 1; });

    T("value_is_reloaded_after_ttl", [] {
        Clock clock; int calls = 0;
        CachedLoader<string> cl(clock, 4, 1000, 100, [&](const string& k) { calls++; return optional<string>(k); });
        cl.get("a"); clock.advance(1000); cl.get("a");
        return calls == 2 && cl.stats.loads == 2; });

    T("missing_values_are_cached_only_briefly", [] {
        Clock clock; int calls = 0;
        CachedLoader<string> cl(clock, 4, 10000, 100, [&](const string&) { calls++; return optional<string>(); });
        cl.get("ghost"); clock.advance(50); cl.get("ghost");
        bool cachedWhileFresh = calls == 1;
        clock.advance(100); cl.get("ghost");
        return cachedWhileFresh && calls == 2; });

    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
