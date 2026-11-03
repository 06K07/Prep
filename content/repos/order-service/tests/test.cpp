#include <functional>
#include <iostream>
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
template <class E = std::exception> bool throws(function<void()> f) {
    try { f(); } catch (const E&) { return true; } catch (...) {}
    return false;
}

int main() {
    T("place_order_reduces_stock_and_charges", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 10, 250);
        int id = svc.place({{"pen", 4}});
        return inv.stockOf("pen") == 6 && pay.charged == 1000 && svc.get(id).status == OrderStatus::PAID; });

    T("unknown_sku_rejected", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        return throws([&] { svc.place({{"ghost", 1}}); }); });

    T("empty_order_rejected", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        return throws([&] { svc.place({}); }); });

    T("out_of_stock_rejected_without_charge", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 2, 100);
        bool t = throws([&] { svc.place({{"pen", 3}}); });
        return t && pay.calls == 0 && inv.stockOf("pen") == 2; });

    T("reserve_is_all_or_nothing", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 5, 100); inv.add("ink", 1, 100);
        bool t = throws([&] { svc.place({{"pen", 2}, {"ink", 3}}); });
        return t && inv.stockOf("pen") == 5 && inv.stockOf("ink") == 1; });

    T("negative_quantity_rejected", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 5, 100);
        bool t = throws([&] { svc.place({{"pen", -3}}); });
        return t && inv.stockOf("pen") == 5; });

    T("large_total_does_not_overflow", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("yacht", 5, 2000000000LL);
        int id = svc.place({{"yacht", 2}});
        return svc.get(id).totalCents == 4000000000LL - 400000000LL; });

    T("discount_applies_at_exactly_the_threshold", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("tv", 3, 100000);
        int id = svc.place({{"tv", 1}});
        return svc.get(id).totalCents == 90000 && pay.charged == 90000; });

    T("no_discount_below_threshold", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("tv", 3, 99999);
        int id = svc.place({{"tv", 1}});
        return svc.get(id).totalCents == 99999; });

    T("payment_failure_marks_failed_and_releases_stock", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 10, 100);
        pay.shouldFail = true;
        int id = svc.place({{"pen", 4}});
        return svc.get(id).status == OrderStatus::FAILED && inv.stockOf("pen") == 10; });

    T("cancel_restocks_a_paid_order", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 10, 100);
        int id = svc.place({{"pen", 4}});
        bool ok = svc.cancel(id);
        return ok && inv.stockOf("pen") == 10 && svc.get(id).status == OrderStatus::CANCELLED; });

    T("cancel_twice_does_not_double_restock", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 10, 100);
        int id = svc.place({{"pen", 4}});
        svc.cancel(id);
        bool second = false;
        try { second = svc.cancel(id); } catch (...) { second = false; }
        return !second && inv.stockOf("pen") == 10; });

    T("failed_order_cannot_be_cancelled", [] {
        Inventory inv; FakeGateway pay; OrderService svc(inv, pay);
        inv.add("pen", 10, 100);
        pay.shouldFail = true;
        int id = svc.place({{"pen", 4}});
        try { svc.cancel(id); } catch (...) {}
        return inv.stockOf("pen") == 10; });

    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
