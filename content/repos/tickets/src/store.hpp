#pragma once
#include <map>
#include <vector>
#include <stdexcept>
#include "models.hpp"

// In-memory storage layer. Returns copies, callers must put() changes back.
class TicketStore {
    std::map<int, Ticket> data;
    int nextId = 1;
public:
    int nextIdValue() { return nextId++; }
    void put(const Ticket& t) { data[t.id] = t; }
    Ticket get(int id) const {
        auto it = data.find(id);
        if (it == data.end()) throw std::out_of_range("ticket not found");
        return it->second;
    }
    std::vector<Ticket> all() const {
        std::vector<Ticket> v;
        for (auto& kv : data) v.push_back(kv.second);
        return v;
    }
};
