#include <iostream>
#include <functional>
#include "service.hpp"
using namespace std;

int fails = 0;
// Each test is isolated: an uncaught exception counts as FAIL, not a crash.
void T(const string& name, function<bool()> f) {
    bool ok = false;
    try { ok = f(); } catch (...) { ok = false; }
    cout << (ok ? "PASS " : "FAIL ") << name << endl;
    if (!ok) fails++;
}
template <class E = std::exception> bool throws(function<void()> f) { try { f(); } catch (const E&) { return true; } catch (...) {} return false; }
const long long H = 3600;
static void advance(TicketService& svc, int id, initializer_list<Status> path) { for (auto s : path) svc.transition(id, s); }

int main() {
    T("create_assigns_sequential_ids", [] {
        TicketStore s; TicketService svc(s);
        int a = svc.create("login broken", Priority::HIGH, 0), b = svc.create("typo", Priority::LOW, 10);
        return a == 1 && b == 2; });

    T("empty_title_rejected_and_id_not_consumed", [] {
        TicketStore s; TicketService svc(s);
        bool t = throws([&] { svc.create("", Priority::LOW, 0); });
        return t && svc.create("ok", Priority::LOW, 0) == 1; });

    T("assign_persists", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        svc.assign(id, "priya");
        return svc.get(id).assignee == "priya"; });

    T("assign_closed_rejected", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        advance(svc, id, {Status::IN_PROGRESS, Status::RESOLVED, Status::CLOSED});
        return throws([&] { svc.assign(id, "bob"); }); });

    T("valid_workflow_path", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        advance(svc, id, {Status::IN_PROGRESS, Status::RESOLVED, Status::CLOSED});
        return svc.get(id).status == Status::CLOSED; });

    T("open_cannot_jump_to_resolved", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        return throws([&] { svc.transition(id, Status::RESOLVED); }); });

    T("transition_unknown_ticket_throws", [] {
        TicketStore s; TicketService svc(s);
        return throws<out_of_range>([&] { svc.transition(999, Status::IN_PROGRESS); }); });

    T("resolved_can_be_reopened", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        advance(svc, id, {Status::IN_PROGRESS, Status::RESOLVED, Status::IN_PROGRESS});
        return svc.get(id).status == Status::IN_PROGRESS; });

    T("closed_is_terminal", [] {
        TicketStore s; TicketService svc(s);
        int id = svc.create("x", Priority::LOW, 0);
        advance(svc, id, {Status::IN_PROGRESS, Status::RESOLVED, Status::CLOSED});
        return throws([&] { svc.transition(id, Status::OPEN); }); });

    T("list_order_priority_desc_then_oldest", [] {
        TicketStore s; TicketService svc(s);
        svc.create("a", Priority::LOW, 1); svc.create("b", Priority::CRITICAL, 2);
        svc.create("c", Priority::HIGH, 3); svc.create("d", Priority::CRITICAL, 4);
        auto v = svc.list(false, Status::OPEN, 1, 10);
        return v.size() == 4 && v[0].id == 2 && v[1].id == 4 && v[2].id == 3 && v[3].id == 1; });

    T("pagination_page1_returns_first_items", [] {
        TicketStore s; TicketService svc(s);
        for (int i = 0; i < 5; i++) svc.create("t", Priority::MEDIUM, i);
        auto p = svc.list(false, Status::OPEN, 1, 2);
        return p.size() == 2 && p[0].id == 1 && p[1].id == 2; });

    T("pagination_last_page_partial", [] {
        TicketStore s; TicketService svc(s);
        for (int i = 0; i < 5; i++) svc.create("t", Priority::MEDIUM, i);
        auto p = svc.list(false, Status::OPEN, 3, 2);
        return p.size() == 1 && p[0].id == 5; });

    T("sla_counts_open_breach", [] {
        TicketStore s; TicketService svc(s);
        svc.create("high", Priority::HIGH, 0); svc.create("med", Priority::MEDIUM, 0);
        return svc.countSlaBreaches(25 * H) == 1; });

    T("sla_ignores_resolved_tickets", [] {
        TicketStore s; TicketService svc(s);
        int h = svc.create("high", Priority::HIGH, 0); svc.create("med", Priority::MEDIUM, 0);
        advance(svc, h, {Status::IN_PROGRESS, Status::RESOLVED});
        return svc.countSlaBreaches(25 * H) == 0; });

    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
