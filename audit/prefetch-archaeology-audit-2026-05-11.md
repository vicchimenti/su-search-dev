# FE Prefetch Archaeology Audit — Phase 1 (Timeline)

**Audit date:** 2026-05-11
**Auditor:** Claude Code (Opus 4.7, 1M context) under read-only / audit-scoped permissions
**Repo:** `su-search-dev`
**Posture honored:** Read-only on source. Writes scoped to `audit/**`. No source edits, no commits to source files, no history rewriting. All evidence in this document is from local `git log`, `git show`, `git blame`, and current-file reads — no GitHub PR/issue threads accessed (GH MCP unavailable per brief).
**Status:** Phase 1 complete. Phase 2 (puzzle resolutions) deferred for developer-review checkpoint per brief's standing two-phase cadence.

---

## 0. Reading guide

This audit follows the brief's instruction to keep Phase 1 to inventory-and-classification and reserve interpretive puzzle resolution for Phase 2. Two notes on how the boundary actually fell:

1. **`prefetch.ts` is a one-commit file.** It was created in a single commit (`b6ba756e`, 2025-05-06) and has never been modified since — same blame on every line, current bytes identical to creation. That collapses much of what a normal archaeology Phase 1 would do: there is no commit-by-commit timeline of prefetch.ts to walk through. The Phase 1 work consequently centers on the creation commit's full context, the FE-side `prefetchSearchResults` function's later edits in `public/integration.js`, and the surrounding `lib/cache.ts` infrastructure that prefetch depends on.

2. **The Phase 1/Phase 2 boundary collapses partially**, as the brief anticipated. The creation commit's message is unusually explicit about intent, and inspecting it answers most of the design-intent puzzles directly from primary evidence — there's no later commit drift to interpret. Where Phase 1 evidence answers a puzzle outright, that is noted in §6 (Observations from Phase 1 evidence) but explicit puzzle *resolutions* are still deferred to Phase 2 per the cadence.

---

## 1. Scope

**Primary target:** `pages/api/prefetch.ts` — depth-to-creation git history. (Result: one commit ever; see §3.)

**Secondary target:** The FE-side `prefetchSearchResults` function in `public/integration.js`, plus its two listener attachments. (Result: five commits touched it; see §4.)

**Tertiary target:** `lib/cache.ts`'s key-generation helpers — only commits that materially affected the prefetch cache key. (Result: two commits affected the `generateSearchCacheKey` function body; the namespace prefix `search:` has been stable since introduction; see §5.)

**Out of scope (per brief and honored):** `pre-render.ts` standalone history (only a Puzzle G anchor commit is noted); proxy-side `prefetch=true` handling; Funnelback-side configuration; per-feature manager histories; `SessionService` evolution.

---

## 2. Stop rule and how it was honored

**Depth stop rule:** Follow back to creation; follow renames; if rename trail breaks, stop at the new-introduction commit and note the discontinuity.

**Honored:** `git log --all --follow -- pages/api/prefetch.ts` returned exactly one commit (`b6ba756e`, 2025-05-06). `git log --all -- pages/api/prefetch.ts` (no `--follow`) returned the same single commit. No rename history exists; the file was introduced new at `b6ba756e` and has never been moved, renamed, or re-introduced. The depth stop rule terminates at this creation commit cleanly.

**Breadth stop rule:** Three files only (`prefetch.ts`, `integration.js` function-scoped, `cache.ts` key-generator-scoped). Cross-references surface only when a commit touches a scope file.

**Honored:** All commits classified in §3–§5 were entered into the timeline because they touch one of those three files. Same-day commits and adjacent-week commits that *don't* touch any of those files are not classified here (see §7 for the few commit IDs noted as ambient context, not classified).

---

## 3. `pages/api/prefetch.ts` — full commit timeline

### 3.1 The only commit: `b6ba756e` — 2025-05-06 09:23:59 -0700 — *creation*

**Commit message (full):**

> Add predictive search caching functionality
>
> - Implement background prefetch in integration.js to cache search results during typing
> - Create new prefetch API endpoint that caches results without blocking the UI
> - Add configurable cache TTL and proper error handling
> - Include basic metrics tracking for monitoring cache performance
> - Ensure backward compatibility with existing search functionality
>
> This change improves perceived search performance by pre-warming the Redis cache while users are typing, before they submit a search query.

**Files touched in commit (2 total):**

| File | Change | Lines |
|------|--------|-------|
| `pages/api/prefetch.ts` | new file | +217 |
| `public/integration.js` | modified | +112 / −2 |

**Classification:** Feature-add (new mechanism, intentional design, articulated rationale).

**Key shape at creation (relevant to later puzzles, no interpretation here — just the facts on the page):**

- Imports: `setCachedData`, `generateSearchCacheKey` from `lib/cache`; `createApiClient` from `lib/api-client`; `getClientInfo` from `lib/ip-service`.
- Cache namespace: prefetch uses `generateSearchCacheKey(query, collection, profile)`, which produces a `search:`-prefixed key (per `lib/cache.ts:148–150` at the time of the commit — see §5.1).
- Backend call: `apiClient.get('/funnelback/search', { params: { ..., prefetch: 'true', ... } })`. The endpoint calls the **proxy directly** (`/funnelback/search`), not the internal `/api/search` route.
- Control flow: backend `.get(...).then(setCachedData(...))` is fired and **not awaited**. The handler returns `res.status(202).json({ status: 'accepted', ... })` *before* the backend response (and therefore before the cache write) completes.
- Default TTL: 300 seconds (5 minutes), with optional `ttl` query parameter override.
- Query normalization: prefetch.ts L80 does `query.trim().toLowerCase()` server-side before generating the cache key, independent of whatever the FE caller sent.
- Metrics: `trackPrefetchMetrics()` is a development-mode `console.log`-only stub. Comment at L216 reads `// TODO: Add proper metrics tracking in the future`.

**Same-commit edits to `public/integration.js` (covered in detail in §4.1 — the creation commit is shared across files):**

- `config` object gains `prefetchDebounceTime: 300`, `prefetchMinQueryLength: 4`, `cacheTTL: 300`.
- Function `prefetchSearchResults(query)` added (then ~lines 296–355).
- Listener attached inside `setupHeaderSearch` for header input element via `handlePrefetch` debounced wrapper.
- Listener attached inside `setupResultsSearch` for search-page input element via a *separate* `handlePrefetch` (locally redeclared) debounced wrapper.
- Global exposure: `window.prefetchSearchResults = prefetchSearchResults` at end of IIFE.

