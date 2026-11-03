#include "shortener/service.hpp"

#include <algorithm>
#include <cctype>
#include "shortener/base62.hpp"
#include "shortener/validator.hpp"

namespace shortener {

namespace {

bool validAlias(const std::string& alias) {
    if (alias.size() < 3 || alias.size() > 20) return false;
    return std::all_of(alias.begin(), alias.end(), [](unsigned char c) {
        return std::isalnum(c) || c == '-' || c == '_';
    });
}

long long expiryFor(long long now, long long ttlMs) { return ttlMs > 0 ? now + ttlMs : 0; }

}  // namespace

bool isReservedAlias(const std::string& alias) {
    std::string lower = alias;
    std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char c) { return std::tolower(c); });
    return lower == "api" || lower == "admin" || lower == "static" || lower == "health";
}

ShortenResult ShortenerService::shorten(const std::string& url, long long now, long long ttlMs) {
    if (!isValidUrl(url)) return {false, "", "invalid_url"};

    std::string key = url;
    if (auto existing = store.codeForUrl(key)) return {true, *existing, ""};

    std::string code;
    do {
        code = encodeBase62(nextId++);
    } while (store.get(code));

    Record record;
    record.code = code;
    record.url = normalizeUrl(url);
    record.createdAt = now;
    record.expiresAt = expiryFor(now, ttlMs);
    store.put(record);
    return {true, code, ""};
}

ShortenResult ShortenerService::shortenWithAlias(const std::string& url, const std::string& alias,
                                                 long long now, long long ttlMs) {
    if (!isValidUrl(url)) return {false, "", "invalid_url"};
    if (!validAlias(alias)) return {false, "", "invalid_alias"};

    Record record;
    record.code = alias;
    record.url = normalizeUrl(url);
    record.createdAt = now;
    record.expiresAt = expiryFor(now, ttlMs);
    store.put(record);
    return {true, alias, ""};
}

std::optional<std::string> ShortenerService::resolve(const std::string& code, long long now) {
    auto record = store.get(code);
    if (!record) return std::nullopt;
    if (record->expiresAt != 0 && now > record->expiresAt) return std::nullopt;
    store.touch(code);
    return record->url;
}

long long ShortenerService::hits(const std::string& code) const {
    auto record = store.get(code);
    return record ? record->hits : 0;
}

}  // namespace shortener
