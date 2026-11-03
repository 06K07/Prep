#include "mini_test.hpp"
#include "shortener/validator.hpp"

using namespace shortener;

TEST(Validator, AcceptsHttpAndHttps) {
    EXPECT_TRUE(isValidUrl("http://example.com"));
    EXPECT_TRUE(isValidUrl("https://example.com/path?q=1#frag"));
}

TEST(Validator, AcceptsAnyLetterCaseInTheScheme) {
    EXPECT_TRUE(isValidUrl("HTTP://example.com"));
    EXPECT_TRUE(isValidUrl("Https://example.com"));
}

TEST(Validator, RejectsOtherSchemes) {
    EXPECT_FALSE(isValidUrl("ftp://example.com"));
    EXPECT_FALSE(isValidUrl("httpx://example.com"));
    EXPECT_FALSE(isValidUrl("example.com"));
}

TEST(Validator, RejectsMissingHost) {
    EXPECT_FALSE(isValidUrl("http://"));
    EXPECT_FALSE(isValidUrl("https:///path"));
}

TEST(Validator, RejectsWhitespace) {
    EXPECT_FALSE(isValidUrl("http://exa mple.com"));
    EXPECT_FALSE(isValidUrl("http://example.com/\n"));
}

TEST(Validator, AcceptsUrlOfExactlyMaxLength) {
    std::string url = "http://a.com/" + std::string(kMaxUrlLength - 13, 'x');
    EXPECT_EQ(url.size(), kMaxUrlLength);
    EXPECT_TRUE(isValidUrl(url));
}

TEST(Validator, RejectsUrlLongerThanMax) {
    std::string url = "http://a.com/" + std::string(kMaxUrlLength - 12, 'x');
    EXPECT_FALSE(isValidUrl(url));
}

TEST(Normalize, LowercasesSchemeAndHostOnly) {
    EXPECT_EQ(normalizeUrl("HTTP://Example.COM/Path/A?Q=B"), std::string("http://example.com/Path/A?Q=B"));
}

TEST(Normalize, DropsAPathThatIsJustASlash) {
    EXPECT_EQ(normalizeUrl("http://a.com/"), std::string("http://a.com"));
}

TEST(Normalize, KeepsTrailingSlashOfRealPaths) {
    EXPECT_EQ(normalizeUrl("http://a.com/docs/"), std::string("http://a.com/docs/"));
}
