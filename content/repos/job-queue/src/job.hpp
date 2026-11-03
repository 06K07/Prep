#pragma once
#include <string>

enum class JobStatus { READY, RUNNING, DONE, DEAD };

struct Job {
    int id = 0;
    std::string payload;
    JobStatus status = JobStatus::READY;
    int attempts = 0;
    int maxAttempts = 3;
    long long runAt = 0;
    long long leaseUntil = 0;
};
