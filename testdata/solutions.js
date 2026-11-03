'use strict';

const OPTIMAL = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; long long k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    unordered_map<long long, int> first;
    first[0] = -1;
    long long sum = 0;
    int best = 0;
    for (int i = 0; i < n; i++) {
        sum += a[i];
        if (first.count(sum - k)) best = max(best, i - first[sum - k]);
        if (!first.count(sum)) first[sum] = i;
    }
    cout << best << endl;
}
`;

const BRUTE_FORCE = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; long long k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    int best = 0;
    for (int i = 0; i < n; i++) {
        long long sum = 0;
        for (int j = i; j < n; j++) {
            sum += a[j];
            if (sum == k) best = max(best, j - i + 1);
        }
    }
    cout << best << endl;
}
`;

module.exports = { OPTIMAL, BRUTE_FORCE };

/** Correct C++ reference solutions, one per problem id (used to verify the judge + test data). */
const SOLUTIONS = {
  'longest-subarray-k': OPTIMAL,
  'merge-intervals': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    vector<pair<long long, long long>> v(n);
    for (auto &p : v) cin >> p.first >> p.second;
    sort(v.begin(), v.end());
    vector<pair<long long, long long>> r;
    for (auto &p : v) {
        if (!r.empty() && p.first <= r.back().second) r.back().second = max(r.back().second, p.second);
        else r.push_back(p);
    }
    for (auto &p : r) cout << p.first << " " << p.second << "\\n";
}
`,
  'number-of-islands': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int R, C; cin >> R >> C;
    vector<string> g(R);
    for (auto &s : g) cin >> s;
    int dx[] = {1, -1, 0, 0}, dy[] = {0, 0, 1, -1}, count = 0;
    for (int i = 0; i < R; i++) for (int j = 0; j < C; j++) {
        if (g[i][j] != '1') continue;
        count++;
        queue<pair<int, int>> q; q.push({i, j}); g[i][j] = '0';
        while (!q.empty()) {
            auto cur = q.front(); q.pop();
            for (int d = 0; d < 4; d++) {
                int nx = cur.first + dx[d], ny = cur.second + dy[d];
                if (nx >= 0 && ny >= 0 && nx < R && ny < C && g[nx][ny] == '1') { g[nx][ny] = '0'; q.push({nx, ny}); }
            }
        }
    }
    cout << count << endl;
}
`,
  'min-eating-speed': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; long long h; cin >> n >> h;
    vector<long long> p(n);
    for (auto &x : p) cin >> x;
    long long lo = 1, hi = *max_element(p.begin(), p.end());
    while (lo < hi) {
        long long mid = (lo + hi) / 2, t = 0;
        for (auto x : p) t += (x + mid - 1) / mid;
        if (t <= h) hi = mid; else lo = mid + 1;
    }
    cout << lo << endl;
}
`,
  'coin-change': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, amount; cin >> n >> amount;
    vector<int> coins(n);
    for (auto &c : coins) cin >> c;
    const int INF = 1e9;
    vector<int> dp(amount + 1, INF); dp[0] = 0;
    for (int a = 1; a <= amount; a++) for (int c : coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    cout << (dp[amount] >= INF ? -1 : dp[amount]) << endl;
}
`,
  'top-k-frequent': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, k; cin >> n >> k;
    map<long long, int> cnt;
    for (int i = 0; i < n; i++) { long long x; cin >> x; cnt[x]++; }
    vector<pair<int, long long>> v;
    for (auto &kv : cnt) v.push_back({-kv.second, kv.first});
    sort(v.begin(), v.end());
    for (int i = 0; i < k; i++) cout << v[i].second << (i + 1 < k ? " " : "\\n");
}
`,
};

/** Plausible-but-wrong solutions that the judge must reject (TLE / RE). */
const SLOW = {
  'min-eating-speed': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; long long h; cin >> n >> h;
    vector<long long> p(n);
    for (auto &x : p) cin >> x;
    long long mx = *max_element(p.begin(), p.end());
    for (long long k = 1; k <= mx; k++) {
        long long t = 0;
        for (auto x : p) t += (x + k - 1) / k;
        if (t <= h) { cout << k << endl; return 0; }
    }
}
`,
  'number-of-islands': `#include <bits/stdc++.h>
using namespace std;
int R, C; vector<string> g;
void dfs(int x, int y) {
    if (x < 0 || y < 0 || x >= R || y >= C || g[x][y] != '1') return;
    g[x][y] = '0';
    dfs(x + 1, y); dfs(x - 1, y); dfs(x, y + 1); dfs(x, y - 1);
}
int main() {
    cin >> R >> C; g.resize(R);
    for (auto &s : g) cin >> s;
    int count = 0;
    for (int i = 0; i < R; i++) for (int j = 0; j < C; j++) if (g[i][j] == '1') { count++; dfs(i, j); }
    cout << count << endl;
}
`,
  'coin-change': `#include <bits/stdc++.h>
using namespace std;
int n; vector<int> coins;
int solve(int a) {
    if (a == 0) return 0;
    int best = 1e9;
    for (int c : coins) if (c <= a) best = min(best, solve(a - c) + 1);
    return best;
}
int main() {
    int amount; cin >> n >> amount; coins.resize(n);
    for (auto &c : coins) cin >> c;
    int r = solve(amount);
    cout << (r >= 1e9 ? -1 : r) << endl;
}
`,
};

