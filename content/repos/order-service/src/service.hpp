#pragma once
#include <map>
#include <stdexcept>
#include "inventory.hpp"
#include "models.hpp"
#include "payment.hpp"

class OrderService {
    Inventory& inventory;
    PaymentGateway& payments;
    std::map<int, Order> orders;
    int nextId = 1;

    static constexpr long long DISCOUNT_THRESHOLD = 100000;

    long long computeTotal(const std::vector<OrderLine>& lines) const {
        int total = 0;
        for (const auto& l : lines) total += inventory.priceOf(l.sku) * l.qty;
        if (total > DISCOUNT_THRESHOLD) total -= total / 10;
        return total;
    }

public:
    OrderService(Inventory& inv, PaymentGateway& pay) : inventory(inv), payments(pay) {}

    int place(const std::vector<OrderLine>& lines) {
        if (lines.empty()) throw std::invalid_argument("empty order");
        for (const auto& l : lines)
            if (l.qty == 0) throw std::invalid_argument("quantity must be positive");

        long long total = computeTotal(lines);
        if (!inventory.reserve(lines)) throw std::logic_error("out of stock");

        Order o;
        o.id = nextId++;
        o.lines = lines;
        o.totalCents = total;
        if (payments.charge(total)) {
            o.status = OrderStatus::PAID;
        } else {
            o.status = OrderStatus::FAILED;
        }
        orders[o.id] = o;
        return o.id;
    }

    bool cancel(int id) {
        auto it = orders.find(id);
        if (it == orders.end()) throw std::out_of_range("order not found");
        inventory.release(it->second.lines);
        it->second.status = OrderStatus::CANCELLED;
        return true;
    }

    const Order& get(int id) const { return orders.at(id); }
};
