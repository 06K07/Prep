#pragma once
// A tiny GoogleTest-style harness (TEST / EXPECT_*), so the repo builds with no downloads.
#include <exception>
#include <functional>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

namespace minitest {

struct Case {
    std::string name;
    std::function<void()> fn;
};

inline std::vector<Case>& registry() {
    static std::vector<Case> cases;
    return cases;
}

inline bool& failedFlag() {
    static bool failed = false;
    return failed;
}

struct Registrar {
    Registrar(const char* name, std::function<void()> fn) { registry().push_back({name, std::move(fn)}); }
};

template <class T>
std::string show(const T& value) {
    if constexpr (std::is_same_v<T, std::string>) {
        return "\"" + value + "\"";
    } else if constexpr (std::is_same_v<T, bool>) {
        return value ? "true" : "false";
    } else {
        std::ostringstream out;
        out << value;
        return out.str();
    }
}

template <class T>
std::string show(const std::optional<T>& value) {
    return value ? "optional(" + show(*value) + ")" : "nullopt";
}

inline void report(const char* file, int line, const std::string& message) {
    failedFlag() = true;
    std::cerr << "    " << file << ":" << line << ": " << message << "\n";
}

template <class A, class B>
void expectEq(const A& a, const B& b, const char* exprA, const char* exprB, const char* file, int line) {
    if (!(a == b)) {
        report(file, line, std::string("expected ") + exprA + " == " + exprB + "\n      left:  " + show(a) +
                               "\n      right: " + show(b));
    }
}

inline int runAll() {
    int failures = 0;
    for (const auto& test : registry()) {
        failedFlag() = false;
        try {
            test.fn();
        } catch (const std::exception& e) {
            report(__FILE__, __LINE__, std::string("uncaught exception: ") + e.what());
        } catch (...) {
            report(__FILE__, __LINE__, "uncaught unknown exception");
        }
        std::cout << (failedFlag() ? "FAIL " : "PASS ") << test.name << std::endl;
        if (failedFlag()) failures++;
    }
    std::cout << "\n" << (failures ? std::to_string(failures) + " test(s) failing" : std::string("All green")) << std::endl;
    return failures ? 1 : 0;
}

}  // namespace minitest

#define TEST(suite, name)                                                                  \
    static void suite##_##name();                                                          \
    static ::minitest::Registrar registrar_##suite##_##name(#suite "." #name, suite##_##name); \
    static void suite##_##name()

#define EXPECT_TRUE(cond)                                                          \
    do {                                                                           \
        if (!(cond)) ::minitest::report(__FILE__, __LINE__, "expected true: " #cond); \
    } while (0)
#define EXPECT_FALSE(cond)                                                          \
    do {                                                                            \
        if (cond) ::minitest::report(__FILE__, __LINE__, "expected false: " #cond); \
    } while (0)
#define EXPECT_EQ(a, b) ::minitest::expectEq((a), (b), #a, #b, __FILE__, __LINE__)
