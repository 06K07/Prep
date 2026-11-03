# Order Service (pre-prod)

Checkout backend: inventory reservation, pricing, payment, cancellation.

Layers: tests/test.cpp -> src/service.hpp -> src/inventory.hpp + src/payment.hpp -> src/models.hpp

Rules:
- All prices are integer cents (`long long`). Totals can exceed 32-bit range.
- Reserving stock is all-or-nothing: if any line cannot be fulfilled nothing is reserved.
- Quantities must be positive. Empty orders and unknown SKUs are rejected.
- Orders with a total of 100000 cents (1000.00) or more get 10% off (`total - total / 10`).
- If the payment fails the order is marked FAILED and the reserved stock is released.
- Only a PAID order can be cancelled; cancelling restocks it exactly once.

Task: run run.sh and make all tests pass without editing tests/.