### 3.2 Confirmation of zero subsequent commits

Three independent checks for completeness:

| Command | Result |
|---------|--------|
| `git log --follow -- pages/api/prefetch.ts` | 1 commit |
| `git log --all --follow -- pages/api/prefetch.ts` | 1 commit |
| `diff <(git show b6ba756e:pages/api/prefetch.ts) /home/vic/repos/vercel/su-search-dev/pages/api/prefetch.ts` | empty (byte-identical) |

The file as it sits in HEAD on 2026-05-11 is the file as it was written on 2025-05-06. One year and five days with zero edits.

`git blame -L 1,40 pages/api/prefetch.ts` confirms every line's last-edit commit is `b6ba756e`. The same will hold for all 217 lines.

The file's `@version` field reads `1.0.0` and `@lastModified` reads `2025-05-06` — consistent with the zero-edit history. No version increment.

---

## 4. `prefetchSearchResults` function in `public/integration.js` — chronological timeline

The FE-side function was introduced in the same commit as `prefetch.ts` and was edited four more times. All five commits are classified below in chronological order.

### 4.1 `b6ba756e` — 2025-05-06 09:23 PT — *creation*

(Same commit as §3.1; this entry covers only the integration.js delta.)

**Classification:** Feature-add — initial introduction of the FE-side prefetch function and its two listener attachments.

**Function body at creation (~L296 of integration.js at that commit):**

