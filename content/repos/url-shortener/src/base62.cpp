#include "shortener/base62.hpp"

#include <algorithm>

namespace shortener {

namespace {
const std::string kAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
}

std::string encodeBase62(std::uint64_t n) {
    if (n == 0) return "0";
    std::string out;
    while (n > 0) {
        out.push_back(kAlphabet[n % 62]);
        n /= 62;
    }
    return out;
}

std::optional<std::uint64_t> decodeBase62(const std::string& s) {
    if (s.empty()) return std::nullopt;
    std::uint64_t value = 0;
    for (char c : s) {
        auto pos = kAlphabet.find(c);
        value = value * 62 + pos;
    }
    return value;
}

}  // namespace shortener
