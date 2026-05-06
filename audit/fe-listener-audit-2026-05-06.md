# FE Listener Audit — 2026-05-06

**Repo:** `su-search-dev` (FE only)
**Date:** 2026-05-06
**Author:** audit pass run via Claude Code session
**Posture:** Read-only across all source files; writes scoped to `audit/**` by `.claude/settings.local.json`. No source-file edits, no commits, no deploys.
**Status:** Phase 1 complete (listener inventory + reachability map). Phase 2 complete (seven puzzles resolved).

## Scope

- **In scope (read in full, listener-bearing):**
  - `public/integration.js` (1320 lines)
  - `public/search-page-autocomplete.js` (1134 lines)
  - `public/js/modules/core-search-manager.js` (875 lines)
- **In scope (read narrowly for two specific questions, Phase 2 only):**
  - `pages/api/search.ts` — substring-inference fallback at lines 127–145 (reachability)
  - `pages/api/prefetch.ts` — backend-fetch-then-cache-write timing path (race hypothesis)
- **Out of scope:** `SessionService` internals, per-feature manager module internals (tabs / facets / pagination / spelling / analytics / collapse), proxy edge middleware, proxy serverless handlers (other than the two narrow reads above), `search-index.js`, `search-bundle.js` (the latter is unused per CLAUDE.md).

## Stop rule

Listener attachments and their reachability are fully within the in-scope FE files. Imports out of those files are not followed except for the two narrow TS reads in Phase 2. Helper modules (`SessionService`, the per-feature managers, etc.) are referenced by name and treated as opaque dispatchers — their internals are out of scope; what calls them and under what conditions is in scope.

## Verification status

Permission allow-list at `.claude/settings.local.json` correctly scopes write/edit to `audit/**` and bash to read-shaped commands plus `mkdir:audit` and read-only git. All three listener-bearing files exist at the expected paths with line counts matching the brief: 1320 / 1134 / 875.

| Anchor cited in brief | Status | Notes |
| --- | --- | --- |
| `integration.js:899` (`async function performSearch`) | confirmed | line 899 exact |
| `integration.js:1280` (`window.performSearch = function`) | confirmed | line 1280 exact |
| `integration.js:635` (`input.value = text`) | confirmed | line 635 exact |
| `integration.js:421` (header prefetch listener attach) | confirmed | line 421 exact |
| `integration.js:739` (search-page prefetch listener attach) | confirmed | line 739 exact |
| `integration.js:934` (live `fetch` initiator on suggestion clicks) | confirmed | line 934 exact (inside `performSearch`) |
| `integration.js:633-636` (input value mutation block) | confirmed | block spans lines 633–636 exact |
| `core-search-manager.js:249` (dynamic import of `${moduleName}-manager.js`) | confirmed | line 249 exact |
| `search-page-autocomplete.js:666` (local `performSearch`) | confirmed | line 666 exact |
| `search-page-autocomplete.js:168` (`checkForPreRenderedContent`) | confirmed | line 168 exact |
| `search-page-autocomplete.js:290` (`displayPreRenderedResults`) | confirmed | line 290 exact |
| `search-page-autocomplete.js:1133-1134` (global exposures) | confirmed | lines 1133–1134 exact |
| Suggestion-click attach in `search-page-autocomplete.js` | **shifted** | autocomplete audit (May 5) cited L545–554 for the inner-`<a>` special branch; **current location is L543–555**, with the click-listener attach loop at L506–568 inside `attachClickHandlers` defined at L505. Brief warned this had drifted. |
| Search-page input listener in `search-page-autocomplete.js` | **shifted** | brief warned drift; **current location is L1113** inside the DOMContentLoaded handler at L1080. |
| `search-page-autocomplete.js:550 / :564` (which-`performSearch` calls) | confirmed | L550 inside the staff/program inner-`<a>` branch (setTimeout 100ms wrapper); L564 in the main branch. Both call the local `performSearch` at L666. |
| `proxyBaseUrl` hardcodings in autocomplete file (cited L601, L843) | confirmed | line 601 (`trackSuggestionClick`) and line 843 (`trackResultClick`) exact |
| `apiBaseUrl` hardcodings in autocomplete file (cited L182, L634, L678) | confirmed | line 182 (`checkForPreRenderedContent`), L634 (`fetchSuggestions`), L678 (`performSearch`) exact |

No anchor was found to be invalid; two were reconfirmed at slightly different ranges (the suggestion-click attach loop and the search-page input listener), as the brief anticipated.

For the Phase 2 narrow TS reads:
| Anchor cited in brief | Status | Notes |
| --- | --- | --- |
| `pages/api/search.ts:127-145` (substring-inference fallback) | confirmed | block spans L125–147 (the surrounding `if (!tabRequestDetected)` opens at L125, the substring-matching block runs L132–142, log at L145, brace closure L146–147). The brief's L127–145 cite is correct to within one line. |
| `pages/api/prefetch.ts` async backend-fetch-then-cache-write | confirmed | the fire-and-forget `apiClient.get` at L121 with the chained `.then(...) → setCachedData(...)` at L131–158; immediate `res.status(202).json(...)` return at L185. |

---

## Phase 1.1 — Listener inventory

Every `addEventListener` call, every `on*` property assignment, and every `window.addEventListener` / `document.addEventListener` in the three in-scope JS files. Listed in source order per file. MutationObserver instances are noted at the bottom of each file's section because they observe DOM mutations rather than user-driven events but are functionally relevant to listener reachability (per-feature manager modules are notified through them).

### `public/integration.js`

The whole file is wrapped in an IIFE (`(function () { ... })()` at L14 / L1320). All attachments are reached through the L102 DOMContentLoaded callback or its descendants.

**1. L102 — `document.addEventListener("DOMContentLoaded", function () { ... })`**
- Element / target: `document`
- Event: `DOMContentLoaded`
- Handler: anonymous function (lines 102–138)
- Containing scope: IIFE top level
- Attach condition: always (every page where this script loads)
- Repeats: one-time
- Effect: runs `findSearchComponents`, `setupConditionalPreloading`, then conditionally `setupHeaderSearch` (if header components found) and — on a page whose URL path includes `search-test` — `setupResultsSearch` + `processUrlParameters`.

**2. L173 — `searchToggle.addEventListener("click", function () { ... })`**
- Element / target: `searchToggle` = `document.getElementById("site-search--button-toggle")` ?? `document.querySelector(".site-search__toggle")` (resolved at L151–153)
- Event: `click`
- Handler: anonymous function (lines 173–184)
- Containing scope: `setupConditionalPreloading`
- Attach condition: `searchToggle` exists AND `sessionStorage.getItem("searchResourcesPreloaded") !== "true"`. The `setupConditionalPreloading` function is itself called from the L102 DOMContentLoaded callback unconditionally (L117).
- Repeats: one-time per page load (function returns early if already attached)
- Effect: calls `preloadSearchResources` (injects `<link rel="preconnect|preload|prefetch">` tags into `<head>` for `apiBaseUrl`, `proxyBaseUrl`, `SessionService.js`, `search-bundle.js`, `/search-test/`) and sets `sessionStorage.searchResourcesPreloaded = "true"`.

**3. L336 — `component.form.addEventListener("submit", function (e) { ... })`**
- Element / target: `component.form` = the closest `<form>` ancestor of `#search-input` (the header search input)
- Event: `submit`
- Handler: anonymous function (lines 336–387)
- Containing scope: `setupHeaderSearch`
- Attach condition: header search component was found (L120 `if (searchComponents.header) { setupHeaderSearch(...) }`) — i.e., `#search-input` exists in the page AND has a `<form>` ancestor
- Repeats: one-time per page load
- Effect: `e.preventDefault()`; if input is empty, returns; normalizes query; reads `SessionService.getSessionId()`; fires `fetch(${apiBaseUrl}/api/pre-render, { method: 'POST', keepalive: true, headers: 'application/json', body: { query, sessionId } })` and registers `.then`/`.catch` handlers; calls `SessionService.prepareForSearchRedirect(normalizedQuery)` if available; sets `window.location.href = '/search-test/?query=' + encodeURIComponent(normalizedQuery)`. The redirect is fired without awaiting the pre-render fetch — `keepalive: true` is what keeps that request alive across the navigation.

**4. L403 — `component.input.addEventListener("input", handleInput)`**
- Element / target: `component.input` = `#search-input`
- Event: `input`
- Handler: `handleInput` = `debounce(async function () { ... }, config.debounceTime /* 200ms */)` defined at L391–401
- Containing scope: `setupHeaderSearch`
- Attach condition: header component AND `component.suggestionsContainer` exists
- Repeats: one-time per page load (the same debounced function instance is attached once)
- Effect: when the trailing edge of debounce fires, reads `component.input.value.trim()`; if shorter than `config.minQueryLength` (3) clears+hides the suggestions container; otherwise calls `fetchHeaderSuggestions(query, component.suggestionsContainer)` which fires `GET ${apiBaseUrl}/api/suggestions?query=…[&sessionId=…]` then calls `renderHeaderSuggestions` (which itself attaches the per-item listener at L628 — see entry 7).

**5. L421 — `component.input.addEventListener("input", handlePrefetch)`**
- Element / target: `component.input` = `#search-input` (same element as entry 4)
- Event: `input`
- Handler: `handlePrefetch` = `debounce(async function () { ... }, config.prefetchDebounceTime /* 300ms */)` defined at L405–418
- Containing scope: `setupHeaderSearch`
- Attach condition: same as entry 4
- Repeats: one-time per page load
- Effect: when the trailing edge of debounce fires, reads `component.input.value.trim()`; if shorter than `config.prefetchMinQueryLength` (4), returns silently; otherwise calls `prefetchSearchResults(normalizedQuery)` which fires `GET ${apiBaseUrl}/api/prefetch?query=…&collection=…&profile=…&prefetch=true[&sessionId=…]` with `keepalive: true`, `priority: "low"`, 5-second AbortController timeout.
- **Co-attached with entry 4:** every native `input` event on `#search-input` is dispatched to both handlers in registration order (L403 first, L421 second). They run independently — different debounce intervals, different min-length thresholds, different downstream calls.

**6. L424 — `document.addEventListener("click", function (e) { ... })`**
- Element / target: `document`
- Event: `click`
- Handler: anonymous function (lines 424–433)
- Containing scope: `setupHeaderSearch` (after the input-listener block)
- Attach condition: header component exists (same gate as entry 3 onward)
- Repeats: one-time per page load
- Effect: outside-click dismissal — if `component.suggestionsContainer` exists AND the click target is outside both `component.input` and `component.suggestionsContainer`, clears `innerHTML` and sets `hidden = true`.