```js
function prefetchSearchResults(query) {
  try {
    if (!query || query.length < config.prefetchMinQueryLength) return;
    const normalizedQuery = query.trim().toLowerCase();
    let sessionId = '';
    if (window.SessionService) sessionId = window.SessionService.getSessionId() || '';
    const params = new URLSearchParams({
      query: normalizedQuery,
      collection: config.collection,
      profile: config.profile,
      prefetch: 'true'
    });
    if (sessionId) params.append('sessionId', sessionId);
    const prefetchUrl = `${config.apiBaseUrl}/api/prefetch?${params}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    fetch(prefetchUrl, {
      method: 'GET',
      signal: controller.signal,
      priority: 'low',
      keepalive: true,
      headers: { 'X-Prefetch-Request': 'true', 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then(response => {
        clearTimeout(timeoutId);
        if (response.ok) {
          if (window.location.hostname.includes('dev') || window.location.hostname === 'localhost') {
            console.log(`Prefetched results for: ${normalizedQuery}`);
          }
        }
      })
      .catch(() => { clearTimeout(timeoutId); });
  } catch (error) { /* silent */ }
}
```

Key initial-state facts:
- The function normalizes the query (`trim().toLowerCase()`) *before* sending it to `/api/prefetch`.
- It sends `priority: 'low'`, `keepalive: true`, with a 5-second `AbortController` timeout.
- The response body is not consumed; only `response.ok` is checked.
- Listener attachment in `setupHeaderSearch` at original L271-ish, again in `setupResultsSearch` at original L387-ish.

### 4.2 `489fd47b` — 2025-05-06 10:33 PT (~1h 10m after creation) — *same-day behavior change*

**Commit message subject:** "Implement search redirect optimization with SessionService integration"
**Files touched:** `public/integration.js`, `public/js/SessionService.js` (broader commit; integration.js diff ~+281 lines)
**Classification:** Refactor/feature-add to the broader redirect flow. Net effect on `prefetchSearchResults`: **a small but consequential behavior change** — see below.

**Delta to `prefetchSearchResults`:**

- The FE-side query normalization was **removed**. The function previously did `const normalizedQuery = query.trim().toLowerCase()` and used `normalizedQuery` in both the `URLSearchParams` and the logged output. After this commit, both call sites use `query` directly. Comment `// Normalize query for consistent caching` removed from this function.
- Logging upgraded: `console.log` replaced with `debugLog(...)`; a masked session-id log line added; the `.then` handler grew a second-stage `.then(data => debugLog(...))` (still doesn't consume data meaningfully, just logs).
- Error handling expanded with `if (config.enableDebugLogging) console.error(...)` in both `catch` blocks.

**Why this is worth flagging in Phase 1 evidence (not a Phase 2 resolution, just an observation):** Server-side normalization at `prefetch.ts:80` still runs (`query.trim().toLowerCase()`), so the final cache key is unchanged for inputs the user actually types. But the FE-side function began sending un-normalized strings — meaning the prefetch endpoint's HTTP-layer view of the query (URL parameter, logging, X-Prefetch-Request body) now diverged from what the server stored as the cache key. Phase 2 should consider whether this affected anything downstream of the URL (analytics, logging, etc.) but it does not change the cache-key shape.

### 4.3 `5a2bec5a` — 2025-05-07 — *observability-only*

**Commit message subject:** "Enhanced Logging for A/B Environment Consistency Implemented standardized logging across core components with log level support (ERROR, WARN, INFO, DEBUG) to ensure consistent visibility in both A/B variants. ..."
**Files touched (commit message excerpt):** `cache.ts`, `api-client.ts`, `SessionService.js`, `integration.js`
**Classification:** Observability — pure logging refactor. No behavior change to prefetch.

**Delta to `prefetchSearchResults`:**

- `debugLog(...)` calls replaced with `log(..., LOG_LEVELS.XYZ, ...)`.
- Inline `if (window.SessionService._maskString && sessionId)` guard added around the masked-session-id log line.
- Style/quote-style normalizations (single → double quotes, trailing commas, arrow-function param parens) — harmless.

No change to fetch URL construction, fetch options, or response handling.

### 4.4 `0624d09e` — 2025-09-04 — *surrounding edit (pre-render install)*

**Commit message subject:** "feat (pre-render, integration, autocomplete) : install smart pre-rendering"
**Files touched:** `pages/api/pre-render.ts` (new), `public/integration.js` (+87 / −variable), `public/search-page-autocomplete.js` (extensive)
**Classification:** Surrounding edit. Adds a *separate, parallel* mechanism (pre-render) that operates on a different trigger (form submit) than prefetch (typing). The prefetch function itself and its listener attachments are essentially untouched at the behavior level.

**Delta in the vicinity of `prefetchSearchResults` and its attachments:**

- `setupHeaderSearch`'s **form-submit handler** is rewritten. Before this commit, the submit handler called `SessionService.prepareForSearchRedirect(normalizedQuery)` and then redirected. After this commit, it additionally issues a `fetch('/api/pre-render', { method: 'POST', keepalive: true, body: JSON.stringify({ query: normalizedQuery, sessionId }) })` call before the redirect.
- The function-level `setupHeaderSearch` JSDoc block was rewritten to advertise "Smart pre-rendering trigger for instant results."
- Inside `setupHeaderSearch`, the `handlePrefetch` debounced listener attached to `component.input` (the typing-trigger path for prefetch) is **retained essentially unchanged** — only a few inline comments were removed and one stylistic touch-up.
- `prefetchSearchResults` function body is **not touched** by this commit.

**Significance:** From this commit forward, the codebase has two parallel cache-warming mechanisms:
- **Prefetch** (existing since 2025-05-06): fires during *typing* in either header or search-page input, hits `/api/prefetch` → `/funnelback/search` → writes `search:`-namespaced cache.
- **Pre-render** (new on 2025-09-04): fires on header *form submit*, hits `/api/pre-render` → (separately implemented path).

These mechanisms coexist but were not added as a pair (4 months apart). They share neither code, nor cache namespace handling, nor lifecycle. Phase 2 will need to consider whether the pre-render addition reflects a recognition that prefetch wasn't producing results, or whether it was an additive optimization. This commit's message does not address prefetch.

### 4.5 `4ffe3f6d` — 2025-09-12 — *neighbor edit (dead code removal)*

**Commit message subject:** "fix(setupResultsSearch): remove redundant initialization to session service"
**Files touched:** `public/integration.js` (−20 lines)
**Classification:** Neighbor edit — removed a block inside `setupResultsSearch` that *referenced* the word "prefetched" in a comment but was not part of `prefetchSearchResults` or its listener attachments.

**Delta:**

- 20 lines removed from near the end of `setupResultsSearch` (current ~L743 region). The removed block included the comment `// Check if this is a redirect from a prefetched query` followed by a `window.SessionService.getLastSearchQuery()` / `clearLastSearchQuery()` sequence. **This block was reading from `SessionService`, not from the prefetch cache or the `/api/prefetch` endpoint.** The wording in the comment overloads "prefetched" but the data flow has no relationship to `prefetchSearchResults`.

**No edits to:** `prefetchSearchResults` function body, the header-input prefetch listener attachment, or the search-page-input prefetch listener attachment.

This commit's only significance for the prefetch audit is that it removed text containing the word "prefetched" — a potential source of name confusion for future readers, now eliminated. But this should not be read as evidence of prefetch investigation; the commit message is specific to SessionService.

### 4.6 Inventory close-out — current state of the FE function

Located in `public/integration.js`:
- **Function definition:** line 465 (`function prefetchSearchResults(query)`).
- **Header-input listener attachment:** lines 405–421 (`handlePrefetch` debounce + `component.input.addEventListener("input", handlePrefetch)`).
- **Search-page-input listener attachment:** lines 721–739 (second locally-redeclared `handlePrefetch` debounce; same shape).
- **Global exposure:** line 1305 (`window.prefetchSearchResults = prefetchSearchResults`).

Function-level last-edit commits (per `git log -G 'prefetchSearchResults'`):
- Lines that emerged from the **logging refactor** (`5a2bec5a`, 2025-05-07) carry that commit as their last edit.
- Listener attachment blocks: substantially original from `b6ba756e` with cosmetic touches from later commits.
- The function body has not received a *behavior-changing* edit since `489fd47b` on 2025-05-06 (the normalization removal). All subsequent edits to lines inside this function have been logging-shape only.

---

## 5. `lib/cache.ts` — prefetch-key-relevant timeline (filtered, not full file history)

The brief scopes cache.ts to "only the commits that materially affected the prefetch cache key, not the file's full history." Two commits materially affected the function `generateSearchCacheKey`; one more is noted because it affected the Redis env var the prefetch path depends on.

### 5.1 `2242e5f6` — 2025-04-16 — *introduction of `generateSearchCacheKey`* (3 weeks before prefetch existed)

**Commit message subject:** "feat: Implement tab content caching"

**Relevant delta to cache.ts:**

```ts
export function generateSearchCacheKey(query: string, collection: string, profile: string): string {
  return `search:${query}:${collection || 'default'}:${profile || 'default'}`;
}
```

**Classification:** Pre-creation infrastructure. The `generateSearchCacheKey` helper has existed since 2025-04-16, three weeks before `prefetch.ts` was added. When prefetch was authored on 2025-05-06, this function and its `search:` namespace prefix already existed and had been in production use by `search.ts` (the same commit also wired this helper into `pages/api/search.ts`).

In the same commit, `generateTabCacheKey` was introduced returning `tab:${...}` — establishing the `tab:` namespace as **a separate, parallel namespace** from `search:`.

### 5.2 `57eca4f5` — 2025-05-06 15:32 PT (~6 hours after prefetch creation) — *internal normalization added*

**Commit message subject:** "Enhance caching system with tiered TTL and metrics tracking"

(Note: this is the second attempt at this change. An earlier same-day commit `54bfbf65` at 14:54 PT made similar changes but was reverted at 14:58–15:32 PT by `59fd630a` "revert(client, cache, search) : roll back". The `57eca4f5` redo is what stuck.)

**Relevant delta to `generateSearchCacheKey`:**

```diff
 export function generateSearchCacheKey(query: string, collection: string, profile: string): string {
-  return `search:${query}:${collection || 'default'}:${profile || 'default'}`;
+  const normalizedQuery = (query || '').trim().toLowerCase();
+  const normalizedCollection = (collection || 'default').trim();
+  const normalizedProfile = (profile || 'default').trim();
+  return `search:${normalizedQuery}:${normalizedCollection}:${normalizedProfile}`;
 }
```

The function signature is unchanged. The `search:` prefix is unchanged. The internal change is that query/collection/profile are now `.trim().toLowerCase()`-ed (query) and `.trim()`-ed (collection/profile) inside the function body.

**Classification:** Same-day infrastructure change, post-prefetch. The prefetch endpoint's caller already passes a `normalizedQuery` (lowercased + trimmed at `prefetch.ts:80` before calling the generator), so this commit is effectively a no-op for prefetch's cache-key output as long as `collection` and `profile` were also previously normalized — which in prefetch's call they always were (`collection` and `profile` come from `req.query` and are static values like `seattleu~sp-search` and `_default` in practice). For prefetch.ts, this commit is benign.

The same commit added a `tab:` and `search:` substring sniff inside `getCachedData` / `setCachedData` for use with the new tiered-TTL and metrics-tracking layer — see `lib/cache.ts` current lines 270 and 272 / 374 and 376 (`key.startsWith("search:")` and `key.startsWith("tab:")` branches). The prefetch.ts call to `setCachedData(cacheKey, response.data, cacheTTL)` flows through this sniff but, given prefetch's key prefix is `search:`, is binned correctly into the search-popularity branch — not a mismatch.

### 5.3 `a8e2b38f` — 2026-01-20 — *Redis env var rename* (cache-flush mechanism)

**Commit message subject:** "fix(cache): update Redis environment variables to new Upstash instance"

**Relevant delta:** Replaced `Fall_0925_KV_URL` / `Fall_0925_REDIS_URL` env-var lookups with `su_search_dev_012026_KV_URL` / `su_search_dev_012026_REDIS_URL`. No function signature changes, no key prefix changes, no normalization changes. Pure infrastructure swap to a new Upstash instance.

**Classification:** Maintenance. This commit pointed `lib/cache.ts` at a different physical KV store — which effectively flushed all existing cache content per the cache audit's observation that env var renames are "the system's actual cache-flush mechanism." For the prefetch audit, this is a connection-target change with no semantic-key impact: prefetch's `setCachedData` calls reach the new store with the same keys.

### 5.4 What did NOT change cache.ts in a way that affected prefetch

The following commits touched `lib/cache.ts` but did not change `generateSearchCacheKey`'s output or signature, did not change the `search:` prefix, did not change the `setCachedData` interface, and did not change the prefetch-relevant call path:

- `54bfbf65` (2025-05-06) — added tiered TTL / metrics; **reverted by `59fd630a`**.
- `59fd630a` (2025-05-06) — the revert.
- `02815de9` (2025-09-10) — TTL value increase (12 → 20 hours); does not affect prefetch's TTL (prefetch passes `cacheTTL: 300` explicitly).
- `e4af75e7` (2025-09-02) — env-var update for a different store (precedes the 2026-01-20 store switch).
- `f09cc5ef` (2025-10-01) — suggestions-API TTL correction; suggestions-only, not prefetch.
- `98730aac` (2025-10-01) — version/date increment in file headers; cosmetic.

These are listed for completeness; none are classified into the prefetch timeline.

---

## 6. Observations from Phase 1 evidence (factual; puzzle resolutions deferred to Phase 2)

These are direct observations that fall out of Phase 1 inventory. They are not Phase 2 resolutions — they are unprocessed evidence. Phase 2 will compose them into the puzzle answers.

1. **Single-commit creation.** `prefetch.ts` was authored complete in one commit with a multi-line, articulated commit message describing the design intent. No staged or incremental rollout.

2. **Race shape is original.** The 202-before-cache-write timing pattern (`apiClient.get(...).then(setCachedData).catch(...)` issued without `await`, immediately followed by `return res.status(202).json(...)`) is **verbatim from the creation commit**. It was not introduced by a later refactor; it was the design from line one. The commit message uses the phrases "non-blocking way" and "fire and forget" (the latter as an inline comment at the original L106, preserved in current L119). The pattern was intentional — whether it was correctly intentional is Phase 2 work.

3. **Backend-direct call is original.** `apiClient.get('/funnelback/search', ...)` was the original target. The endpoint has never routed through the internal `/api/search` handler; that choice has been stable from creation.

4. **Namespace at the *generator* level is stable and matches `search.ts`'s generator.** Prefetch writes via `generateSearchCacheKey` → `search:${normalizedQuery}:${collection}:${profile}`. This generator's prefix was `search:` before prefetch existed and is `search:` today. The function's body changed once (`57eca4f5` added internal normalization, ~6 hours after prefetch shipped) but the prefix and the function signature are stable. This means: if `search.ts` calls the same `generateSearchCacheKey` for the same `(query, collection, profile)` tuple, the lookup key matches the prefetch write key.

5. **What the listener audit established about FE-server-side behavior does not appear in cache.ts's commit history of `generateSearchCacheKey`.** The mismatch identified in `audit/fe-listener-audit-2026-05-06.md` — that `form=partial` requests get binned into the `tab:` namespace via substring-inference fallback in `search.ts:127–145` — would necessarily come from a `search.ts` change (out of this audit's scope), not from a `cache.ts` change to `generateSearchCacheKey`. The cache.ts generator itself never bins anything into `tab:`; that helper produces `search:` keys deterministically. The mismatch, whatever its origin, is *external* to the generator.

6. **The FE-side de-normalization (489fd47b) was orphaned.** When the FE function stopped pre-normalizing the query (one hour after creation), the server-side normalization at `prefetch.ts:80` continued to do the work. Net effect on the cache key: nil. Net effect on URL-layer artifacts (request logs, query-string params, X-Prefetch-Request headers): query reaches the prefetch endpoint un-lowercased. The implications for downstream consumers of those URL-layer artifacts are not in this audit's scope.

7. **Zero post-creation edits to `prefetch.ts`.** Across one year and five days (2025-05-06 to 2026-05-11), the prefetch endpoint has not been modified. No fix commits, no debug commits, no version increment, no comment update, no log-message adjustment. The file's `@version 1.0.0` is original.

8. **`pre-render.ts` was added approximately 4 months later** (2025-09-04, commit `0624d09e`), in a commit that did not modify `prefetch.ts` and did not modify the `prefetchSearchResults` function body. Pre-render was wired into header form submission as a new mechanism, parallel to the existing prefetch-on-typing path. This is the answer to Puzzle G's chronology anchor: they were *not* added as a pair.

9. **No commit message in the entire integration.js or prefetch.ts history mentions "prefetch race," "prefetch cache miss," "prefetch fix," "prefetch namespace," "cache mismatch," or similar.** The grep `git log -G 'prefetch' -- public/integration.js` returns the commits already classified above. No diagnostic commits exist.

10. **The May 5 "feat(integration): conditional prefetch search-test" commit (`d253236488`, 2025-05-05) is unrelated terminology overlap.** This commit predates `prefetch.ts` by one day and adds HTML `<link rel="prefetch">` / `<link rel="preconnect">` / `<link rel="preload">` resource hints triggered by a search-toggle click. It does not interact with the `/api/prefetch` endpoint or the `prefetchSearchResults` function. The word "prefetch" is doing double duty (browser-level resource hint vs. data-caching endpoint) but the mechanisms are independent.

---

## 7. Commits not entered into the timeline (ambient context, not classified)

These commits occurred within the relevant time window but did not touch any of the three scope files (prefetch.ts, integration.js function-scoped to `prefetchSearchResults`, cache.ts key-generator-scoped). They are noted only so future re-derivation does not re-investigate them:

- `bae4f96a` (2025-05-07): "Implement cache-first search optimization" — added `pages/api/check-cache.ts` and modified `search-page-autocomplete.js`. Did **not** modify prefetch.ts, the prefetch function, or cache.ts key generators. Out of timeline scope.
- `489fd47b`'s SessionService companion changes: covered in §4.2 only for the integration.js delta; the SessionService.js delta is out of scope.
- Various `pages/api/search.ts` commits (form=partial-related tab-detection logic added 2025-04-16 in `883afc6d` and `c280e1a3`, plus subsequent September 2025 cache-header debugging): out of scope per the brief's three-file breadth limit. Phase 2 may need to reference these for cross-artifact synthesis but Phase 1 deliberately stops at the boundary.

---

## 8. Phase 2 puzzle preview (not resolved here)

The following puzzles from the brief are now anchored by Phase 1 evidence and ready for Phase 2 interpretation. The bracketed pointers indicate where Phase 1 evidence lives.

- **A. Original intent.** [§3.1 commit message; §6.1] — the creation commit articulates "improves perceived search performance by pre-warming the Redis cache while users are typing." Articulated intent, not residue.
- **B. Race baked in vs. drifted in.** [§3.1; §6.2] — baked in from the creation commit. Phase 2 to assess whether the developer believed the cache write would complete before user submit, and whether timing-race awareness existed.
- **C. Namespace mismatch genesis.** [§5; §6.4; §6.5] — at the generator level, prefetch and search.ts have always shared the `search:` namespace. The listener-audit-identified mismatch comes from `search.ts`'s substring-inference fallback binning `form=partial` requests as `tab:`, which is **outside this audit's scope at the source-file level** but Phase 2 should reconcile what evidence we have. The relevant `search.ts` change date (2025-04-16, `2242e5f6` / `883afc6d` / `c280e1a3` for the tab-detection logic) **predates** prefetch creation by 3 weeks. Phase 2 will need to consider whether the mismatch was therefore structurally present at prefetch's birth.
- **D. Why bypass `/api/search`.** [§3.1; §6.3] — original design choice. No commit message in the prefetch history (one commit) addresses the choice explicitly beyond "non-blocking way."
- **E. Awareness of failure modes.** [§6.7; §6.9] — zero post-creation commits to prefetch.ts, zero diagnostic commit messages in any related file. Phase 2 to assess what this absence implies.
- **F. Feature lineage.** [§3.1] — no boilerplate signature in the original commit, no commit-message reference to an external template. The code style is consistent with other Vic-Chimenti-authored API routes in this repo (`pages/api/search.ts`, `pages/api/suggestions.ts`). Phase 2 to assess whether this is from-scratch original or adapted from a known pattern.
- **G. pre-render relationship.** [§4.4; §6.8] — pre-render came **4 months after prefetch**. Not added as a pair. Phase 2 to assess whether pre-render was a recognition-of-failure response or an additive layer.

---

## 9. Cross-artifact refinements to existing audits (Phase 1 evidence flags)

Phase 1 evidence does not yet justify changes to other audit documents, but it does surface two items that Phase 2 (or the architectural conversation upstream) may need to act on:

1. **`audit/fe-listener-audit-2026-05-06.md`** noted prefetch's namespace mismatch with the search submit lookup. Phase 1 evidence confirms the generator-level namespace is consistent (`search:`); the mismatch is downstream in `search.ts`'s substring-inference fallback, not in prefetch's write. This refinement may belong in Phase 2 or a future cross-cutting note — Phase 1 only records the evidence.

2. **`audit/fe-cache-audit-2026-05-04.md`** lists prefetch as one of the five `setCachedData` call sites with its own normalization pattern. Phase 1 evidence confirms prefetch's normalization is *both* server-side (at `prefetch.ts:80`) *and* implicitly via the generator (since `57eca4f5` added internal normalization). The pattern is technically double-normalized for prefetch but the result is unchanged. No refinement needed to the cache audit's headline finding, but the "four different normalization patterns" framing might be re-examined in Phase 2 given the generator-level normalization layer.

---

## 10. Developer-review checkpoint

Phase 1 stops here.

**Open questions for the developer-review checkpoint:**

1. Does the Phase 1 timeline as classified match your recollection / project history? Specifically: was the May 6 prefetch commit and the same-day cache-tiered-TTL commit (`57eca4f5`) sequenced as the timeline reads (prefetch first at 09:23, then `54bfbf65` at 14:54, reverted at 14:58, redo `57eca4f5` at 15:32), or is there context that reorders the intent?

2. The pre-render mechanism (added 2025-09-04) coexists with prefetch without overlap. Is there a recollection or written record (in the companion docs not visible to this session) of why pre-render was added on top of prefetch rather than replacing it? Phase 2 will speculate from absence-of-evidence, but if positive evidence exists in conversation history, it would materially constrain Puzzle G's resolution.

3. Phase 1 finds no diagnostic commits — no "fix prefetch," no "debug prefetch race," no "prefetch namespace investigation." Is this consistent with your recollection? Phase 2's resolution of Puzzle E ("awareness of failure modes") depends on whether the absence of diagnostic commits reflects (a) the developer never noticing the issues, (b) the issues being noticed but logged elsewhere and never re-committed, or (c) the issues being noticed but deprioritized.

4. Was the `setOriginalQuery`-style residue pattern (dead consumer with no producer) present anywhere in the prefetch path? Phase 1 inspection of `prefetch.ts` and the prefetch function shows no such residue — every function called is defined. Confirming this aligns with your read of the file would close out one potential "is this dead code" branch in Phase 2.

**Awaiting:** developer review of the Phase 1 timeline before Phase 2 puzzle resolutions are committed to writing. Per the brief's standing two-phase cadence.

---

## 11. Evidence-call reproducibility

For future re-derivation or verification, the principal commands used:

```sh
# Existence and singularity of prefetch.ts creation
git log --all --follow --pretty=format:'%H|%ad|%an|%s' --date=short -- pages/api/prefetch.ts
diff <(git show b6ba756e:pages/api/prefetch.ts) pages/api/prefetch.ts

# Function-scoped FE history (the syntax `-L :name:file` failed for this function;
# fall back to -G content search):
git log -G 'prefetchSearchResults' --pretty=format:'%H|%ad|%s' --date=short -- public/integration.js

# Cache.ts generator history
git log -G 'function generateSearchCacheKey' --pretty=format:'%H|%ad|%s' --date=short -- lib/cache.ts
git log -G 'normalizedCollection\|normalizedProfile' --pretty=format:'%H|%ad|%s' --date=short -- lib/cache.ts

# Cross-confirming no diagnostic commits
git log -G '/api/prefetch' --pretty=format:'%H|%ad|%s' --date=short

# Companion pre-render anchor
git log --follow --pretty=format:'%H|%ad|%s' --date=short -- pages/api/pre-render.ts

# Blame snapshot of current file
git blame pages/api/prefetch.ts | awk '{print $1}' | sort -u
# → returns only b6ba756e
```

These commands collectively reproduce the Phase 1 timeline without re-reading this audit doc.

---

# Phase 2 — Puzzle Resolutions, Rebuild Decision Shape, and Meta-Lesson

*Appended 2026-05-11 following developer-review checkpoint. Phase 1 sections (§0–§11) preserved verbatim per brief. New sections are numbered §12 / §13 / §14 to avoid collision with the existing §11 (Evidence-call reproducibility); the Phase 2 brief drafted §11 / §12 / §13 in the assumption that Phase 1 ended at §10, but Phase 1 in fact extended to §11. Integer shift only — content faithful to the brief.*

## §12 Framing correction (developer-review checkpoint outcome)

Phase 1 closed with §10's open questions and the implicit synthesis that the code's shape — Redis writes from creation, canonical `search:` namespace, key generator shared with the intended `/api/search` read side — supported a "coherent paired Hypothesis B design" reading. On developer review, that reading has been **corrected**: the prefetch + pre-render system was built reactively, not as a coherent paired design.

Per the project's standing principle that **recollection is authoritative on intent and history while code is authoritative on current behavior**, the recollection wins. The corrected reading is that the code's shape is *consistent with* Hypothesis B but does not constitute evidence that B was the *intent*. Absence of supporting evidence — no read-side handler at creation, no diagnostic commits in a year, no namespace contract documented anywhere, no recollected coherent design — means the audit cannot recover a design intent because there wasn't a coherent one to recover.

Phase 2 reports this as a finding, not as an audit failure. The audit's value to the rebuild is a worked example of what reactive building produces, not a recovered specification.

This framing applies retroactively to the puzzle resolutions below. Where Phase 1's §8 puzzle preview hinted at a more coherent-intent interpretation, the resolutions in §12.A and §12.G in particular show that hint was over-fit on shape evidence and is corrected here. Phase 1 text is left unedited per brief — the audit document is a record of how thinking developed, not a reconciled final state.

## §12.A — Puzzle A: Original intent

The May 6 listener audit chat established a three-hypothesis framing of what prefetch's original intent might have been:

- **Hypothesis A — browser HTTP cache warming.** The prefetch request causes the browser's HTTP cache to hold the response, so a later user-submitted request finds the response without a network round trip.
- **Hypothesis B — Redis pre-render system.** The prefetch request causes the FE-server's Redis cache to hold the response, so a later read-side handler finds the response without a backend round trip.
- **Hypothesis C — Funnelback backend warming.** The prefetch request causes Funnelback's upstream caches (and/or warm container state) to be populated, so a later request to Funnelback resolves faster regardless of whether anything in front of Funnelback caches the response.

Applying Phase 1 evidence:

- **Hypothesis A is contradicted.** Redis writes via `setCachedData` are present from line one of the creation commit (§3.1). The FE-side prefetch issues an AJAX call (`fetch(prefetchUrl, {...})` consuming `apiClient.get` server-side), not a `<link rel="prefetch">` resource hint and not a `fetch()` configured with Cache-Control / CORS shapes that would let the browser HTTP cache reuse the response across origins. There is no Cache-Control machinery designed to make the browser HTTP layer serve a later submit. If the original intent had been browser HTTP cache warming, the code shape would not include `setCachedData(cacheKey, response.data, cacheTTL)` — that whole arm would be absent.

- **Hypothesis B's shape is the closest match.** The Redis write at `prefetch.ts:134` uses `generateSearchCacheKey` to produce a `search:`-prefixed key — the canonical namespace generator that an intended-but-broken `/api/search` read side would naturally use. If a coherent paired design had been the intent, this is the namespace contract that pairing would imply.

- **Hypothesis C is residual.** The `prefetch=true` backend query parameter is original (`prefetch.ts:127`) and propagated through `apiClient.get('/funnelback/search', { params: { ..., prefetch: 'true', ... } })`. This is consistent with a backend-warming layer the original author added on top, but it is not the anchoring architecture — the surrounding code is not fire-and-forget-to-backend-only. C is best read as a secondary belt rather than the load-bearing design.

**Resolution:** The code's shape is most B-like, but per developer recollection there was no coherent paired design at creation time. **Shape consistency is not intent evidence.** The audit cannot recover a design intent because there wasn't a coherent one to recover.

Reported as a finding. The implication for the rebuild is that any "what was the original intent" question this audit was meant to answer has no answer to recover — the rebuild's design phase makes the design from first principles, not by reconstructing the original.

## §12.B — Puzzle B: Race baked in vs. drifted in

Settled at Phase 1 (§3.1, §6.2). The 202-before-cache-write race is **original**: `apiClient.get(...).then(setCachedData)` issued without `await`, followed immediately by `res.status(202).json({ status: 'accepted', ... })`, are verbatim from commit `b6ba756e`. The inline comment `// Use a non-blocking approach - fire and forget the backend request` at original L106 (current L119) makes the pattern explicit at the source.

Not drift. No subsequent commit to prefetch.ts could have introduced the race — there are no subsequent commits.

Restated here only for completeness; no additional interpretive work is needed.

## §12.C — Puzzle C: Namespace mismatch genesis

Settled at Phase 1 with the reframing required by §12's framing correction.

At the *generator* level there was never a mismatch. `generateSearchCacheKey` has produced `search:`-prefixed keys since `2242e5f6` (2025-04-16, three weeks before prefetch creation), and `prefetch.ts` has always called that generator. The write side has been internally consistent from the first second of prefetch's existence.

The mismatch identified in the listener audit's combined puzzles 2 + 4 is **downstream in `search.ts`'s substring-inference fallback at L127–L145**, which routes `form=partial` reads to the `tab:` cache namespace rather than the `search:` namespace where prefetch deposits its writes. That fallback's authorship history is outside this audit's source scope (the brief scopes cache.ts strictly to key-generator commits).

The prefetch author wrote to the canonical namespace. The divergence is what `search.ts` later did with form=partial-flagged reads — and per the corrected framing, this is not a coherent-design-broken-by-later-drift story. It is a no-coherent-design story: the prefetch author and the `search.ts` substring-fallback author were not coordinating to a shared contract, because no shared contract was ever written down.

## §12.D — Puzzle D: Why bypass /api/search

**Brief resolution:** no recorded reasoning.

The backend-direct call (`apiClient.get('/funnelback/search', ...)` at `prefetch.ts:121`) is original at creation. There is no commit message, code comment, or surrounding-commit context articulating the choice. The commit message subject and body (quoted in full at §3.1) do not address why prefetch routes around the internal `/api/search` handler.

Per the corrected framing in §12, this is consistent with **reactive choice** rather than deliberate architectural decision. The hypothetical reasons that might justify the choice — avoiding recursive API-boundary nesting, avoiding serverless cold-start nesting, simpler control flow for a fire-and-forget path — are reader-supplied; nothing in the archaeology supports them as the original developer's reasoning.

The rebuild's design phase can independently evaluate whether to route a prefetch-shaped mechanism through an internal API handler or directly to the upstream. Either choice is defensible; the original archaeology does not support one over the other.

## §12.E — Puzzle E: Awareness of failure modes

Settled at Phase 1 (§6.7, §6.9).

Zero diagnostic commits across the prefetch path in **one year and five days**. `git log -G '/api/prefetch'` returns only the creation commit plus seven audit docs from April–May 2026. No "fix prefetch," no "investigate," no "race," no "namespace," no version increment, no comment update, no log-message adjustment. The mechanism shipped at `@version 1.0.0` and stayed there.

Failure modes were **never noticed in production**. This is consistent with the listener audit's finding that actual user-visible speed comes from the 1003ms pre-render boundary plus the MISS-response-used-directly handoff, which collectively masked prefetch's true hit-rate from operational visibility. If prefetch had been producing the speed effects attributed to it, the developer would have had no signal it was failing; if it was failing silently, the surrounding mechanisms were producing enough perceived speed that nothing prompted investigation.

Per §12's framing correction, the absence of diagnostic commits is also consistent with the **no-coherent-design** reading. A coherent paired design with a documented namespace contract and explicit performance budget would have produced operational checks against that contract; the absence of such checks is consistent with no contract having been articulated.

## §12.F — Puzzle F: Feature lineage

Interpretive work performed against the creation commit's `pages/api/prefetch.ts` source.

**File header convention.** The header block uses `@fileoverview`, `@license MIT`, `@author Victor Chimenti`, `@version 1.0.0`, `@lastModified 2025-05-06`. This pattern is consistent with other Vic-Chimenti-authored API routes in the same repo (`pages/api/search.ts`, `pages/api/suggestions.ts`) at the time of authorship — same tag set, same ordering, same "Victor Chimenti" attribution, same MIT license declaration. It is the developer's house style for new API route files.

**JSDoc and signature pattern.** The endpoint uses `export default async function handler(req: NextApiRequest, res: NextApiResponse<PrefetchResponse>)` — the standard Next.js Pages-Router API route shape. The `PrefetchResponse` type alias defined just above is hand-written, not imported from a shared types module. The JSDoc block on `handler` uses `@param req` / `@param res` conventionally. No deviation from the Next.js API route idiom; nothing distinctive of an external template.

**Request handling idioms.** Several patterns are characteristic of the developer's house style rather than an external template:

- `Array.isArray(x) ? x[0] : x` to coerce possibly-array query parameters appears five times in this single file. Other Vic-Chimenti API routes in the repo use the same pattern inline rather than abstracted to a helper. This is idiomatic Next.js but coded explicitly rather than abstracted — a stylistic tell, not a template tell.
- Log prefix convention: `[PREFETCH-API]` for endpoint logs, `[PREFETCH-METRICS]` for metrics. This matches the developer's broader log-prefix convention across the repo (e.g., `[CACHE]`, `[CACHE-METRICS]` from `lib/cache.ts`).
- The "non-blocking approach - fire and forget" inline comment at original L106 is verbose and prose-style, more characteristic of in-author commentary than copied boilerplate.
- The trailing `// TODO: Add proper metrics tracking in the future` at original L216 with the explicit acknowledgment that `trackPrefetchMetrics` is a development-mode `console.log` stub is a placeholder pattern the developer uses elsewhere — it is not template residue (a template would have shipped with either real metrics or no metrics function at all, not a placeholder).

**Vercel template signatures.** No `/api/hello.ts`-style example-cookie-cutting, no `Welcome to Next.js` boilerplate residue, no `vercel.json` co-changes in the commit, no `// example` comments.

**Funnelback / Squiz template signatures.** None. The only Funnelback-specific element is the `apiClient.get('/funnelback/search', ...)` URL fragment, which is a string literal pointing at the internal proxy route shape — not a Funnelback SDK call, not a generated client, not a Squiz boilerplate import.

**Conclusion:** The prefetch endpoint is **from-scratch authorship by the original developer**, in the developer's established house style for new Next.js API routes in this repo. It is not adapted from a recognizable Vercel, Next.js example, or Funnelback/Squiz template.

**Implication for the rebuild:** Lineage does not constrain the rebuild's choice of shape. If the rebuild includes a prefetch-shaped mechanism, the original's structural idioms are the developer's house style and can be carried forward or replaced according to the rebuild's broader design conventions, without losing fidelity to an external template.

## §12.G — Puzzle G: pre-render relationship

Largely settled at Phase 1 (§4.4, §6.8); the chronology and the no-pairing-in-design finding stand. Pre-render's creation (`0624d09e`, 2025-09-04) is **four months after** prefetch's creation (`b6ba756e`, 2025-05-06). Per the developer's recollection at the checkpoint, also **not paired in design intent** — the "coherent paired Hypothesis B system" reading is an over-fit on the code's shape rather than a recovered intent.

Pre-render was added on top of prefetch because the system was being built reactively, not because pre-render is the designed "read side" of a designed pair. The fact that pre-render writes via a different mechanism, on a different trigger (form submit vs. typing), with a different lifecycle, is the structural signature of reactive accretion rather than coherent pairing.

Pre-render's own archaeology is **out of scope for this audit** per the brief. If the rebuild's design phase later needs pre-render's history for its own decisions, a separate Phase 1 / Phase 2 archaeology audit can fire against `pages/api/pre-render.ts`.

---

## §13 Rebuild Decision Shape

The original brief outlined three rebuild options for the prefetch mechanism: **remove entirely**, **re-articulate as warming**, **rebuild as cache-mirror**. Each is revisited below against the corrected framing in §12.

### §13.1 Remove entirely

**Becomes more viable, not less, under the corrected framing.**

The implicit concern that lingered through Phase 1 — that removing prefetch would orphan pre-render — assumed they were a designed pair. They weren't. Removing prefetch from the rebuild requires **no compensating change to a paired read side**, because the paired read side as a coherent design didn't exist.

Pre-render in production is doing whatever work it does via the 1003ms boundary plus the MISS-response-used-directly handoff established in the listener audit, not via cache hits from prefetch's writes. That mechanism does not require prefetch to exist. If the rebuild's design phase does not need a prefetch-shaped mechanism for its own reasons (faster perceived speed via cache hits, server warming, etc.), **remove is now the default option**.

### §13.2 Re-articulate as warming

**Still viable if** server-side warming (Vercel serverless container, Redis client connections, possibly upstream Funnelback container/cache state) is empirically a benefit.

This is **separately testable and is not an archaeology question.** The audit cannot say whether warming is real. It can only say that *if* warming is the actual contribution prefetch is currently making in production, the rebuild should articulate that contract explicitly — with documented behavioral expectations, observability for the warming effect, and explicit decisions on TTL / scope / trigger — rather than carry forward the implicit one.

Re-articulation also removes a load-bearing piece of misframing: under the current implicit contract, prefetch is *called* a cache-warmer but is *acting* as a connection / container warmer at best. Naming the actual contract removes that drift.

### §13.3 Rebuild as cache-mirror

**The right shape if and only if the rebuild commits to coherent paired design.**

The corrected framing makes this conditional explicit: cache-mirror is *not* a one-line change to route prefetch through `/api/search`'s cache write path. It is a design commitment to:

- A write side with a documented namespace contract.
- A read side that uses the same contract.
- No substring-inference fallbacks that route around the contract.
- No fire-and-forget timing race between write and the response the user is about to need.
- Explicit decisions on every parameter the cache key depends on (collection, profile, form, tab, filters, sessionId-scoping, anything else the upstream request shape captures).
- Diagnostic visibility — operational metrics on hit-rate, namespace collisions, race-loss frequency — present from day one.

Adopting cache-mirror **without that commitment reproduces the reactive-build pattern in new code**. The original prefetch is what happens when a write-side mechanism ships against an aspirational paired read side that gets queued for later; the rebuild's version of "later" is the moment the next developer needs to debug a cache miss with no contract to check against.

### §13.4 No recommendation between the three

The rebuild's design phase makes the call against its broader architecture, not against archaeology evidence.

The archaeology constrains the option space (cache-mirror is conditional on a coherent-design commitment that did not exist originally; remove is the default option since removal does not orphan pre-render; re-articulation is empirically conditional on warming being real). It does not pick among the options.

---

## §14 Meta-Lesson

The audit's most valuable output is not any specific puzzle resolution. It is a worked example of what reactive building produces, on a system the developer built and maintains.

The patterns visible across Phase 1 evidence:

- **Single-commit creation of a load-bearing mechanism, then no edits in a year while the mechanism's failure modes accumulated silently.** `prefetch.ts` shipped at `@version 1.0.0` and stayed there for 370+ days. The accumulating failure surface (timing race, namespace consumption pathology in `search.ts`, dead metrics stub) was invisible to the system that could have corrected it.

- **No diagnostic commits, suggesting the mechanism's failure modes were never operationally visible.** Speed effects credited to prefetch in current-system mental models were actually being produced by other mechanisms — the 1003ms pre-render boundary, MISS-response-used-directly handoff, eventual `/funnelback/search` direct paths. The credit was misallocated because there was no signal to allocate it correctly.

- **A paired-system design implied by code shape (write side writing to a namespace the read side would naturally use) but not realized at creation.** The read side was added four months later as a separate effort. The broken consumption path in `search.ts` (form=partial substring inference routing reads to the `tab:` namespace) was never traced back to its origin in prefetch's writes, because no one was looking — there was no contract to detect the violation against.

- **Hypothesis-shaped framing of original intent that, on developer review, has to be abandoned because there wasn't a coherent intent to recover.** The Phase 1 synthesis read Hypothesis B's shape as evidence of Hypothesis B's intent. The developer's recollection corrected this: the shape is the residue of reactive choices that happen to be locally B-shaped, not the expression of a B-shaped plan.

The rebuild's design phase must make **explicit decisions on each of these surfaces**:

- **Cache namespacing** should be a documented contract, not an inferred-from-substring heuristic.
- **Paired write/read systems** should be designed and shipped as pairs, not as a write side with an aspirational paired read side queued for later.
- **Diagnostic visibility** should be a first-class concern from day one, not assumed-emergent.
- **Original-intent documentation** should be written at creation time, not reconstructed years later from commit messages that don't articulate intent. The commit message at `b6ba756e` is unusually articulate by this codebase's standards and *still* underspecifies the contract; if even that level of documentation is insufficient, the rebuild's bar is higher.

The lesson generalizes across the remaining audit sequence. HTML audit, rendering audit, non-search-to-search redirect audit, and any conditional audits queued behind them should be read as potentially surfacing the same pattern: **reactive accretion masquerading as design**. The pattern's tell is the same as it was here — code shape that suggests a coherent system, plus the absence of diagnostic / documentation evidence that the system was actually planned.

### §14.x Cross-artifact refinements

The project instructions' standing "prefetch redesign-vs-removal" framing should be updated to reflect that **removal is now the default option**, not one of three peer options. The other two options remain viable under their respective conditionals (cache-mirror conditional on coherent-design commitment; warming conditional on the empirical warming question being settled positively). The standing anti-pattern "treating prefetch as needing tuning rather than redesign" remains correct and **should not be softened** — Phase 2 reinforces the anti-pattern rather than relaxing it, since the corrected framing rules out tuning as a path to a coherent contract that never existed.

The listener audit's framing of prefetch's "actual contribution is more likely server-side warming" remains accurate as a **hypothesis** but does not constitute **evidence** — the warming contribution is empirically untested, and this audit cannot test it. The rebuild's design phase, not this audit, would test it (or decide not to test it because the warming benefit, even if real, does not justify the operational surface area).
