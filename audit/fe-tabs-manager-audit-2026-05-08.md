# FE Tabs-Manager Audit — 2026-05-08

**Repo:** `su-search-dev` (FE only)
**Date:** 2026-05-08
**Author:** audit pass run via Claude Code session
**Posture:** Read-only across all source files; writes scoped to `audit/**` by `.claude/settings.local.json`. No source-file edits, no commits, no deploys.
**Status:** **Phase 1 complete (foundation / single-file inventory).** Phase 2 (puzzles) **not run** — awaiting developer-review checkpoint per the audit brief.

## Scope

- **In scope (read in full):**
  - `public/js/modules/tabs-manager.js` (562 lines, 16 938 bytes; file metadata `@version 3.6.1`, `@lastModified 2025-05-09` — note that the `@lastModified` stamp predates today's audit pass, consistent with the discovery-phase no-changes posture).
- **In scope (read narrowly for cross-reference):**
  - `public/js/modules/core-search-manager.js` — L24 (`enabledModules`), L249 (dynamic import), L253 (`new ModuleClass(this)`), L267–L280 (`extractOriginalQuery`), L325–L344 (MutationObserver M1), L411 (`fetchFromProxy`).
  - `public/integration.js` — L692–L711 (the `setOriginalQuery` consumer block), L1227 (`updateUrl` definition), L1280 (`window.performSearch` exposure), L1300 (`window.updateSearchUrl = updateUrl` exposure).
- **Out of scope:** other per-feature manager modules (`facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, `collapse-manager.js`); `SessionService` internals; `lib/cache.ts`, `pages/api/search.ts`, `pages/api/prefetch.ts`, `pages/api/suggestions.ts` (the FE-server layer is not crossed by tab-click requests, which go direct to proxy via `fetchFromProxy`); proxy edge middleware and proxy serverless handlers; `public/search-page-autocomplete.js`, `public/js/SessionService.js`, `public/js/search-index.js`, `public/search-bundle.js`.

## Stop rule (as applied)

The audit reads `tabs-manager.js` in full and consults the cited locations in `core-search-manager.js` and `integration.js` only to anchor cross-references. Imports out of `tabs-manager.js` are not followed (the file imports nothing — see §1.9). Two supporting greps confirmed scope-relevant negatives across the wider FE tree (no `setOriginalQuery` definition anywhere; no `stencils.tabs.facets` reference anywhere in `public/`, `pages/`, or `lib/`); no other-file source reads were performed.

## Verification status

Permission allow-list at `.claude/settings.local.json` correctly scopes write/edit to `audit/**` and bash to read-shaped commands plus `mkdir:audit`, read-only git, and audit-scoped commit. The target file exists at `public/js/modules/tabs-manager.js` with line count 562.

| Anchor cited in brief | Status | Notes |
| --- | --- | --- |
| `public/js/modules/tabs-manager.js` exists | confirmed | 562 lines, 16 938 bytes |
| `core-search-manager.js:24` `enabledModules` array | confirmed | exact value `["tabs", "facets", "pagination", "spelling", "analytics", "collapse"]` (line 24, no drift from listener audit) |
| `core-search-manager.js:249` dynamic import of `${moduleName}-manager.js` | confirmed | `const module = await import(\`./${moduleName}-manager.js\`);` at line 249 (no drift) |
| `core-search-manager.js:253` `new ModuleClass(this)` | confirmed | `this.modules[moduleName] = new ModuleClass(this);` at line 253 (no drift) |
| `core-search-manager.js:332` MutationObserver M1 declaration | confirmed | `this.observer = new MutationObserver(...)` at line 332 (no drift); the cascade body invokes `module.handleDomChanges(mutation.addedNodes)` at line 338 |
| `core-search-manager.js:411` `fetchFromProxy` definition | confirmed | `async fetchFromProxy(url, type = "search")` at line 411 (no drift) |
| `integration.js:696` `window.SearchManager.setOriginalQuery` call | confirmed | `if (typeof window.SearchManager.setOriginalQuery === "function") { window.SearchManager.setOriginalQuery(normalizedQuery); ... }` at lines 696–702; fallback direct-write at line 705 |

No anchor was found to be invalid. All seven anchors hold exactly as the brief stated; no drift since the listener audit's verification table.

---

## Phase 1.1 — File-level facts

- **Total line count:** 562 (final newline excluded; `wc -l` reports 562).
- **Class name and export shape:** A single ES-module class `TabsManager` (declared at L14), exported as the module default at L562 (`export default TabsManager;`). The file is *not* an IIFE (unlike `integration.js`) and is *not* a procedural script (unlike `search-page-autocomplete.js`); it is a clean ES-module with one class and one export.
- **Constructor signature:** `constructor(core)` at L19. The single `core` argument is the `SearchManager` instance passed by `core-search-manager.js:253` (`new ModuleClass(this)`). It is stored as `this.core` at L20 and is the manager's only handle to the central singleton.
- **No top-level executable code:** no module-load-time side effects beyond the class declaration. Initialisation happens entirely in the constructor (`this.initialize()` at L40), which is invoked by the dynamic-import loop at `core-search-manager.js:249–253`.
- **File-level metadata note:** the `@lastModified` stamp at L11 reads `2025-05-09`, which is one calendar year prior to today's audit date. The discrepancy is consistent with the discovery-phase no-changes posture (the file has not been modified during the audit chain) and does not represent a bug; flagging only because future maintainers reading the metadata may find the date confusing in context.

## Phase 1.2 — Listener inventory

Three `addEventListener` attachments are reachable from `tabs-manager.js`. All three attach the same handler reference pattern (`this.handleTabClick.bind(this)`); none uses `{ once: true }`, capture phase, or other listener options.

**1. L105 — container-level click delegation (one per found tab container)**
- Selector / element resolution: each element in `this.tabContainers`, populated by `findTabContainers()` (L79–L96) by `document.querySelectorAll` over four candidate container selectors: `.tab-list__nav`, `.tab-container`, `[role="tablist"]`, `.tabs`.
- Event: `click`
- Handler: `this.handleTabClick.bind(this)` (a fresh bound function per attach call)
- Attachment site: `installTabClickHandlers` (L101–L111), called from `initialize` (L70).
- Timing: once at module-load (constructor → initialize). Re-attached for newly added containers via `handleDomChanges` (see attachment 3).
- Options: none — bubble phase, non-passive.
- Idempotency: protected at L532 by `if (!this.tabContainers.includes(container))` for additions made via `handleDomChanges`. The initial-load loop at L104 has no dedup guard, but `findTabContainers` runs once per page-load and pushes each `querySelectorAll` match without deduplication across selectors. If a single DOM element matches more than one of the four container selectors (e.g., a `.tabs` element that also has `role="tablist"`), the same element would be pushed into `this.tabContainers` twice and would receive two click listeners. **No structural deduplication within the initial-load path.** Whether this hazard ever fires depends on the rendered DOM's selector overlap.

**2. L109 — document-level click delegation (fallback)**
- Selector / element resolution: `document` (no element selection).
- Event: `click`
- Handler: `this.handleTabClick.bind(this)`
- Attachment site: `installTabClickHandlers` (L101–L111), in the **else** branch of `if (this.tabContainers.length > 0)`.
- Timing: once at module-load (constructor → initialize), **only if `findTabContainers` found zero containers**.
- Options: none.
- Idempotency: not relevant — single attachment by construction.
- Footnote: this listener is permanent for the page once attached. There is no demotion path: if `handleDomChanges` later adds container-level listeners (because tab containers appeared via DOM mutation after initial load), the document-level fallback **stays attached**. A click that bubbles up from a tab inside one of those late-added containers would then run **both** the container-level listener (attachment 3) **and** the document-level listener — handling the same click twice. The duplicate-handling effects are largely benign (`debouncedTrackTabChange` at L262 already guards against analytics double-fire within a 300 ms window, and `handleTabClick` at L223 calls `e.preventDefault()` then early-returns on the first matching selector), but a second `loadTabContent` call would launch a second `fetchFromProxy` for the same `href` if the document-level listener fires after the container-level listener has already started its async fetch. Flag worth surfacing because this is a plausible source of *some* of the duplicate-fetch noise observed in network captures (separate from the four-tab fan-out, which §1.5 establishes does not originate here).

**3. L534 — late-added container click delegation**
- Selector / element resolution: each element in `newTabContainers`, populated inside `handleDomChanges` (L498–L538) by matching mutation `addedNodes` against the same four container selectors as `findTabContainers`.
- Event: `click`
- Handler: `this.handleTabClick.bind(this)`
- Attachment site: `handleDomChanges` (L498–L538), invoked by the M1 MutationObserver at `core-search-manager.js:338`.
- Timing: every M1 mutation that adds a node matching one of the four container selectors (or contains one as a descendant).
- Options: none.
- Idempotency: protected at L532 by `if (!this.tabContainers.includes(container))`. A given DOM element will only ever be added once. The selector-overlap caveat from attachment 1 also applies here — within a single `handleDomChanges` invocation, the inner loop at L514 iterates all four selectors against the same node, so a node matching two selectors would be pushed twice into `newTabContainers` (no dedup before the L532 check, which checks against `this.tabContainers`, not against `newTabContainers`). The L532 check would catch the second push only after the first push has completed and added to `this.tabContainers`.

**No MutationObserver instances declared in `tabs-manager.js` itself.** The observer that drives this manager's `handleDomChanges` lives in `core-search-manager.js:332`.

**No `window.addEventListener` or `document`-level listeners other than attachment 2.**

**No `removeEventListener` calls except in `destroy()` (L543–L559).** The destroy paths at L555 and L558 use `this.handleTabClick.bind(this)` to identify the listener to remove, which produces a *new* bound function on each call. `removeEventListener` will not match listeners attached with a different bound-function instance, so **`destroy()` does not actually remove the click listeners** — it leaks them. This is a latent defect, not a runtime issue today (the module is never destroyed in normal flow); flag for the rebuild's lifecycle design.

## Phase 1.3 — State variables

All state lives on the class instance; no module-scoped variables are declared.

| Property | Initial value (L20–L37) | Type | Read sites | Write sites | Reset / clear sites |
| --- | --- | --- | --- | --- | --- |
| `this.core` | constructor argument | `SearchManager` instance | L294 (`this.core.originalQuery`), L308 (`this.core.sendAnalyticsData`), L363 / L437 (`this.core.fetchFromProxy`) | L20 (constructor) | never |
| `this.isFromTabNavigation` | `false` | `boolean` | L408 (read in `enhancedPerformSearch`), L486 (read in `enhancedUpdateUrl`) | L234 (set `true` in `handleTabClick`), L430 (set `true` in `enhancedPerformSearch` tab path) | L451–L453 (`setTimeout(() => { this.isFromTabNavigation = false; }, 100)` in `enhancedPerformSearch`) |
| `this.activeTabId` | `null` | `string \| null` | L264 (in `debouncedTrackTabChange` composite key) | L132 (`determineActiveTab`), L237 (`handleTabClick`) | never (only overwritten) |
| `this.tabContainers` | `[]` | `Array<Element>` | L103 (length check in `installTabClickHandlers`), L104 (forEach in init), L532 (membership check), L554 (forEach in destroy) | L92 (push in `findTabContainers`), L533 (push in `handleDomChanges`) | never |
| `this.originalPerformSearch` | `null` | `Function \| null` | L476 (called as fallback in `enhancedPerformSearch`'s non-tab branch), L545 (read in destroy) | L53 (saved from `window.performSearch` if it existed at init time) | never (only overwritten) |
| `this.originalUpdateUrl` | `null` | `Function \| null` | L491 (called as fallback in `enhancedUpdateUrl`), L549 (read in destroy) | L62 (first-truthy capture from the loop at L58) | never |
| `this.lastTrackedTab` | `null` | `string \| null` | L268 (debounce comparison) | L275 (set in `debouncedTrackTabChange`) | never |
| `this.lastTrackedTime` | `0` | `number` (epoch ms) | L269 (debounce comparison) | L276 (set in `debouncedTrackTabChange`) | never |
| `this.trackingDebounceTime` | `300` | `number` (ms) | L269 (debounce comparison) | L28 (constructor) | never |
| `this.tabSelectors` | five-element array (L31–L37) | `Array<string>` (CSS selectors) | L225 (`handleTabClick` `closest()` loop), L328 (`updateTabState` `querySelectorAll`-with-`.join(", ")`) | L31 (constructor literal) | never |

**Observation: there is no client-side cache of tab content.** No property holds previously-fetched tab HTML, no Map keyed by tab name or URL, no LRU. The state model is purely about *where the user is* (active tab, navigation flag) and *what we just tracked* (debounce dedup); it carries no memory of what was fetched. This finding is the input for §2 Puzzle 1's resolution.

**Observation: the navigation flag is the only short-lived state.** `this.isFromTabNavigation` is the lone property that gets explicitly cleared (via the 100 ms `setTimeout` at L451–L453). Everything else is either monotonic-overwrite (active tab, tracked tab, original-function captures) or append-only (`tabContainers`).

## Phase 1.4 — Method-level inventory

Twelve methods on `TabsManager` (constructor + 11 instance methods). Listed in source order.

| L | Method | Brief |
| --- | --- | --- |
| 19 | `constructor(core)` | Stores `core` reference, initialises eight state properties + the five-element `tabSelectors` literal, then calls `this.initialize()`. |
| 46 | `initialize()` | Calls `findTabContainers`, then conditionally wraps `window.performSearch` (if defined) and the first of `["updateSearchUrl", "updateUrl"]` it finds on `window`, then calls `installTabClickHandlers` and `determineActiveTab`. |
| 79 | `findTabContainers()` | Scans the DOM for elements matching one of four container selectors and pushes each match into `this.tabContainers`. Runs once at init time. |
| 101 | `installTabClickHandlers()` | Attaches the `handleTabClick` listener to each found container, **else** to `document` as a fallback. See §1.2 attachments 1 and 2. |
| 116 | `determineActiveTab()` | Iterates eight selector candidates (active-state combos) and stores the first match's `id` or `data-tab-group-control` attribute into `this.activeTabId`. Reads only — does not modify the DOM. |
| 144 | `extractCleanTabName(tabElement)` | Three-cascade strategy to extract a tab's display name: a child `.tab-name`/`.tab-title`/`.tab-label`, then the first text node child, then full `textContent`. Result is passed through `sanitizeTabName`. |
| 188 | `sanitizeTabName(tabName)` | Strips counter patterns (`(26)`, `[26]`), control characters, HTML tags, and normalises whitespace. Pure function. |
| 223 | `handleTabClick(e)` | The single-tab click handler. Iterates `this.tabSelectors`, calls `e.target.closest(selector)` against each, and on first match: `e.preventDefault()`; sets `this.isFromTabNavigation = true`; updates `this.activeTabId`; calls `updateTabState`, `debouncedTrackTabChange`, then `loadTabContent(href, tabElement)` if `href` exists. **Operates on a single element via `closest()` — no iteration over multiple tabs.** |
| 262 | `debouncedTrackTabChange(tabElement, cleanTabName)` | 300 ms dedup wrapper around `trackTabChange`, keyed on `${cleanTabName}-${this.activeTabId}`. |
| 287 | `trackTabChange(tabElement, cleanTabName)` | Builds a supplement-endpoint analytics envelope (`type: "tab"`, `query` resolved from URL or `this.core.originalQuery`, `enrichmentData.actionType: "tab"`, `tabName`, `timestamp`) and calls `this.core.sendAnalyticsData`. |
| 318 | `updateTabState(activeTab)` | Updates `aria-selected` and toggles the `.active` class across all tabs in the same container. DOM-only side effects. |
| 351 | `loadTabContent(href, tabElement)` | Async. Adds `.loading` to `#results`, calls `this.core.fetchFromProxy(href, "search")` for the **single** `href`, replaces `#results` innerHTML with the response wrapped in a `funnelback-search-container` div. Re-fetches the `#results` reference defensively before each write. **Single fetch, single URL.** |
| 405 | `enhancedPerformSearch(query, containerId, sessionId)` | The wrapper that replaces `window.performSearch` at L54. Sniffs the `query` for tab-navigation patterns (`form=partial` plus one of `tab=`, `Tab=`, or `profile=`); if matched, performs the same single-fetch flow as `loadTabContent`; otherwise delegates to `this.originalPerformSearch`. |
| 484 | `enhancedUpdateUrl(query)` | Skips the call when `this.isFromTabNavigation` is true; otherwise delegates to `this.originalUpdateUrl`. |
| 498 | `handleDomChanges(addedNodes)` | The M1 contract method. Inspects `addedNodes` for tab-container nodes (matching the same four selectors as `findTabContainers`) or descendants thereof, dedups against `this.tabContainers`, and attaches click listeners (§1.2 attachment 3). **Does not call `fetchFromProxy`. Does not re-bind the `window.performSearch` / `window.updateSearchUrl` overrides.** |
| 543 | `destroy()` | Restores `window.performSearch` and `window.updateSearchUrl`/`window.updateUrl`, then attempts to remove click listeners from each container and the document. The remove calls do **not** match the originally-attached listeners (see §1.2 attachment 3 footnote), so listener removal is non-functional. Method is not invoked anywhere in the codebase. |

**External call sites for `tabs-manager.js` methods (statically discoverable):**

A grep for `modules.tabs.<method>` and `modules["tabs"].<method>` across `public/`, `pages/`, and `lib/` returns zero matches. Tabs-manager is a side-effect-only module: it is constructed, runs `initialize()` once, and from then on is reachable only through:
1. **The window-global override surface.** `window.performSearch` (replaced at L54) and `window.updateSearchUrl` / `window.updateUrl` (replaced at L65) are the public-facing handles. Any code that calls those globals after `loadModules` resolves will hit the wrapper methods on this manager.
2. **The M1 MutationObserver contract.** `handleDomChanges` is invoked by `core-search-manager.js:338` after every `#results` mutation.
3. **DOM-bound click listeners.** §1.2 attachments 1, 2, and 3.

No direct cross-module method calls into tabs-manager are observed.

## Phase 1.5 — `fetchFromProxy` call sites in tabs-manager

Two call sites:

- **L363** — `loadTabContent(href, tabElement)`. Calls `this.core.fetchFromProxy(href, "search")` exactly once per invocation, with the literal `href` attribute value of the clicked tab as the URL. **No iteration. No multi-tab fan-out.**
- **L437** — `enhancedPerformSearch(query, containerId, sessionId)` tab branch. Calls `this.core.fetchFromProxy(query, "search")` exactly once per invocation, with the `query` parameter (which the L407–L413 sniff has already classified as a tab-navigation URL) as the URL. **No iteration. No multi-tab fan-out.**

Both call sites pass the request URL through opaquely to `core.fetchFromProxy`. The trinity (collection / profile / form) is **not** constructed inside tabs-manager — it lives in the `href` already (a tab anchor's `href` is a Funnelback URL with the trinity baked in by the partial template that produced the tab list, per `network-investigation-2026-05-01.md`'s structural framing). `core.fetchFromProxy` extracts the query string, sanitises sessionId / clientIp, and re-attaches the canonical session identifiers (per `core-search-manager.js:411–444` cited in the listener audit's verification table).

**Premise displacement.** The audit brief framed Puzzle 1 around the assumption that the four parallel `/proxy/funnelback/search` requests on a single tab click come from a per-feature manager iterating over the four live tabs, with `tabs-manager.js` as the most plausible candidate. **The Phase 1 evidence rules out tabs-manager as the iteration source.** Both fetch sites in `tabs-manager.js` issue exactly one request per invocation; neither is wrapped in a loop over tabs. The `handleTabClick` handler at L223 selects exactly one tab via `closest()` and breaks out of the selector loop on first match (L252 `return`). The MutationObserver path (`handleDomChanges` at L498) does not trigger any fetch at all. This finding has direct consequences for Puzzle 1 (which the brief itself anticipated could be displaced); see the §2 Puzzle 1 placeholder.

## Phase 1.6 — Tab identification

`tabs-manager.js` carries **no hardcoded tab list and no hardcoded tab count**. The "four" multiplier observed in network captures is not authored in this file. Tab identification in this file is purely DOM-derived:

- **Click-time identification.** `handleTabClick` (L223) accepts an event from anywhere a click can land and uses `e.target.closest(selector)` to walk up to the nearest matching tab element. The five-element `this.tabSelectors` (L31–L37) is the *grammar* of "what counts as a tab" — `.tab-list__nav a`, `.tab__button`, `a[role="tab"]`, `.tab_button`, `[data-tab-group-control]` — but not a list of specific tabs.
- **Container identification.** `findTabContainers` (L79) and the corresponding mutation path inside `handleDomChanges` (L498) both look up DOM elements matching `.tab-list__nav`, `.tab-container`, `[role="tablist"]`, `.tabs`. Again: a grammar of *tab containers*, not a list of specific containers.
- **Active-tab identification.** `determineActiveTab` (L116) reads the `aria-selected="true"` (or `.active`) state from the rendered DOM at init time. The active tab is whatever the server-rendered HTML says is active.

This means the rebuild can configure the tab grammar externally (selectors are the contract) without coupling to a specific tab list. Conversely, *whatever produces the four-tab list* is upstream of this manager — most likely the partial template that renders the results page's tab strip, which is a Funnelback-side artifact (`partial.ftl` / `stencils.tabs.*` per the project instructions). Tabs-manager consumes that rendered output; it does not produce it.

## Phase 1.7 — Tab ↔ facet coupling visibility

The project instructions describe tab/facet coupling: *"tab selection drives facet scope via `stencils.tabs.facets.${selected}`"* and *"tabs and facets are not independent UI modules."* From `tabs-manager.js`'s vantage point, the FE-side dispatch shape of that coupling is **not visible**:

- A grep for `stencils.tabs` across `public/`, `pages/`, and `lib/` returns **zero matches**. The `stencils.tabs.facets.${selected}` mechanism is a *backend* (Funnelback partial-template) concern; the FE never reads or writes that path.
- `tabs-manager.js` does **not** call into `facets-manager` directly. There is no `this.core.modules.facets.<method>` invocation, no `import` from a sibling module, no shared module-scoped variable.
- `tabs-manager.js` does **not** publish the selected-tab state via custom event, window global, or `this.core` property write. The closest thing is `this.activeTabId`, which is purely internal to this manager. `this.core.originalQuery` is read at L294 but never written by tabs-manager.
- The DOM update at `updateTabState` (L318) sets `aria-selected="true"` / `.active` class — *that* is the only signal a sibling module could subscribe to, and it requires the sibling to read the rendered DOM directly.

The most plausible coupling architecture, given this evidence, is **DOM-driven**: tabs-manager updates the active-tab class state on click; `loadTabContent` then replaces the `#results` innerHTML with a server-rendered response that includes the new facet block; facets-manager's own `handleDomChanges` (out of scope here) re-binds against the new DOM. The "coupling" then runs through *the server-rendered HTML response* — the FE never explicitly orchestrates it. This is consistent with the network-investigation finding that tab-clicks produce a fully-formed partial response from the proxy and the FE simply paints it.

If the actual coupling involves dispatch from `facets-manager` *into* tabs-manager (e.g., facets-manager listens for the `loadTabContent` response and asks tabs-manager something), this audit cannot see it from tabs-manager's side; it would surface from a future facets-manager audit. Flag for follow-up.

## Phase 1.8 — SessionService consumption

`tabs-manager.js` does **not** read `window.SessionService` or call `getSessionId` directly. A grep for `SessionService` against the file returns zero matches.

SessionId resolution happens entirely through the `core.fetchFromProxy` boundary: at the L363 / L437 call sites, the manager passes a URL with no sessionId concern, and `fetchFromProxy` (per the listener audit's confirmed view of `core-search-manager.js:411–444`) calls `checkAndRefreshIdentifiers()` at L419, then `getSessionId()` / `getClientIp()` to attach canonical values, stripping any conflicting values from the inbound URL.

**Implication for the rebuild.** Per-feature managers consume sessionId opaquely via the core's fetch wrapper; they do not need to know how sessionId is sourced. This is a clean abstraction worth preserving in any rebuild design.

## Phase 1.9 — Imports and outbound dependencies

**Imports:** zero. A grep for `^import` against `tabs-manager.js` returns no matches. The file is a self-contained ES-module that depends on the runtime (DOM, `window`, `Date.now`, `Node.ELEMENT_NODE`/`Node.TEXT_NODE`) and on the constructor-injected `core` reference.

**`this.core.*` accesses** (the manager's effective dependency surface on `core-search-manager.js`):

| Property / method on `this.core` | Used at | Purpose |
| --- | --- | --- |
| `this.core.originalQuery` | L294 (read) | Fallback query value for the analytics envelope when the URL has no `query` parameter. |
| `this.core.sendAnalyticsData(data)` | L308 (call) | Submits the supplement-endpoint analytics envelope. |
| `this.core.fetchFromProxy(url, "search")` | L363 (call), L437 (call) | The manager's only network egress point. |

Three properties / methods total. Tabs-manager treats `this.core` as a narrow service interface, not as an opaque container for arbitrary state. No reads of `this.core.modules`, `this.core.config`, `this.core.sessionId`, `this.core.clientIp`, etc.

**Window-global function consumption:**

| Window global | Used at | Purpose |
| --- | --- | --- |
| `window.performSearch` | L51 (existence test), L53 (capture), L54 (replace) | Wrapped via `enhancedPerformSearch`. |
| `window.updateSearchUrl` / `window.updateUrl` | L58 (loop key), L60 (existence test), L62 (capture if first one), L65 (replace) | Wrapped via `enhancedUpdateUrl`. |

Note: `integration.js:1280` exposes `window.performSearch` and `integration.js:1300` exposes `window.updateSearchUrl = updateUrl`. **`window.updateUrl` is *not* directly exposed by `integration.js`** (a grep against `integration.js` shows the local `updateUrl` at L1227 and the `window.updateSearchUrl = updateUrl` assignment at L1300, but no `window.updateUrl =` assignment). Therefore the `["updateSearchUrl", "updateUrl"]` loop at L58 will, in current production, only resolve `window.updateSearchUrl` — the `updateUrl` second iteration is dead. The loop is defensive against a future world where `window.updateUrl` is exposed too, but that world does not exist today. Flag for the rebuild.

## Phase 1.10 — SearchManager singleton augmentation

`tabs-manager.js` does **not** define `setOriginalQuery` on `window.SearchManager`, on `this.core`, or anywhere else. A grep for `setOriginalQuery` across `public/`, `pages/`, and `lib/` returns exactly two hits — both *consumer* sites in `integration.js` (the `typeof` check at L696 and the call at L697). **There is no definition site anywhere in the codebase.**

This settles the listener audit's open question conclusively (see also §2 Puzzle 2 below): the `integration.js:696` codepath always falls through to the L705 direct-property-write branch. The `setOriginalQuery` typeof-check is a defensive presence-test for a method that has never existed in this codebase, and the entire `if`-branch (L696–L702) is structurally dead.

For completeness, the audit also catalogued every `window.SearchManager.<symbol>` access across the FE (per the brief's request for a comprehensive answer):

| Site | Symbol | Operation |
| --- | --- | --- |
| `integration.js:696` | `setOriginalQuery` | typeof check |
| `integration.js:697` | `setOriginalQuery` | invoke |
| `integration.js:705` | `originalQuery` | direct write (fallback branch) |
| `search-page-autocomplete.js:326` | `updateResults` | typeof check |
| `search-page-autocomplete.js:328` | `updateResults` | invoke |

A grep for the corresponding *definition* sites across `public/`, `pages/`, and `lib/` shows:
- `setOriginalQuery`: zero definitions (confirmed above).
- `updateResults`: a `SearchManager.prototype.updateResults` method exists at `core-search-manager.js` (out of scope for this audit's read window, but the symbol shows up in the cross-grep). This is the only runtime-reachable singleton-method consumer pair on this list. Flag for the rebuild's interface inventory; not a tabs-manager finding.

`tabs-manager.js` itself **does** mutate one piece of singleton-adjacent state: it overwrites `window.performSearch` (L54) and `window.updateSearchUrl` (L65) at module-load time. These are window-global function writes, not `window.SearchManager.*` property writes — distinct from the singleton-augmentation question Puzzle 2 was asking about, but worth noting under "augmentation of shared state" generally.

---

## Cross-cutting observations from Phase 1

These items were not asked for explicitly by the brief's 1.1–1.10 inventory, but emerged as readable from the file in scope and have rebuild implications.

1. **Tabs-manager wraps two window-global functions during initialise.** The wrapping happens once at module-load time inside the dynamic-import promise resolution chain (`core-search-manager.js:249` → `new ModuleClass(this)` at L253 → tabs-manager's constructor → `initialize()` at L40 → L51–L67). Any code that captured `window.performSearch` *before* tabs-manager's load — for example, an inline script in the HTML head — would hold a reference to the *original* `integration.js` performSearch and bypass tabs-manager's enhancement entirely. Whether this matters in production depends on `core-search-manager.js`'s load timing relative to other scripts; the listener audit's verification table establishes that `core-search-manager.js` is loaded by `search-index.js` (`type="module"`, deferred), so the tab-manager wrapping happens *after* `integration.js` has finished its DOMContentLoaded callback. By that point, the autocomplete-suggestion-click flow's call-site resolution (per the listener audit's puzzle 3) has already locked in. Rebuild implication: wrapping window globals from a deferred module is fragile; the rebuild should prefer explicit dispatch over global-function patching.

2. **`destroy()` does not actually clean up listeners.** Cited in §1.2 attachment 3's footnote and §1.4. The `removeEventListener` calls at L555 and L558 use freshly-bound function references that will not match the originally-attached listeners. In current production this is moot — `destroy()` is never invoked in any code path, including page navigation (these are SPA-style results-page navigations that do not unload the JS context). Flag for the rebuild's lifecycle design.

3. **The `tabSelectors` array is duplicated by intent across `handleTabClick` and `updateTabState`.** L225–L228 uses each selector individually with `closest()`; L328 joins them with `", "` for `querySelectorAll`. Two consumers, one source-of-truth array — this is a clean pattern. The `containerSelectors` arrays in `findTabContainers` (L81–L86) and `handleDomChanges` (L507–L512) are *also* duplicates of each other (same four-element list, written twice). That is *not* a clean pattern — the same list authored in two places is a minor consistency hazard. Rebuild candidate for consolidation.

4. **Defensive `#results` re-fetching in `loadTabContent`.** L353, L366, L379, L391 — four separate `document.getElementById("results")` calls inside one method, each guarded by an `if (!container) return` (or equivalent). The pattern guards against the container being removed mid-fetch. This is more defensive than the autocomplete file's display path (per the autocomplete audit) and reflects the tab-fetch path being long-lived (real network call vs. autocomplete's fast-path).

5. **`enhancedPerformSearch`'s tab-detection sniff is heuristic, not authoritative.** L407–L413 inspects the `query` argument for `form=partial` plus one of `tab=` / `Tab=` / `profile=`. This catches tab-navigation URLs that arrive via the wrapped `window.performSearch` path (e.g., from code that constructs a tab-navigation URL and calls `performSearch` rather than a DOM click). The L408 `this.isFromTabNavigation || ...` short-circuit means a click-driven flow has already set the flag in `handleTabClick`, so the heuristic only matters for non-click entry points. Flag for the listener audit's puzzle 4: this sniff is a *second* place where `form=partial` is used as the tab-navigation discriminator, parallel to the FE-server-side `pages/api/search.ts:127–145` substring inference that the listener audit catalogued. Two independent uses of the same heuristic, both fragile to URL-shape drift; rebuild should make tab-navigation an explicit type.

6. **Analytics envelope shape divergence.** `trackTabChange` at L297–L305 builds a supplement-endpoint envelope with `type: "tab"` and `enrichmentData.actionType: "tab"` — both fields. The L297 comment explicitly notes that `type` is consumed by core-search-manager for routing. Compare with the `originalQuery`-vs-`query` rename happening at `core-search-manager.js:638–641` (per the cross-reference grep above): the supplement endpoint expects `query`, not `originalQuery`, and core-search-manager rewrites the field on submission. Tabs-manager's envelope already uses `query` directly, sidestepping the rewrite. This is a minor cleanliness contribution worth preserving in the rebuild's analytics-envelope contract.

---

## Developer-review checkpoint — Phase 1 ends here

Phase 2 puzzles **have not been answered**. The brief's convention is that Vic reviews Phase 1 first, signs off, then Phase 2 puzzles execute. Per the brief: *"If the Phase 1 inventory surfaces evidence that displaces a Phase 2 puzzle's premise, surface it in the deliverable and skip the puzzle rather than answering a question whose framing has been invalidated. Same convention as the listener audit's puzzle 7 — when the premise turned out to be wrong, the audit said so."*

For each Phase 2 puzzle, the placeholder below records the Phase 1 evidence already in hand and the open path for resolution.

### Puzzle 1 — Pre-emptive vs defensive caching

**Status: premise displaced.**

Phase 1.3 establishes that `tabs-manager.js` carries no client-side cache structure for tab content (no Map, no object keyed by tab name or URL, no LRU). Phase 1.5 establishes that both fetch sites issue a single request per invocation, never iterating over multiple tabs. Phase 1.4's `handleTabClick` walkthrough confirms the click handler operates on a single element via `closest()` with an early `return` on first selector match.

Therefore: from `tabs-manager.js`'s side, the answer is "neither pre-emptive nor defensive in the multi-tab sense — every tab click triggers a single fetch for the clicked tab's `href`, and there is no client-side memory of prior fetches at this layer." This is the *defensive* end of the spectrum on a per-tab basis (always fresh), but it does **not** explain the four-request fan-out observed in network captures.

The four-request fan-out's structural source remains unidentified by this audit. Candidate explanations (each requires reading a file out of this audit's scope):

- A different per-feature manager (`facets-manager`, `pagination-manager`, etc.) iterates over four tabs in its own click handler. The `fetchFromProxy` grep in §1.5's supporting greps shows `facets-manager.js` calls `fetchFromProxy` at L100 and L135, and `pagination-manager.js` at L86 — but whether any of these iterate over four tabs requires reading those files.
- Something in `core-search-manager.js` itself fans out. The listener audit treated the core's request paths as opaque except for `fetchFromProxy`'s definition at L411 and the `extractOriginalQuery`/observer setup; whether some other code path in core-search-manager iterates over tabs would require a re-read with that question in mind.
- The fan-out is server-side. The proxy or Funnelback responds to a single tab-click request by emitting four requests upstream (less likely given the network-investigation framing, which captured client-side requests), or the fan-out happens via prefetch (`pages/api/prefetch.ts`) or another FE-server endpoint. The brief explicitly excludes the FE-server layer from in-scope reads.
- A loop iterates inside `enhancedPerformSearch` somewhere; the audit's full read of this file rules this out for tabs-manager but the wrapper *is* installed at the window scope, so any code that calls `window.performSearch` four times (e.g., a DOMContentLoaded warmer) would route four single-fetch calls through tabs-manager. This is a hypothesis worth checking against `core-search-manager.js` and `integration.js`'s warmer / prefetch paths.

**Recommendation for Phase 2 (when Vic signs off):** because the premise is displaced rather than the question being settled, Phase 2 should *redirect* Puzzle 1's intent to the source-identification question (where do the four requests come from, given that tabs-manager isn't the source). Resolving that requires reading a file outside this audit's scope; the brief's stop rule says "surface the gap rather than expanding scope," so the right next step is a follow-up audit with the relevant per-feature manager (or core-search-manager re-read) in scope. Alternatively, runtime instrumentation could resolve it directly by capturing the call stack at the four parallel fetches.

### Puzzle 2 — `SearchManager.setOriginalQuery` resolution

**Status: settled by Phase 1.10.**

`tabs-manager.js` does not define `setOriginalQuery`. Neither does any other file in `public/`, `pages/`, or `lib/`. A grep against the entire FE tree returns exactly two hits: the `typeof` check at `integration.js:696` and the call at L697 — both *consumer* sites, no definition. Conclusion: **the `integration.js:696` codepath always falls through to the L705 direct-property-write branch.** The `setOriginalQuery` typeof-check is a defensive presence-test for a method that does not exist; the entire L696–L702 `if`-branch is structurally dead.

This closes the listener audit's open question on `setOriginalQuery`.

A note on the breadth of this finding: the brief asked for a comprehensive look at *any* `window.SearchManager.<method>` consumer, in case multiple consumers were lurking. There are exactly five sites total (cataloged in §1.10), of which two (the `setOriginalQuery` pair) are consumers of a non-existent method, two (the `updateResults` pair in `search-page-autocomplete.js`) are consumers of a method that *does* exist on `core-search-manager.js`'s `SearchManager` class (out of scope here, but the symbol is reachable per the cross-grep), and one (the `originalQuery` direct-write at L705) bypasses any setter. The singleton's *consumed* surface is wider than the singleton's *augmented* surface; in this codebase, the augmented surface from per-feature managers is empty.

**Recommendation for Phase 2:** no further work needed. Fold this finding into the cross-artifact refinement list for the next canonical-document update pass.

### Puzzle 3 — `handleDomChanges(addedNodes)` intent

**Status: ready for Phase 2 (no premise displacement).**

Phase 1.4 records that `handleDomChanges` (L498–L538) does the following: dedup-checks `addedNodes` against `this.tabContainers`, attaches click listeners (§1.2 attachment 3) to newly-arrived containers, and does **not** call `fetchFromProxy` and does **not** re-fire any `loadTabContent` flow.

The interaction with the four-request fan-out hypothesised in the brief: **null**. `handleDomChanges` cannot be a source of fetches (no fetch call site), so it cannot contribute to the multiplier. The MutationObserver-cascade hypothesis from the listener audit's puzzle 1 is reconfirmed as ruled out: no `addedNodes` mutation produces a request from tabs-manager.

A residual concern surfaced in §1.2 attachment 1's selector-overlap caveat: if a DOM element matches multiple of the four container selectors, both the initial-load attach loop and `handleDomChanges` would be susceptible to attaching duplicate listeners (the L532 `this.tabContainers.includes(container)` check protects only against re-adding the *same element-instance* to `this.tabContainers`, not against the same element being matched by multiple selectors within a single invocation). Whether this hazard fires depends on the rendered DOM's overlap.

**Recommendation for Phase 2:** answer the headline question (handleDomChanges = re-bind click listeners on late-arriving containers, no fetch implication) plus document the selector-overlap edge case for the rebuild.

### Puzzle 4 — Tab ↔ facet coupling mechanism

**Status: ready for Phase 2 (no premise displacement, but tabs-manager's view is one-sided).**

Phase 1.7's evidence: from tabs-manager's side, the coupling is **DOM-driven** — the manager updates `aria-selected` / `.active` on click and replaces `#results` innerHTML with the server-rendered tab response (which itself contains the new facet block); any sibling module subscribing to that change does so via its own `handleDomChanges` (i.e., the M1 MutationObserver cascade re-fires for facets-manager when `#results` mutates).

This is the *one-sided* answer. The full coupling picture requires reading `facets-manager.js` to see how it consumes the rendered DOM and whether it reads `aria-selected="true"` from the active tab to drive its own scope. That's out of scope here.

**Recommendation for Phase 2:** record the one-sided answer (DOM-driven from tabs-manager's side; explicit dispatch absent) and open a follow-up audit for `facets-manager.js` to close the loop.

### Puzzle 5 — Cache-namespace alignment with the listener audit's puzzle 4

**Status: settled by Phase 1.5 + the listener audit's puzzle 4 finding.**

Phase 1.5 confirms tab-click requests go directly to the proxy via `core.fetchFromProxy(href, "search")`, with no FE-server intermediary. The endpoint built at `core-search-manager.js:412` (`${this.config.proxyBaseUrl}/funnelback/${type}` → `https://funnelback-proxy-dev.vercel.app/proxy/funnelback/search`) is a direct proxy URL. `pages/api/search.ts` is not in the request path.

Combined with the listener audit's puzzle 4 finding (that `pages/api/search.ts:127–145`'s substring-inference fallback routes form=partial requests to the `tab:` cache namespace), the conclusion is sharper than either audit settled on its own:

- The `tab:` cache namespace in `lib/cache.ts` is **not** populated by tab-click requests at all.
- The `tab:` cache namespace is populated by **form=partial requests routed through `pages/api/search.ts`** — i.e., search-form submissions and standard-search flows that happen to carry `form=partial` parameters and thereby trigger the substring-inference fallback.
- Tab-click content caching is currently entirely a **proxy-layer** concern (the proxy's own KV cache). The FE cache layer is uninvolved on the tab-click path.

This refines the cache-audit's framing: the "tab-cache namespace" is a misnomer in the sense that tab clicks do not write to it. A more accurate framing would be "form-partial-fallback namespace, populated by search-form flows that the FE-server-layer's substring inference treats as tab-like."

**Rebuild implication.** Adding FE-layer caching of tab-click content would be a *new* layer, not a refactor of an existing one. The rebuild's cache-namespace strategy therefore has three independent design surfaces: (a) what `lib/cache.ts` does for search-form / form-partial / suggestions paths, (b) what the proxy does for direct proxy traffic (currently the only cache layer for tab-click and pagination/facets/spelling content), and (c) whether to introduce client-side memory caching in the per-feature managers themselves. Decisions about (a) do not constrain decisions about (b) or (c).

**Recommendation for Phase 2:** record the sharpened framing and feed it into the cross-artifact refinement list for `fe-cache-audit-2026-05-04.md` and `fe-listener-audit-2026-05-06.md`.

---

## Items deferred to future audits

1. **Source of the four-request fan-out** (carried forward from Puzzle 1's premise displacement). Resolution requires reading at least one of `facets-manager.js`, `pagination-manager.js`, or a deeper re-read of `core-search-manager.js` outside the cited anchor lines, or runtime instrumentation. Recommend a follow-up `fe-per-feature-manager-audit-<date>.md` covering the remaining five managers in one pass, or a focused network-instrumentation pass to capture stack traces at the parallel fetch sites.

2. **Facets-manager's view of the tab/facet coupling** (carried forward from Puzzle 4). Resolves the one-sided answer in §1.7. Recommend folding into the per-feature-manager audit above.

3. **Whether selector-overlap in the four container selectors actually fires duplicate-listener-attach in production DOM** (carried forward from §1.2 attachment 1 / Puzzle 3). Resolves by inspecting a rendered search-results page's tab-container DOM (a one-off DevTools task) or by adding a single `console.assert` to the manager. Not a code-reading question.

4. **Whether `window.updateUrl` gets exposed by some other script** (raised in §1.9). The L58 `["updateSearchUrl", "updateUrl"]` loop is dead on its second iteration in the current `integration.js`-only world; whether a future or sibling script exposes `window.updateUrl` is an open assumption.

5. **The wrapping order between tabs-manager and `integration.js`'s captured `performSearch` references** (raised in cross-cutting observation 1). Resolves with a runtime check or by reading the autocomplete-click handler's call-site resolution alongside tabs-manager's load timing. The listener audit's puzzle 3 is the related thread.

## Open questions raised but not answered

- **Q1.** What is the canonical contract between `core.fetchFromProxy` and per-feature managers regarding error handling? Tabs-manager's catches at L377 and L456 swallow the error message into the rendered HTML. Whether other managers do the same, or whether the contract is "throw and let the core handle it," is unknown from this single-file audit.
- **Q2.** Why does `enhancedPerformSearch` reset the navigation flag with a 100 ms `setTimeout` (L451–L453) rather than synchronously after the response is painted? The comment says "to allow time for other handlers to see it." Which handlers? Plausibly `enhancedUpdateUrl` (which reads the flag at L486), but `enhancedUpdateUrl` should be invoked *during* the same call frame in normal flow (i.e., before the timeout could fire). The 100 ms suggests an async race somewhere — possibly with the MutationObserver M1 firing analytics or other downstream consumers of the navigation state. Worth resolving in a follow-up audit.
- **Q3.** The `lastTrackedTab` / `lastTrackedTime` debounce dedup at L262–L280 is keyed on `${cleanTabName}-${this.activeTabId || ""}`. Because `this.activeTabId` is updated *before* the debounce check (L237 happens before L244), the composite key always reflects the *new* tab's identity. So the debounce protects against rapid-fire clicks on the *same new tab* within 300 ms — not against rapid-fire alternation between two tabs. Whether this matches the intended product behaviour is a UX question.

## Cross-artifact refinements expected

Per the audit-chain convention, prior canonical artifacts are not edited; this audit's findings flag refinements via cross-reference. Targets:

- **`fe-listener-audit-2026-05-06.md` puzzle 1 deferred half:** The four-request fan-out's source is **not** `tabs-manager.js`. Carries forward as Items-deferred 1 above. The listener audit's wording — "Almost certainly `tabs-manager.js`" — is now contradicted by direct evidence and should be amended in the next canonical-document pass.
- **`fe-listener-audit-2026-05-06.md` open question on `SearchManager.setOriginalQuery`:** Closes. The method does not exist anywhere; the L696–L702 branch is dead.
- **`network-investigation-2026-05-01.md` four-request fan-out section:** The structural explanation needs amending — the source is *not* tabs-manager. Specific candidate sources are catalogued in Items-deferred 1.
- **`fe-endpoint-dictionary-2026-05-01.json` `tab-click` entry:** The "tab-click" structural source needs to reflect that `core.fetchFromProxy` is the egress, called once per click from `tabs-manager.js`, with the `href` coming from the clicked anchor's attribute (not constructed from a per-feature manager's tab list). The per-click-count of *one* requires a separate explanation for the four-request observation.
- **`fe-cache-audit-2026-05-04.md` cache-namespace framing:** The `tab:` namespace is populated by `pages/api/search.ts`'s form=partial substring fallback, **not** by tab-click requests. Tab-click requests bypass `lib/cache.ts` entirely and hit only the proxy's own cache layer.
- **`CLAUDE.md` tab-coupling description:** The "tab selection drives facet scope via `stencils.tabs.facets.${selected}`" line is *correct as a backend description* but could be clarified that the FE side has no direct involvement — coupling runs through the server-rendered HTML response and the M1 MutationObserver cascade, not through any FE-side cross-module dispatch.
- **`CLAUDE.md` per-feature-manager load chain section:** The "no double-import / no double-initialisation" finding from the listener audit's puzzle 7 stands; this audit reconfirms it from the tabs-manager side (constructor invoked once via `core-search-manager.js:253`'s dynamic-import loop, no other instantiation site). The L58 `["updateSearchUrl", "updateUrl"]` loop's dead second iteration is a minor finding worth flagging in the singleton-augmentation discussion.

## Status block (close)

Phase 1 complete. Single-file inventory of `public/js/modules/tabs-manager.js` (562 lines) is anchored to specific line numbers throughout. Cross-references to `core-search-manager.js` and `integration.js` use the listener audit's confirmed line numbers from its verification status table (no drift detected). Two of the five Phase 2 puzzles are settled inside Phase 1 (Puzzle 2 by structural absence of a definition; Puzzle 5 by combination with the listener audit's puzzle 4); one is premise-displaced (Puzzle 1, redirected to a follow-up audit); two remain ready for Phase 2 execution after Vic's sign-off (Puzzle 3, Puzzle 4).

Awaiting developer-review checkpoint before any Phase 2 work proceeds.

---

## Phase 2 — Puzzle resolutions

Developer-review checkpoint passed. Phase 2 executes here. For puzzles already settled inside Phase 1 (Puzzles 2 and 5) this section formalises the close. For puzzles ready for execution (Puzzles 3 and 4) this section produces the resolution. For the displaced puzzle (Puzzle 1) this section closes it as displaced and routes the redirected question forward.

### Puzzle 1 — Pre-emptive vs defensive caching

**Resolution: closed as premise-displaced.**

The brief framed this puzzle around an assumption — that a per-feature manager (most plausibly `tabs-manager.js`) iterates over four tabs on a single click, producing the four-request fan-out observed in network captures, and that the question to resolve was whether the resulting four responses get cached for re-use (pre-emptive) or discarded (defensive).

Phase 1 rules out the antecedent. Tabs-manager fires exactly **one** request per click (single `closest()` resolution at L223–L255; single `fetchFromProxy` call at L363; no iteration anywhere). It also has **no** client-side cache structure (Phase 1.3 inventory found no Map / object / LRU keyed by tab name or URL). On a per-tab basis the pattern is therefore "always fresh, no FE memory of prior fetches" — which is the defensive posture, but the puzzle's framing was about the multi-tab case.

The redirected question — *"where does the four-request fan-out come from, given that tabs-manager isn't the source"* — is **not answerable from this audit's scope**. Per the brief's stop rule (*"surface the gap rather than expanding scope"*), this audit closes the puzzle here and carries the redirected question forward as Items-deferred 1 above. Resolution paths:

- **Static analysis route.** Read `facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, `collapse-manager.js` in a single follow-up audit. The §1.5 supporting greps already located four `fetchFromProxy` call sites outside tabs-manager (`facets-manager.js` L100 / L135, `pagination-manager.js` L86, `spelling-manager.js` L87) — none of them are *obviously* loops over tabs from grep alone, but the surrounding code needs to be read to confirm. The `core-search-manager.js` `extractOriginalQuery` and `performSearch`-or-equivalent paths are also candidates worth re-checking with the fan-out question in mind.
- **Runtime route.** Add `console.trace` instrumentation at `core-search-manager.js:411` (the `fetchFromProxy` entry) and capture the four parallel call stacks on a tab click. Resolves the question in seconds with definitive evidence.
- **Network-layer route.** Inspect the request payloads of the four parallel requests in DevTools. If they differ only in the tab discriminator (`tab=`, `Tab=`, or `f.Tabs`), the iteration is over tabs; if they differ in some other dimension, the framing of the puzzle was wrong on a different axis.

The runtime route is the lowest-cost path to a definitive answer. The static-analysis route is the right path if the goal is also to gather rebuild-design context for the other per-feature managers.

**Recommendation.** Route this to a follow-up audit (`fe-per-feature-manager-audit-<date>.md`) rather than re-opening Phase 2 here. The framing of *"pre-emptive vs defensive caching"* may not even be the right question once the source is identified — if e.g. it turns out the four requests come from `core-search-manager.js`'s warmer path on results-page load (rather than per-click iteration), the cache question becomes "warm-on-load vs lazy-on-click" rather than "cache-the-fan-out-for-reuse."

**Artifacts to amend in the next canonical-document pass:**
- `fe-listener-audit-2026-05-06.md` puzzle 1's "Almost certainly `tabs-manager.js`" line — contradicted by direct evidence here.
- `network-investigation-2026-05-01.md` four-request fan-out section — structural source still unidentified.
- `fe-endpoint-dictionary-2026-05-01.json` `tab-click` entry — the structural source field needs the corrected "single fetch from `tabs-manager.js`'s `loadTabContent`" framing, with the fan-out's source flagged as separate / unidentified.

### Puzzle 2 — `SearchManager.setOriginalQuery` resolution

**Resolution: settled. The method does not exist in this codebase.**

The grep evidence (Phase 1.10) is unambiguous: across `public/`, `pages/`, and `lib/`, the symbol `setOriginalQuery` appears at exactly two sites — both *consumer* sites in `integration.js` (the `typeof` check at L696 and the call at L697). There is **no** definition site anywhere. `tabs-manager.js` does not augment the singleton; nor does any other per-feature manager (`facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, `collapse-manager.js`) per the same grep. The `SearchManager` class in `core-search-manager.js` (lines 14–end as confirmed by the listener audit's 875-line read) does not declare it.

Therefore: the runtime evaluation of `typeof window.SearchManager.setOriginalQuery === "function"` at `integration.js:696` is **always `false`** in the current production codebase. Control always flows to the L703–L711 `else` branch, where the property is written directly: `window.SearchManager.originalQuery = normalizedQuery` at L705.

**Implication for the L692–L711 block in `integration.js`.** The defensive `if`-branch was authored as a forward-compatible hook for a setter that was never added. The two log lines (L698–L701 vs L706–L709) emit different debug strings depending on which branch fires, which means a reader of the production debug log will see only the "Updated SearchManager.originalQuery directly" message — never the "via setter" variant. The dead-branch finding is empirically observable, not just a static-analysis claim.

**Closes:** the listener audit's open question on `SearchManager.setOriginalQuery` (catalogued in that audit's "Open questions raised but not answered" section).

**Artifacts to amend in the next canonical-document pass:**
- `fe-listener-audit-2026-05-06.md` open-questions list — remove the `setOriginalQuery` entry; replace with a closed-question annotation pointing at this audit.
- `CLAUDE.md`'s singleton-augmentation discussion (if any future revision adds one) — note that per-feature managers do not augment `window.SearchManager`'s method surface; the only consumer pair that hits a real method is `search-page-autocomplete.js:326–328` consuming `updateResults`, which is defined on the `SearchManager` class itself.
- The `integration.js:692–711` block is a removal candidate for the rebuild — collapse to a single direct-write or, better, an explicit setter on the new manager class with no defensive presence-test.

### Puzzle 3 — `handleDomChanges(addedNodes)` intent

**Resolution: handleDomChanges re-binds click listeners on late-arriving tab containers and does not interact with the four-request fan-out.**

Reading the body at L498–L538:

1. **Early-out** (L499). If `addedNodes` is empty or undefined, return immediately. The MutationObserver M1 contract at `core-search-manager.js:332–344` invokes every loaded module's `handleDomChanges(mutation.addedNodes)` once per `childList` mutation, so this guard short-circuits the no-op cases.
2. **Container discovery** (L502–L526). For every element-type added node, iterate the four container selectors. For each selector, check whether the node *itself* matches (L515) and also `querySelectorAll` for descendants matching (L520). Push every match into the local `newTabContainers` array.
3. **Listener attachment** (L528–L537). For each container in `newTabContainers`, dedup-check against `this.tabContainers` at L532. If not already known, push to `this.tabContainers` *and* attach a click listener via `this.handleTabClick.bind(this)` (L534).

**No `fetchFromProxy` call. No `loadTabContent` invocation. No `enhancedPerformSearch` invocation. No URL update.** The method's only effect is listener-attachment plus internal-state bookkeeping. The MutationObserver-cascade hypothesis from the listener audit's puzzle 1 is reconfirmed as ruled out for tabs-manager: `addedNodes` mutations cannot trigger a fetch through this code path.

**Double-binding hazard analysis (the brief asked).**

The L532 dedup check (`if (!this.tabContainers.includes(container))`) protects against repeat attachment for the *same DOM element* across `handleDomChanges` invocations and also *within a single invocation*. Walk-through: suppose `node` matches both `.tabs` and `[role="tablist"]` selectors:

- First selector iteration (L514, selector `.tab-list__nav`): no match.
- Second selector iteration (selector `.tab-container`): no match.
- Third selector iteration (selector `[role="tablist"]`): L515 match → `newTabContainers.push(node)`. (But not yet attached.)
- Fourth selector iteration (selector `.tabs`): L515 match → `newTabContainers.push(node)`. (`newTabContainers` now contains the same node twice.)
- Then L530 forEach loop: first pass — node not in `this.tabContainers` → push to `this.tabContainers`, attach listener (L533–L534). Second pass over the same node — **now in `this.tabContainers`**, the L532 check skips. Net result: one listener.

**So `handleDomChanges` is safely idempotent for selector-overlap.** Phase 1.2 attachment 3's footnote mentioned this as a residual concern; the closer reading here clarifies that the dedup *does* hold for this path because the L533 push to `this.tabContainers` happens before the second pass executes its L532 check.

**The initial-load path is *not* idempotent.** `findTabContainers` at L79–L96 has no dedup guard:

```js
containerSelectors.forEach((selector) => {
  const containers = document.querySelectorAll(selector);
  if (containers.length > 0) {
    containers.forEach((container) => {
      this.tabContainers.push(container);   // L92 — no .includes check
    });
  }
});
```

Then `installTabClickHandlers` at L104 iterates `this.tabContainers` and attaches a listener per element. If a single DOM element matches two of the four container selectors (e.g., `<div class="tabs" role="tablist">`), it gets pushed twice into `this.tabContainers` and receives two click listeners. Both listeners would fire on a tab click — the analytics dedup at L267–L272 absorbs the duplicate analytics fire, but `loadTabContent` would be invoked twice, which would send two fetches for the same `href`. **This is the only structurally observable double-fetch source in `tabs-manager.js`.** Whether it actually fires in production depends on the rendered DOM's selector overlap; it is observable in DevTools by inspecting `getEventListeners(container)` against any tab container.

This finding is bounded — at most one extra fetch per click, not a multiplier of four. It does not explain the four-request fan-out.

**Latent listener leakage (cross-cutting from §1.2 attachment 1).**

When `loadTabContent` overwrites `#results` innerHTML at L372–L376, the *old* tab containers (which were children of `#results` or descendants thereof) are removed from the DOM but **stay in `this.tabContainers`** as JS-side references. Their click listeners can no longer fire (the elements are detached) but the references prevent garbage collection. New containers from the response trigger M1 → `handleDomChanges` → L532 dedup check (which passes — they're new element instances) → push + attach. So `this.tabContainers` grows monotonically across navigations.

In a long-lived results-page session with many tab clicks, `this.tabContainers` accumulates dead references at a rate of one per displaced container per navigation. Container count per page is small (typically one tab strip), so the leak is bounded but real. Not a runtime bug today; flag for the rebuild's lifecycle design.

**Settles:**
- The brief's puzzle 3 question on `handleDomChanges` intent.
- The reconfirmation of the listener audit's puzzle 1 ruling-out of MutationObserver-cascade as a fetch source (now confirmed with the manager's body in evidence).
- The double-binding hazard's actual scope: confined to the initial-load path's selector-overlap, not the late-arriving-container path.

**Items raised by Puzzle 3 for the rebuild:**
- Use a single source-of-truth selector (or an explicit data-attribute contract like `data-tab-control`) rather than four overlapping CSS selectors.
- Prefer event delegation from a stable parent (e.g., `#results`) rather than per-container listener attachment, so the listener's lifecycle doesn't depend on which containers exist when.
- Track containers by stable identity (a Map or Set keyed by element reference) and clear stale entries when their elements detach — or sidestep the question entirely with the delegation approach above.

### Puzzle 4 — Tab ↔ facet coupling mechanism

**Resolution: server-driven, not FE-orchestrated. The coupling runs through the server-rendered HTML response and the M1 MutationObserver cascade, with no FE-side cross-module dispatch from tabs-manager.**

Three-architecture taxonomy from the brief:

- **Direct call** (e.g., `this.core.modules.facets.setScope(selected)`): **ruled out**. Phase 1.4 catalogues every method body in `tabs-manager.js`; no call to any other per-feature manager. The grep for `modules.tabs` / `modules["tabs"]` returns zero hits, and the symmetric question — does tabs-manager call into another manager — also returns zero hits across §1.4 and §1.9.
- **Shared state** (window global / `this.core` property write / custom event): **ruled out**. Phase 1.7 establishes that tabs-manager does not write to any shared state surface. `this.activeTabId` is internal. `this.core.originalQuery` is *read* (L294) but never written from tabs-manager. No `dispatchEvent` calls. No `window.<global> =` writes other than the L54 / L65 function-wrapping (which are not state writes for the tab-selection question).
- **DOM-driven**: **partially correct, but the framing should be sharper**. From tabs-manager's side, the only cross-module signal it produces is DOM mutation: `aria-selected="true"` / `.active` class via `updateTabState` (L318), and innerHTML replacement of `#results` via `loadTabContent` (L372). But the *content* of that innerHTML — including the new facet block — is not authored by tabs-manager. It is authored by the server-side partial template (`partial.ftl` and the per-tab content templates downstream of it) in response to the URL that tabs-manager forwarded.

**The sharper framing: server-driven coupling.**

The mechanism is:

1. User clicks a tab. `handleTabClick` (L223) extracts the tab anchor's `href` (a Funnelback URL with the trinity baked in).
2. `loadTabContent` (L351) calls `this.core.fetchFromProxy(href, "search")` (L363).
3. The proxy receives the request, which by URL contains a tab discriminator (e.g., `f.Tabs|search-collection=staff` or similar Funnelback parameter), and forwards it to Funnelback.
4. Funnelback's `partial.ftl` template selects a content template based on the tab discriminator and produces a partial response that contains both the new tab's results *and* the new tab's facet block (via the `stencils.tabs.facets.${selected}` mechanism the project instructions mention — this is server-side template logic).
5. The proxy returns the partial HTML to the FE.
6. `loadTabContent` writes the response HTML into `#results.innerHTML` at L372–L376.
7. The DOM mutation triggers M1 (`core-search-manager.js:332`). M1 iterates every loaded module's `handleDomChanges`. For `facets-manager.js` (out of scope here), this means its `handleDomChanges` runs against the new DOM and re-binds whatever facet listeners it cares about.

**The FE never explicitly tells facets-manager which tab is selected.** The facets-manager simply re-binds against whatever facet block appears in the new DOM, and that facet block is already correct because the server produced it for the right tab. The "coupling" is data-flow-shaped, not control-flow-shaped: tabs-manager fires the URL, the server resolves the URL into a coherent response, and facets-manager paints the part of the response it owns.

This is consistent with the network-investigation finding that tab-clicks produce a fully-formed partial response from the proxy, and the FE simply paints it.

**One-sided answer caveat (the brief flagged this).**

The audit cannot see facets-manager's reading mechanism from tabs-manager's side. The above framing assumes facets-manager's `handleDomChanges` reads from the DOM rather than asking tabs-manager / `this.core` for the selected-tab state. That assumption is consistent with the broader pattern (per-feature managers communicate with the rendered DOM, not with each other), but a definitive resolution requires reading `facets-manager.js`. Carries forward as Items-deferred 2.

**Rebuild implications.**

Three architectural options, in order of progressively tighter coupling:

1. **Preserve the server-driven pattern.** Tabs and facets remain independent FE modules; the server response drives the coupling. Pros: minimal FE-side complexity; the server's partial-rendering logic is the single source-of-truth. Cons: FE-side debugging is harder (state is invisible until painted); the rebuild's "one great app vs front-back pair" question (per CLAUDE.md) interacts with this — if the rebuild merges FE and proxy into a single Next.js app, the partial-rendering logic moves into the FE codebase and the "server" becomes "the same app's API routes."
2. **Introduce explicit FE-side dispatch.** Tabs-manager publishes a `tabSelected` event (or writes to a shared store); facets-manager subscribes. Pros: state is observable in the FE; tighter integration enables features like optimistic UI. Cons: introduces a control-flow path that has to stay in sync with the server's data-flow path.
3. **Collapse tabs and facets into a unified state model.** Pros: maximum simplicity for downstream features that need both at once; one truth source for "what is the user looking at." Cons: the largest refactor; risks losing the modular-loading benefit the current per-feature-manager pattern provides.

The current pattern is option 1. Whether the rebuild keeps it depends on the answer to the open architectural question (one app vs front-back pair) and on whether any planned features need FE-side state introspection.

**Settles:**
- The brief's puzzle 4 question, with the caveat that facets-manager's side of the coupling is not visible from this audit.
- The CLAUDE.md description of "tab selection drives facet scope via `stencils.tabs.facets.${selected}`" — this is correct as a *backend* description; the FE side has no involvement other than firing the URL and painting the response.

**Items raised by Puzzle 4 for follow-up:**
- A `facets-manager.js` audit (per Items-deferred 2) to confirm the DOM-reading assumption and document facets-manager's actual coupling mechanism.
- A focused note in the rebuild design conversation about the tabs/facets coupling architecture choice (preserve / explicit-dispatch / unified).

### Puzzle 5 — Cache-namespace alignment with the listener audit's puzzle 4

**Resolution: settled. Tab-click requests bypass `lib/cache.ts` entirely; the `tab:` namespace is populated by `pages/api/search.ts`'s form=partial substring fallback, not by tab clicks.**

Phase 1.5 confirmed tab-click requests go direct to the proxy via `core.fetchFromProxy(href, "search")`, building the URL `${this.config.proxyBaseUrl}/funnelback/search` at `core-search-manager.js:412`. With `proxyBaseUrl = "https://funnelback-proxy-dev.vercel.app/proxy"` (from `core-search-manager.js:23`), the resolved endpoint is `https://funnelback-proxy-dev.vercel.app/proxy/funnelback/search` — an external URL, not a Next.js API route. The request **never reaches `pages/api/search.ts`** and therefore **never enters the `lib/cache.ts` get/set surface**.

Combined with the listener audit's puzzle 4 finding (that `pages/api/search.ts:127–145`'s substring-inference fallback routes form=partial requests through the `tab:` cache namespace), the conclusion is:

- The `tab:` cache namespace in `lib/cache.ts` is **populated by**: form=partial requests that hit `pages/api/search.ts` and trigger the L132–L142 substring-matching block. Per the listener audit, these come from search-form submission flows and the `integration.js` `performSearch` path — flows where `form=partial` is included in the query string but the request is going *through* the FE-server.
- The `tab:` cache namespace is **not populated by**: tab-click requests originating from `tabs-manager.js`'s `loadTabContent` (Phase 1.5) or from `enhancedPerformSearch`'s tab branch (Phase 1.5). Both use `core.fetchFromProxy` direct.

Tab-click content caching is therefore **entirely a proxy-layer concern**. The proxy's own KV cache (out of scope here) is the only cache layer for tab-click content. If that layer's cache strategy is structurally broken or absent (the project knows this from prior proxy-side audit work), tab-click responses are effectively uncached on this code path.

**The "tab-cache namespace" is a misnomer.**

A more accurate descriptive label for the `tab:` namespace in `lib/cache.ts` would be "form-partial-fallback namespace, populated by FE-server requests where the substring inference at `pages/api/search.ts:132–142` classifies the request as tab-like." The naming is historically motivated (the substring inference *is* trying to detect tab clicks), but the runtime population pattern doesn't match the intent — tab clicks never get there.

**Three independent design surfaces for the rebuild's cache strategy.**

The rebuild's cache-namespace strategy has three independent design surfaces, none of which is constrained by the others:

1. **FE-server cache layer** (currently `lib/cache.ts`): what to do for search-form / form-partial / suggestions paths that route through the FE-server's API routes. Independent of (2) and (3).
2. **Proxy cache layer** (currently the proxy's own KV cache): what to do for direct proxy traffic — tab clicks, pagination, facets, spelling. Independent of (1) and (3).
3. **Client-side memory cache** (currently absent): whether to introduce per-feature-manager in-memory caching, e.g., a Map in tabs-manager for previously-fetched tab content within the same query session. Independent of (1) and (2).

The current architecture has nothing in (3), `lib/cache.ts` in (1), and an out-of-scope-here proxy cache in (2). The rebuild can mix and match.

**Settles:**
- The brief's puzzle 5 question.
- Sharpens `fe-cache-audit-2026-05-04.md`'s framing of the `tab:` namespace.
- Sharpens `fe-listener-audit-2026-05-06.md`'s puzzle 4 by clarifying which call paths actually populate the `tab:` namespace (confirms it's the substring-fallback path, *not* tab clicks).

**Artifacts to amend in the next canonical-document pass:**
- `fe-cache-audit-2026-05-04.md` — add a note on the `tab:` namespace's actual population pattern (form-partial-fallback only; not tab-click).
- `fe-listener-audit-2026-05-06.md` — add a cross-reference from puzzle 4 to this finding for completeness.
- `fe-endpoint-dictionary-2026-05-01.json` — the `tab-click` entry's caching column should explicitly note "FE-cache-uninvolved; proxy-cache-only."

---

## Phase 2 status block

Phase 2 complete. Five puzzles resolved:

| Puzzle | Resolution |
| --- | --- |
| 1 — Pre-emptive vs defensive caching | Closed as premise-displaced. Redirected source-identification question routed to a follow-up audit. |
| 2 — `setOriginalQuery` resolution | Settled. Method does not exist anywhere in the codebase; the `integration.js:696–702` branch is structurally dead. |
| 3 — `handleDomChanges` intent | Resolved. Re-binds click listeners on late-arriving containers; no fetch implication. Selector-overlap double-bind is confined to the initial-load path, not `handleDomChanges` itself. Latent listener leakage on innerHTML replacement is bounded but real. |
| 4 — Tab ↔ facet coupling mechanism | Resolved (one-sided). Server-driven coupling: tabs-manager fires the URL; the server returns a partial response containing the correct facet block; M1 cascade fires facets-manager's `handleDomChanges` against the new DOM. No FE-side cross-module dispatch from tabs-manager. Facets-manager's reading mechanism is opaque from this audit's vantage point. |
| 5 — Cache-namespace alignment | Settled. Tab-click requests bypass `lib/cache.ts` entirely; the `tab:` namespace is populated by `pages/api/search.ts`'s form=partial substring fallback, not by tab clicks. Tab-click content caching is a proxy-layer concern. |

Two new findings emerged from Phase 2's deeper reads:

- **The initial-load selector-overlap double-bind (Puzzle 3).** A bounded extra fetch per click is structurally possible if the rendered DOM matches a single element to multiple of the four container selectors. Resolves with DevTools inspection or with a single `getEventListeners` check.
- **Latent listener leakage in `this.tabContainers` (Puzzle 3).** Old container references are retained across innerHTML replacements; the array grows monotonically. Bounded but real; flag for the rebuild's lifecycle design.

Items deferred to future audits are unchanged from the Phase 1 list (the four-request fan-out source remains unidentified; facets-manager's coupling-side view remains opaque). Open questions unchanged. Cross-artifact refinements are folded into each puzzle's resolution above.

Awaiting commit decision per the brief's commit convention (`docs: tabs-manager audit` subject; audit-scoped allow-list permits the commit).
