#pragma once
#include <algorithm>
#include <map>
#include <stdexcept>
#include <string>
#include "job.hpp"

class JobQueue {
    std::map<int, Job> jobs;
    int nextId = 1;
    long long baseBackoffMs;
    long long maxBackoffMs;

public:
    explicit JobQueue(long long base = 1000, long long maxBackoff = 60000)
        : baseBackoffMs(base), maxBackoffMs(maxBackoff) {}

    int enqueue(const std::string& payload, long long runAt, int maxAttempts = 3) {
        Job j;
        j.id = nextId++;
        j.payload = payload;
        j.runAt = runAt;
        j.maxAttempts = maxAttempts;
        jobs[j.id] = j;
        return j.id;
    }

    long long backoff(int attempts) const {
        long long delay = baseBackoffMs << attempts;
        return delay;
    }

    bool lease(long long now, long long visibilityMs, Job& out) {
        Job* best = nullptr;
        for (auto& kv : jobs) {
            Job& j = kv.second;
            if (j.status != JobStatus::READY) continue;
            if (!best || j.runAt < best->runAt) best = &j;
        }
        if (!best) return false;
        best->status = JobStatus::RUNNING;
        best->leaseUntil = now + visibilityMs;
        out = *best;
        return true;
    }

    bool ack(int id) {
        Job& j = jobs.at(id);
        j.status = JobStatus::DONE;
        return true;
    }

    void fail(int id, long long now) {
        Job& j = jobs.at(id);
        j.attempts++;
        if (j.attempts > j.maxAttempts) {
            j.status = JobStatus::DEAD;
        } else {
            j.status = JobStatus::READY;
            j.runAt = now + backoff(j.attempts);
        }
    }

    int reclaimExpired(long long now) {
        int reclaimed = 0;
        for (auto& kv : jobs) {
            Job& j = kv.second;
            if (j.status == JobStatus::RUNNING && j.leaseUntil < now) {
                fail(j.id, now);
                reclaimed++;
            }
        }
        return reclaimed;
    }

    const Job& get(int id) const { return jobs.at(id); }
};
