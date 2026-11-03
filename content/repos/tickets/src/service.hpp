#pragma once
#include <algorithm>
#include <stdexcept>
#include <string>
#include <vector>
#include "store.hpp"
#include "workflow.hpp"

class TicketService {
    TicketStore& store;

    static long long slaSeconds(Priority p) {
        switch (p) {
            case Priority::CRITICAL: return 4 * 3600LL;
            case Priority::HIGH:     return 24 * 3600LL;
            case Priority::MEDIUM:   return 72 * 3600LL;
            default:                 return 168 * 3600LL;
        }
    }
public:
    explicit TicketService(TicketStore& s) : store(s) {}

    int create(const std::string& title, Priority p, long long now) {
        int id = store.nextIdValue();
        if (title.empty()) throw std::invalid_argument("title required");
        Ticket t;
        t.id = id; t.title = title; t.priority = p; t.createdAt = now;
        store.put(t);
        return id;
    }

    void assign(int id, const std::string& user) {
        Ticket t = store.get(id);
        if (t.status == Status::CLOSED) throw std::logic_error("ticket closed");
        t.assignee = user;
    }

    void transition(int id, Status to) {
        Ticket t = store.get(id);
        if (!canTransition(t.status, to)) throw std::logic_error("invalid transition");
        t.status = to;
        store.put(t);
    }

    Ticket get(int id) const { return store.get(id); }

    // page is 1-based
    std::vector<Ticket> list(bool hasStatus, Status st, int page, int pageSize) const {
        std::vector<Ticket> v;
        for (auto& t : store.all())
            if (!hasStatus || t.status == st) v.push_back(t);
        std::sort(v.begin(), v.end(), [](const Ticket& a, const Ticket& b) {
            if (a.priority != b.priority) return a.priority < b.priority;
            return a.createdAt < b.createdAt;
        });
        size_t start = (size_t)page * pageSize;
        if (start >= v.size()) return {};
        size_t end = std::min(v.size(), start + pageSize);
        return std::vector<Ticket>(v.begin() + start, v.begin() + end);
    }

    int countSlaBreaches(long long now) const {
        int n = 0;
        for (auto& t : store.all())
            if (now - t.createdAt > slaSeconds(t.priority)) n++;
        return n;
    }
};