module.exports.SOLUTIONS = SOLUTIONS;
module.exports.SLOW = SLOW;

Object.assign(module.exports.SOLUTIONS, {
  'course-schedule': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, m; scanf("%d %d", &n, &m);
    vector<vector<int>> adj(n); vector<int> indeg(n, 0);
    for (int i = 0; i < m; i++) { int a, b; scanf("%d %d", &a, &b); adj[a].push_back(b); indeg[b]++; }
    vector<int> q; for (int i = 0; i < n; i++) if (!indeg[i]) q.push_back(i);
    for (size_t h = 0; h < q.size(); h++) for (int nx : adj[q[h]]) if (--indeg[nx] == 0) q.push_back(nx);
    puts((int)q.size() == n ? "YES" : "NO");
}
`,
  'running-median': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    priority_queue<long long> low;
    priority_queue<long long, vector<long long>, greater<long long>> high;
    for (int i = 0; i < n; i++) {
        long long x; scanf("%lld", &x);
        if (low.empty() || x <= low.top()) low.push(x); else high.push(x);
        if (low.size() > high.size() + 1) { high.push(low.top()); low.pop(); }
        else if (high.size() > low.size()) { low.push(high.top()); high.pop(); }
        printf("%lld\\n", low.top());
    }
}
`,
  'longest-substring-k-distinct': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, k; cin >> n >> k; string s; cin >> s;
    int cnt[26] = {0}, distinct = 0, left = 0, best = 0;
    for (int r = 0; r < n; r++) {
        if (cnt[s[r] - 'a']++ == 0) distinct++;
        while (distinct > k) if (--cnt[s[left++] - 'a'] == 0) distinct--;
        best = max(best, r - left + 1);
    }
    cout << best << endl;
}
`,
});

Object.assign(module.exports.SLOW, {
  'course-schedule': `#include <bits/stdc++.h>
using namespace std;
vector<vector<int>> adj; vector<int> state; bool cyc = false;
void dfs(int u) {
    state[u] = 1;
    for (int v : adj[u]) { if (state[v] == 1) cyc = true; else if (state[v] == 0) dfs(v); }
    state[u] = 2;
}
int main() {
    int n, m; scanf("%d %d", &n, &m); adj.resize(n); state.assign(n, 0);
    for (int i = 0; i < m; i++) { int a, b; scanf("%d %d", &a, &b); adj[a].push_back(b); }
    for (int i = 0; i < n; i++) if (state[i] == 0) dfs(i);
    puts(cyc ? "NO" : "YES");
}
`,
  'running-median': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; scanf("%d", &n);
    vector<long long> v;
    for (int i = 0; i < n; i++) {
        long long x; scanf("%lld", &x);
        v.insert(upper_bound(v.begin(), v.end(), x), x);
        printf("%lld\\n", v[(v.size() - 1) / 2]);
    }
}
`,
  'longest-substring-k-distinct': `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n, k; cin >> n >> k; string s; cin >> s;
    int best = 0;
    for (int i = 0; i < n; i++) {
        set<char> seen;
        for (int j = i; j < n; j++) {
            seen.insert(s[j]);
            if ((int)seen.size() > k) break;
            best = max(best, j - i + 1);
        }
    }
    cout << best << endl;
}
`,
});

/** Which failing verdict each SLOW solution must produce on the large tests. */
module.exports.SLOW_VERDICT = {
  'min-eating-speed': 'TLE',
  'number-of-islands': 'RE',
  'coin-change': 'TLE',
  'course-schedule': 'RE',
  'running-median': 'TLE',
  'longest-substring-k-distinct': 'TLE',
};
