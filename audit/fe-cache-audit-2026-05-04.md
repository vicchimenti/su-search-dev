# Frontend Cache Audit — 2026-05-04

Standalone reference document. Captures the implementation of the frontend (su-search-dev) cache layer as of audit time, focused on `lib/cache.ts` and its five call sites in `pages/api/`. Structured for retrieval; not chronological.

## Scope and posture

**Target:** The frontend cache module (`lib/cache.ts`) and the five API endpoints that consume it directly (`pages/api/search.ts`, `pages/api/prefetch.ts`, `pages/api/suggestions.ts`, `pages/api/check-cache.ts`, `pages/api/pre-render.ts`), plus the cache-relevant pieces of `lib/api-client.ts`.

**Method:** Direct read of the seven in-scope files. One level of dependency from `lib/cache.ts` and from each enumerated call site. Imports of imports were not followed. Verification of the popularity-tier residue claim required a single `grep` across the repo for external references to popularity/metrics functions; that grep is the only out-of-scope read performed and is reported under verification status below.

**Stop rule:** Single-pass code reading at the audit-time state of the files. The proxy repo (`funnelback-proxy-dev`) is out of scope; where the FE cache references the proxy via URL or expected response shape, the contract surface is noted but the proxy side is not crossed into. No edits to source files. Audit-directory writes only.

**Posture:** Read-only. Findings are observations against the code at audit time; line citations are to the file as read on 2026-05-04. Findings are observations, not proposals; lessons are kept separate in a final section and are framed as observations about what the implementation did, not as requirements for what should be built next.

## Verification status

All claims about code in this document cite a specific file and line range. Each citation describes what is in the file at audit time and was confirmed by direct read. Where this document refines or contradicts a claim from `audit/fe-endpoint-dictionary-2026-05-01.json` or `audit/network-investigation-2026-05-01.md`, the contradiction is explicit.

The popularity-tier residue claim required confirming the absence of external consumers. A repo-wide grep was run for the symbols `getRecommendedTtl`, `trackQueryHit`, `queryPopularity`, `getCacheHitRate`, `updateCacheMetrics`, `getCacheStats`, `isRedisHealthy`, `clearQueryCache`, `clearAllTabCache` outside `lib/cache.ts`. Two hits surfaced and were inspected:

- `pages/api/search.ts:24` imports `getRecommendedTtl` but does not call it directly anywhere in the file body. The function is reached transitively through `setCachedSearchResults` (see `lib/cache.ts:617`); the import statement itself is residue.
- `public/search-page-autocomplete.js:128` defines a `getCacheHitRate` method on a client-side metrics object literal (it operates on `this.metrics.cacheChecks` and `this.metrics.cacheHits`, which are client-side counters). It is name-collided with `lib/cache.ts`'s `getCacheHitRate` export but is unrelated; client-side JS in `public/` cannot import the server-side TS module.

No other external consumer of the popularity-tiering or metrics surface exists in the repo.

## High-level finding

The frontend cache is **a single-file, narrow-shape, key-prefix-conventional Redis layer with a partially-residual popularity-tiering feature wrapped around it**. The code is small (`lib/cache.ts` is ~840 lines including comments and a metrics-stats helper that is itself uncalled), its core get/set surface is clean, and the call sites are roughly consistent in shape but differ in three load-bearing ways: **key normalization** (four different normalizations across five call sites), **TTL selection** (five different default-TTL behaviors across five call sites), and **whether the popularity tier is reachable at all** (it is reachable from one call site, partially reachable from two more, and bypassed by two). The `form` URL parameter — flagged in the May 1 endpoint dictionary as inconsistent across paths — is **not a key component**; the cache layer is benign with respect to that inconsistency. The prefetch-to-canonical-search handoff failure observed in `network-investigation-2026-05-01.md` is **not explained by key divergence**; the keys produced by `prefetch.ts` and looked up by `search.ts` are byte-identical for the same inputs. The popularity-tier residue claim is **partially confirmed**: the feature has no external consumer and is internal to `cache.ts`, but it is not fully inert — it does influence TTLs for one call path. However, because `queryPopularity` is held in module-local memory, on Vercel serverless the counter resets per function-instance lifetime, so the tier's effect on real traffic is bounded by container warmth rather than by query-popularity-over-time.

## What the cache is and how it's wired

