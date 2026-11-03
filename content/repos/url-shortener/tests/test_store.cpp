#include "mini_test.hpp"
#include "shortener/store.hpp"

using namespace shortener;

static Record makeRecord(const std::string& code, const std::string& url) {
    Record r;
    r.code = code;
    r.url = url;
    return r;
}

TEST(Store, PutAndGetRoundTrip) {
    LinkStore store;
    EXPECT_TRUE(store.put(makeRecord("abc", "http://a.com")));
    auto got = store.get("abc");
    EXPECT_TRUE(got.has_value());
    EXPECT_EQ(got->url, std::string("http://a.com"));
    EXPECT_FALSE(store.get("missing").has_value());
}

TEST(Store, PutRefusesADuplicateCodeAndKeepsTheOriginal) {
    LinkStore store;
    store.put(makeRecord("abc", "http://first.com"));
    EXPECT_FALSE(store.put(makeRecord("abc", "http://second.com")));
    EXPECT_EQ(store.get("abc")->url, std::string("http://first.com"));
    EXPECT_EQ(store.size(), std::size_t(1));
}

TEST(Store, TouchCountsHits) {
    LinkStore store;
    store.put(makeRecord("abc", "http://a.com"));
    EXPECT_TRUE(store.touch("abc"));
    EXPECT_TRUE(store.touch("abc"));
    EXPECT_EQ(store.get("abc")->hits, 2LL);
    EXPECT_FALSE(store.touch("missing"));
}
