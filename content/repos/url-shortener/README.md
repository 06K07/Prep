# URL Shortener (C++ / CMake, pre-prod)

A small link-shortening backend, built as a CMake project: a static library plus a test executable.

    CMakeLists.txt
    include/shortener/   public headers
    src/                 implementation (library "shortener")
    tests/               test executable "shortener_tests" (also registered with ctest)
    build/               out-of-source build directory (created by run.sh)

Layers: tests -> service -> (validator, base62, store)

Build and run the tests the way you would locally:

    cmake -S . -B build && cmake --build build && ./build/shortener_tests
    ctest --test-dir build --output-on-failure      # same tests through ctest

(run.sh does the first command for you.) New .cpp files must be listed in CMakeLists.txt.

Rules
- Base62 uses the alphabet 0-9, a-z, A-Z (so 61 -> "Z", 62 -> "10"). Decoding rejects empty input and any
  character outside the alphabet.
- A URL is valid when it has no whitespace, is at most 2048 characters (2048 is allowed), uses the scheme
  http or https (any letter case), and has a non-empty host.
- Normalisation lowercases ONLY the scheme and host. The path, query and fragment keep their case. A path
  that is just "/" is dropped ("http://a.com/" -> "http://a.com"); any other trailing slash is kept.
- shorten(): the same normalised URL always returns the same code. Codes are base62 of an increasing id.
- shortenWithAlias(): alias is 3-20 characters of [A-Za-z0-9_-], not a reserved word (api, admin, static,
  health; case-insensitive) and not already taken. A taken alias fails with "alias_taken" and the original
  link keeps working.
- resolve(): a link with ttl expires exactly at `createdAt + ttl` (not valid at that instant). Every
  successful resolve counts as one hit.

Task: run run.sh and make all tests pass without editing tests/.