**Backend selection.** `lib/cache.ts:32-36` selects the Redis backend at module load. It tries `process.env.su_search_dev_012026_KV_URL` first, falls back to `process.env.su_search_dev_012026_REDIS_URL`, and if neither is set the client is `null`. The two env-var names are timestamped — the `_012026_` infix encodes January 2026, when the variables were renamed to align with a planned analytics-dashboard rollout (per `CLAUDE.md`'s note that the timestamp is "residue from an analytics-dashboard concept that did not land").

**Client construction.** `new Redis(url)` from `ioredis` is constructed once at module load (`lib/cache.ts:14`, `:32-36`). There is no explicit connection-lifecycle management — no `.connect()`, no `.quit()`, no reconnection backoff configuration. `ioredis` handles reconnection internally. There is no per-request client; the same singleton is shared across all API routes that import the module.

**Fallback path.** `lib/cache.ts:39` declares an in-memory `Map` named `memoryCache`. When `redisClient` is `null`, the get/set/clear operations transparently switch to the Map (`:308-340`, `:400-417`, `:457-473`). The Map stores `{ data, expiry }` objects; expiry is checked on read (`:311`, `:668`) and stale entries are deleted lazily. There is no periodic eviction sweep — the Map will grow unbounded in any environment where Redis is misconfigured for long enough.

**Error handling.** Every public function in `cache.ts` is wrapped in a `try/catch` that logs the error at `LogLevel.ERROR` and returns either `null` (gets), `false` (sets/clears), or a sentinel value (existence checks). A Redis outage manifests as cache MISS for every read and silent-success for every write — the calling endpoint will simply re-fetch from the backend and proceed. There is no retry, no circuit breaker, no degraded-mode signal exposed to callers.

**Logging surface.** `lib/cache.ts:17-22` defines a four-level enum (`ERROR`, `WARN`, `INFO`, `DEBUG`). The default is `INFO` (`:25`); the level can be raised via `process.env.CACHE_LOG_LEVEL`. Every cache op logs at least one line at INFO. At default level on production traffic this produces high log volume — every search HIT produces `[CACHE-INFO] HIT for search:<query>:<collection>:<profile>`, which is also the cache key in the clear.

**Health check.** `isRedisHealthy()` (`:826-845`) pings Redis and returns boolean. No external caller invokes it (verified via grep). It exists but is unused.

**Stats surface.** `getCacheStats()` (`:686-793`) builds a rich stats object including Redis `INFO` parsing, key counts by prefix, and the metrics + popularity rollups. No external caller invokes it. The `pages/api/check-cache.ts` endpoint name might suggest it consumes `getCacheStats`, but it does not — `check-cache` is a per-query existence probe, not a stats endpoint.

## Cache key construction, per call site

The cache uses three key prefixes: `search:`, `tab:`, and `suggestions:`. Each call site constructs keys differently. The inventory below documents each call site's normalization and field order at audit time.

### `pages/api/search.ts` — `search:` and `tab:` keys via the helpers

Search-mode lookups call `getCachedSearchResults(query, collection, profile)` (`pages/api/search.ts:203-207`), which delegates to `generateSearchCacheKey` (`lib/cache.ts:585-596`). The helper normalizes:

- `query` → `(query || "").trim().toLowerCase()` (`lib/cache.ts:498`)
- `collection` → `(collection || "default").trim()` — case preserved (`:499`)
- `profile` → `(profile || "default").trim()` — case preserved (`:500`)

Field order: `search:<query>:<collection>:<profile>` (`:502`). Note that the helper's empty-fallback for missing collection/profile is the literal string `"default"`, not the search-system defaults `seattleu~sp-search` / `_default` — those defaults are applied at the `pages/api/search.ts:206-207` call site before delegation.

Tab-mode lookups call `getCachedTabContent(query, collection, profile, tabId)` (`pages/api/search.ts:157-162`), which delegates to `generateTabCacheKey` (`lib/cache.ts:513-526`). Same normalization for the first three fields, plus `tabId` → `(tabId || "default").trim()` (`:523`). Field order: `tab:<query>:<collection>:<profile>:<tabId>` (`:525`).

The `query`, `collection`, `profile` fields are taken from `req.query` directly (`pages/api/search.ts:81`); they reflect whatever URL the browser submitted, with no pre-normalization at the API-route boundary. The `tabId` is derived from URL inspection via `isTabRequest` / `extractTabId` / `normalizeTabId` (`:108-114`), with a fallback path that infers `tabId` from `form === 'partial'` plus URL substring matching for "Faculty"/"Programs"/"News" (`:127-145`).

### `pages/api/prefetch.ts` — `search:` keys via the helper, with pre-normalization

`pages/api/prefetch.ts:80` pre-normalizes the query: `const normalizedQuery = query.trim().toLowerCase();`. Then `pages/api/prefetch.ts:92-96` passes the pre-normalized value into `generateSearchCacheKey`, which performs the same `trim().toLowerCase()` again. Net normalization is identical to `search.ts`'s — the trim and lowercase are idempotent. Collection and profile pass through unchanged via the helper.

The pre-normalized `normalizedQuery` is also used as the value sent to the proxy in the params payload (`:123`), and as the value embedded in `prefetchData` for metrics (`:101`). The cache key is therefore guaranteed-equivalent to a `search.ts` lookup with the same `query` URL parameter.

### `pages/api/suggestions.ts` — bespoke `suggestions:` keys, no helper

`pages/api/suggestions.ts:57` constructs the cache key inline: `` `suggestions:${type || 'all'}:${query}:${collection || 'default'}` ``. The differences from the search/tab key shape are load-bearing:

- **No normalization at all.** The raw `query` and `type` from `req.query` are interpolated directly. A query of `"Computer"` produces a different cache entry than `"computer"`, and `"computer "` (trailing space) produces a third. Compare to `search.ts`'s `trim().toLowerCase()`.
- **`profile` is absent.** The key includes `type`, `query`, and `collection` only (`:57`).
- **`type` may be `undefined`.** `req.query.type` from the suggestions endpoint can be missing (the default-case branch at `:92` handles this and fans out to all three suggestion types), in which case the key string contains the literal `"all"` from the `|| 'all'` fallback. The cached object in that case is the merged `{ general, staff, programs }` shape from `:101-105`.
- **Bypasses the metrics/popularity surface.** The endpoint calls `getCachedData(cacheKey)` (`:60`) and `setCachedData(cacheKey, result, DEFAULT_TTL)` (`:109`) without the `options` parameter. The internal key-prefix sniff in `getCachedData` (`lib/cache.ts:267-274`) and `setCachedData` (`:370-378`) only matches `search:` and `tab:` prefixes, so for `suggestions:` keys no `query` is extracted and `trackQueryHit` is never called even if `trackMetrics` were set.

This confirms the May 1 endpoint-dictionary observation that suggestions and search normalize differently. The dictionary surfaced the inconsistency at the `query`-string level; in the cache layer the inconsistency is broader — the entire key shape and tracking integration differ.

### `pages/api/check-cache.ts` — a third normalization

`pages/api/check-cache.ts:38-51` defines its own `normalizeQuery` function, separate from `generateSearchCacheKey`. It does:

- lowercase (`:42`)
- trim and collapse whitespace runs (`:45`)
- strip the special characters `' " ? ! . ,` (`:48`)

The result is then passed to `generateSearchCacheKey` (`:105`), which performs another `trim().toLowerCase()` — those operations are idempotent against the already-normalized string, so the effective composite normalization is `normalizeQuery`'s. This is **more aggressive** than the normalization that `search.ts` applies to the same `query` URL parameter:

| Input query | search.ts effective key | check-cache.ts effective key |
| --- | --- | --- |
| `"What's up?"` | `search:what's up?:<col>:<prof>` | `search:whats up:<col>:<prof>` |
| `"   hello world   "` | `search:hello world:<col>:<prof>` | `search:hello world:<col>:<prof>` |
| `"hello, world."` | `search:hello, world.:<col>:<prof>` | `search:hello world:<col>:<prof>` |

The comment at `:38-39` declares intent: "This function must match the client-side implementation in integration.js." The client-side normalization in `integration.js` is out of scope for this audit, but the implication is that `check-cache` is intended to be consulted by clients that have already normalized their key with the same function — not by `search.ts` callers using the raw URL query. If a client uses one path's normalization and the FE is consulted via the other, the cache check and the cache lookup will disagree for any query containing apostrophes, quotes, question marks, exclamation points, periods, or commas.

This is a key-construction surface that exists in the cache layer but is not exercised uniformly across the call paths the cache layer can be reached through.

### `pages/api/pre-render.ts` — `search:` keys via the helper, partial pre-normalization

`pages/api/pre-render.ts:126` pre-normalizes the query to `query.trim()` only (no lowercase). It then calls `setCachedSearchResults(normalizedQuery, collection, profile, response.data, 16 * 3600)` (`:173`), which delegates to `generateSearchCacheKey` (`lib/cache.ts:614`), which applies its own `trim().toLowerCase()`. So the effective key is the same as search.ts's. The `console.log` at `pre-render.ts:180` reconstructs the key as `` `search:${normalizedQuery.toLowerCase()}:${collection}:${profile}` `` — note the manual `.toLowerCase()` here mirrors what the helper does internally; the log line is accurate but the manual reconstruction is a duplicate of the helper's logic and would drift if `generateSearchCacheKey` ever changed.

The same applies to `pre-render.ts:206`, where the response payload reports a `cacheKey` field constructed manually rather than by calling `generateSearchCacheKey`. If `generateSearchCacheKey` changes, the response field will report a stale shape.

### Inventory summary

| Call site | Prefix | Helper used | Effective normalization | Profile in key? |
| --- | --- | --- | --- | --- |
| `search.ts` (search) | `search:` | `generateSearchCacheKey` | `trim().toLowerCase()` | Yes |
| `search.ts` (tab) | `tab:` | `generateTabCacheKey` | `trim().toLowerCase()`, plus `tabId.trim()` | Yes |
| `prefetch.ts` | `search:` | `generateSearchCacheKey` (after pre-normalize) | `trim().toLowerCase()` | Yes |
| `suggestions.ts` | `suggestions:` | none — inline template | none | No |
| `check-cache.ts` | `search:` | `generateSearchCacheKey` (after `normalizeQuery`) | `trim().toLowerCase()` + collapse-whitespace + strip-special-chars | Yes |
| `pre-render.ts` | `search:` | `setCachedSearchResults` → `generateSearchCacheKey` | `trim().toLowerCase()` | Yes |

## TTL strategy

Six TTL constants are defined in `lib/cache.ts:42-47`:

- `DEFAULT_TTL` = 12 hours
- `TAB_CONTENT_TTL` = 14 hours
- `POPULAR_TAB_TTL` = 20 hours
- `SEARCH_DEFAULT_TTL` = 12 hours
- `SEARCH_POPULAR_TTL` = 16 hours
- `SEARCH_HIGH_VOLUME_TTL` = 18 hours

The comments at `:41` and `:42` reference the "daily crawl schedule (12-20 hours)". This aligns with the documented crawl cadence (Programs 03:18, Staff 09:18, News 04:22, Web 20:24) — the longest expected interval between crawls is roughly 24 hours, and the shortest active TTL (12 hours) ensures that any cached entry is invalidated by TTL expiry within a single crawl cycle's worst case. The relationship is approximate, not coordinated — there is no per-collection TTL; all `search:` keys share the 12-hour default and all `tab:` keys share the 14-hour default regardless of which crawl source the underlying content came from.

Per call site:

- **`search.ts` (search miss-fetch).** Calls `setCachedSearchResults(query, collection, profile, data)` with no TTL argument (`pages/api/search.ts:296-301`). Internal logic at `lib/cache.ts:617` evaluates `ttlSeconds || getRecommendedTtl(query)` — since no TTL is passed, the popularity tier is consulted. Effective TTL: 12h, 16h, or 18h depending on `queryPopularity[query].count`.
- **`search.ts` (tab miss-fetch).** Calls `setCachedTabContent(query, collection, profile, tabId, data, isPopularTab)` (`pages/api/search.ts:284-291`). `isPopularTab` is `true` for tab IDs in `POPULAR_TABS = ['Results', 'Programs', 'Faculty_Staff', 'News']` (`:38`, `:154`, `:281`). Effective TTL: 20h if popular, 14h otherwise. The popularity tier (`getRecommendedTtl`) is **not** consulted for tab content — `setCachedTabContent` (`lib/cache.ts:560-576`) selects `POPULAR_TAB_TTL` or `TAB_CONTENT_TTL` directly without going through the query-popularity map.
- **`prefetch.ts`.** Calls `setCachedData(cacheKey, response.data, cacheTTL)` (`pages/api/prefetch.ts:134`). `cacheTTL` is `parseInt(req.query.ttl, 10)` if the request includes a `ttl` parameter, else 300 seconds (5 minutes) (`:107-111`). Effective TTL: 5 minutes by default, or whatever the caller asked for. **This is dramatically shorter than search.ts's 12h-default**, and crucially it **bypasses popularity tiering entirely** because `setCachedData` is the raw setter, not `setCachedSearchResults`.
- **`suggestions.ts`.** Calls `setCachedData(cacheKey, result, DEFAULT_TTL)` (`pages/api/suggestions.ts:109`). Effective TTL: 12 hours, fixed. Bypasses popularity tiering.
- **`check-cache.ts`.** Read-only; no TTL is set. Reports the remaining TTL of an existing entry via `getKeyTTL` (`lib/cache.ts:800-823`).
- **`pre-render.ts`.** Calls `setCachedSearchResults(query, collection, profile, data, 16 * 3600)` with an **explicit** 16-hour TTL (`pages/api/pre-render.ts:173`). The explicit value short-circuits `getRecommendedTtl`. Effective TTL: 16 hours, fixed. Note that 16h is also `SEARCH_POPULAR_TTL`'s value — the implementation imports a literal `16 * 3600` rather than referencing the named constant, so the two values would drift independently if either were changed.

The TTL surface is **constants for tabs and suggestions, computed for search miss-fetch (only), and per-call-site literal for prefetch and pre-render**. Across the five call sites there are five distinct TTL behaviors.

## Popularity tiering — verification of residue classification

The user's hypothesis was that the popularity-tiering feature is residue from the retired analytics layer with no live consumer. Verification proceeded by tracing every read and every write of the popularity signal.

**Where the signal is written.** `trackQueryHit` (`lib/cache.ts:138-164`) is the only writer of `queryPopularity`. It is called from inside `getCachedData` (`:286-288`, `:300-302`, `:317-319`, `:336-338`) and `setCachedData` (`:391-394`, `:411-414`), but **only** when `options.trackMetrics === true` AND a non-empty `query` was extracted (either passed via `options.trackQuery` or sniffed from a key starting with `search:` or `tab:`). Of the five call sites:

- `getCachedSearchResults` and `setCachedSearchResults` always pass `trackMetrics: true, category: "search", trackQuery: query` (`lib/cache.ts:591-595`, `:619-623`). HIT/MISS/SET on these increment popularity.
- `getCachedTabContent` and `setCachedTabContent` pass `trackMetrics: true, category: "tabs", trackQuery: query` (`:543-547`, `:571-575`). HIT/MISS/SET on these increment popularity.
- `prefetch.ts` calls `setCachedData(cacheKey, response.data, cacheTTL)` without options (`pages/api/prefetch.ts:134`). The internal sniff would match the `search:` prefix, but `options.trackMetrics` is undefined, so the `if (query && options.trackMetrics)` guard short-circuits and tracking does not fire.
- `suggestions.ts` calls `getCachedData(cacheKey)` and `setCachedData(cacheKey, result, DEFAULT_TTL)` without options (`pages/api/suggestions.ts:60`, `:109`). The `suggestions:` prefix doesn't match the sniff anyway.
- `check-cache.ts` only calls `searchResultsExistInCache` and `getKeyTTL`, neither of which writes popularity.
- `pre-render.ts` calls `setCachedSearchResults` (`pages/api/pre-render.ts:173`), which does write popularity.

So the writers are: every search.ts get/set, every pre-render set, plus tab-content gets/sets via search.ts. Prefetches, suggestions, and cache-existence checks do not write popularity.

**Where the signal is read.** `getRecommendedTtl` (`lib/cache.ts:172-196`) is the only reader of `queryPopularity`. It is called from one place: `setCachedSearchResults` at `:617`. No external caller invokes `getRecommendedTtl` directly (the import at `pages/api/search.ts:24` is unused — `getRecommendedTtl` is reached transitively through `setCachedSearchResults`, not directly). The signal is also surfaced read-only by `getCacheStats` (`:697-705`), but `getCacheStats` itself has no caller anywhere in the repo.

**Net flow.** The popularity tier influences exactly one decision: the TTL chosen by `setCachedSearchResults` when no explicit TTL is passed. That happens at one call site: `search.ts`'s search miss-fetch path (`pages/api/search.ts:296-301`). For all other writes (tab content, pre-render, prefetch, suggestions), the TTL is fixed and the popularity counter has no behavioral effect even though it may be incremented.

**Verification verdict.** The user's classification is **partially confirmed**. The popularity-tiering feature has no external consumer and no surface that exposes it to callers. The metrics map (`metrics`) and the popularity map (`queryPopularity`) are read only by `getCacheStats`, which is itself unused. So the **observability** half of the feature is dead. The **TTL-tuning** half is alive but narrow — it tunes the TTL on one call path and is entirely bypassed by four others. It is not what the user characterized as "no live consumer," strictly — it does affect cache TTLs — but it is also not a load-bearing part of the cache's behavior.

**Effectiveness on serverless.** The `queryPopularity` map (`lib/cache.ts:75-80`) and the `metrics` object (`:66-72`) are module-local in-memory state. On Vercel serverless, each function-instance lifetime is bounded by container warmth; cold starts re-initialize the module and the popularity counter starts from zero. Repeated requests that happen to land on the same warm instance accumulate counts; requests that land on different instances do not share the signal. So even where the tier is reachable, its effect on real traffic is bounded by how long an instance stays warm and how much of the query distribution lands on a single instance during that window. The signal is collected per-instance, not per-query-population.

## The form parameter question

The May 1 endpoint dictionary surfaced inconsistent handling of `form=partial` across the FE: `integration.js`'s `performSearch` adds it on submit, `search-page-autocomplete.js`'s `performSearch` does not, `prefetch.ts` does not add it on the backend leg, and `pre-render.ts` does add it. The question for the cache layer is whether this inconsistency propagates into key construction.

**It does not.** Neither `generateSearchCacheKey` nor `generateTabCacheKey` includes `form` (`lib/cache.ts:492-503`, `:513-526`). The fields are `query`, `collection`, `profile` for search keys and `query`, `collection`, `profile`, `tabId` for tab keys. `form` does not appear in any cache key produced by any call site. Its inclusion in the params payload (`pages/api/search.ts:249`) affects the proxy's response shape but not the FE cache lookup.

**Implication for the cache layer specifically.** The `form` inconsistency is benign at the cache layer. A prefetch that omits `form` and a submit-fetch that includes it produce the same cache key and will be matched as the same entry. The inconsistency is real and does have implications for upstream proxy behavior and for the response shape stored in the cache, but it is not the explanation for any cache-layer key divergence.

## Prefetch → canonical search handoff

`network-investigation-2026-05-01.md` recorded that even prefetches firing during typing for the exact eventual query did not produce cache hits on the subsequent search submit. Two possible causes were flagged: a race (prefetch hadn't completed before submit), or a key divergence (`prefetch.ts` and `search.ts` produce different cache keys). The cache-layer half of that question is whether the keys are byte-identical.

**They are.** Both `prefetch.ts` and `search.ts` ultimately route through `generateSearchCacheKey` with the same fields. Walking the two paths for an input query of `Q`, collection `C`, profile `P`:

- `prefetch.ts:80` computes `normalizedQuery = Q.trim().toLowerCase()`. `:92-96` calls `generateSearchCacheKey(normalizedQuery, C, P)`. Inside, `:498` re-normalizes (idempotent) and produces `search:<Q.trim().toLowerCase()>:<C.trim()>:<P.trim()>`.
- `search.ts:203-207` calls `getCachedSearchResults(Q, C, P)` with the raw `req.query` value. `lib/cache.ts:590` invokes `generateSearchCacheKey(Q, C, P)`. Inside, `:498` produces `search:<Q.trim().toLowerCase()>:<C.trim()>:<P.trim()>`.

Both produce the identical string for identical inputs. The only way these keys can diverge is if the URL parameters themselves diverge (different collection, different profile, or different query at the URL level). The cache-layer mechanism is consistent.

**Where divergence could still occur at the URL level.** If `prefetch.ts` is called with `query=academic+credentials` and `search.ts` is then loaded with `query=academic credentials` (no plus, decoded space), Next.js will parse both to `"academic credentials"` and the keys will match. If one path includes an extra trailing space or trailing punctuation that the other strips, the trim-and-lowercase normalization will resolve the trailing-space case but not the trailing-punctuation case (since `generateSearchCacheKey` does not strip punctuation). However, neither `prefetch.ts` nor `search.ts` does any punctuation stripping, so they will be consistently divergent rather than divergently consistent — both will keep punctuation in the key. The May 1 capture's `academic+credentials` query has no punctuation, so this is not the explanation for that capture.

**Verdict.** The cache-layer half of the prefetch-to-canonical handoff failure is **not the explanation**. The keys are consistent. The remaining hypothesis from the network investigation — race conditions where the prefetch's backend-fetch-then-cache-write didn't complete before the submit's lookup — is the live one. That is a timing question, not a cache-layer question, and is out of scope for this audit.

## Tab naming spaces at the cache layer

The May 1 endpoint dictionary established two tab-identity namespaces: `tabName` (display-form, e.g. `"Faculty & Staff"`) and `tabId` (URL-safe form, e.g. `"Faculty_Staff"`). Tab clicks bypass `/api/search` and `lib/cache.ts` entirely (the click handler in `core-search-manager.js` calls the proxy directly, per the May 1 capture). The question for this audit is whether either tab-identity form leaks into cache.ts or any call site that does reach the cache.

**Only `tabId` (URL-safe form) appears in the cache layer.** `generateTabCacheKey` (`lib/cache.ts:513-526`) takes a `tabId` parameter and trims it without case-changing. `pages/api/search.ts:38` declares `POPULAR_TABS = ['Results', 'Programs', 'Faculty_Staff', 'News']` — these are URL-safe IDs, with the underscore in `Faculty_Staff`. The fallback inference path at `:127-145` looks for substring matches "Faculty"/"Staff"/"Programs"/"News" in the URL (which would match URL-safe IDs as well as display forms; the substring match is loose) and then **assigns** an URL-safe ID like `"Faculty_Staff"` (`:135`) to `tabId`. The display form `"Faculty & Staff"` does not appear anywhere in `cache.ts` or in the cache-relevant call sites.

**The fallback inference path is a coupling worth flagging.** `pages/api/search.ts:127-145` infers `tabId` by checking whether the request URL contains certain substrings. This is a fragile inference — it would mis-route a query like `"Faculty awards"` (substring `"Faculty"`) into the `Faculty_Staff` tab cache. The May 1 capture established that real tab clicks do not reach `search.ts` at all (they go directly to the proxy), so this fallback path may not be exercised in current production traffic. Whether it is exercisable at all from any reachable code path is a question one level deeper than this audit went; the observation is that the path exists and is suspect.

**`tabId` casing in the key is the URL-safe form's case.** `Faculty_Staff` (with capital F and S, underscore between) is the canonical form per `POPULAR_TABS`. `generateTabCacheKey` only trims, doesn't lowercase, so the key will be `tab:<query>:<col>:<prof>:Faculty_Staff` for the popular case. `query` is lowercased; `tabId` is not. This is consistent across the file but worth noting because it differs from the search-key normalization within the same module.

## Invalidation and eviction

**No explicit invalidation is reachable.** `lib/cache.ts` exposes `clearCachedData`, `clearQueryCache`, and `clearAllTabCache` (`:432-483`, `:631-636`, `:642-644`). None has any caller in the repo (verified via grep). Eviction is therefore TTL-driven only. There is no admin endpoint, no scheduled job, no signal-handler-based clear. If a stale entry needs to be invalidated, the only mechanism is to wait for the TTL to expire.

**Pattern-based clear is implemented but unused.** `clearCachedData` accepts a wildcard pattern (`:436-447`) and uses `redisClient.keys(pattern)` to enumerate keys matching the pattern, then `redisClient.del(keys)` to bulk-delete. `clearQueryCache(query)` builds a pattern of `*:<normalizedQuery>:*` (`:635`) — note this would match both `search:` and `tab:` and `suggestions:` keys for the same query, which is consistent across all three caches. `clearAllTabCache()` uses `tab:*` (`:643`). Both are unreachable from any call site.

**`redisClient.keys()` on production traffic is risky.** `redisClient.keys(pattern)` is a `KEYS` command, which scans all keys in the Redis DB. On a hot Redis with significant key counts, `KEYS` is O(N) and blocks the server. Since these clears are unreachable, the risk is latent — but if any of them were wired up later, the implementation would need to switch to `SCAN` for production safety. Worth noting for the rebuild's cache design discussion.

**In-memory fallback eviction is lazy.** As noted in "What the cache is and how it's wired," the `memoryCache` Map evicts expired entries only on read of the same key (`:325-328`, `:670-672`). Entries that are written and never read again live until the process restarts. This is fine on serverless (process restarts frequently) and probably fine in any production posture, but it is unbounded in development scenarios where the same Node process runs for hours with cache writes but no reads.

## Cross-cutting observations

**Three-prefix convention with no shared key-construction discipline.** The cache uses three key prefixes (`search:`, `tab:`, `suggestions:`) and four key-construction strategies (helper-with-pre-normalize, helper-direct, custom-normalize-then-helper, inline-template-no-normalize). The helpers exist (`generateSearchCacheKey`, `generateTabCacheKey`) but two of the five call sites either bypass them (`suggestions.ts`) or reach them through a different normalization (`check-cache.ts`). There is no `generateSuggestionsCacheKey` helper, no central registry of key shapes, and the `pre-render.ts` reconstruction at `:180` and `:206` duplicates the helper's internal logic.

**Two parallel logging surfaces with the same level enum.** `lib/cache.ts` defines its own `LogLevel` enum (`:17-22`) and exports a `log` function (`:88-101`). `lib/api-client.ts` defines its own `LogLevel` enum (`:20-25`) and exports its own `log` function (`:46-55`). The two enums are byte-identical in structure but are separately defined. The level prefixes differ (`[CACHE-INFO]` vs `[API-CLIENT-INFO]`), so the two logging surfaces are distinguishable in output, but the duplicated enum is structural redundancy that any single source-of-truth refactor would collapse.

**Cache reads and writes log at INFO by default, including the cache key.** `lib/cache.ts:290`, `:304`, `:322`, `:340`, `:396`, `:416` log the full cache key (which contains the user's query) at INFO. On any production traffic this writes the user's query string into the standard log stream every time the cache is read or written. The log level is configurable via env, but the default is INFO and the queries are unredacted.

**`getClientInfo` is called twice in `search.ts`.** `pages/api/search.ts:78` calls `getClientInfo(req.headers)` and assigns to `clientInfo`. Then `:96` calls `getClientInfo(req.headers)` again and reassigns the same name (shadowing the outer scope's `clientInfo` is not happening — TypeScript would catch a same-name re-declaration in the same scope, so this is two separate calls in different scopes). Both calls log to the console. The first call's `clientInfo.source` is set on the response header at `:100`, but the value is then overwritten by the second call. Net behavior: two redundant IP-resolution log lines per request. Not a cache-layer issue but adjacent to one.

**Cache-aware vs cache-blind clients are constructed differently across call sites.** `pages/api/search.ts:265` and `pages/api/pre-render.ts:138` create the API client with `{ cacheAware: true }`. `pages/api/prefetch.ts:117` and `pages/api/suggestions.ts:71` create it without that option. The `cacheAware` flag adds `X-Cache-Aware: true` to the outgoing headers (`lib/api-client.ts:192-194`). This is a contract surface with the proxy — the proxy may behave differently when this header is present. It is not a cache-layer concern in the FE strictly, but it is a place where the FE's cache architecture asserts a contract on the upstream that the rebuild's cache design will need to either preserve or replace.

**`POPULAR_TABS` is a hardcoded local constant in `search.ts`.** `pages/api/search.ts:38` declares the four URL-safe tab IDs that get the longer popular-tab TTL. The list is local to `search.ts`; `cache.ts` is unaware of which tabs are "popular." The `isPopularTab` boolean is computed at the call site (`:154`, `:281`) and passed into `setCachedTabContent`. The popularity classification for tabs is therefore static-and-call-site-bound, in contrast to the popularity classification for queries which is dynamic-and-cache-internal. Two different "popularity" concepts share a name in this module.

**No cache versioning.** None of the cache keys carries a version suffix or schema marker. If the response shape changes in a future deploy, in-flight cached entries will be served as-is until TTL expiry. The 12-hour minimum TTL means that any deploy that changes response shape will see up to 12 hours of mixed-shape cache hits unless the deploy includes an explicit cache flush — which, given that the explicit-flush surface is unreachable (see "Invalidation and eviction"), would have to be done by manually editing Redis or by changing the env-var name to repoint at a fresh KV store. The env-var name's `_012026_` infix is one such version marker, but it is a deployment-level rather than per-key marker.

## Lessons

This section is observational, not prescriptive. The user's operational anchor — that the FE cache delivers approximately a 50% reduction in delivery time on hits and has been stable for eighteen months — is a load-bearing fact about the implementation as a whole, attributed as user-reported rather than independently measured. The lessons below are observations about what the implementation got right, what would be designed differently knowing what is now known, and what surfaces are seams worth thinking about when the rebuild's cache is designed.

**The cache works because its core get/set surface is narrow and consistent.** `getCachedData` and `setCachedData` are simple, consistent, and fail safely. Every error path returns null/false/sentinel and lets the caller fall through to the upstream fetch. The Redis-or-memory fallback is transparent. Eighteen months of stability comes from this narrow surface, not from the popularity tier or the metrics rollup.

**The popularity-tier mechanism is a clean example of an internal-only feature that drifted out of relevance.** It is well-implemented in isolation, but its real-world effectiveness is bounded by serverless container warmth (per-instance counters reset on cold start), and four of the five call sites bypass it entirely. The metrics-and-stats rollup (`getCacheStats`, `getCacheHitRate`) has no consumer at all. This is the residue the user characterized — collected but never consulted.

**Key normalization being inconsistent across call sites is the cache layer's most surprising finding.** Five call sites, four normalizations. The inconsistency is not a bug — each call site's normalization is internally correct for what it computes — but the inconsistency is a seam. `check-cache.ts`'s special-character stripping in particular establishes a contract that `search.ts` does not honor; if a client is built that consults `check-cache` before navigating to `search.ts`, queries with apostrophes or punctuation will report HIT and then MISS. This is a seam worth thinking about for the rebuild even though the current behavior is operationally fine.

**TTL selection is also inconsistent across call sites in a way the implementation doesn't surface.** Five call sites, five TTL behaviors. Prefetch's 5-minute default and pre-render's hardcoded 16h literal are particularly notable — neither flows through the popularity tier, both are local decisions, and neither references the named constants. `pre-render.ts:173` writes `16 * 3600` rather than `SEARCH_POPULAR_TTL`; if that constant changes, pre-render won't follow.

**The cache has no version marker per key.** The `_012026_` env-var infix is a deploy-level marker, not a per-key one. A response-shape change requires a 12-hour-minimum coexistence of old and new shapes in cache, and the explicit-flush surface is unreachable. This is a real design constraint that the implementation accepts implicitly. Whether the rebuild wants to accept the same constraint is a seam.

**Invalidation is TTL-only, and the unused clear functions use `KEYS` rather than `SCAN`.** If the rebuild's cache wants any explicit invalidation, the implementation will need to use `SCAN`. This is a small implementation detail but it would be a real production issue if the unused clear functions were ever wired up as-is.

**The cache key contains the user's query in the clear in the log stream.** Default-INFO logging produces `[CACHE-INFO] HIT for search:<query>:<col>:<prof>` for every cache read. This is fine for the search domain (queries are not sensitive), but it is a posture worth being explicit about in any future cache design — the cache key is observable in logs, and any sensitive content in a query string would be exposed by default. For a search system this is not a concern; for a system that caches anything more sensitive than a search query it would be.

**The implementation's stability over eighteen months is, in retrospect, attributable to what it does not do.** It does not invalidate, does not version per-key, does not coordinate across instances, does not retry on Redis failure, and does not expose its internal metrics. Each of those non-features removes a potential failure mode. The popularity tier is the one feature that goes beyond the simple fall-through cache, and its real-world impact is small enough that even its inconsistencies (bypassed by four of five call sites) have not produced operational issues. The cache succeeds by being small. That is not a prescription for what the rebuild should be — that is project-instructions territory — but it is the load-bearing observation of this audit.
