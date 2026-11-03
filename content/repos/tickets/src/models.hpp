#pragma once
#include <string>

enum class Status { OPEN, IN_PROGRESS, RESOLVED, CLOSED };
enum class Priority { LOW = 1, MEDIUM = 2, HIGH = 3, CRITICAL = 4 };

struct Ticket {
    int id = 0;
    std::string title;
    Status status = Status::OPEN;
    Priority priority = Priority::MEDIUM;
    std::string assignee;
    long long createdAt = 0;   // seconds
};
