# API Rate Limiter (pre-prod)

Rate limiting layer for a public API. Two algorithms plus a per-key registry.

Layers: tests/test.cpp -> src/limiter.hpp -> src/token_bucket.hpp / src/sliding_window.hpp -> src/clock.hpp

Rules:
- Token bucket: holds at most `capacity` tokens, refills continuously at `refillPerSec`
  (fractions of a second count), and starts full. A request costs `cost` tokens.
- retryAfterMs: milliseconds (rounded up) until `cost` tokens are available, 0 if already available.
- Sliding window: at most `limit` hits in the window (now - windowMs, now]. A hit made exactly
  `windowMs` ago no longer counts.
- evictIdle(idleMs): removes keys that have not been touched for MORE than idleMs.

Task: run run.sh and make all tests pass without editing tests/.
