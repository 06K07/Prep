#include "mini_test.hpp"
#include "shortener/service.hpp"

using namespace shortener;

TEST(Service, ShortenReturnsAResolvableCode) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://example.com/a", 0);
    EXPECT_TRUE(r.ok);
    EXPECT_EQ(svc.resolve(r.code, 1), std::optional<std::string>("http://example.com/a"));
}

TEST(Service, SameUrlGetsTheSameCode) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_EQ(svc.shorten("http://example.com/a", 0).code, svc.shorten("http://example.com/a", 5).code);
}

TEST(Service, UrlsThatNormaliseTheSameShareACode) {
    LinkStore store;
    ShortenerService svc(store);
    auto first = svc.shorten("http://example.com", 0);
    EXPECT_EQ(svc.shorten("HTTP://EXAMPLE.com/", 1).code, first.code);
    EXPECT_EQ(store.size(), std::size_t(1));
}

TEST(Service, DifferentUrlsGetDifferentCodes) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_TRUE(svc.shorten("http://a.com", 0).code != svc.shorten("http://b.com", 0).code);
}

TEST(Service, PathCaseMatters) {
    LinkStore store;
    ShortenerService svc(store);
    auto lower = svc.shorten("http://a.com/abc", 0);
    auto upper = svc.shorten("http://a.com/ABC", 0);
    EXPECT_TRUE(lower.code != upper.code);
    EXPECT_EQ(svc.resolve(upper.code, 1), std::optional<std::string>("http://a.com/ABC"));
}

TEST(Service, InvalidUrlIsRejected) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("not a url", 0);
    EXPECT_FALSE(r.ok);
    EXPECT_EQ(r.error, std::string("invalid_url"));
}

TEST(Service, ResolvingAnUnknownCodeGivesNothing) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_FALSE(svc.resolve("nope", 0).has_value());
}

TEST(Service, LinkIsValidJustBeforeItsDeadline) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://a.com", 1000, 500);
    EXPECT_TRUE(svc.resolve(r.code, 1499).has_value());
}

TEST(Service, LinkExpiresExactlyAtItsDeadline) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://a.com", 1000, 500);
    EXPECT_FALSE(svc.resolve(r.code, 1500).has_value());
}

TEST(Service, LinkWithoutTtlNeverExpires) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://a.com", 0);
    EXPECT_TRUE(svc.resolve(r.code, 999999999).has_value());
}

TEST(Service, AliasWorks) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shortenWithAlias("http://a.com/docs", "my-docs", 0);
    EXPECT_TRUE(r.ok);
    EXPECT_EQ(r.code, std::string("my-docs"));
    EXPECT_EQ(svc.resolve("my-docs", 1), std::optional<std::string>("http://a.com/docs"));
}

TEST(Service, InvalidAliasIsRejected) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_EQ(svc.shortenWithAlias("http://a.com", "ab", 0).error, std::string("invalid_alias"));
    EXPECT_EQ(svc.shortenWithAlias("http://a.com", "has space", 0).error, std::string("invalid_alias"));
    EXPECT_EQ(svc.shortenWithAlias("http://a.com", std::string(21, 'a'), 0).error, std::string("invalid_alias"));
}

TEST(Service, ReservedAliasIsRejectedInAnyCase) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_EQ(svc.shortenWithAlias("http://a.com", "admin", 0).error, std::string("alias_reserved"));
    EXPECT_EQ(svc.shortenWithAlias("http://a.com", "API", 0).error, std::string("alias_reserved"));
}

TEST(Service, TakenAliasIsRejectedAndTheOriginalLinkSurvives) {
    LinkStore store;
    ShortenerService svc(store);
    EXPECT_TRUE(svc.shortenWithAlias("http://first.com", "docs", 0).ok);
    auto second = svc.shortenWithAlias("http://second.com", "docs", 1);
    EXPECT_FALSE(second.ok);
    EXPECT_EQ(second.error, std::string("alias_taken"));
    EXPECT_EQ(svc.resolve("docs", 2), std::optional<std::string>("http://first.com"));
}

TEST(Service, GeneratedCodesSkipCodesThatAreAlreadyTaken) {
    LinkStore store;
    Record taken;
    taken.code = "1";  // the first code the service would generate
    taken.url = "http://taken.com";
    store.put(taken);
    ShortenerService svc(store);
    auto r = svc.shorten("http://other.com", 0);
    EXPECT_EQ(r.code, std::string("2"));
    EXPECT_EQ(store.get("1")->url, std::string("http://taken.com"));
}

TEST(Service, EverySuccessfulResolveCountsAsOneHit) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://a.com", 0);
    svc.resolve(r.code, 1);
    svc.resolve(r.code, 2);
    EXPECT_EQ(svc.hits(r.code), 2LL);
}

TEST(Service, ExpiredResolvesDoNotCountAsHits) {
    LinkStore store;
    ShortenerService svc(store);
    auto r = svc.shorten("http://a.com", 0, 100);
    svc.resolve(r.code, 50);
    svc.resolve(r.code, 500);
    EXPECT_EQ(svc.hits(r.code), 1LL);
}
