#pragma once
#include <map>
#include <string>
#include <stdexcept>

struct Result { bool ok; std::string err; };

// Wallet service: accounts, idempotent transfers.
class WalletService {
    std::map<std::string, long long> bal;
    std::map<std::string, Result> seen;   // idempotency key -> result
public:
    void open(const std::string& id, long long amt) {
        if (amt < 0) throw std::invalid_argument("negative");
        bal[id] = amt;
    }
    long long balance(const std::string& id) { return bal[id]; }

    Result transfer(const std::string& key, const std::string& from,
                    const std::string& to, long long amt) {
        if (seen.count(key)) return seen[key];
        if (amt < 0) return {false, "invalid_amount"};
        if (bal[from] <= amt) return {false, "insufficient_funds"};
        bal[from] -= amt;
        bal[to] += amt;
        return {true, ""};
    }
};
