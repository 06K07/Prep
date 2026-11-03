#pragma once

class PaymentGateway {
public:
    virtual ~PaymentGateway() = default;
    virtual bool charge(long long cents) = 0;
};

// Test double: can be told to fail and records what it charged.
class FakeGateway : public PaymentGateway {
public:
    bool shouldFail = false;
    long long charged = 0;
    int calls = 0;

    bool charge(long long cents) override {
        calls++;
        if (shouldFail) return false;
        charged += cents;
        return true;
    }
};
