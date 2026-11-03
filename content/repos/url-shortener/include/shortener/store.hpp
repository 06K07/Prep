#pragma once
#include <map>
#include <mutex>
#include <optional>
#include <string>

namespace shortener {

struct Record {
    std::string code;
    std::string url;          // normalised
    long long createdAt = 0;
    long long expiresAt = 0;  // 0 = never expires
    long long hits = 0;
};

// Thread-safe in-memory storage.
class LinkStore {
    std::map<std::string, Record> byCode;
    std::map<std::string, std::string> byUrl;
    mutable std::mutex mu;

public:
    // Returns false (and changes nothing) when the code already exists.
    bool put(const Record& record);
    std::optional<Record> get(const std::string& code) const;
    std::optional<std::string> codeForUrl(const std::string& normalizedUrl) const;
    // Counts one hit. Returns false for an unknown code.
    bool touch(const std::string& code);
    std::size_t size() const;
};

}  // namespace shortener
