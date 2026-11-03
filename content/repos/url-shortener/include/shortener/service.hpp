#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include "shortener/store.hpp"

namespace shortener {

struct ShortenResult {
    bool ok = false;
    std::string code;
    std::string error;  // "invalid_url", "invalid_alias", "alias_reserved", "alias_taken"
};

bool isReservedAlias(const std::string& alias);

class ShortenerService {
    LinkStore& store;
    std::uint64_t nextId = 1;

public:
    explicit ShortenerService(LinkStore& s) : store(s) {}

    // ttlMs <= 0 means the link never expires.
    ShortenResult shorten(const std::string& url, long long now, long long ttlMs = 0);
    ShortenResult shortenWithAlias(const std::string& url, const std::string& alias, long long now,
                                   long long ttlMs = 0);

    // Returns the normalised target URL, or nullopt when unknown or expired.
    std::optional<std::string> resolve(const std::string& code, long long now);
    long long hits(const std::string& code) const;
};

}  // namespace shortener
