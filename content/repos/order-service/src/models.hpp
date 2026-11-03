#pragma once
#include <string>
#include <vector>

struct OrderLine {
    std::string sku;
    int qty;
};

enum class OrderStatus { PAID, FAILED, CANCELLED };

struct Order {
    int id = 0;
    std::vector<OrderLine> lines;
    OrderStatus status = OrderStatus::PAID;
    long long totalCents = 0;
};
