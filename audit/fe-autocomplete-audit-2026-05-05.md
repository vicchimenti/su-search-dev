# Frontend Autocomplete Audit — 2026-05-05

## 1. Scope and posture

**Target.** The autocomplete subsystem as a connected lifecycle — from Funnelback as suggestion-data source, through the proxy, through the FE-server boundary (`/api/suggestions`), through the two FE consumers (header autocomplete on non-search pages, search-page autocomplete on `/search-test/`), through the click-dispatch surfaces, through the redirect from header-suggestion click into the search page, to the seam where the FE hands data to the dropdown DOM-construction code.

The audit captures the two flows as one shared backbone: where they share, where they diverge, and what the data contract looks like at each layer.

**Files read directly.**

- `pages/api/suggestions.ts` — full file (174 lines).
- `public/integration.js` — read in three targeted ranges covering all autocomplete- and redirect-relevant sections: lines 1–450 (config + DOMContentLoaded + `setupHeaderSearch` + `normalizeQuery`), lines 450–900 (`prefetchSearchResults`, `fetchHeaderSuggestions`, `renderHeaderSuggestions`, `setupResultsSearch`, `processUrlParameters`, `performStandardSearchFallback`), lines 899–1320 (private `performSearch`, `attachResultClickHandlers`, `trackResultClick`, `window.trackSuggestionClick`, `window.performSearch`, exposed globals). Sections explicitly out of scope: `setupConditionalPreloading`, `preloadSearchResources`, `findSearchComponents` (light read for context), `prefetchSearchResults` (read for surface only), `trackTabChange` (out of scope).
- `public/search-page-autocomplete.js` — full file (1135 lines). All 1135 lines are autocomplete subsystem or pre-render-related responsibility.

**Dependency surface contracts confirmed (no deep traversal):** `lib/cache.ts` (`setCachedData`, `getCachedData`, `DEFAULT_TTL` exported as expected, all consumed by suggestions.ts at lines 60, 109, 109 respectively); `lib/api-client.ts` (`createApiClient` at line 164, `BACKEND_API_URL` defaulting to the proxy URL at line 17, used by suggestions.ts:71); `lib/ip-service.ts` (`getClientInfo` at line 225, `getClientIpHeaders` at line 263 — see §4 for usage).

**Reference documents (not re-derived):** `audit/proxy-audit-2026-04-29.md`, `audit/funnelback-endpoint-dictionary-2026-05-01.json`, `audit/fe-endpoint-dictionary-2026-05-01.json`, `audit/network-investigation-2026-05-01.md`, `audit/fe-cache-audit-2026-05-04.md`.

**Stop rule.** Single-pass code reading at audit-time state of each file, one level of dependency, no proxy-repo crossings, no source modifications. Out of scope: FTL templates, dropdown CSS/visual styling, deep cache architecture, deep listener wiring, other redirect paths beyond header-suggestion-click, SessionService internals.

**Posture.** Read-only on source. Writes only to `audit/`. Bash usage limited to grep/rg/find/ls/wc/cat/head/tail/diff/read-only git per the local allowlist.

## 2. Verification status

All claims about code cite a specific file and line range as it exists at audit time.

**File versions at audit time:**

- `pages/api/suggestions.ts` — header v3.1.0, lastModified 2025-10-01.
- `public/integration.js` — header v3.3.0, lastModified 2025-09-12.
- `public/search-page-autocomplete.js` — header v3.2.1, lastModified 2026-01-20.

**Bash operations performed during this audit:**

- `wc -l` on the three primary files to confirm sizes (174, 1320, 1135).
- `grep -n -E '^(function|async function|window\.|const |let |var )|setupHeaderSearch|fetchHeaderSuggestions|renderHeaderSuggestions|processUrlParameters|performSearch|trackSuggestionClick|performStandardSearchFallback' public/integration.js` to map structural anchors before chunked reads.
- `grep -n 'getClientIpHeaders\|getClientInfo' pages/api/suggestions.ts` — confirmed `getClientIpHeaders` is imported (line 16) and never called.
- `grep -n 'funnelback-proxy-dev.vercel.app' public/integration.js public/search-page-autocomplete.js public/js/search-index.js public/js/modules/core-search-manager.js` — see §11.
- `grep -n 'trackSuggestionClick' public/integration.js public/search-page-autocomplete.js` — confirmed two distinct definitions (one local function in search-page-autocomplete.js:578, one `window.trackSuggestionClick` in integration.js:1091) and the bare-call site at integration.js:654.
- `grep -n 'normalizeQuery' public/integration.js` — eight call sites and one definition. Notably absent: `fetchHeaderSuggestions`.
- `grep -n -E 'normalizeQuery|searchInput\.value' public/search-page-autocomplete.js` — confirmed zero `normalizeQuery` calls in the file.

**Refinements / contradictions of prior artifacts:**

