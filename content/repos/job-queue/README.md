# Job Queue with Retries (pre-prod)

Background job queue: leasing, acknowledgements, retries with exponential backoff, dead jobs.

Layers: tests/test.cpp -> src/queue.hpp -> src/job.hpp

Rules:
- `lease(now, visibilityMs)` returns the READY job with the smallest (runAt, id) where
  `runAt <= now`, marks it RUNNING with `leaseUntil = now + visibilityMs`.
- `ack(id)` is only valid for a RUNNING job (returns true and marks DONE). Otherwise it returns false
  and changes nothing (for example, the lease already expired and the job was reclaimed).
- `fail(id, now)` counts an attempt. When `attempts >= maxAttempts` the job becomes DEAD, otherwise it is
  READY again with `runAt = now + backoff(attempts)`.
- `backoff(n) = baseBackoffMs * 2^(n-1)`, never more than `maxBackoffMs`.
- `reclaimExpired(now)` fails every RUNNING job whose `leaseUntil <= now` and returns how many.

Task: run run.sh and make all tests pass without editing tests/.
