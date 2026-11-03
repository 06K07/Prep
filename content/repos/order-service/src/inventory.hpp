#pragma once
#include <map>
#include <stdexcept>
#include <string>
#include <vector>
#include "models.hpp"

class Inventory {
    std::map<std::string, int> stock;
    std::map<std::string, long long> priceCents;

public:
    void add(const std::string& sku, int qty, long long price) {
        stock[sku] += qty;
        priceCents[sku] = price;
    }

    int stockOf(const std::string& sku) const {
        auto it = stock.find(sku);
        return it == stock.end() ? 0 : it->second;
    }

    long long priceOf(const std::string& sku) const {
        auto it = priceCents.find(sku);
        if (it == priceCents.end()) throw std::invalid_argument("unknown sku");
        return it->second;
    }

    bool reserve(const std::vector<OrderLine>& lines) {
        for (const auto& l : lines) {
            if (stock[l.sku] < l.qty) return false;
            stock[l.sku] -= l.qty;
        }
        return true;
    }

    void release(const std::vector<OrderLine>& lines) {
        for (const auto& l : lines) stock[l.sku] += l.qty;
    }
};
