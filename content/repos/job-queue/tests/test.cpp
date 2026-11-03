#include <functional>
#include <iostream>
#include "queue.hpp"
using namespace std;

int fails = 0;
// Each test is isolated: an uncaught exception counts as FAIL, not a crash.
void T(const string& name, function<bool()> f) {
    bool ok = false;
    try { ok = f(); } catch (...) { ok = false; }
    cout << (ok ? "PASS " : "FAIL ") << name << endl;
    if (!ok) fails++;
}

int main() {
    T("enqueue_returns_incrementing_ids", [] {
        JobQueue q;
        return q.enqueue("a", 0) == 1 && q.enqueue("b", 0) == 2; });

    T("lease_returns_job_with_smallest_run_at_then_id", [] {
        JobQueue q; Job j;
        q.enqueue("late", 100); q.enqueue("early", 50); q.enqueue("early2", 50);
        bool ok = q.lease(200, 1000, j);
        return ok && j.payload == "early"; });

    T("lease_on_empty_queue_returns_false", [] {
        JobQueue q; Job j;
        return !q.lease(0, 1000, j); });

    T("lease_skips_jobs_scheduled_in_the_future", [] {
        JobQueue q; Job j;
        q.enqueue("later", 5000);
        return !q.lease(0, 1000, j); });

    T("running_job_is_not_leased_twice", [] {
        JobQueue q; Job j;
        q.enqueue("a", 0);
        bool first = q.lease(0, 1000, j);
        return first && !q.lease(1, 1000, j); });

    T("ack_marks_job_done", [] {
        JobQueue q; Job j;
        int id = q.enqueue("a", 0);
        q.lease(0, 1000, j);
        return q.ack(id) && q.get(id).status == JobStatus::DONE; });

    T("backoff_doubles_with_each_attempt", [] {
        JobQueue q(1000, 60000); Job j;
        int id = q.enqueue("a", 0, 5);
        q.lease(0, 1000, j);
        q.fail(id, 0);
        long long first = q.get(id).runAt;
        q.lease(first, 1000, j);
        q.fail(id, first);
        long long second = q.get(id).runAt - first;
        return first == 1000 && second == 2000; });

    T("backoff_is_capped_at_max", [] {
        JobQueue q(1000, 8000);
        return q.backoff(5) == 8000 && q.backoff(10) == 8000 && q.backoff(3) == 4000; });

    T("job_dies_after_max_attempts", [] {
        JobQueue q(1000, 60000); Job j;
        int id = q.enqueue("a", 0, 2);
        q.lease(0, 1000, j); q.fail(id, 0);
        bool stillReady = q.get(id).status == JobStatus::READY;
        q.lease(100000, 1000, j); q.fail(id, 100000);
        return stillReady && q.get(id).status == JobStatus::DEAD; });

    T("ack_after_lease_expired_and_reclaimed_is_rejected", [] {
        JobQueue q; Job j;
        int id = q.enqueue("a", 0);
        q.lease(0, 1000, j);
        q.reclaimExpired(5000);
        bool acked = q.ack(id);
        return !acked && q.get(id).status == JobStatus::READY; });

    T("lease_expires_exactly_at_deadline", [] {
        JobQueue q; Job j;
        q.enqueue("a", 0);
        q.lease(0, 1000, j);
        return q.reclaimExpired(1000) == 1; });

    T("reclaim_counts_an_attempt_and_schedules_retry", [] {
        JobQueue q(1000, 60000); Job j;
        int id = q.enqueue("a", 0);
        q.lease(0, 1000, j);
        q.reclaimExpired(5000);
        return q.get(id).attempts == 1 && q.get(id).status == JobStatus::READY; });

    cout << (fails ? "\n" + to_string(fails) + " test(s) failing" : "\nAll green") << endl;
    return fails ? 1 : 0;
}
