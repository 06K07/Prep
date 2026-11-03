#include "shortener/store.hpp"

namespace shortener {

bool LinkStore::put(const Record& record) {
    std::lock_guard<std::mutex> lock(mu);
    byCode[record.code] = record;
    byUrl.emplace(record.url, record.code);
    return true;
}

std::optional<Record> LinkStore::get(const std::string& code) const {
    std::lock_guard<std::mutex> lock(mu);
    auto it = byCode.find(code);
    if (it == byCode.end()) return std::nullopt;
    return it->second;
}

std::optional<std::string> LinkStore::codeForUrl(const std::string& normalizedUrl) const {
    std::lock_guard<std::mutex> lock(mu);
    auto it = byUrl.find(normalizedUrl);
    if (it == byUrl.end()) return std::nullopt;
    return it->second;
}

bool LinkStore::touch(const std::string& code) {
    std::lock_guard<std::mutex> lock(mu);
    auto it = byCode.find(code);
    if (it == byCode.end()) return false;
    Record rec = it->second;
    rec.hits++;
    return true;
}

std::size_t LinkStore::size() const {
    std::lock_guard<std::mutex> lock(mu);
    return byCode.size();
}

}  // namespace shortener
