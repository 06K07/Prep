#include <iostream>
#include "service.hpp"
using namespace std;
int fails = 0;
#define CHECK(name, cond) do { bool ok_ = (cond); cout << (ok_ ? "PASS " : "FAIL ") << name << endl; if(!ok_) fails++; } while(0)

int main() {
    { WalletService w; w.open("a", 100); w.open("b", 0);
      auto r = w.transfer("k1", "a", "b", 40);
      CHECK("basic_transfer", r.ok && w.balance("a") == 60 && w.balance("b") == 40); }
    { WalletService w; w.open("a", 100); w.open("b", 0);
      w.transfer("k1", "a", "b", 30); w.transfer("k1", "a", "b", 30);
      CHECK("idempotent_retry_no_double_debit", w.balance("a") == 70); }
    { WalletService w; w.open("a", 50); w.open("b", 0);
      auto r = w.transfer("k1", "a", "b", 50);
      CHECK("transfer_full_balance_allowed", r.ok && w.balance("a") == 0); }
    { WalletService w; w.open("a", 50); w.open("b", 0);
      auto r = w.transfer("k1", "a", "b", 0);
      CHECK("zero_amount_rejected", !r.ok); }
    { WalletService w; w.open("a", 50);
      auto r = w.transfer("k1", "a", "ghost", 10);
      CHECK("unknown_destination_rejected", !r.ok && w.balance("a") == 50); }
    { WalletService w; w.open("a", 50);
      bool threw = false;
      try { w.open("a", 999); } catch (...) { threw = true; }
      CHECK("duplicate_open_rejected", threw && w.balance("a") == 50); }
    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
