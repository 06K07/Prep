#include "shortener/validator.hpp"

#include <algorithm>
#include <cctype>

namespace shortener {

bool isValidUrl(const std::string& url) {
    if (url.empty() || url.size() >= kMaxUrlLength) return false;
    for (unsigned char c : url) {
        if (std::isspace(c)) return false;
    }
    if (url.rfind("http", 0) != 0) return false;
    auto sep = url.find("://");
    if (sep == std::string::npos) return false;

    auto hostStart = sep + 3;
    auto hostEnd = url.find_first_of("/?#", hostStart);
    std::string host = url.substr(hostStart, hostEnd == std::string::npos ? std::string::npos : hostEnd - hostStart);
    return !host.empty();
}

std::string normalizeUrl(const std::string& url) {
    std::string out = url;
    std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) { return std::tolower(c); });
    if (out.size() > 1 && out.back() == '/') out.pop_back();
    return out;
}

}  // namespace shortener