- The brief's framing that "header normalizes before send" is **incorrect**. Header keystroke fetch (`fetchHeaderSuggestions`) sends only `.trim()`'d input, not `normalizeQuery()`'d. The header normalizes only on form-submit (line 345), prefetch (line 414), and suggestion-click redirect (line 639). The keystroke-suggestions request itself sends a trimmed-only query. The search-page-autocomplete keystroke also sends `.trim()`-only. **Both consumers are equivalent on the suggestions request itself; the asymmetry is in click-dispatch, not in keystroke send.**
- CLAUDE.md and the FE endpoint dictionary count proxyBaseUrl hardcoding at **three** locations. The actual count is **five literals across four files**. See §11 for the full list.
- The FE endpoint dictionary's "three places" finding (line 546) refers to trinity-value duplication (collection/profile/form), not proxyBaseUrl. CLAUDE.md's "three places" finding refers to proxyBaseUrl. The dictionary appears to conflate these two distinct dedup items — they are separate findings with different counts and different scopes. See §11.
- Network investigation's finding that `integration.js:934`'s `performSearch` is the empirical live initiator on suggestion clicks (and `search-page-autocomplete.js:666`'s local `performSearch` appears dead) is consistent with what static analysis sees. See §7.

## 3. Source layer (reference only)

Per the proxy dictionary and existing audits — three Funnelback endpoints back the three buckets:

- **General suggestions.** Proxy `/funnelback/suggest` → upstream Funnelback suggest endpoint. Response shape consumed by FE: array of strings or array of `{ display: string, ... }` objects (search-page-autocomplete.js:387 handles both shapes via `suggestion.display || suggestion`).
- **Staff/faculty suggestions.** Proxy `/suggestPeople` → upstream people suggest endpoint. Response shape consumed by FE: array of objects with fields `title`, `position`, `affiliation`, `department`, `college`, `image`, `url` (search-page-autocomplete.js:407–447).
- **Programs suggestions.** Proxy `/suggestPrograms` → upstream programs suggest endpoint. Response shape consumed by FE: **either** an array of program objects **or** an object `{ programs: [...] }`. The FE handles both shapes at search-page-autocomplete.js:360–363 (`Array.isArray(programs) ? programs : programs.programs || []`). Each program object has `title`, `url`, `description`, and `details.school`.

## 4. FE-server boundary: `pages/api/suggestions.ts`

`pages/api/suggestions.ts:18–118` is the single FE-server endpoint that handles all autocomplete requests from both consumers. It is a `GET`-only handler with CORS pinned to `https://www.seattleu.edu` (lines 23–25).

**Request parsing (lines 39–45).** Extracts `query, type, collection, profile, sessionId` from `req.query`. Only `query` is required. `type, collection, profile` are unused for routing the default case — see fan-out logic.

**Cache integration (lines 56–68, 108–110).**
- Cache key: `` `suggestions:${type || 'all'}:${query}:${collection || 'default'}` `` (line 57). Per the cache audit (`fe-cache-audit-2026-05-04.md:70-77`), this `suggestions:` prefix bypasses the query-popularity / metrics tracking surface in `lib/cache.ts` (the prefix sniff only matches `search:` and `tab:`).
- `getCachedData(cacheKey)` at line 60 (no `options` arg) and `setCachedData(cacheKey, result, DEFAULT_TTL)` at line 109. Effective TTL: 12 hours (per `lib/cache.ts:42`). Fixed — no popularity tiering.
- Sets `X-Cache-Status: HIT` or `MISS` response header (lines 63, 68) — search-page-autocomplete.js does not read this header on the `/api/suggestions` response (it reads it only on the `/api/search` and `/api/pre-render` paths).

**Fan-out (lines 79–106).** A `switch (type)` with three explicit branches plus a default:
- `case 'general'` (line 80): calls `fetchGeneralSuggestions` only.
- `case 'staff'` (line 84): calls `fetchStaffSuggestions` only.
- `case 'programs'` (line 88): calls `fetchProgramSuggestions` only.
- `default` (line 92): runs all three in parallel via `Promise.all` and returns `{ general, staff, programs }`.

The three typed branches are **structurally unreachable from the inspected FE consumers**. Both `fetchHeaderSuggestions` (integration.js:549, sends `{ query, sessionId }`) and `fetchSuggestions` (search-page-autocomplete.js:638, sends `{ query, sessionId }`) omit `type`. Neither reachable client-side caller exercises any of the three typed branches. The FE endpoint dictionary already settled this; this audit confirms it without re-investigating production traffic. The branches are documented structural artifacts — likely debug-time scaffolding from earlier development, not retired feature surface.

**Parameter renaming at the boundary (lines 121–139).** `fetchGeneralSuggestions` constructs the upstream params as:
```
{ partial_query: query, collection: 'seattleu~sp-search', profile: '_default', sessionId }
```
and calls `client.get('/funnelback/suggest', { params })`. **Only the general leg renames** `query` → `partial_query`. The staff (lines 144–147: `{ query, sessionId }`) and programs (lines 162–165: `{ query, sessionId }`) legs forward `query` as-is. This rename is the FE-server boundary's primary semantic transformation and is invisible to the client — the FE always sends `query`.

**Trinity defaults sourcing (lines 124–129).** Collection (`'seattleu~sp-search'`) and profile (`'_default'`) are hardcoded literals in `fetchGeneralSuggestions` only. The staff and programs legs do not send these to the proxy at all. The FE never sends collection or profile to `/api/suggestions` — these values exist server-side only, on the general leg, as a hardcoded handler default. (Cross-reference: this is one of the three trinity duplications the FE endpoint dictionary documents at line 546.)

**Client construction (lines 70–71).** `createApiClient(req.headers)` is called with the request headers — the API client uses these to propagate client IP into `X-Forwarded-For` and similar headers per `lib/api-client.ts:164–198`. Note: this is the cache-blind path (`cacheAware: true` is **not** passed) — per the cache audit (`fe-cache-audit-2026-05-04.md:218`), suggestions.ts does not assert the `X-Cache-Aware: true` contract on the upstream proxy.

**`getClientIpHeaders` import-but-not-used (line 16).** `getClientIpHeaders` is imported from `lib/ip-service.ts` but never called anywhere in the file. Confirmed via grep. This is unused-import residue. (Note for distinguishing: this is debug/refactor residue, not retired-feature residue. The function itself is exported and may be used elsewhere — `lib/ip-service.ts:263` defines it — but the import in suggestions.ts is dead.)

**Logging.** Verbose `console.log` at lines 49, 51, 62, 67, 74, 81/85/89/94, 110 with `[SUGGESTIONS-API]` prefix. Per-request log volume: ~5–7 lines on a fan-out cache miss. Not a finding — noted for the rebuild.

## 5. Header autocomplete flow (`public/integration.js`)

The header autocomplete is the keystroke-driven dropdown that appears under the site's persistent header search input (`#search-input`, located via `findSearchComponents` at integration.js:255). It is set up by `setupHeaderSearch` (integration.js:332) on every page where the input element is present.

**Trigger and debounce (integration.js:391–401).** A debounced input listener with `config.debounceTime = 200` ms (line 33). Requires `query.length >= config.minQueryLength = 3` (line 32). Triggers `fetchHeaderSuggestions(query, component.suggestionsContainer)`. **Note:** a second debounced listener (line 405) attached to the same input, with `prefetchDebounceTime = 300` ms and `prefetchMinQueryLength = 4` (line 35), separately fires `prefetchSearchResults` on every keystroke. So a single keystroke when the query length passes 4 fires both `/api/suggestions` (at 200 ms) and `/api/prefetch` (at 300 ms). This is by design — flagged in §11 as cross-cutting.

**Request construction in `fetchHeaderSuggestions` (integration.js:544–593).** URL is `${config.apiBaseUrl}/api/suggestions?${params}` where `apiBaseUrl = "https://su-search-dev.vercel.app"` (hardcoded, line 28). Params constructed (lines 549–565):
- `query`: the raw input value `.trim()`'d. **No `normalizeQuery()` is called before send.** Confirmed by grep — `normalizeQuery` is never called in `fetchHeaderSuggestions` or its caller (line 392 just calls `component.input.value.trim()`).
- `sessionId`: appended only if `window.SessionService.getSessionId()` returns truthy. Direct inline access — no wrapper.
- No `collection`, `profile`, or `type` parameters are sent.
- No custom headers. Default `fetch()` only.

**Response handling: `data.general`-only consumption (integration.js:601–624).** `renderHeaderSuggestions` extracts `data.general || []` (line 602) and **discards `data.staff` and `data.programs` entirely**. Confirmed: no other code path in integration.js reads `data.staff` or `data.programs` from this response. The debug-log at lines 579–583 reads counts of all three buckets, but only the `general` array is rendered.

This is intentional product behavior, not residue. The header bar's UX real estate cannot accommodate the three-column featured layout that the search-page consumer renders. The fan-out cost (server-side, three parallel proxy calls every keystroke regardless of consumer) is the trade-off the current implementation accepts for endpoint uniformity — one `/api/suggestions` shape serves both consumers. The rebuild faces a real design choice: keep the uniform fan-out (accept the cost), or split into two endpoint shapes (header: general-only; search-page: all-buckets) and accept the divergence cost.

**Dropdown HTML construction (integration.js:610–624).** Builds a flat `<div class="suggestions-list">` containing `<div class="suggestion-item" role="option" data-index="N"><span class="suggestion-text">...</span></div>` per suggestion. Each suggestion renders `suggestion.display || suggestion` to handle the upstream's mixed string-or-object shape. **The seam for the rendering audit is `container.innerHTML = html` at integration.js:623.** The container itself (`#header-suggestions`) is created dynamically by `findSearchComponents` at lines 268–284 if it does not already exist — it is inserted as the next sibling of the header form.

**Suggestion click handler (integration.js:627–661).** Each suggestion item gets a click listener:
1. Read `text` from `.suggestion-text` (line 629).
2. Set `#search-input` value to `text` (lines 633–636) — note the input setter mutation may trigger the debounced `prefetch` listener again on certain browsers; not investigated.
3. Normalize: `normalizeQuery(text)` (line 639). **This is the only normalization that happens on the header path** (other than form-submit).
4. SessionService prep: `window.SessionService.prepareForSearchRedirect(normalizedQuery)` (lines 642–651).
5. Track click: bare `trackSuggestionClick(text, "general", "", text)` at line 654.
6. Redirect: `window.location.href = "/search-test/?query=" + encodeURIComponent(normalizedQuery)` (line 657–659).

**`trackSuggestionClick` resolution at line 654.** The bare call resolves to `window.trackSuggestionClick` (defined at line 1091) via implicit global access. Confirmed: there is no local `trackSuggestionClick` in scope inside the IIFE that wraps the file (the IIFE starts at line 14). The two definitions in the codebase are: `window.trackSuggestionClick` at integration.js:1091 (this one) and a separate local `function trackSuggestionClick` at search-page-autocomplete.js:578 (used inside that file only). The style observation: the call at line 654 is bare rather than explicitly `window.trackSuggestionClick(...)` — minor stylistic inconsistency relative to the explicit `window.SessionService` accesses elsewhere in the same handler. Not a bug; idiomatic JavaScript.

**`type="general"` argument at line 654.** The header click handler hardcodes the `type` argument as `"general"`. This is correct given that header consumes only `data.general`; staff/program clicks are not possible from the header dropdown.

## 6. Search-page autocomplete flow (`public/search-page-autocomplete.js`)

The search-page autocomplete is the three-column dropdown that appears under the on-results-page search input (`#autocomplete-concierge-inputField`). It is set up directly by the file's own `DOMContentLoaded` handler at line 1080, **independently from `integration.js`'s setup** (which on the search page runs `setupResultsSearch`, not anything autocomplete-related). The two scripts coexist on `/search-test/` pages.

**SessionManager wrapper (lines 31–73).** Module-level object that caches a session ID on first init and refreshes from `window.SessionService` on every `getSessionId()` call. The ultimate source is `window.SessionService.getSessionId()` (lines 44, 65). The wrapper provides no behavioral change beyond defensive try/catch around the global access — both consumers (this one via `SessionManager`, integration.js via `window.SessionService` directly) reach the same global.

**Trigger and debounce (lines 1080–1113).** A debounced input listener (lines 1100–1110) with `debounceTime = window.seattleUConfig?.search?.debounceTime || 200` ms and `minQueryLength = window.seattleUConfig?.search?.minQueryLength || 3`. The fallback values match integration.js's defaults — and in practice `seattleUConfig.search` is populated by integration.js's config spread at line 42. So the effective values are 200 ms and 3 chars unless overridden upstream. Triggers `fetchSuggestions(query, suggestionsContainer, true)`.

**Request construction in `fetchSuggestions` (lines 627–663).** URL is `${apiBaseUrl}/api/suggestions?${params}` where `apiBaseUrl` is resolved as `window.seattleUConfig?.search?.apiBaseUrl || "https://su-search-dev.vercel.app"` (lines 633–635). Params constructed (lines 638–643):
- `query`: the raw input `.trim()`'d at line 1101, passed through unchanged. **No normalization on send.** Equivalent to header on this dimension.
- `sessionId`: appended only if `SessionManager.getSessionId()` returns truthy.
- No `collection`, `profile`, or `type` parameters are sent.
- No custom headers. Default `fetch()`.

The request shape is **identical** to integration.js's `fetchHeaderSuggestions` request — same URL, same params, same omissions. The two consumers fan out from the same endpoint with the same payload.

**Response handling: all three buckets consumed (`renderResultsPageSuggestions`, lines 354–575).** Extracts `data.general`, `data.staff`, `data.programs` (lines 356–358). Handles the documented format variance in the programs payload at lines 360–363:
```
const programResults = Array.isArray(programs)
  ? programs
  : programs.programs || [];
```
This anticipates that the upstream may return programs as a bare array **or** as an object `{ programs: [...] }` — variance most likely originating at the proxy or upstream Funnelback level (response shape contract is not pinned).

**Dropdown HTML construction (lines 376–498).** Three-column layout:
- **General column** (lines 380–398): plain `<div class="suggestion-item" role="option" data-index="N" data-type="general">` per item, with `.suggestion-text` showing `suggestion.display || suggestion`.
- **Staff column** (lines 400–458): `<div class="suggestion-item staff-item" data-type="staff" data-url="...">` wrapping an embedded `<a href="${person.url}" class="staff-link" target="_blank" rel="noopener noreferrer">`. Inner content includes optional `<img>` thumbnail, `.suggestion-text` (person.title), and zero-or-more `.staff-role` and `.staff-department` lines (position, affiliation, department, college).
- **Programs column** (lines 460–495): `<div class="suggestion-item program-item" data-type="program" data-url="...">` wrapping an embedded `<a href="${program.url}" class="program-link" target="_blank" rel="noopener noreferrer">`. Inner content: title, school, description.

The seam for the rendering audit is `container.innerHTML = html` at line 501. The container is `#autocomplete-suggestions`, which is **expected to exist in the T4 PageLayout** (it is queried via `getElementById` at line 1088 — if missing, the file's setup returns early at line 1093).

**Embedded `<a target="_blank">` is structurally significant.** The staff and program suggestion items are wrapped in actual `<a href>` links — clicking a staff/program item is a real anchor navigation, not a JS-only handler. This is what enables the click handler's "let the link handle navigation" branch (see below).

**Keyboard navigation (lines 869–1066).** Adds a single `keydown` listener to the search input handling `ArrowDown/Up/Left/Right`, `Enter`, `Escape`. Tracks an `activeItem` and `activeColumn` and supports cross-column movement preserving relative position. `Enter` calls `activeItem.click()` (line 933) — so keyboard-Enter is dispatched through the same click handler as mouse clicks. Defensive: removes any pre-existing `_keydownListener` before adding a new one (lines 884–887) to avoid double-binding across re-renders.

**Suggestion click handler (lines 506–568).**
1. Read `text` from `.suggestion-text`, `type` from `data-type`, `url` from `data-url` (lines 508–510).
2. Build a more detailed `title` with role/department info for staff and program types (lines 513–525) — used only for the analytics payload, not the displayed text.
3. Set `#autocomplete-concierge-inputField` value to `text` (lines 528–533). **No normalization.**
4. Track click: `trackSuggestionClick(text, type, url, title)` (line 536) — this calls the **local** `trackSuggestionClick` defined at line 578, not `window.trackSuggestionClick`.
5. Hide suggestions (lines 539–540).
6. **Special-case staff/program with URL (lines 543–559):**
   - If the click event was on the `<a>` element (`e.target.closest("a")` truthy at line 545): `setTimeout(() => { performSearch(text, resultsContainer); updateUrl(text); }, 100)` (lines 547–553). `return` to allow default link navigation.
   - Else (the click was on the surrounding `<div>` rather than the inner `<a>`): `window.open(url, "_blank", "noopener,noreferrer")` (line 558) and **fall through** to step 7.
7. **General path (lines 561–566):** `performSearch(text, resultsContainer); updateUrl(text);`. **No normalization.**

**The `performSearch` referenced at lines 550 and 564 is the local `performSearch` defined at line 666**, not `window.performSearch`. JavaScript scope resolution prefers the local function over the window property. Confirmed by static analysis: there is no shadowing or rebinding that would cause this resolution to land on `window.performSearch` instead.

**`updateUrl` (lines 777–783).** Local function — uses `window.history.pushState` to set the `query` param without page reload.

**`trackSuggestionClick` local definition (lines 578–624).** Functionally equivalent to `window.trackSuggestionClick` in integration.js: same data shape, same `sendBeacon` strategy, same fallback to `fetch keepalive`, same proxy URL hardcoding. The two implementations differ only in: (a) source of session ID (`SessionManager` vs direct `window.SessionService`), (b) silence on errors (this one) vs `log()` calls (integration.js), (c) the `apiBaseUrl` lookup uses the override path: `window.seattleUConfig?.search?.proxyBaseUrl || "https://funnelback-proxy-dev.vercel.app/proxy"` (lines 599–601).

**Pre-render functions live in this file (lines 168–351).** `checkForPreRenderedContent` and `displayPreRenderedResults` are defined here and exposed globally at lines 1133–1134. They are called from `integration.js`'s `processUrlParameters` (see §9). The file-name-vs-scope mismatch CLAUDE.md notes is empirically real: this file is named "search-page-autocomplete" but contains the pre-render lifecycle helpers as well. Both are search-page-only responsibilities — the file is an aggregation of two concerns under one filename.

**Residue at lines 1127–1130.** The `DOMContentLoaded` handler reads `urlParams.get("query")` into a local `query` variable but **never uses it**. The comment at line 1127 says "Process any URL parameters for initial search with smart pre-rendering" but the actual processing of URL params happens in integration.js's `processUrlParameters` (line 789). This is incomplete-migration residue — likely a leftover from a previous structure where this file owned URL-param handling. (Marked as residue for the rebuild.)

## 7. The two `performSearch` implementations

The brief raises this question explicitly. Static analysis confirms two distinct implementations:

**(A) `integration.js`'s pair: private `performSearch` + `window.performSearch` wrapper.**
- Private `async function performSearch(query, container)` at integration.js:899–980.
- Public `window.performSearch = function (query, containerId)` at integration.js:1280–1295. This wrapper resolves the container, calls `normalizeQuery(query)` (line 1292), and delegates to the private function.
- Request construction (lines 904–909): `URLSearchParams({ query, form: 'partial', collection: config.collection, profile: config.profile })`. Includes `form=partial` — distinguishing feature.
- The fetch executes at line 934 (`const response = await fetch(url)`).
- Network investigation observed `integration.js:934` as the empirical live initiator on suggestion clicks.

**(B) `search-page-autocomplete.js`'s local `performSearch`.**
- `async function performSearch(query, container)` at search-page-autocomplete.js:666–750.
- Request construction (lines 685–689): `URLSearchParams({ query, collection, profile })`. **Does not include `form=partial`** — this is a wire-level distinguishing feature.
- The fetch executes at line 698.
- This is the function the search-page click handler at lines 550 and 564 resolves to (local lexical scope).

**What static analysis can establish:**
- Both make `/api/search` GET calls with a session ID appended if available.
- Both update `container.innerHTML` with the same wrapper div structure.
- The two implementations are **wire-level distinguishable** by the presence/absence of `form=partial`.
- The search-page click handler's references at lines 550 and 564 lexically resolve to the local function (B), not the global (A).

**What static analysis cannot establish:** Whether the local `performSearch` (B) is actually invoked under live traffic. The network investigation observed only (A) firing on clicks, suggesting (B) is dead — but the listener-coupling that determines this is listener-audit territory.

**Hypothesis (for listener audit, not this audit's domain).** One mechanism by which (A) might fire instead of (B) on a search-page click: another listener attached to the same elements (perhaps from `core-search-manager.js` or from `setupResultsSearch`) intercepts the click before it reaches the autocomplete file's handler, or rebinds the click target. This is speculation — flagged for the listener audit.

**For the rebuild.** Two `performSearch`s with subtly different wire payloads (`form=partial` in one, absent in the other) is a duplication that the rebuild should collapse. If only (A) is live, the cleanup is removing dead code. If both fire under different conditions, the cleanup is unifying them.

## 8. Click-handling comparison

| Dimension | Header click (integration.js:627–661) | Search-page click (search-page-autocomplete.js:506–568) |
|---|---|---|
| Possible suggestion types | general only | general, staff, program |
| Input value setter | `#search-input.value = text` | `#autocomplete-concierge-inputField.value = text` |
| Query normalization | `normalizeQuery(text)` (line 639) | none — `text` used as-is |
| Session prep | `SessionService.prepareForSearchRedirect(normalizedQuery)` | none — session is already on the search page, no redirect happens |
| Click tracking | `trackSuggestionClick(text, "general", "", text)` → `window.trackSuggestionClick` (integration.js:1091) | `trackSuggestionClick(text, type, url, title)` → local function (search-page-autocomplete.js:578) |
| Hide dropdown | (handled by document-level outside-click listener at integration.js:424) | `container.innerHTML = ""; container.hidden = true` (lines 539–540) |
| Special staff/program with URL | not possible | `<a target="_blank">` navigates; setTimeout(100ms) then background `performSearch` + `updateUrl` |
| Search dispatch | `window.location.href = "/search-test/?query=..."` (full navigation) | local `performSearch(text, resultsContainer)` (in-page) + `updateUrl(text)` (history.pushState) |
| Number of network requests on click | 1 (the navigation; pre-render was already triggered on form-submit, not on click) | 2 (`/api/search` + `/analytics/click`); 3 if staff/program-with-URL click also fires the new-tab navigation |

**The structural difference** is what the rebuild's suggestion-click model needs to handle:
- Header click is the **simple case** — clean redirect-only, the "fourth interaction class" the v10 cadence has separately catalogued.
- Search-page click is the **messier case** — staff/program link branching, background search firing, URL update without navigation, two distinct `performSearch` paths possible (local on general click, [TBD listener-audit] on staff/program-link-click). The rebuild needs to preserve the user-visible behavior (described in §11 cross-cutting) while collapsing the implementation surface.

## 9. Redirect lifecycle from header suggestion click

The full lifecycle from a header-suggestion click to displayed results:

**Step 1 — Click in header dropdown (integration.js:627–661).**
Click handler fires:
- `#search-input.value = text` (line 633–636).
- `normalizedQuery = normalizeQuery(text)` (line 639).
- `window.SessionService.prepareForSearchRedirect(normalizedQuery)` (line 646) — session prep sidecar, returns synchronously.
- `trackSuggestionClick(text, "general", "", text)` (line 654) — fires `sendBeacon` to `${proxyBaseUrl}/analytics/click`. Non-blocking, fire-and-forget. Per network investigation (line 128), these beacons currently return 400 from the proxy and silently fail — but the navigation continues regardless.
- `window.location.href = "/search-test/?query=" + encodeURIComponent(normalizedQuery)` (line 657–659) — full-page navigation to the search results page.

**Step 2 — Navigation to `/search-test/?query=...`.** Browser unloads the current page. All in-memory JS state (including `SessionManager._sessionId`, integration.js's IIFE state, `seattleUConfig.search` config, the cache monitor) is discarded.

**Step 3 — `/search-test/` page loads.** The T4 PageLayout chain-loads scripts. Per CLAUDE.md, the load tier is: SessionService.js (high priority) → search-page-autocomplete.js (synchronous) → integration.js (defer) → search-index.js (module/defer).

**Step 4 — Each script re-initializes from scratch.**
- SessionService.js initializes against same-origin `sessionStorage` / `localStorage` — **the session ID survives the navigation** because it is persisted in storage. No code path in integration.js's redirect handler clears it (line 657–659 just sets `window.location.href`). Confirmed by static analysis: the redirect path does not call any `SessionService.clear*` or storage-clearing function. (Cross-reference: network investigation empirically confirmed the same session ID survives across the redirect.)
- search-page-autocomplete.js's `DOMContentLoaded` (line 1080) runs: `SessionManager.init()` reads `window.SessionService.getSessionId()` into `_sessionId` (line 44).
- integration.js's `DOMContentLoaded` (line 102) runs: `findSearchComponents` populates header + results components, `setupHeaderSearch(searchComponents.header)` runs (header suggestions still functional on the destination page), and because `isResultsPage` is true (URL contains "search-test", line 106), `setupResultsSearch(searchComponents.results)` and `processUrlParameters(searchComponents.results, cacheFirst)` both run (lines 124–134).

**Step 5 — `processUrlParameters` (integration.js:789–864).**
- Reads `query` from URL params (line 793). If absent, returns silently.
- Sets `component.input.value = query` (line 807).
- `normalizedQuery = normalizeQuery(query)` (line 811) — note that the URL `query` was already normalized before being placed in the URL by step 1; this is a redundant-but-idempotent normalization.
- Checks `window.checkForPreRenderedContent` (line 814) — defined in search-page-autocomplete.js:168 and exposed globally at search-page-autocomplete.js:1133. If present (it is, because search-page-autocomplete.js loaded first):
  - Calls `window.checkForPreRenderedContent(normalizedQuery)` (line 819). This issues a **GET `/api/search`** request with `form=partial` from the search-page-autocomplete side, with a 1000 ms `AbortController` timeout (search-page-autocomplete.js:201).
  - On any response (HIT or under-timeout MISS): calls `window.displayPreRenderedResults(html, normalizedQuery)` (integration.js:827). This is the "results in <50ms when cache HIT, ~1s when MISS-but-fast" path.
  - On display failure or no HTML: calls `performStandardSearchFallback` (lines 838, 845, 855).
- If `window.checkForPreRenderedContent` is missing (defensive fallback at line 862): goes directly to `performStandardSearchFallback`.

**Step 6 — `performStandardSearchFallback` → private `performSearch` (integration.js:876–892, 899–980).**
- Calls private `performSearch(normalizedQuery, container)` (line 881).
- Private `performSearch` issues `/api/search?query=&form=partial&collection=&profile=&sessionId=` and renders the response HTML into the results container (line 956–960).
- This is the path the network investigation identified at integration.js:934 as the live request initiator.

**What survives the redirect:** session ID (via `sessionStorage` / `localStorage`); the URL query string (now visible to the destination page).

**What re-initializes:** every script's IIFE state, every module-level cache, the `SessionManager._sessionId` (re-read on first access on the new page), `CacheMonitor` metrics (start at zero), all event listeners.

## 10. Handoff to rendering

The seam between data and DOM construction is where the rendering audit will pick up.

**Header consumer.**
- Container: `<div id="header-suggestions" class="header-suggestions-container" role="listbox" hidden>`. Created dynamically at `findSearchComponents` (integration.js:268–284) if not pre-existing in the DOM — inserted as the next sibling of the header form.
- Data shape at handoff: `data.general` array (typed as `string | { display: string }` per item — the FE handles both via `suggestion.display || suggestion` at integration.js:613).
- HTML written: `<div class="suggestions-list"> { <div class="suggestion-item" role="option" data-index="N"><span class="suggestion-text">...</span></div> } </div>` (lines 610–621).

**Search-page consumer.**
- Container: `<div id="autocomplete-suggestions">`. Expected to exist in the T4 PageLayout (queried via `getElementById` at search-page-autocomplete.js:1088, returns early at line 1093 if absent).
- Data shape at handoff: full `{ general, staff, programs }` payload, with `programs` accepting either array or `{ programs: [...] }` shape.
- HTML written: three-column layout `<div class="suggestions-list"><div class="suggestions-columns">...</div></div>` containing per-column `<div class="suggestions-column">` sub-trees with column-header and per-item items. Staff and program items wrap their content in `<a target="_blank" rel="noopener noreferrer">` for direct link navigation.

**Contract surfaces for the rendering audit to verify against:**
- Class names: `.suggestions-list`, `.suggestions-columns`, `.suggestions-column`, `.column-header`, `.suggestion-item`, `.suggestion-text`, `.staff-item`, `.staff-link`, `.staff-suggestion`, `.staff-image`, `.staff-thumbnail`, `.staff-info`, `.staff-role`, `.staff-department`, `.program-item`, `.program-link`, `.program-suggestion`, `.suggestion-type`, `.program-description`, `.active` (keyboard nav).
- ARIA: `role="listbox"` on container, `role="option"` on items.
- Data attributes consumed by click and keyboard handlers: `data-type`, `data-url`, `data-index`.
- Element IDs: `#search-input` (header input), `#header-suggestions` (header dropdown container), `#autocomplete-concierge-inputField` (search-page input), `#autocomplete-suggestions` (search-page dropdown container), `#results` (search-page results container).

## 11. Cross-cutting observations

These asymmetries and patterns surface across the lifecycle. Not framed as cleanup targets — the rebuild design phase will choose how to handle each.

**Query normalization asymmetry.** Neither consumer normalizes on the keystroke `/api/suggestions` send — both use `.trim()` only. Header normalizes on click (integration.js:639) before the redirect. Search-page does **not** normalize on click — `text` is passed to `trackSuggestionClick`, the local `performSearch`, and `updateUrl` raw. (This refines the brief's framing, which had stated "header normalizes before send".) The rebuild's normalization rule should be settled and applied consistently — at the wire boundary, not per-call-site.

**Session source duplication.** integration.js accesses `window.SessionService` inline with try/catch at every use site. search-page-autocomplete.js wraps it in a module-level `SessionManager` object. Both ultimately reach the same global `window.SessionService.getSessionId()`. Two patterns, one underlying source. The rebuild should pick one wrapper shape (or none).

**Trinity sourcing on the suggestions path.** `suggestions.ts` hardcodes `collection: 'seattleu~sp-search'` and `profile: '_default'` in `fetchGeneralSuggestions` (lines 126–127). The staff and programs legs send neither. **The FE never sends collection or profile to `/api/suggestions`** — these values exist only as a server-side handler default on the general leg. The `pre-render` and `performSearch` paths *do* send them (sourced from `seattleUConfig.search` or fallback literals). Three different trinity-sourcing conventions across four FE-originated paths.

**proxyBaseUrl hardcoding — five literals across four files.** CLAUDE.md and the FE endpoint dictionary count "three places". The actual count from `grep -n 'funnelback-proxy-dev.vercel.app' public/integration.js public/search-page-autocomplete.js public/js/search-index.js public/js/modules/core-search-manager.js`:
1. `public/integration.js:29` — in the `config` object.
2. `public/search-page-autocomplete.js:601` — fallback in `trackSuggestionClick`.
3. `public/search-page-autocomplete.js:843` — fallback in `trackResultClick`.
4. `public/js/search-index.js:20` — passed to `searchManager.init()`.
5. `public/js/modules/core-search-manager.js:23` — module's own default.

Plus a sixth instance server-side at `lib/api-client.ts:17` (`process.env.BACKEND_API_URL || 'https://funnelback-proxy-dev.vercel.app/proxy'`) — distinct because this one has an env-var override path.

CLAUDE.md's "three places" appears to enumerate by-file (integration.js + search-index.js + core-search-manager.js), missing the two search-page-autocomplete.js fallbacks. The FE endpoint dictionary at line 546 uses "three places" for trinity duplication, not proxyBaseUrl — these are two distinct dedup items the dictionary's text appears to conflate. The rebuild collapses to one configured value; this audit's count is the one to use.

**`/api/suggestions` `type=general/staff/programs` branches are unreachable from inspected FE consumers.** Both consumers send `{ query, sessionId }` with no `type` — only the default fan-out branch executes. The "three-tier autocomplete" naming describes what is structurally **one tier with three internal legs in the default branch**. Per the FE endpoint dictionary, the typed branches are not exercised on production traffic. They are debug/refactor residue, not retired-feature surface.

**Programs response-shape variance.** `renderResultsPageSuggestions` handles both `Array.isArray(programs)` and `programs.programs` (lines 360–363). The variance is at the proxy/upstream level — not investigated in this audit (proxy-repo crossing). The rebuild's response-contract design must pin the shape.

**Pre-render helpers live in the autocomplete file.** `checkForPreRenderedContent` (line 168) and `displayPreRenderedResults` (line 290) are defined in `search-page-autocomplete.js` and exposed globally at lines 1133–1134. They are called from `integration.js`'s `processUrlParameters`. The file-name-vs-scope mismatch CLAUDE.md flags is real and load-bearing — the file owns two responsibilities (autocomplete + pre-render display) that the v11 cadence may want to split.

**Keystroke double-fan-out.** Each header keystroke (when query passes 4 chars) fires both `/api/suggestions` (200 ms debounce) and `/api/prefetch` (300 ms debounce) from two separately-bound listeners on the same input (integration.js:391–401, 405–421). Each results-page keystroke does the same (search-page-autocomplete.js handles `/api/suggestions`; integration.js's `setupResultsSearch` at lines 723–740 handles prefetch). Two debounced listeners per input, separate firing, separate network requests.

**Header consumes only the general bucket — intentional product behavior.** The header bar's UX real estate cannot accommodate the three-column featured layout. The fan-out cost (server-side, three parallel proxy calls every keystroke) is the trade-off for endpoint uniformity (one `/api/suggestions` shape serves both consumers). The rebuild faces a real design choice: keep the uniform fan-out and accept the cost, or split into two endpoint shapes (header: general-only; search-page: all-buckets) and accept the divergence cost. The audit's job is to make the trade-off legible — not to flag the current behavior as residue.

**Search-page background-search-on-link-click — intentional UX behavior.** At search-page-autocomplete.js:543–554, clicking a staff or program suggestion with a URL fires both: (a) navigation to that URL in a new tab via the `<a target="_blank">`, and (b) a background `performSearch` for the suggestion text after a 100ms `setTimeout` (plus an `updateUrl(text)` to set the URL query param). User-visible effect: the user clicks a featured suggestion, opens that destination in a new tab, and the original tab's search results update to show the full result set for that query — so when they come back, results are waiting. This serves the case where a user clicks the wrong program/staff suggestion and wants to browse the full result set without re-running the query. The user-visible behavior is a rebuild requirement; the implementation shape is not. The rebuild can implement this however fits the new architecture.

**`getClientIpHeaders` import at suggestions.ts:16 is unused.** Imported but never called — confirmed by grep. Residue.

**Read-but-unused URL `query` at search-page-autocomplete.js:1127–1130.** The `DOMContentLoaded` handler reads `urlParams.get("query")` into a local variable and never uses it. URL-param processing actually lives in integration.js's `processUrlParameters`. Incomplete-migration residue.

**Two `trackSuggestionClick` implementations, identical in behavior.** integration.js:1091 (`window.trackSuggestionClick`, used by header click handler) and search-page-autocomplete.js:578 (local function, used by search-page click handler) differ only in (a) session-ID source pattern, (b) error-logging verbosity, (c) the proxyBaseUrl override-path versus inline literal. Functionally equivalent — both fire `sendBeacon` to `${proxyBaseUrl}/analytics/click` with the same payload shape. (Note: per the network investigation at line 128, suggestion-click beacons currently return 400 silently — a behavior to verify in the rebuild's analytics contract.)

**Cache-aware contract on suggestions.ts is opt-out.** Per the cache audit: `pages/api/search.ts` and `pages/api/pre-render.ts` create their API client with `{ cacheAware: true }`; `pages/api/suggestions.ts:71` does not. This is an upstream-proxy contract assertion that the suggestions path does not opt into. Rebuild question: should the suggestions path assert cache-awareness on the proxy, or stay cache-blind?

## 12. Lessons (separate from observations)

Framed as observations about what the implementation did. The rebuild design phase will draw from these; this audit captures what is, not what should be.

- **The shared backbone is the FE-server endpoint, not the consumer code.** Both consumers share `/api/suggestions` and the response schema. Their consumer code is independent — separately bound, separately debounced, separate session wrappers, separate click handlers, separate trackSuggestionClick implementations. The shared surface is one HTTP endpoint and one JSON schema. Everything else duplicates.

- **The "three buckets" naming is consumer-asymmetric.** The endpoint serves three buckets; the search-page consumer uses all three; the header consumer uses one. The header pays the fan-out cost without consuming the fan-out value. Whether this asymmetry is worth the endpoint-uniformity it buys is a rebuild decision, not a current-system bug.

- **Click-handling complexity grows with featured suggestions.** General-only clicks are simple — set input, normalize, redirect-or-search. Staff/program clicks introduce: anchor navigation racing JS handlers, background-search-while-navigating, dual-purpose URL updates. The complexity is justified by the UX (results waiting when the user comes back) but is not centralized — every click-dispatch path reimplements its own variant.

- **Pre-render is a parallel infrastructure to search.** The `/api/pre-render` POST on header form submit, the `/api/search` GET with cache-status awareness on processUrlParameters, the `displayPreRenderedResults` path — all of this exists to make redirected searches appear instant. It is structurally separate from the autocomplete fan-out. The rebuild's design needs to decide whether to keep these as separate infrastructures or merge.

- **State across the redirect is minimal but load-bearing.** Only the session ID and the URL query string survive. Everything else (cache monitor metrics, debounce timers, listener bindings) re-initializes. This minimal-handoff design works because every page re-loads every script — the rebuild's bundle-shape decision will determine whether this stays the same or changes.

- **Hardcoded URLs are scattered across both server and client code.** The proxy base URL has six occurrences across five files (five FE literals plus one server-side env-overridable). The `apiBaseUrl` (`https://su-search-dev.vercel.app`) appears in `integration.js:28`, `search-page-autocomplete.js:182, 634, 678` — four FE literals. The rebuild's environment-config architecture is the single biggest dedup opportunity in this subsystem.

- **The two-`performSearch` situation is genuinely two implementations.** They differ on the wire (`form=partial` versus absent). If the listener audit confirms only one fires under live traffic, the dead one is residue. If both fire under different conditions, they are an unintended divergence. Either way, the rebuild collapses to one — but the listener audit needs to settle which case applies.