**7. L628 — `item.addEventListener("click", function () { ... })` (inside a per-item loop)**
- Element / target: every `.suggestion-item` element inside the header `suggestionsContainer`
- Event: `click`
- Handler: anonymous function (lines 628–660)
- Containing scope: `renderHeaderSuggestions` (L601), called from `fetchHeaderSuggestions` at L586
- Attach condition: invoked every time `renderHeaderSuggestions` runs and `data.general.length > 0`
- Repeats: per render — each call to `renderHeaderSuggestions` overwrites `container.innerHTML` (L623), which throws away the old items and their listeners; new items get fresh listeners attached. Therefore "one listener per current item per render."
- Effect: reads `.suggestion-text` content; sets `document.getElementById("search-input").value = text` (L633–636 — programmatic assignment, see Phase 2 puzzle 5); normalizes query; calls `SessionService.prepareForSearchRedirect` if available; calls `trackSuggestionClick(text, "general", "", text)` (which is `window.trackSuggestionClick` defined at L1091); sets `window.location.href = '/search-test/?query=' + encodeURIComponent(normalizedQuery)`.

**8. L678 — `component.form.addEventListener("submit", function (e) { ... })`**
- Element / target: `component.form` = the closest `<form>` ancestor of `#autocomplete-concierge-inputField` (the search-page input)
- Event: `submit`
- Handler: anonymous function (lines 678–718)
- Containing scope: `setupResultsSearch`
- Attach condition: page is `search-test` AND results component found AND `component.form` is truthy. (`setupResultsSearch` is only called at L125 inside the L102 DOMContentLoaded handler when both `isResultsPage` and `searchComponents.results` are true.)
- Repeats: one-time per page load
- Effect: `e.preventDefault()`; reads input value; normalizes; if `window.SearchManager` exists, sets its `originalQuery` (via `setOriginalQuery` setter if available, else direct property write); calls `performSearch(normalizedQuery, component.container)` — the **integration.js local `performSearch`** at L899, which sends `form=partial`; calls `updateUrl(normalizedQuery)` which uses `history.pushState` (no reload).

**9. L739 — `component.input.addEventListener("input", handlePrefetch)`**
- Element / target: `component.input` = `#autocomplete-concierge-inputField`
- Event: `input`
- Handler: `handlePrefetch` = `debounce(async function () { ... }, config.prefetchDebounceTime /* 300ms */)` defined at L723–736
- Containing scope: `setupResultsSearch`
- Attach condition: results component AND `component.input` exists (search results page)
- Repeats: one-time per page load
- Effect: identical structure to entry 5 but on the search-page input. Fires `GET /api/prefetch` when query length ≥ 4 chars, after 300ms debounce.
- Note: there is **no integration.js `input` listener for suggestions** on the search-page input. Suggestions on `#autocomplete-concierge-inputField` are handled by `search-page-autocomplete.js`'s L1113 listener — see entry 14 below.

**10. L999 — `link.addEventListener("click", function (e) { ... })` (inside a per-link loop)**
- Element / target: every `a` matched by `.fb-result h3 a, .search-result-item h3 a, .listing-item__title a` inside the results container
- Event: `click`
- Handler: anonymous function (lines 999–1015)
- Containing scope: `attachResultClickHandlers` (L987)
- Callers of `attachResultClickHandlers` in this file: L745 (initial setup in `setupResultsSearch`, but on first load `#results` is empty so `querySelectorAll` matches nothing and no listeners are attached), L965 (after `performSearch` overwrites `container.innerHTML`).
- Attach condition: invoked whenever `attachResultClickHandlers` runs against a non-empty results container
- Repeats: per render — each `performSearch` overwrites `container.innerHTML`, which destroys previous result-link nodes and their listeners; new nodes get new listeners.
- Effect: does **not** preventDefault — link navigation proceeds normally; reads `data-live-url || href` and link text; calls `trackResultClick(query, url, title, position)` which fires `navigator.sendBeacon(${proxyBaseUrl}/analytics/click, blob)` (or fetch fallback).

**MutationObservers in `integration.js`:** none. (The MutationObserver in this codebase is in `core-search-manager.js`.)

**`window.*` exposures (not listeners but worth noting because they are entry points for cross-file dispatch):**
- `window.trackSuggestionClick` (L1091) — called by the L628 click handler in this file.
- `window.trackTabChange` (L1163) — exposed for use by tab manager.
- `window.searchConfig` (L1273) — config object.
- `window.performSearch` (L1280) — wrapper around the local `performSearch` (L899). Looks up `containerId` (string or element), normalizes query, returns `performSearch(normalizedQuery, container)`. Whether anything reaches this wrapper at runtime is Phase 2 puzzle 3.
- `window.updateSearchUrl` (L1300) — alias of `updateUrl`.
- `window.prefetchSearchResults` (L1305) — alias of the local prefetch function.
- `window.normalizeQuery` (L1310) — alias of the local `normalizeQuery`.
- `window.setSearchDebugLogging` (L1316) — debug toggle.
- `window.debounceFunction` (L1254) — alias of the local `debounce`.

### `public/search-page-autocomplete.js`

This file is a flat module-style script (not wrapped in an IIFE). All attachments are reached through the L1080 DOMContentLoaded callback or via `window.checkForPreRenderedContent` / `window.displayPreRenderedResults` exposures (L1133–1134) called by `integration.js`'s `processUrlParameters`.

