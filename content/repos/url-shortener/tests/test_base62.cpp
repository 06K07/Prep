#include <optional>
#include "mini_test.hpp"
#include "shortener/base62.hpp"

using namespace shortener;

TEST(Base62, EncodesZero) { EXPECT_EQ(encodeBase62(0), std::string("0")); }

TEST(Base62, EncodesSingleDigitBoundary) {
    EXPECT_EQ(encodeBase62(9), std::string("9"));
    EXPECT_EQ(encodeBase62(10), std::string("a"));
    EXPECT_EQ(encodeBase62(61), std::string("Z"));
}

TEST(Base62, EncodesMostSignificantDigitFirst) {
    EXPECT_EQ(encodeBase62(62), std::string("10"));
    EXPECT_EQ(encodeBase62(3844), std::string("100"));
}

TEST(Base62, RoundTripsLargeValues) {
    for (std::uint64_t n : {1ULL, 61ULL, 62ULL, 12345ULL, 987654321ULL, 18446744073709551615ULL}) {
        EXPECT_EQ(decodeBase62(encodeBase62(n)), std::optional<std::uint64_t>(n));
    }
}

TEST(Base62, DecodesKnownValue) { EXPECT_EQ(decodeBase62("10"), std::optional<std::uint64_t>(62)); }

TEST(Base62, DecodeRejectsEmptyInput) { EXPECT_FALSE(decodeBase62("").has_value()); }

TEST(Base62, DecodeRejectsCharactersOutsideTheAlphabet) {
    EXPECT_FALSE(decodeBase62("ab-c").has_value());
    EXPECT_FALSE(decodeBase62("a b").has_value());
    EXPECT_FALSE(decodeBase62("!").has_value());
}
