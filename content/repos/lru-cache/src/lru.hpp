#pragma once
#include <cstddef>
#include <list>
#include <unordered_map>
#include <utility>

template <class K, class V>
class LruCache {
    struct Entry {
        K key;
        V value;
    };
    size_t capacity;
    std::list<Entry> items;  // front = most recently used
    std::unordered_map<K, typename std::list<Entry>::iterator> index;

    void evictOldest() {
        index.erase(items.back().key);
        items.pop_back();
    }

public:
    explicit LruCache(size_t cap) : capacity(cap) {}

    V* get(const K& key) {
        auto found = index.find(key);
        if (found == index.end()) return nullptr;
        return &found->second->value;
    }

    void put(const K& key, V value) {
        if (capacity == 0) return;
        if (items.size() >= capacity) evictOldest();
        auto found = index.find(key);
        if (found != index.end()) {
            found->second->value = std::move(value);
            return;
        }
        items.push_front(Entry{key, std::move(value)});
        index[key] = items.begin();
    }

    bool erase(const K& key) {
        auto found = index.find(key);
        if (found == index.end()) return false;
        items.erase(found->second);
        index.erase(found);
        return true;
    }

    template <class Pred>
    size_t eraseIf(Pred pred) {
        size_t removed = 0;
        for (auto it = items.begin(); it != items.end();) {
            if (pred(it->key, it->value)) {
                index.erase(it->key);
                it = items.erase(it);
                removed++;
            } else {
                ++it;
            }
        }
        return removed;
    }

    size_t size() const { return items.size(); }
};
