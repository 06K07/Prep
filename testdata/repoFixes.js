'use strict';

/**
 * Known-good fixes for every bundled repo: [file, from, to].
 * Proves each repo is solvable and that its metadata (failing test counts) is honest.
 */
const FIXES = {
  tickets: [
    [
      'src/service.hpp',
      'int id = store.nextIdValue();\n        if (title.empty()) throw std::invalid_argument("title required");',
      'if (title.empty()) throw std::invalid_argument("title required");\n        int id = store.nextIdValue();',
    ],
    ['src/service.hpp', 't.assignee = user;', 't.assignee = user;\n        store.put(t);'],
    ['src/service.hpp', 'return a.priority < b.priority;', 'return a.priority > b.priority;'],
    ['src/service.hpp', '(size_t)page * pageSize', '(size_t)(page - 1) * pageSize'],
    [
      'src/service.hpp',
      'if (now - t.createdAt > slaSeconds(t.priority)) n++;',
      'if ((t.status == Status::OPEN || t.status == Status::IN_PROGRESS) &&\n                now - t.createdAt > slaSeconds(t.priority)) n++;',
    ],
    [
      'src/workflow.hpp',
      'return to == Status::CLOSED;',
      'return to == Status::CLOSED || to == Status::IN_PROGRESS;',
    ],
    [
      'src/workflow.hpp',
      'case Status::CLOSED:      return true;',
      'case Status::CLOSED:      return false;',
    ],
  ],

  wallet: [
    [
      'service.hpp',
      'bal[id] = amt;',
      'if (bal.count(id)) throw std::invalid_argument("duplicate");\n        bal[id] = amt;',
    ],
    [
      'service.hpp',
      `        if (amt < 0) return {false, "invalid_amount"};
        if (bal[from] <= amt) return {false, "insufficient_funds"};
        bal[from] -= amt;
        bal[to] += amt;
        return {true, ""};`,
      `        Result r{true, ""};
        if (amt <= 0) r = {false, "invalid_amount"};
        else if (!bal.count(from) || !bal.count(to)) r = {false, "no_account"};
        else if (bal[from] < amt) r = {false, "insufficient_funds"};
        else { bal[from] -= amt; bal[to] += amt; }
        seen[key] = r;
        return r;`,
    ],
  ],

  'rate-limiter': [
    [
      'src/token_bucket.hpp',
      'long long elapsedSec = (now - lastMs) / 1000;\n        tokens = tokens + elapsedSec * refillPerSec;',
      'double elapsedSec = (now - lastMs) / 1000.0;\n        tokens = std::min(capacity, tokens + elapsedSec * refillPerSec);',
    ],
    [
      'src/token_bucket.hpp',
      'return (long long)((cost - tokens) / refillPerSec);',
      'return (long long)std::ceil((cost - tokens) / refillPerSec * 1000.0);',
    ],
    ['src/sliding_window.hpp', 'now - hits.front() > windowMs', 'now - hits.front() >= windowMs'],
    ['src/sliding_window.hpp', '(int)hits.size() > limit', '(int)hits.size() >= limit'],
    [
      'src/limiter.hpp',
      'clock.now() - it->second.lastSeen() < idleMs',
      'clock.now() - it->second.lastSeen() > idleMs',
    ],
  ],

  'order-service': [
    [
      'src/inventory.hpp',
      `        for (const auto& l : lines) {
            if (stock[l.sku] < l.qty) return false;
            stock[l.sku] -= l.qty;
        }
        return true;`,
      `        for (const auto& l : lines)
            if (stockOf(l.sku) < l.qty) return false;
        for (const auto& l : lines) stock[l.sku] -= l.qty;
        return true;`,
    ],
    ['src/service.hpp', 'int total = 0;', 'long long total = 0;'],
    ['src/service.hpp', 'if (total > DISCOUNT_THRESHOLD)', 'if (total >= DISCOUNT_THRESHOLD)'],
    ['src/service.hpp', 'if (l.qty == 0) throw', 'if (l.qty <= 0) throw'],
    [
      'src/service.hpp',
      'o.status = OrderStatus::FAILED;',
      'o.status = OrderStatus::FAILED;\n            inventory.release(lines);',
    ],
    [
      'src/service.hpp',
      '        inventory.release(it->second.lines);',
      '        if (it->second.status != OrderStatus::PAID) return false;\n        inventory.release(it->second.lines);',
    ],
  ],
  'job-queue': [
    [
      'src/queue.hpp',
      'if (j.status != JobStatus::READY) continue;',
      'if (j.status != JobStatus::READY || j.runAt > now) continue;',
    ],
    [
      'src/queue.hpp',
      `        Job& j = jobs.at(id);
        j.status = JobStatus::DONE;
        return true;`,
      `        Job& j = jobs.at(id);
        if (j.status != JobStatus::RUNNING) return false;
        j.status = JobStatus::DONE;
        return true;`,
    ],
    ['src/queue.hpp', 'j.attempts > j.maxAttempts', 'j.attempts >= j.maxAttempts'],
    [
      'src/queue.hpp',
      `        long long delay = baseBackoffMs << attempts;
        return delay;`,
      `        long long delay = baseBackoffMs << (attempts - 1);
        return std::min(delay, maxBackoffMs);`,
    ],
    ['src/queue.hpp', 'j.leaseUntil < now', 'j.leaseUntil <= now'],
  ],

  'lru-cache': [
    [
      'src/lru.hpp',
      `        if (found == index.end()) return nullptr;
        return &found->second->value;`,
      `        if (found == index.end()) return nullptr;
        items.splice(items.begin(), items, found->second);
        return &found->second->value;`,
    ],
    [
      'src/lru.hpp',
      `        if (items.size() >= capacity) evictOldest();
        auto found = index.find(key);
        if (found != index.end()) {
            found->second->value = std::move(value);
            return;
        }`,
      `        auto found = index.find(key);
        if (found != index.end()) {
            found->second->value = std::move(value);
            items.splice(items.begin(), items, found->second);
            return;
        }
        if (items.size() >= capacity) evictOldest();`,
    ],
    [
      'src/ttl_cache.hpp',
      'if (clock.now() > s->expiresAt) {',
      'if (clock.now() >= s->expiresAt) {',
    ],
    [
      'src/ttl_cache.hpp',
      'size_t size() { return lru.size(); }',
      `size_t size() {
        lru.eraseIf([&](const K&, const Stamped& s) { return clock.now() >= s.expiresAt; });
        return lru.size();
    }`,
    ],
    [
      'src/cached_loader.hpp',
      'cache.put(key, value);',
      'cache.put(key, value, value ? -1 : negativeTtlMs);',
    ],
  ],
  'url-shortener': [
    [
      'src/base62.cpp',
      `        n /= 62;
    }
    return out;`,
      `        n /= 62;
    }
    std::reverse(out.begin(), out.end());
    return out;`,
    ],
    [
      'src/base62.cpp',
      '        value = value * 62 + pos;',
      `        if (pos == std::string::npos) return std::nullopt;
        value = value * 62 + pos;`,
    ],
    ['src/validator.cpp', 'url.size() >= kMaxUrlLength', 'url.size() > kMaxUrlLength'],
    [
      'src/validator.cpp',
      `    if (url.rfind("http", 0) != 0) return false;
    auto sep = url.find("://");
    if (sep == std::string::npos) return false;`,
      `    auto sep = url.find("://");
    if (sep == std::string::npos) return false;
    std::string scheme = url.substr(0, sep);
    std::transform(scheme.begin(), scheme.end(), scheme.begin(), [](unsigned char c) { return std::tolower(c); });
    if (scheme != "http" && scheme != "https") return false;`,
    ],
    [
      'src/validator.cpp',
      `    std::string out = url;
    std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) { return std::tolower(c); });
    if (out.size() > 1 && out.back() == '/') out.pop_back();
    return out;`,
      `    auto sep = url.find("://");
    if (sep == std::string::npos) return url;
    auto hostEnd = url.find_first_of("/?#", sep + 3);
    std::string head = url.substr(0, hostEnd == std::string::npos ? url.size() : hostEnd);
    std::string tail = hostEnd == std::string::npos ? "" : url.substr(hostEnd);
    std::transform(head.begin(), head.end(), head.begin(), [](unsigned char c) { return std::tolower(c); });
    if (tail == "/") tail.clear();
    return head + tail;`,
    ],
    [
      'src/store.cpp',
      '    byCode[record.code] = record;',
      '    if (!byCode.emplace(record.code, record).second) return false;',
    ],
    [
      'src/store.cpp',
      `    Record rec = it->second;
    rec.hits++;`,
      '    it->second.hits++;',
    ],
    ['src/service.cpp', 'std::string key = url;', 'std::string key = normalizeUrl(url);'],
    ['src/service.cpp', 'now > record->expiresAt', 'now >= record->expiresAt'],
    [
      'src/service.cpp',
      '    if (!validAlias(alias)) return {false, "", "invalid_alias"};',
      `    if (!validAlias(alias)) return {false, "", "invalid_alias"};
    if (isReservedAlias(alias)) return {false, "", "alias_reserved"};`,
    ],
    [
      'src/service.cpp',
      `    store.put(record);
    return {true, alias, ""};`,
      `    if (!store.put(record)) return {false, "", "alias_taken"};
    return {true, alias, ""};`,
    ],
  ],
};

/** Applies a repo's fixes to a files map. Throws if a fix no longer matches (repo drifted). */
function applyFixes(repoId, files) {
  const fixed = { ...files };
  for (const [file, from, to] of FIXES[repoId]) {
    if (!fixed[file] || !fixed[file].includes(from)) {
      throw new Error(`fix for ${repoId}/${file} no longer matches: ${from.slice(0, 50)}`);
    }
    fixed[file] = fixed[file].replace(from, () => to);
  }
  return fixed;
}

module.exports = { FIXES, applyFixes };