**11. L507 — `item.addEventListener("click", function (e) { ... })` (inside a per-item loop)**
- Element / target: every `.suggestion-item` inside the search-page suggestions container (`#autocomplete-suggestions`)
- Event: `click`
- Handler: anonymous function (lines 507–567)
- Containing scope: `attachClickHandlers` (L505), called at L571 inside `renderResultsPageSuggestions`
- Attach condition: invoked every time `renderResultsPageSuggestions` runs and at least one of `general`, `staff`, `programs` returned non-empty results
- Repeats: per render — `container.innerHTML = html` at L501 wipes prior items and their listeners; new items get fresh listeners.
- Effect (sequence):
  1. read `.suggestion-text` content, `dataset.type` (`general` | `staff` | `program`), `dataset.url`
  2. compose enriched `title` for staff / program based on auxiliary fields
  3. set `document.getElementById("autocomplete-concierge-inputField").value = text` (L532) — programmatic assignment, see Phase 2 puzzle 5
  4. call `trackSuggestionClick` (this file's local copy at L578)
  5. clear and hide the suggestions container
  6. **inner-`<a>` special branch (L543–555):** if `type === "staff" || type === "program"` AND `url && url !== "#"` AND `e.target.closest("a")` (the click landed on the inner anchor), schedule `setTimeout(() => { performSearch(text, resultsContainer); updateUrl(text); }, 100)` (the `performSearch` reference is to the **local L666**, see Phase 2 puzzle 6) and `return` — letting the `<a>` element handle navigation in a new tab (it has `target="_blank"`, see L413, L473).
  7. **non-inner-`<a>` staff/program branch (L557–559):** if same type/url conditions but click not on inner `<a>` (e.g., click on a non-link descendant of the staff/program suggestion-item), `window.open(url, '_blank', 'noopener,noreferrer')` and **fall through** to the main branch.
  8. **main branch (L561–566):** call the local `performSearch(text, resultsContainer)` (no `form=partial`) and `updateUrl(text)`. This branch executes for general suggestions and as the fall-through for the non-inner-`<a>` staff/program case. It does **not** execute for the inner-`<a>` branch (which `return`s at L554).

**12. L805 — `link.addEventListener("click", function (e) { ... })` (inside a per-link loop)**
- Element / target: every `a` matched by `.fb-result h3 a, .search-result-item h3 a, .listing-item__title a` inside the results container
- Event: `click`
- Handler: anonymous function (lines 805–815)
- Containing scope: `attachResultClickHandlers` (L798)
- Callers of `attachResultClickHandlers` in this file: L320 (in `displayPreRenderedResults` after writing pre-rendered HTML into `#results`), L727 (in the local `performSearch` after writing the new HTML).
- Attach condition: invoked whenever its caller runs against a non-empty results container
- Repeats: per render — each render replaces the result-link nodes
- Effect: does **not** preventDefault; reads `data-live-url || href` and link text; calls this file's local `trackResultClick` (L820), which fires `navigator.sendBeacon(${proxyBaseUrl}/analytics/click, blob)` (or fetch fallback). Functionally identical to entry 10 (integration.js).
- **Important — relationship with entry 10:** these two attachers (this file's L798 and integration.js's L987) are **never both** attached to the same set of result-link nodes in the same render. The two render paths are:
  - **Pre-render hit:** `processUrlParameters` (integration.js) → `window.displayPreRenderedResults` (this file's L290) → `attachResultClickHandlers` (this file's L798) — only this file's listener fires.
  - **Standard search via `performSearch` (integration.js, L899):** `attachResultClickHandlers` (integration.js's L987) — only integration.js's listener fires.
  - **Suggestion click on search page → `performSearch` (this file, L666):** `attachResultClickHandlers` (this file's L798) — only this file's listener fires.
  - On any subsequent re-render, the previous `innerHTML = ...` wipes prior listeners. So result links carry exactly one tracking listener at any time.

**13. L946 — `searchInput.addEventListener("keydown", keydownListener)`**
- Element / target: `searchInput` = `document.getElementById("autocomplete-concierge-inputField")`
- Event: `keydown`
- Handler: named function expression `keydownListener` (lines 890–943); also stored on the input element at `searchInput._keydownListener` for de-dup tracking (L945)
- Containing scope: `addKeyboardNavigation`, called at L574 inside `renderResultsPageSuggestions`
- Attach condition: every render of search-page suggestions
- Repeats: per render — but the function explicitly removes the previously stored `_keydownListener` first (L884–887). Therefore there is at most one keydown listener attached at any time.
- Effect: handles ArrowDown/Up/Left/Right (navigate within suggestions, with cross-column logic), Enter (`activeItem.click()` — synthesizes a click on the active suggestion-item, which triggers the L507 listener), Escape (clear and hide suggestions, blur input). Returns early if no suggestions visible.

**14. L1080 — `document.addEventListener("DOMContentLoaded", function () { ... })`**
- Element / target: `document`
- Event: `DOMContentLoaded`
- Handler: anonymous function (lines 1080–1130)
- Containing scope: file top level
- Attach condition: always (every page where this script loads — and per CLAUDE.md, this script loads synchronously on every T4 PageLayout page, even though it only does useful work on `/search-test/`)
- Repeats: one-time
- Effect: initializes `SessionManager`; finds `#autocomplete-concierge-inputField` and `#autocomplete-suggestions`; **early-returns if either is missing** (this is the gate that makes the file inert on non-search pages); otherwise attaches L1113 input listener and L1116 outside-click listener; reads `?query=` URL param into a local `query` variable that is then unused (the variable is assigned but never read).

**15. L1113 — `searchInput.addEventListener("input", handleInput)`**
- Element / target: `#autocomplete-concierge-inputField`
- Event: `input`
- Handler: `handleInput` = `debounce(function () { ... }, debounceTime /* 200ms from window.seattleUConfig */)` defined at L1100–1110
- Containing scope: L1080 DOMContentLoaded callback
- Attach condition: search-page input AND container both exist (effectively `/search-test/` only)
- Repeats: one-time per page load
- Effect: when debounce fires, reads `searchInput.value.trim()`; if shorter than `minQueryLength` (3) clears+hides suggestions; otherwise calls `fetchSuggestions(query, suggestionsContainer, true)` which fires `GET ${apiBaseUrl}/api/suggestions?query=…[&sessionId=…]` then `renderResultsPageSuggestions(data, container, query)` (which attaches per-item listeners — entry 11 — and the keydown listener — entry 13).

**16. L1116 — `document.addEventListener("click", function (e) { ... })`**
- Element / target: `document`
- Event: `click`
- Handler: anonymous function (lines 1116–1125)
- Containing scope: L1080 DOMContentLoaded callback
- Attach condition: same as entry 15 (search-page only)
- Repeats: one-time per page load
- Effect: outside-click dismissal — if click is outside both `searchInput` and `suggestionsContainer`, clears `innerHTML` and sets `hidden = true`. Functionally analogous to entry 6 (integration.js) but on a different element pair.

**MutationObservers in `search-page-autocomplete.js`:** none.

**Global exposures:**
- `window.checkForPreRenderedContent` (L1133) — alias of L168 function. Called by integration.js's `processUrlParameters` at L814 / L819.
- `window.displayPreRenderedResults` (L1134) — alias of L290 function. Called by integration.js's `processUrlParameters` at L823 / L827.

### `public/js/modules/core-search-manager.js`

This file defines the `SearchManager` class and exports a singleton. The class itself attaches **zero DOM event listeners**. It uses `MutationObserver` for DOM-mutation detection and dynamic ES-module imports to load per-feature manager modules; the listeners on tab-bar items, facet checkboxes, pagination links, etc., live inside those per-feature modules and are out of scope per the brief's stop rule.

**No `addEventListener`, `on*` property assignment, `window.addEventListener`, or `document.addEventListener` calls exist in this file.**

**MutationObservers (relevant because they fan out to per-feature managers):**

**M1. L332 — `this.observer = new MutationObserver((mutations) => { ... })`**
- Type: `MutationObserver` constructor
- Containing scope: `initializeObserver` method
- Attached at: L354 by `startObserving`, observing the element matched by `this.config.resultsContainerSelector` (`#results`) with config `{ childList: true, subtree: true }`
- Attach condition: the SearchManager singleton has had `init()` and then `initialize()` called (gated at L71 by `window.location.pathname.includes("search")`)
- Effect on each `childList` mutation: iterates `Object.values(this.modules)` and, for any module that defines a `handleDomChanges` method, invokes `module.handleDomChanges(mutation.addedNodes)`. This is how per-feature managers get re-attached / re-bound to newly-rendered tab buttons, facet checkboxes, pagination links, etc., after `#results` is re-rendered by any of the `performSearch` / `displayPreRenderedResults` / `updateResults` paths.

**M2. L364 — `const bodyObserver = new MutationObserver((mutations, obs) => { ... })`**
- Type: `MutationObserver` constructor
- Containing scope: `waitForResultsContainer` method
- Attached at: L374 observing `document.body` with config `{ childList: true, subtree: true }`
- Attach condition: invoked from `startObserving` (L356) when the results container does not exist at `init()` time
- Effect: each childList mutation re-checks `document.querySelector(this.config.resultsContainerSelector)`; once found, `obs.disconnect()` self-cleans this body-level observer and starts the M1 observer on the now-available container.

**Dynamic imports of out-of-scope modules:**
- L249: `await import(\`./\${moduleName}-manager.js\`)` for each entry in `this.config.enabledModules` (`tabs`, `facets`, `pagination`, `spelling`, `analytics`, `collapse`). Each loaded module is constructed with `new ModuleClass(this)` and stored at `this.modules[moduleName]`. The brief's Phase 2 puzzle 7 asks whether these modules are also loaded by the page HTML (causing double-import / double-listener-attachment) — see § Phase 2 puzzle 7 below for resolution.

**`fetchFromProxy` (L411) — non-listener entry point relevant to reachability mapping:**
- Sends GET requests to `${proxyBaseUrl}/funnelback/{search|tools|spelling}` with merged session/IP query params
- Called by per-feature managers on tab clicks, facet selections, etc. — so tab-click and facet-click reachability terminates at `fetchFromProxy` from this audit's perspective.

**Class methods exposed on `window` indirectly via the singleton (`searchManager` default export):**
- `getSessionId`, `getClientIp`, `updateResults`, `sendAnalyticsData`, `setOriginalQuery` (referenced by integration.js L696–697 but **not defined in this file** — see Open questions below).

---

## Phase 1.2 — Reachability map by user-action class

For each action class: which listeners fire (cross-referenced by file:line back to the inventory), what each does, what network requests result, and any cascading firings.

A note on terminology: "listener inventory entry N" below refers to the numbered entries 1–16 + M1/M2 in §1.1 above.

### A. Typing in the header search input on a non-search page

**Element receiving native `input` events:** `#search-input`.

**Listeners fire (in registration order):**
1. **inventory #4 — integration.js:403 `handleInput` (debounce 200ms).** Trailing-edge fires `fetchHeaderSuggestions(query, container)` if `query.length >= 3` → `GET ${apiBaseUrl}/api/suggestions?query=…[&sessionId=…]` (via `fetch`). On response, `renderHeaderSuggestions` overwrites the suggestions container's innerHTML and **attaches one listener per `.suggestion-item`** (inventory #7).
2. **inventory #5 — integration.js:421 `handlePrefetch` (debounce 300ms).** Trailing-edge fires `prefetchSearchResults(normalizedQuery)` if `query.length >= 4` → `GET ${apiBaseUrl}/api/prefetch?query=…&collection=…&profile=…&prefetch=true[&sessionId=…]` (via `fetch`, `keepalive: true`, `priority: "low"`, 5s `AbortController`).

**Listeners that do NOT fire here (worth listing because they look like candidates):**
- inventory #15 (search-page-autocomplete.js:1113) targets `#autocomplete-concierge-inputField`, which only exists on the search-test page. On a non-search page, the entire L1080 DOMContentLoaded callback returns early at L1093 because the element is missing — so #15 is never attached, let alone fired.

**Network requests resulting per debounced trailing edge:**
- One `GET /api/suggestions` at 200ms-quiet (if query ≥ 3 chars).
- One `GET /api/prefetch` at 300ms-quiet (if query ≥ 4 chars).

**Cascading firings:** none. Setting `searchInput.value` programmatically is not done in this action class. The L7 click-listener attaches happen on `renderHeaderSuggestions` returning, not as a cascading native event.

### B. Typing in the search-page input

**Element receiving native `input` events:** `#autocomplete-concierge-inputField`.

**Listeners fire (in registration order):**
1. **inventory #15 — search-page-autocomplete.js:1113 `handleInput` (debounce 200ms).** Trailing-edge fires `fetchSuggestions(query, suggestionsContainer, true)` if `query.length >= 3` → `GET ${apiBaseUrl}/api/suggestions?query=…[&sessionId=…]`. On response, `renderResultsPageSuggestions` overwrites the suggestions container's innerHTML, **attaches one listener per `.suggestion-item`** (inventory #11), and **re-attaches** the keydown listener on the input (inventory #13, which first removes the prior `_keydownListener`).
2. **inventory #9 — integration.js:739 `handlePrefetch` (debounce 300ms).** Trailing-edge fires `prefetchSearchResults(normalizedQuery)` if `query.length >= 4` → `GET ${apiBaseUrl}/api/prefetch?…`.

**Listeners that do NOT fire here:**
- inventory #4 / #5 (integration.js:403 / :421) target `#search-input`, the header input. They are different elements; they do not fire.
- inventory #13 (the keydown listener) only fires on `keydown` events (Arrow keys / Enter / Escape), not on `input` events.

**Network requests resulting per debounced trailing edge:**
- One `GET /api/suggestions` at 200ms-quiet.
- One `GET /api/prefetch` at 300ms-quiet.

**Cascading firings:** none from typing alone. (When suggestions arrive and Enter is later pressed, see action class F.)

### C. Submitting the header search form

**Trigger:** user presses Enter inside `#search-input`, or clicks the form's `button[type="submit"]`.

**Listeners fire:**
1. **inventory #3 — integration.js:336 form submit listener.** `e.preventDefault()` immediately. Reads input, returns silently if empty. Normalizes query. Reads `SessionService.getSessionId()`. **Fires `fetch(${apiBaseUrl}/api/pre-render, POST, keepalive: true, body: { query, sessionId })` and does not await it.** Calls `SessionService.prepareForSearchRedirect(normalizedQuery)`. Sets `window.location.href = '/search-test/?query=' + encodeURIComponent(normalizedQuery)` — navigation begins. The `keepalive: true` flag keeps the pre-render POST alive across the navigation.

**Network requests resulting:**
- One `POST ${apiBaseUrl}/api/pre-render` (body: JSON `{ query, sessionId }`).
- Plus the navigation to `/search-test/?query=…`, which loads the search results page and triggers action class L (initial search-page load).

**Cascading firings:** the navigation fully unloads the current page; no further listeners on the originating page fire. On the destination page, action class L runs.

### D. Submitting the search-page search form

**Trigger:** user presses Enter inside `#autocomplete-concierge-inputField`, or clicks `#on-page-search-button`.

**Listeners fire:**
1. **inventory #8 — integration.js:678 form submit listener.** `e.preventDefault()`. Returns if empty. Normalizes query. If `window.SearchManager` exists, calls `setOriginalQuery(normalizedQuery)` (if defined; **see Open questions** — this method is referenced but not visible in core-search-manager.js) or sets `originalQuery` directly. Calls **integration.js's local `performSearch`** (L899) with `(normalizedQuery, component.container)` — this is the `form=partial` variant. Calls `updateUrl(normalizedQuery)` → `history.pushState`.

**Inside `performSearch` (L899):**
- Reads session ID via `SessionService.getSessionId()`.
- Fires `GET ${apiBaseUrl}/api/search?query=…&form=partial&collection=…&profile=…[&sessionId=…]` (line 934).
- On response, sets `container.innerHTML = '<div id="funnelback-search-container-response"…>' + html + '</div>'`.
- Calls `attachResultClickHandlers(container, query)` — **attaches inventory #10** to every result link in the new HTML.
- The MutationObserver M1 (core-search-manager.js:332) fires its callback because of the `innerHTML` mutation — every loaded per-feature manager's `handleDomChanges(addedNodes)` is invoked. (Per-feature manager bindings are out of scope.)
- Conditionally `scrollIntoView`.

**Network requests resulting:** one `GET /api/search?…&form=partial`.

**Cascading firings:**
- M1 fires on `innerHTML` mutation → every per-feature manager's `handleDomChanges` is called → those modules attach their own listeners to newly-rendered tab/facet/pagination elements (out of scope).
- The L1080 keydown-listener path is unchanged (no new render of suggestions).

### E. Clicking a suggestion in the header dropdown

**Trigger:** click on any `.suggestion-item` inside the header `#header-suggestions` container.

**Listeners fire:**
1. **inventory #7 — integration.js:628 per-item click handler.** Reads `.suggestion-text`. **Sets `document.getElementById("search-input").value = text` (L633–636).** Normalizes query. Calls `SessionService.prepareForSearchRedirect` if available. Calls `window.trackSuggestionClick(text, "general", "", text)` — which is the L1091 implementation in this same file, firing `navigator.sendBeacon(${proxyBaseUrl}/analytics/click, blob)` (or fetch fallback). Sets `window.location.href = '/search-test/?query=' + encodeURIComponent(normalizedQuery)`.
2. **inventory #6 — integration.js:424 document-level outside-click handler.** Bubbles to document. The click target is inside `component.suggestionsContainer`, so the if-check at L427–429 is false and the handler does nothing.

**Network requests resulting:**
- One `navigator.sendBeacon ${proxyBaseUrl}/analytics/click` (or fetch fallback).
- Plus the navigation to `/search-test/?query=…`, triggering action class L.

**Cascading firings to consider:**
- **Setting `input.value = text` programmatically does NOT dispatch an `input` event in any modern browser.** Therefore inventory #4 (header suggestions input listener) and inventory #5 (header prefetch input listener) do **not** re-fire from this assignment alone — see Phase 2 puzzle 5 for the resolution of this against the May 1 capture's duplicate-prefetch observation.
- The L173 click listener (search toggle) is on a different element and does not fire here.
- The L424 outside-click listener bubbles but takes no action because the click is inside the suggestions container.

### F. Clicking a suggestion in the search-page dropdown (general type)

**Trigger:** click on a `.suggestion-item` with `data-type="general"` inside `#autocomplete-suggestions`. (Staff and program types are action class G.)

**Listeners fire:**
1. **inventory #11 — search-page-autocomplete.js:507 per-item click handler.** Reads `.suggestion-text`, `dataset.type` (`general`), `dataset.url` (none for general). Sets `document.getElementById("autocomplete-concierge-inputField").value = text` (L532). Calls `trackSuggestionClick(text, "general", undefined, text)` (this file's local L578) → `navigator.sendBeacon(${proxyBaseUrl}/analytics/click, blob)`. Clears the suggestions container. Skips the staff/program branch (type is general). **Falls through to the main branch (L561–566): calls `performSearch(text, resultsContainer)` — the local `performSearch` at L666** — and `updateUrl(text)`.
2. **inventory #16 — search-page-autocomplete.js:1116 document outside-click handler.** Bubbles to document. The click target is inside `suggestionsContainer`, but the handler runs `container.innerHTML = ""` at L539 of #11 *before* the document listener fires. By the time #16 fires, #11 has already cleared `container.innerHTML` and removed the suggestion-item from the DOM — `Node.contains(other)` walks `other`'s parent chain looking for `this`, so `suggestionsContainer.contains(e.target)` returns false because the target has been detached. The handler then re-clears `container.innerHTML` (no-op) and sets hidden = true (already hidden). Net effect: no observable change.

**Inside the local `performSearch` (search-page-autocomplete.js:666):**
- Sets loading state on container.
- Reads session ID.
- Fires `GET ${apiBaseUrl}/api/search?query=…&collection=…&profile=…[&sessionId=…]` — **without `form=partial`** (compare to integration.js:899 which sends `form=partial`).
- On response, sets `container.innerHTML = '<div id="funnelback-search-container-response"…>' + html + '</div>'`.
- Calls `attachResultClickHandlers(container, query)` at L727 → **attaches inventory #12** to every result link.
- `CacheMonitor.logSearch(usedPreRender)`.
- Clear loading state.

**Network requests resulting:**
- One `navigator.sendBeacon /analytics/click`.
- One `GET /api/search?…` **without `form=partial`** ← this is the empirically distinctive shape; resolved against the May 1 capture in Phase 2 puzzle 3.

**Cascading firings:**
- M1 (core-search-manager.js:332) fires on `innerHTML` mutation → per-feature managers' `handleDomChanges` runs.
- Programmatic `input.value = text` at L532 does **not** dispatch an `input` event, so inventory #15 (#1113 input listener) and inventory #9 (#739 prefetch listener) do not re-fire (per Phase 2 puzzle 5).

### G. Clicking a staff or program suggestion in the search-page dropdown — including the inner-`<a>` branch

**Setup:** staff and program suggestion items contain a nested `<a>` with `target="_blank"` (L411–413, L471–473). Their suggestion-item DOMs look like `<div class="suggestion-item …" data-type="staff|program" data-url="…"> <a href="…" target="_blank"…> <div…>…</div> </a> </div>`. Clicks can land on the outer `<div>` or on the inner `<a>` (or its descendants).

**Listeners fire:**
1. **inventory #11 — search-page-autocomplete.js:507 per-item click handler.** This is the same listener as F. The branching:
   - **Inner-`<a>` branch (L543–555):** triggered when the click target is or has an ancestor `<a>` (`e.target.closest("a")`). The handler does NOT preventDefault — so the `<a>` element's default `target="_blank"` navigation proceeds (browser opens the URL in a new tab). Before returning, the handler schedules `setTimeout(() => { performSearch(text, resultsContainer); updateUrl(text); }, 100)`. This means: the new tab opens immediately to the staff or program URL; 100ms later, on the originating tab, the **local `performSearch` (search-page-autocomplete.js:666)** runs against the same `text`, filling `#results` with general search results for that text. Then `return` exits the click handler — the main branch at L561–566 does NOT execute. (See Phase 2 puzzle 6 for which-`performSearch`-fires resolution.)
   - **Non-inner-`<a>` staff/program branch (L557–559):** triggered when the click target has no ancestor `<a>` despite type being staff/program (e.g., click landed on padding around the `<a>`). The handler calls `window.open(url, '_blank', 'noopener,noreferrer')` and **falls through** to the main branch.
   - **Main branch (L561–566):** calls **the local `performSearch`** (L666) and `updateUrl`. This branch runs for general suggestions (action class F) and for the non-inner-`<a>` staff/program path.
2. **inventory #16 (document outside-click handler):** same bubble-stage no-op behavior as in action class F.

**Network requests resulting:**
- For the inner-`<a>` branch: browser navigation in a NEW TAB to the staff/program URL (no XHR from JS); plus, in the originating tab, after 100ms, one `navigator.sendBeacon /analytics/click` (already issued during step 4 of the click handler, before the branch — see entry 11 effect 4) and one `GET /api/search?…` without `form=partial`.
- For the non-inner-`<a>` branch: `window.open` to the URL; plus the same beacon + search request.

**Cascading firings:** as in F, plus the new tab's load is independent of the originating tab.

### H. Clicking a tab in the search-page tab bar

**Trigger:** click on a tab button rendered inside `#results`. Per the May 1 network investigation, four parallel `/proxy/funnelback/search` requests were observed.

**Listeners fire:** none in the three in-scope files. The listener is in `tabs-manager.js`, an out-of-scope per-feature manager loaded at core-search-manager.js:249. From the in-scope perspective, the dispatch terminates at:
- Per-feature manager → `core-search-manager.fetchFromProxy(url, "search")` (L411) → `GET ${proxyBaseUrl}/funnelback/search?…` with query/session/clientIp params.

**MutationObserver M1 (core-search-manager.js:332)** is not the trigger of the tab click itself — it is what gets called *after* the per-feature manager rewrites `#results` with the tab's new HTML (so other modules can re-bind to new DOM). Phase 2 puzzle 1 resolves the source of the four-request fan-out using the in-scope structural evidence.

### I. Clicking a facet on the search-page

Same shape as H — the listener is in `facets-manager.js` (out of scope). Dispatch terminates at `fetchFromProxy(url, "search")`.

### J. Clicking a pagination link

Same shape as H — the listener is in `pagination-manager.js` (out of scope). Dispatch terminates at `fetchFromProxy(url, "search")`.

### K. Clicking a result link in the search results

**Element receiving the native `click`:** any `<a>` matched by `.fb-result h3 a, .search-result-item h3 a, .listing-item__title a` inside `#results`.

**Listeners fire (exactly one of):**
- **inventory #10 (integration.js:999)** — if the current results were rendered by integration.js's `performSearch` (L899) — i.e., search-page form submit (action class D) or initial-load standard-search fallback (action class L's standard branch).
- **inventory #12 (search-page-autocomplete.js:805)** — if the current results were rendered by the autocomplete file's `performSearch` (L666) or by `displayPreRenderedResults` (L290) — i.e., suggestion clicks on the search page (action classes F / G), or initial-load pre-render hit (action class L's pre-render branch).

Each listener does **not** preventDefault, so link navigation proceeds; before navigation, it fires `navigator.sendBeacon ${proxyBaseUrl}/analytics/click` (or fetch keepalive fallback) with the click metadata.

**Critical:** at any given moment, a result link carries exactly one of these tracking listeners (because each `innerHTML = …` re-render destroys the previous links). They are mutually exclusive in time; "both attached" cannot occur.

**Network requests resulting:** one beacon to `/analytics/click`, plus the browser navigation away.

### L. Initial search-page load (`processUrlParameters` / `displayPreRenderedResults` path)

**Trigger:** the L102 DOMContentLoaded handler in integration.js fires on the search-test page; at L124–135, it sees `isResultsPage === true`, calls `setupResultsSearch(searchComponents.results)`, and then calls `processUrlParameters(searchComponents.results, cacheFirst)`. (The search-page-autocomplete.js DOMContentLoaded handler at L1080 also fires, but it only sets up the suggestions input and outside-click listeners — entries #15 and #16 — and reads `?query=` into a local variable that is never used.)

**`setupResultsSearch` actions (L668–746) before `processUrlParameters` runs:**
- Removes `empty-query` class from `component.button` (presentation only).
- Attaches **inventory #8** (form submit listener).
- Attaches **inventory #9** (search-page prefetch input listener).
- Calls `attachResultClickHandlers(component.container, queryParam)` — but `#results` is empty on initial load, so `querySelectorAll` matches nothing and zero listeners get attached at this point.

**`processUrlParameters` flow (L789–864):**
- Reads `?query=` from URL. If absent, returns.
- Sets `component.input.value = query` (no `input` event dispatched — see action class E note).
- Normalizes the query.
- **Pre-render branch (L814):** if `window.checkForPreRenderedContent` is defined (it is, exposed at search-page-autocomplete.js:1133), calls it.
  - Inside `checkForPreRenderedContent` (L168): fires `GET ${apiBaseUrl}/api/search?query=…&collection=…&profile=…&form=partial[&sessionId=…]` (L185–205) with a 1s `AbortController` timeout. On response, returns the HTML (whether from cache or live) — and reads `X-Cache-Status` to log HIT vs MISS for metrics.
  - Back in `processUrlParameters` (L820): if HTML returned and `window.displayPreRenderedResults` is defined, calls it (search-page-autocomplete.js:290).
    - Inside `displayPreRenderedResults` (L290): writes `resultsContainer.innerHTML = '<div id="funnelback-search-container-response"…>' + html + '</div>'`; calls `attachResultClickHandlers(resultsContainer, query)` at L320 → **attaches inventory #12** to all result links; if `window.SearchManager.updateResults` exists, calls it (this would write the same content again — minor double-write, presumably idempotent because `updateResults` does the same outer wrap); conditionally `scrollIntoView`.
  - On display success: returns early — pre-render path complete.
  - On display failure / no pre-rendered HTML / pre-render check error: calls `performStandardSearchFallback`.
- **Standard-search fallback branch (L876):** calls integration.js's local `performSearch` (L899), which fires `GET ${apiBaseUrl}/api/search?query=…&form=partial&collection=…&profile=…[&sessionId=…]` and on response writes `container.innerHTML` and calls `attachResultClickHandlers` → **attaches inventory #10**.

**Network requests resulting (most common path — pre-render branch):**
- One `GET /api/search?…&form=partial` from `checkForPreRenderedContent`.
- (No second search request; `displayPreRenderedResults` consumes the same response body.)

**Network requests resulting (standard-search fallback):**
- One `GET /api/search?…&form=partial` from the local `performSearch`.

**Cascading firings:**
- The MutationObserver M1 fires on `#results` `innerHTML` mutation (whether from pre-render display or from standard-search render) → per-feature managers' `handleDomChanges` runs → those modules bind to newly-rendered tabs/facets/pagination/etc.
- `core-search-manager.js`'s `init()` is gated by `window.location.pathname.includes("search")`, so on the search-test page its `initialize()` runs — that's what makes M1 active in the first place. (Triggered by whatever entry-point loads the singleton; per CLAUDE.md, that's `search-index.js` as a `type="module"` deferred import.)

---

## Phase 2 — Puzzles

### Puzzle 1 — Four-request fan-out per tab click

**Question.** The May 1 network capture observed four parallel `/proxy/funnelback/search` requests on a single tab click. The FE endpoint dictionary describes one. Why four? Pre-emptive (multiple potential targets pre-fetched) or defensive (multiple listeners overlapping)?

**Answer.** From the in-scope evidence: **the four requests all originate from a single per-feature manager (almost certainly `tabs-manager.js`) iterating over the four live tabs and firing one `fetchFromProxy("search")` call per tab in parallel.** The audit cannot distinguish "pre-emptive warming" from "defensive refetch all on every click" without reading `tabs-manager.js`, but it CAN rule out the alternative of "multiple listeners on the same tab element each firing one fetch."

**Listener-trace evidence supporting this answer:**

1. *All four requests share the same initiator.* The May 1 capture cited `core-search-manager.js:506` (the May 1 doc's line number for `await fetch(fullUrl)` inside `fetchFromProxy`'s try block; current line is L506 — confirmed). All four requests therefore flow through the same `fetchFromProxy` function. They are not from different listener handlers in different files.

2. *The four requests are parallel, not sequential.* The May 1 capture reports them firing simultaneously on the click. This rules out a chain of "first response triggers MutationObserver M1 which triggers other managers' `handleDomChanges` which fire follow-up fetches." A cascade through M1 would be sequential after the first response, not parallel at click time. Therefore M1 is not the source of the multiplier.

3. *The response sizes (~34 kB each, vs. ~125 kB for the initial render) match single-tab content.* Four requests × ~34 kB ≈ ~136 kB, which matches a single full-tabs render. So the four requests collectively fetch one tab's worth of content each, presumably for the four live tabs (Results / Programs / Faculty_Staff / News — these are the four catalogued in CLAUDE.md as the live renderers and in `pages/api/search.ts:38` as `POPULAR_TABS`).

4. *No structural pattern in core-search-manager.js fires four fetches on a single tab click.* `fetchFromProxy` (L411) is called once per invocation. The MutationObserver M1 fires module callbacks on DOM mutation, not on click. The dynamic-import loop at L249 happens only at `initialize()` time, not per click. So whatever fires four parallel fetches must be inside a per-feature manager (most plausibly `tabs-manager.js` given the request shape), not in core-search-manager.js itself.

5. *Multiple managers each binding to the same tab element and each firing one fetch is not consistent with the observed shape.* The per-feature managers are tabs / facets / pagination / spelling / analytics / collapse. Of these, only "tabs" has a structural reason to fire a `fetchFromProxy("search")` on a tab click. Facets respond to facet checkbox clicks, pagination to pagination-link clicks, spelling to spelling-suggestion clicks, analytics fires beacons not searches, collapse manipulates DOM presentation. The tab-click → four-search shape implies one manager (tabs) iterating four times, not four managers each firing once.

**Pre-emptive vs defensive — why this audit can't settle it.** The two readings differ in `tabs-manager.js`'s state-handling: does it cache a tab's content client-side after fetching it (pre-emptive — "fetch all four once, then re-render from memory on subsequent clicks within the same query")? Or does it discard prior content and re-fetch all four on every tab click (defensive — "always fetch fresh")? The listener-bearing in-scope files don't reveal this. The May 1 capture already noted that distinguishing requires reading `tabs-manager.js` (network-investigation §"Tab clicks — four-request fan-out per click", paragraph "The four-request pattern's purpose is undetermined…"). This audit confirms the framing: **the puzzle is fully scoped to `tabs-manager.js`'s internal state handling.**

**Rebuild observation.** The four-request multiplier is not an accident of listener overlap; it is a deliberate (if not necessarily right) design choice inside the tabs manager. The rebuild's tab-navigation design must make this choice explicitly: lazy single-tab fetch on click, pre-emptive all-tabs warming, or some hybrid. Whichever is chosen, the rebuild's load characteristics on the proxy edge will be sensitive to this decision.

### Puzzle 2 — Prefetch-handoff race hypothesis

**Question.** The cache-key half of the prefetch handoff was closed by the May 4 cache audit (keys are byte-identical between `prefetch.ts` and `search.ts` for the search-cache namespace). The remaining live hypothesis is timing: does the prefetch's backend-fetch-then-cache-write complete before the submit's lookup, or is there a race?

**Answer.** **A race is structurally guaranteed by the prefetch handler's design**, not merely possible. The prefetch handler returns HTTP 202 to the browser before initiating the backend fetch; the cache write happens asynchronously after the backend response arrives. The submit's `/api/search` lookup is not synchronized with this asynchronous chain in any way. Combined with the **search-cache vs tab-cache namespace mismatch surfaced by puzzle 4 below** (search.ts's substring-inference fallback routes form=partial submits to the tab-cache, which the prefetch never populates), the cache hit rate on prefetched queries is structurally bounded near zero on the form-submit path.

**Listener-trace evidence and timing decomposition:**

1. *The prefetch handler is fire-and-forget at the cache-write step.* `pages/api/prefetch.ts:121–181` is the relevant block. The handler calls `apiClient.get('/funnelback/search', { params: ... })` at L121, attaches a `.then(response => { ... setCachedData(cacheKey, response.data, cacheTTL) ... })` at L131–158, then **returns `res.status(202).json(...)` at L185**. The 202 returns to the browser as soon as the headers are flushed — typically within milliseconds. The backend `apiClient.get` and the subsequent `setCachedData` Redis write run in the background, after the HTTP response has already been sent.

2. *No back-channel makes the search submit wait for the prefetch chain to complete.* The submit handler (action class C → action class L on the destination page; or action class D in-page) fires `/api/search` whenever the user submits. Nothing in the FE listener chain inspects "is there a prefetch in flight for this query?" before submitting. There is no shared promise, no waitable state, no DOM signal. The two listener flows (prefetch debounce trailing edge → `/api/prefetch` → background cache write; vs. submit listener → `/api/search` → cache lookup) are independent.

3. *Decomposition of the timing window.* The minimum time from "prefetch fires" to "cache write completes" is approximately:
   - Network round-trip from browser to `pages/api/prefetch.ts`: ~50–200ms (Vercel edge/serverless cold path).
   - 202 returned (this is when the browser sees prefetch "done").
   - Backend `apiClient.get('/funnelback/search')` round-trip: typically 1–3 seconds for Funnelback uncached, ~100–500ms for proxy-side cached.
   - Redis `setCachedData` round-trip: ~10–50ms.
   - **Total: typically ~1–3.5 seconds from prefetch fire to cache populated.**

4. *The 300ms FE prefetch debounce delays the prefetch fire even further.* `config.prefetchDebounceTime = 300` (integration.js L34) means the prefetch fires 300ms after the user stops typing. A user who stops typing and immediately presses Enter (300–500ms reaction time) submits the search before the prefetch has even reached the backend. A user who pauses 1–2 seconds after the last keystroke gives the prefetch a chance — but still loses if the backend fetch is slow.

5. *Empirical confirmation from the May 1 capture.* In the `academic credentials` capture, prefetches fired during typing for the exact eventual query (`academic+credentials` plus several substrings); the post-redirect GET still hit MISS. The race is observed live, not just predicted.

**Rebuild observations.**

- The current architecture's stated intent ("POST warms cache, GET hits cache") is not what produces the speed advantage in practice. The May 1 capture identified the actual mechanism as **the 1003ms timeout boundary on `checkForPreRenderedContent` plus "MISS-response-used-directly"**: even on cache MISS, if the `/api/search` response lands within 1003ms, `displayPreRenderedResults` uses it; only late-landing responses trigger the standard-search fallback. The "cache write" leg of the prefetch / pre-render machinery is not load-bearing for user-visible speed.
- **The prefetch mechanism's actual contribution is more likely server-side warming** — keeping the Vercel container warm, priming Redis client connections, possibly warming Funnelback's upstream caches — rather than producing FE cache hits. If the rebuild keeps a prefetch-shaped mechanism, its contract should be re-articulated around warming rather than caching.
- An alternative the rebuild could consider: drop the FE prefetch entirely and rely on the server-side cache from the user's prior queries plus the submit-path cache lookup. The current FE prefetch fires on every typed character past the threshold, producing high request volume for marginal benefit.

### Puzzle 3 — Two-`performSearch` reachability

**Question.** `integration.js:899` (with `window.performSearch` wrapper at L1280) sends `form=partial`. `search-page-autocomplete.js:666` does not. The May 1 network capture observed `integration.js:934` as the live initiator on suggestion clicks. Is the local `performSearch` reachable from any handler? Is it dead code? Or do both fire under different conditions?

**Answer.** **The local `performSearch` (search-page-autocomplete.js:666) is statically reachable and is the lexically resolved target of the only callers in scope. The May 1 capture's "integration.js:934 as initiator on suggestion clicks" finding is in tension with the static read.** Best static read: the local function is reached on every search-page suggestion click (general, staff/program inner-`<a>` setTimeout, and staff/program non-inner fall-through). The May 1 attribution is most plausibly explained by misattribution of a coincident in-flight request rather than by any code-path that bypasses the local function.

**Listener-trace evidence.**

1. *Lexical scope at the call sites.* `search-page-autocomplete.js:550` (inside the inner-`<a>` branch's setTimeout) and `:564` (inside the main branch) both contain `performSearch(text, resultsContainer)`. Within this module's scope, `performSearch` is a function declaration at L666 (`async function performSearch(query, container) { ... }`). Function declarations are hoisted to the top of the module scope. The module does not import any symbol named `performSearch`. JavaScript's identifier-resolution rules walk lexical scopes outward: enclosing function → module scope → global scope. The local function declaration at L666 is found at the module-scope step, before the resolver reaches the global `window.performSearch`. Therefore `performSearch(text, resultsContainer)` at L550 and L564 lexically and unambiguously resolves to L666.

2. *The local function is exercised on every search-page suggestion click.* No handler in this file or the others routes search-page suggestion clicks through `window.performSearch` or through `integration.js:899`. No runtime monkey-patching is visible. So the static reading is: every search-page suggestion click reaches L666 → fires `fetch(\`${apiBaseUrl}/api/search?${params}\`)` at L698 — without `form=partial`.

3. *The May 1 capture's attribution.* The capture cites `integration.js:934` (the `await fetch(url)` inside integration.js's local `performSearch`) as the initiator on search-page suggestion clicks. This contradicts the static reading. Possible reconciliations, ranked by plausibility:
   - **Coincident in-flight request.** The May 1 capture occurred on `/search-test/` after navigation from the `/dev/funnelback-search/` test page. Action class L (initial-load) fires a `/api/search` from `integration.js:934` (via the standard-search fallback). If the user's suggestion click happened while that initial-load request was still in flight, the network panel might cluster the new suggestion-click initiator's request adjacent to the pre-existing initial-load request. A casual reading of the panel could attribute the wrong initiator. Likelihood: high — the May 1 captures span sub-second windows, and the initial-load can take 1–3 seconds.
   - **Initiator misread in the network panel.** Chrome's "Initiator" column reports the call-stack origin at fetch-time. For dynamically generated request chains (await across multiple files, microtask scheduling, etc.) the displayed initiator can be the JS frame closest to the network call. If the post-search-fall-through render's MutationObserver-cascaded re-attachments somehow ended up in the same task as the suggestion click, the initiator chain might display unexpectedly. Likelihood: moderate, but no concrete mechanism in scope explains it.
   - **Code drift between the May 1 capture date and now.** The autocomplete file was last modified `2026-01-20`; the integration file was last modified `2025-09-12`. Both predate the May 1 capture by months. So drift after the capture is not the explanation.
   - **Local `performSearch` is dynamically replaced by `window.performSearch`.** Would require a runtime monkey-patch (`performSearch = window.performSearch` or similar) somewhere. No such patch is visible in any of the in-scope files. Likelihood: very low.

4. *The local function is not dead code.* Even if the May 1 attribution were correct, the call sites at L550 and L564 lexically resolve to L666 by language semantics. For the local function to be "dead," every static call site would need to be unreachable in practice — but they are reached on suggestion-click handler firing, which is observed (the analytics beacon and URL update happen). So the local function runs; the only question is whether its `fetch` at L698 reaches the wire.

**Rebuild observation.** The two implementations share approximately 80% of their code (preparing params, setting innerHTML, attaching click handlers). Only the `form=partial` parameter and a small set of header behaviors differ. The rebuild can collapse these to one canonical search dispatcher with the `form` parameter as an explicit input. The static read here cannot determine whether the local one is dead or live in production runtime, but **whether or not it's currently firing on the wire, it is dispatching from the suggestion-click handler in source — so removing it requires either (a) verifying via instrumentation that it doesn't fire, or (b) replacing the call with the rebuild's canonical dispatcher.** Either way, no special handling is needed for "the local function is dead."

### Puzzle 4 — Substring-inference fallback at `pages/api/search.ts:127–145` reachability

**Question.** The May 1 capture established that tab clicks bypass `/api/search` entirely (they go direct to the proxy via `core.fetchFromProxy`). The fallback at `pages/api/search.ts:127–145` infers `tabId` from URL substring matching when `form === 'partial'`. Is this code path reachable from any real listener-fired request, or is it unreachable in current production traffic?

**Answer.** **Highly reachable.** Every form-submit and initial-load search request that reaches `pages/api/search.ts` carries `form=partial` in its query string and trips the substring-inference fallback. This block then **misclassifies the request as a tab request and routes it through the tab-cache namespace** (`getCachedTabContent` / `setCachedTabContent`) rather than the search-cache namespace (`getCachedSearchResults` / `setCachedSearchResults`). For the vast majority of queries (those that don't contain "Faculty"/"Staff"/"Programs"/"News" as URL substrings), the fallback assigns `tabId = "Results"` (the default at L141), so traffic is bucketed into the Results-tab cache.

The fallback is reachable from these listener flows:

| Source listener | Path | Sends `form=partial`? | Hits the fallback? |
| --- | --- | --- | --- |
| Header form submit (#3 → action class C → action class L) | `integration.js:899` performSearch | yes | yes |
| Search-page form submit (#8 → action class D) | `integration.js:899` performSearch | yes | yes |
| Initial-load standard-search fallback (#L standard branch) | `integration.js:899` performSearch | yes | yes |
| Initial-load pre-render check (#L pre-render branch) | `search-page-autocomplete.js:168` checkForPreRenderedContent | yes | yes |
| Search-page suggestion click — general (#11 → action class F) | `search-page-autocomplete.js:666` performSearch | **no** | no — uses search-cache namespace |
| Search-page suggestion click — staff/program (#11 → action class G) | `search-page-autocomplete.js:666` performSearch | **no** | no — uses search-cache namespace |
| Tab click (action class H) | bypass `/api/search` entirely | n/a | n/a — never reaches search.ts |

Five of the seven primary FE flows that reach `/api/search` go through the form=partial fallback and into the tab-cache namespace. Only suggestion clicks on the search page (which use the local L666 performSearch without `form=partial`) are routed through the search-cache namespace.

**Listener-trace evidence and the cross-cutting finding it surfaces.**

1. *The block is structurally reached, not a paper code path.* `pages/api/search.ts:108` calls `isTabRequest(fullUrl)` for upfront detection. The brief and the May 1 audit treat this as opaque (it's in `lib/utils.ts`, out of scope). The fallback at L125–147 fires when the upfront check returned false. From the FE side, every listener-originated `/api/search?…&form=partial` request shares the same shape: `?query=<q>&form=partial&collection=seattleu~sp-search&profile=_default[&sessionId=…]`. None of these requests carry `f.Tabs|...=…` parameters that would mark them as tab-shaped to `isTabRequest`. So `isTabRequest` returns false on these requests, and the fallback fires.

2. *The fallback's effect: the request is then handled by the tab-cache code path.* Lines 150–197 of search.ts run for `tabRequestDetected && tabId`: `getCachedTabContent` checks the tab cache, on miss the request hits the backend, on response `setCachedTabContent` writes to the tab cache. The search-cache code path (L201–242 — `getCachedSearchResults` / `setCachedSearchResults`) **runs only when the request did NOT have form=partial**. From the FE side, that's only the search-page suggestion-click flow.

3. *This refines the May 4 cache audit's "cache-key parity" finding.* The May 4 audit established that `prefetch.ts` (which uses `generateSearchCacheKey` at L92) and `search.ts` non-tab path (which uses `getCachedSearchResults` → presumably also `generateSearchCacheKey`) produce byte-identical cache keys. **But for `form=partial` requests on `search.ts`, the path goes through the tab-cache via the L127–145 fallback, which uses `getCachedTabContent` (presumably `generateTabCacheKey`).** Tab-cache keys are not interchangeable with search-cache keys (different generator function, different namespace).

4. *Combined with puzzle 2, this fully explains the May 1 observation that prefetches never produce cache hits on submits.* The chain:
   - Prefetch fires on typing → `/api/prefetch` → background cache write to **search-cache namespace** (key K).
   - User submits form → `/api/search?…&form=partial` → substring-inference fallback fires (tabRequestDetected=true, tabId=Results) → looks up **tab-cache namespace** (key K').
   - K ≠ K' (different namespace, different generator). Cache miss is structurally guaranteed independent of timing.
   
   Even if puzzle 2's race were resolved (e.g., if the prefetch's cache write completed before the submit), the namespace mismatch would still prevent hits. **The two issues are independent and additive.**

5. *Subsequent identical /api/search calls do hit the same tab-cache key, so the cache is not write-only.* If the user submits "basketball" twice with form=partial, the first writes Results-tab-cache, the second reads it. The cache works for repeat-submit-same-query. But it does NOT chain off the prefetch.

**Rebuild observations.**

- The `form=partial`-as-tab-indicator heuristic in search.ts:127–145 is fragile. A query like "News in 2026" would substring-match to `tabId = "News"` (L137–138), routing the request through the News-tab cache despite the user querying for general results. The substring matching is anchored to the entire `fullUrl`, including session IDs and any other parameters — so a session ID containing "Programs" as a substring would also misclassify. (Session IDs are random alphanumerics in practice, so this risk is low, but it exists.)
- The tab-cache vs search-cache namespace split, combined with the form=partial heuristic, means the rebuild's cache strategy needs to be redesigned bottom-up. A single canonical "search-content cache" keyed on the union of all relevant parameters — including the specific tab being requested as a first-class field, not inferred from URL substrings — would unify the namespaces.
- The substring-inference fallback's rebuild status: this code path exists because the upstream `isTabRequest` cannot detect tab requests on form-submit-shaped URLs (which have no `f.Tabs|…` filter). The rebuild's tab-detection logic should not need this fallback at all — tab navigation should be a distinct request type with explicit metadata, not one inferred from the absence of certain markers.

### Puzzle 5 — Input-mutation re-firing prefetch

**Question.** The header click handler at integration.js:633–636 sets `input.value = text` programmatically. Does this re-fire the debounced prefetch listener (lines around 421 and 739)? The May 1 capture observed a duplicate prefetch on suggestion-click — is this its source?

**Answer.** **No, programmatic value assignment does not re-fire the input listener.** The May 1 capture's attribution of the duplicate prefetch to "the input write triggers the same `input` event listener" is incorrect as a static reading. The actual most-plausible source of the duplicate prefetch is **a still-pending debounced trailing-edge from the user's last keystroke that fires shortly after the click.**

**Listener-trace evidence.**

1. *Programmatic value assignment does not dispatch `input` events by HTML spec.* MDN, the W3C HTML spec, and every modern browser are unambiguous: `element.value = "x"` for an `<input>` element is a property assignment that does not trigger an `input` event. The `input` event fires on user-driven changes — keyboard, paste, IME composition, drag-drop into the input. Programmatic assignment is not user-driven, so the event does not fire.

2. *The two relevant programmatic-assignment sites.* Both are in this audit's scope:
   - integration.js:635 — `input.value = text` inside the header suggestion-click handler (action class E).
   - search-page-autocomplete.js:532 — `searchInput.value = text` inside the search-page suggestion-click handler (action classes F / G).
   
   Both run inside synchronous click-handler execution. Neither does anything to manually dispatch an `input` event afterward (no `input.dispatchEvent(new Event('input', { bubbles: true }))` or equivalent). Therefore neither triggers the input listeners attached to the same elements.

3. *The most plausible actual source of the duplicate prefetch.* The user's typing flow before the click looks like:
   - keystroke 1 ("a") at t=0
   - keystroke 2 ("ac") at t=80ms
   - keystroke 3 ("aca") at t=160ms
   - …
   - keystroke N ("academic credentials") at t=Tms
   - the L1113/L739 prefetch debounce was reset on each keystroke; trailing-edge scheduled to fire at t=T+300ms
   - user looks at the suggestions dropdown (which has been updated by the L1113-attached suggestions listener), clicks a suggestion at t=T+P (where P is some user-reaction time, often 200–600ms)
   - the L507/L628 click handler runs synchronously: clears suggestions, fires the click-side `performSearch`
   - at t=T+300ms (which may be before, equal to, or after t=T+P depending on the user), the still-pending debounce fires `prefetchSearchResults(normalizedQuery)` for the last typed query — **this is the duplicate prefetch**
   
   So the duplicate prefetch is not from re-firing the input listener; it's from a previously-scheduled trailing-edge that the click handler did not cancel.

4. *Confirmation by elimination.* If the duplicate prefetch were from re-firing the input listener, you would see one prefetch per programmatic value assignment. There are two value assignments per click (the integration.js version on header dropdown, and the autocomplete version on search-page dropdown), but only one fires per click depending on which dropdown the user clicked. The May 1 capture observed exactly one duplicate prefetch per suggestion click (not, e.g., one prefetch and one immediately-after-suggestion-click prefetch as a tight pair). This is consistent with one debounced trailing-edge firing once, not with N programmatic-assignment-triggered re-fires.

**Rebuild observations.**

- The fix in the rebuild is to **cancel any pending debounced timer** when a suggestion is clicked. The current `debounce` helper (integration.js:1243; mirror at autocomplete.js:1069) does not expose a cancel method — it returns only the debounced function. A rebuild's debounce primitive should expose `.cancel()` so the click handler can call `handleInput.cancel()` and `handlePrefetch.cancel()` before performing the click action.
- The May 1 audit's "duplicate prefetch is implementation, not requirement" framing remains correct in spirit. The contract (search for clicked suggestion, update URL, populate input) is load-bearing; the redundant prefetch is not. The mechanism the May 1 doc proposed for the rebuild ("suggestion-click modeled as its own first-class action without going through the typing-and-submit pipeline") subsumes the cancellation requirement.
- One consequence of correctly identifying the source: even if the rebuild keeps separate listeners for typing-vs-clicking, **just cancelling pending timers on click is sufficient**; no synthetic-input tagging or suppression flag is needed. The pipeline isn't being re-entered; the still-scheduled trailing-edge just hasn't been told to abort. That makes the fix simpler than the May 1 doc anticipated.

### Puzzle 6 — Staff/program inner-`<a>` branch which-`performSearch` fires

**Question.** The search-page click handler has a special branch when the click is on the inner `<a>` element (cited as L545–554 in the autocomplete audit; current location L543–555). The branch is `setTimeout` then `performSearch(text, resultsContainer)`. Does the local `performSearch` actually execute here, or does some other listener intervene first?

**Answer.** **The local `performSearch` (search-page-autocomplete.js:666) executes — no other listener intervenes.** The `setTimeout(..., 100)` fires the call inside a fresh task on the originating tab, ~100ms after the click. By then the new tab has already opened (browser navigation in the new tab is initiated synchronously when the click bubbles past the handler without preventDefault, before the setTimeout's task is even queued). The originating tab's setTimeout callback then runs `performSearch(text, resultsContainer)` with the same lexical resolution as in puzzle 3 — to the local L666 function — and `updateUrl(text)`.

**Listener-trace evidence.**

1. *Same lexical-scope analysis as puzzle 3.* `performSearch` at L550 inside the `setTimeout` callback resolves to the file-local function declaration at L666. The `setTimeout` callback's lexical scope is the click handler at L507, whose lexical scope is `attachClickHandlers` at L505, whose scope is `renderResultsPageSuggestions` at L354, whose scope is the module top level — which contains the L666 function declaration. The `performSearch` identifier is found at the module-scope step.

2. *The click handler does not call preventDefault on the inner-`<a>` branch.* The handler runs to L548 (where the setTimeout is scheduled), then L554 `return`. It never calls `e.preventDefault()`. The `<a>` element with `target="_blank"` therefore proceeds with its default action — opening the URL in a new tab. The new tab's load is asynchronous (browser-initiated navigation in a different tab) and does not block the originating tab's task queue.

3. *Order of operations on the originating tab.* The synchronous click-handler execution completes — including the analytics beacon at L536, the suggestion-clear at L539–540, and the setTimeout schedule at L547. After click-handler return, the click event bubbles up to document where the L1116 outside-click handler runs (no-op, as analyzed in action class F). After event-loop completion of the click task, control returns to the browser. The browser may schedule the new-tab navigation and the setTimeout's 100ms timer in any order, but the setTimeout callback runs ~100ms later as a new task.

4. *The new tab's navigation does not prevent the setTimeout from firing on the originating tab.* The setTimeout was scheduled on the originating tab's window. Browsers do not pause originating-tab JS execution because of new-tab navigation. The 100ms delay is structurally just a yield to let the new-tab navigation kick off cleanly before the originating tab does work.

5. *No listener intervenes between scheduling and firing.* In the 100ms window, the only events that could fire on the originating tab are: a follow-on outside click (would trigger the L1116 handler — no-op); a fresh keystroke if the user typed (would trigger L1113/L739 input listeners — but the user just clicked away and switched focus to the new tab, so this is unusual); a pending debounced trailing-edge from before the click (puzzle 5's duplicate prefetch). None of these affect the setTimeout callback's eventual execution; they just produce concurrent network activity.

6. *The local `performSearch` then fires `GET /api/search?…` at L698, without `form=partial`.* This goes through the search-cache namespace (puzzle 4), not the tab-cache.

**Rebuild observations.**

- The 100ms setTimeout is a defensive yield. Its purpose is presumably to ensure the new-tab navigation has been initiated before the originating tab does any work that might trigger garbage collection, focus changes, or other side effects that could disrupt the navigation. In practice, modern browsers handle this without the yield (new-tab navigation is committed synchronously when the link is followed), so the 100ms is probably overcautious. The rebuild can probably eliminate it.
- More fundamentally, the inner-`<a>` branch implements an awkward dual-action contract: "the user wanted both to navigate to this person/program AND to see general search results for their text on this tab." Whether this dual action is actually load-bearing UX, or a residue from an earlier design, is a UX question that the rebuild should answer explicitly. If load-bearing, model it as one action with two clean side effects; if not, simplify to either "navigate only" or "search only" depending on intent.
- The dual-action also produces the puzzle-1-style multiplier on the originating tab: one click fires beacon + search-without-form-partial, and on most queries that go through this branch, a duplicate prefetch from puzzle 5 piggy-backs on top. Three requests for one click. The rebuild should make this explicit if it's intentional.

### Puzzle 7 — `core-search-manager.js:249` dynamic-imports of already-loaded managers

**Question.** The page HTML already loads the manager scripts; line 249 dynamically imports them again via `import(\`./${moduleName}-manager.js\`)`. Is this a real coupling problem (double-initialization, multiple listener attachments on the same elements) or a no-op (browser module deduplication handles it)?

**Answer.** **The puzzle's premise is wrong: the page HTML does not load the per-feature manager scripts. The dynamic import at L249 is the SOLE loader of those scripts. There is no double-import, no double-initialization, and no need for browser deduplication to handle anything.**

**Listener-trace evidence.**

1. *The May 1 network capture is authoritative on what actually loads on every page navigation.* Network-investigation §"FE script loading — chained reload on every page navigation" lists 11 scripts loaded per page, with their initiator attributions:
   ```
   - SessionService.js          ← from page HTML at line ~542
   - search-index.js            ← from page HTML at line ~548
   - search-page-autocomplete.js ← from page HTML at line ~544
   - integration.js             ← from page HTML at line ~546
   - core-search-manager.js     ← from search-index.js:14
   - tabs-manager.js            ← from core-search-manager.js:249
   - facets-manager.js          ← from core-search-manager.js:249
   - pagination-manager.js      ← from core-search-manager.js:249
   - spelling-manager.js        ← from core-search-manager.js:249
   - analytics-manager.js       ← from core-search-manager.js:249
   - collapse-manager.js        ← from core-search-manager.js:249
   ```
   The page HTML loads four scripts directly. `search-index.js` then imports `core-search-manager.js`. `core-search-manager.js` then dynamically imports the six per-feature managers via the L249 loop. **The per-feature managers have a single initiator: `core-search-manager.js:249`. They are not loaded by the page HTML.**

2. *CLAUDE.md's load-tier description matches the network capture.* CLAUDE.md §"Load tier reality" lists:
   - Tier 1 high-priority: `SessionService.js`
   - Tier 2 synchronous: `search-page-autocomplete.js`
   - Tier 3 deferred: `integration.js` (defer), `search-index.js` (`type="module"`, deferred by default)
   
   That's four scripts from the HTML. The per-feature managers are not in any tier, because they are not in the HTML. Only the L249 dynamic import loads them.

3. *Brief's premise probably came from a misreading of CLAUDE.md or an earlier audit.* This audit's prior phase 1 already flagged this in the Open questions section:
   > The brief's framing assumes the page HTML loads these manager scripts independently. CLAUDE.md's "load tier reality" section lists only four scripts… The per-feature manager files are not in that list. If the HTML does not pre-load them, line 249 is the *only* loader — and the puzzle's premise of "double import" needs to be refined or rejected. Phase 2 will resolve.
   
   The May 1 network evidence resolves it: not loaded by HTML, so no double-import to worry about.

4. *No double-initialization or duplicate listener attachments occur on this axis.* Each per-feature manager is loaded once, instantiated once at L253 (`new ModuleClass(this)`), stored once at `this.modules[moduleName]`. Whatever listeners they attach are attached once. Browser module deduplication (which would have prevented double-evaluation if a module had been loaded twice) is not exercised because there is no second load.

**However — a related concern surfaces.** The May 1 capture noted that **every page navigation triggers a full re-fetch of all 11 FE scripts**. Within a single page session there is no double-load; across page navigations the scripts re-load on every transition. The cost is per-navigation parsing-and-execution overhead on 11 scripts. This is a different problem from the puzzle's framing (which was about double-load within one session). It is operationally significant but not what the brief asked.

The puzzle as stated is a no-op concern. The actual load-overhead concern (per-navigation re-loading) is an open architectural question for the rebuild — covered in network-investigation §"FE script loading — chained reload on every page navigation" with the rebuild question explicit there.

**Rebuild observations.**

- The L249 dynamic-import pattern is **functionally correct** as a single-load mechanism. The brief's premise of double-load is wrong; the audit can mark this puzzle as not-an-issue.
- The rebuild's actual question on script loading is unrelated to L249: should the FE collapse to a single bundle (eliminating both the four-tier HTML imports and the dynamic-imports cascade) or restructure as critical-plus-deferred? The L249 mechanism is only relevant to the rebuild insofar as a rebuild that keeps multiple manager modules and module-typed dynamic imports inherits this pattern.
- A side note on the L249 mechanism for the rebuild: the `enabledModules` array at L24 lists `["tabs", "facets", "pagination", "spelling", "analytics", "collapse"]`. If any of these modules turns out to be unused (e.g., `analytics` if the rebuild removes analytics endpoints, `spelling` if spelling is folded into the search response), removing them from `enabledModules` is the cleanup point. The list is the single source of truth.

---

## Items deferred to future audits

- The per-feature manager modules (`tabs-manager.js`, `facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, `collapse-manager.js`) are out of scope here. A separate audit reading those modules in full would close out tab/facet/pagination listener attachments and answer the pre-emptive-vs-defensive question for the four-request fan-out (puzzle 1).
- `SessionService` internals are out of scope. Methods referenced from the in-scope files (`getSessionId`, `getSessionIp`, `prepareForSearchRedirect`, `_maskString`, `_detectSearchRedirect`, `initialize`) are treated as opaque dispatchers.
- `public/js/search-index.js` is the module entry point that imports `core-search-manager.js`. It is out of scope per the brief (only the three listener-bearing files are read in full). A focused read of that file would let an auditor verify that `core-search-manager.js` is the only thing it imports (the May 1 capture's initiator attribution confirms `search-index.js:14` initiates `core-search-manager.js`, but does not rule out other imports — though the network capture would have surfaced any missing files).
- `lib/utils.ts` and `lib/cache.ts` were treated as opaque from the listener perspective. The puzzle-4 finding about tab-cache vs search-cache namespace would be sharpened by reading the cache-key generators (`generateSearchCacheKey`, `generateTabCacheKey`) directly. The May 4 cache audit covered `lib/cache.ts`; cross-referencing the namespace mismatch finding into that audit's framing is a follow-up.

## Open questions raised but not answered

- **`SearchManager.setOriginalQuery`:** integration.js:696 calls `window.SearchManager.setOriginalQuery(normalizedQuery)` if it exists, else falls back to direct property write. The `core-search-manager.js` class definition does not define `setOriginalQuery`. Either the method is added in a per-feature manager module that augments the singleton, or the codepath always falls through to the direct-write branch. Either way, a Phase 1 listener trace cannot tell — needs a per-feature manager read.
- **`SessionService._detectSearchRedirect`** (integration.js:131–132): this private-prefixed method is read on every search-page load and its return value flows into `processUrlParameters`'s `cacheFirst` parameter, which the function comment at L777 declares "now unused (kept for compatibility)." So the method is invoked but its result is dead. Worth noting because it is a per-page-load `SessionService` call that does nothing useful.
- **Why does the prefetch handler use `apiClient.get('/funnelback/search', ...)` directly instead of going through the normal `/api/search` flow?** Per puzzle 4's finding, this means the prefetch's cache write goes to a different namespace than the eventual submit's cache lookup. If the prefetch were rewritten to call `/api/search` (with appropriate flags), it would land in the same namespace and the cache-hit problem would dissolve (modulo timing). This is a one-line rebuild question: prefetch.ts should mirror search.ts's cache write path, not bypass it.
- **The May 1 capture's `integration.js:934` initiator attribution on suggestion clicks** (puzzle 3): static reading says the local `performSearch` should fire, not the integration.js one. A definitive answer requires runtime instrumentation (e.g., a temporary `console.trace()` at both functions' entry points, or breakpoints in dev tools). This audit cannot settle it without exiting read-only posture.

## Cross-artifact refinements

The following observations from this audit sharpen or extend prior canonical artifacts. Per the brief's instruction, this section flags refinements rather than editing the prior artifacts.

- **`fe-autocomplete-audit-2026-05-05.md` line citations have shifted by ~10 lines** for the search-page suggestion-click handler. The old cite "L545–554 for the inner-`<a>` special branch" should be read as "L543–555 in the current file." The click-listener attach loop is at L506–568 (within `attachClickHandlers` at L505).

- **`network-investigation-2026-05-01.md`'s "duplicate prefetch is from input mutation triggering input listener" hypothesis is incorrect** as a static reading. The actual source is a still-pending debounced trailing-edge from the user's last keystroke. Programmatic value assignment does not dispatch `input` events. (Puzzle 5.) The May 1 doc's broader framing — that the duplicate prefetch is implementation residue, not load-bearing — remains correct; only the *mechanism* identification needs updating. The rebuild fix is simpler than the May 1 doc anticipated: cancel pending debounced timers in the click handler.

- **`network-investigation-2026-05-01.md`'s "`integration.js` `performSearch` is the live one — `search-page-autocomplete.js`'s appears dead" framing** is in tension with the static lexical resolution. Phase 1 + Phase 2 puzzle 3 trace the search-page suggestion-click flow as reaching the local L666 `performSearch` by language semantics. The May 1 attribution of `integration.js:934` as the initiator is most plausibly explained by misattribution of a coincident in-flight request from action class L's standard-search fallback. A definitive resolution would require runtime instrumentation. Either way, the rebuild's "collapse two `performSearch`s into one" cleanup item is unaffected — both are dispatching from suggestion click in source.

- **`fe-cache-audit-2026-05-04.md`'s "byte-identical keys between prefetch.ts and search.ts" finding holds for the search-cache namespace only.** Puzzle 4 surfaces a NEW finding the May 4 audit did not catch: `pages/api/search.ts:127–145` routes form=partial requests through the **tab-cache namespace** (`getCachedTabContent` / `setCachedTabContent`), not the search-cache. Prefetch writes go to the search-cache namespace. Submit reads via form=partial go to the tab-cache namespace. **The two namespaces don't share keys.** This is independent of the timing race (puzzle 2) and means the prefetch handoff is structurally broken on the form-submit path even if timing were perfect. The May 4 cache audit's framing should be extended: the cache-key parity finding is correct as far as it goes, but it doesn't cover the `form=partial` → tab-namespace routing in `search.ts`. Combined, puzzles 2 and 4 fully explain the May 1 capture's observation that prefetches never produce cache hits on submits.

- **`fe-endpoint-dictionary-2026-05-01.json`'s `tab-click` entry's per-click request count** was already flagged for refinement by the May 1 capture (one in dictionary, four observed). Phase 2 puzzle 1 sharpens the structural explanation: the four are not from listener overlap; they are from a single per-feature manager (almost certainly `tabs-manager.js`) iterating over the four live tabs. The dictionary entry should add this structural note when next refined.

- **`fe-endpoint-dictionary-2026-05-01.json`'s framing of the `pre-render-content-check` and `header-form-prerender-trigger` entries should add the cache-namespace caveat.** The pre-render's effective speed contribution is, per the May 1 doc, the 1003ms timeout boundary plus MISS-response-used-directly. The puzzle 4 finding here adds that the cache write the pre-render handler performs lands in a different namespace from the search-page-load lookup, so the cache leg is even less load-bearing than already understood.

