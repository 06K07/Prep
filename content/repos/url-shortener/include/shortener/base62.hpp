#pragma once
#include <cstdint>
#include <optional>
#include <string>

namespace shortener {

std::string encodeBase62(std::uint64_t n);
std::optional<std::uint64_t> decodeBase62(const std::string& s);

}  // namespace shortener
