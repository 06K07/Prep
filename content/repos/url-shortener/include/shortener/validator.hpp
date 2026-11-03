#pragma once
#include <string>

namespace shortener {

constexpr std::size_t kMaxUrlLength = 2048;

bool isValidUrl(const std::string& url);
std::string normalizeUrl(const std::string& url);

}  // namespace shortener
