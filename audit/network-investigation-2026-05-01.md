# Network Investigation — 2026-05-01

Standalone reference document. Captures live-traffic observations of the dev-side search system during a single session of guided dev-tools exploration on `https://www.seattleu.edu/search-test/` and adjacent pages. Structured for retrieval; not chronological.

## Scope and posture

**Target:** Live runtime behavior of the dev FE-and-proxy pair under real user interaction, captured via Chrome dev tools (Network and Console panels) on `su-search-dev.vercel.app` and `funnelback-proxy-dev.vercel.app`.

**Method:** Directed user actions on `https://www.seattleu.edu/search-test/?query=<q>`, the seattleu.edu homepage, and the `/dev/funnelback-search/` test page, with the developer narrating each interaction and Claude requesting specific captures. Filter `domain:*.vercel.app` to isolate FE-and-proxy traffic from page-chrome noise. Preserve log on, Disable cache on. Per-interaction screenshots of console and network with one or two request URLs copied verbatim for full-parameter inspection.

**Stop rule:** Single session, single browser, single user. Findings are observational and reproducible-in-principle but were not separately replicated. Production-side behavior was not independently captured; the mirror principle (dev and prod run the same promoted code) supports applying these findings to production.

**Posture:** Read-only. No code changes, no deploys. Open dev tools, click around, observe.

## Verification status

Findings here were observed during live capture and where possible cross-referenced against `fe-endpoint-dictionary-2026-05-01.json` and `funnelback-endpoint-dictionary-2026-05-01.json`. Where this document confirms a dictionary claim, the citation is to the dictionary's relevant entry. Where this document refines or contradicts a dictionary claim, the contradiction is explicit. Where this document surfaces something not in the dictionaries, it is flagged as net-new.

Several observations are tied to specific request URLs copied verbatim from the network panel; those are the load-bearing primary sources. Other observations are inferred from network-row patterns (initiator, size, timing); those are noted as inferential.

## High-level findings

The dev system is **operationally sound but architecturally noisier than the dictionaries suggested**. The pre-render mechanism is alive but does not work the way its design implied. Tab navigation produces 4× the proxy load per click that the FE dictionary's tab-click entry described. FE scripts reload on every page navigation. Several suggested-but-not-confirmed items in v9's "confirmed removable" list are now empirically settled. Several items previously framed as "open questions" now have empirical answers, and one previously-deferred question (the cache-architecture question scoped out at the start of this session) has a partial answer that this document captures.

## Pre-render mechanism — alive but not what it claims

**`/api/pre-render` POST exists and fires on form submit.** Confirmed via captured POST: `https://su-search-dev.vercel.app/api/pre-render`, content-type `application/json`, Referer `https://www.seattleu.edu/`. The mechanism described in the FE dictionary's `header-form-prerender-trigger` entry is not dead.

**The POST typically does not complete before the GET fires.** The browser fires the POST as `keepalive: true` and immediately navigates to `/search-test/?query=...`. From the browser's perspective the POST shows status "unknown" and 0 kB transferred — it completes server-side but is no longer observable client-side. The subsequent GET to `/api/search` from the destination page typically returns a cache MISS. Two captures support this: `global education` returned MISS at 1088 ms; `academic credentials` returned MISS at 834 ms. In neither case did the POST's cache write satisfy the GET's cache lookup.

**The actual user-visible speed mechanism is the 1003 ms timeout boundary plus MISS-response-used-directly.** The pre-render check at `search-page-autocomplete.js:197` fires `/api/search` with a 1003 ms timeout. If the response lands under 1003 ms, the FE uses the response body directly regardless of cache status (HIT or MISS) and displays results in ~1 second total. If the response lands over 1003 ms, the timeout fires, the FE falls back to `performSearch`, and a second `/api/search` request goes through (also typically a MISS), adding 2–3 seconds.

Three captures, three different outcomes:

- `basketball` (direct page load, presumably no prior session warmth): pre-render check timeout at 1003 ms, fallback fired, standard search MISS at 2712 ms, total **3870 ms**, **two requests** to `/api/search`.
- `global education` (redirect from `/dev/funnelback-search/` test page, after several prior queries warmed the session): pre-render check MISS at 1088 ms (just over timeout), response used anyway, total **1101 ms**, **one request**. The fact that 1088 ms > 1003 ms but no fallback fired suggests the timeout is soft (allows late responses to land within some tolerance) rather than hard, or that the implementation has a race that the basketball case lost and the global-education case won.
- `academic credentials` (redirect from seattleu.edu homepage, session fully warm): pre-render check MISS at 834 ms (under timeout), response used directly, total **847 ms**, **one request**. The fastest of the three.

**The POST's actual contribution is probably container and upstream warming, not cache writing.** When the POST fires, it kicks off a server-side backend call that primes the Vercel container (mongoose connection, geo cache, Redis client, generally hot lambda) and may warm Funnelback's internal caches. The subsequent GET benefits from this warmth even though it doesn't hit the FE Redis cache. This is plausible but not directly observable from the network panel; it would require server-side timing instrumentation to confirm.

**Even prefetches during typing for the exact query do not produce cache hits on the subsequent search.** In the `academic credentials` capture, prefetches fired during typing for `academic+cre`, `academic+cred`, `academic+credentia`, `academic+credential`, `academic+credentials` — including the exact eventual query. The post-redirect GET still hit MISS. Two possible causes, both flagged in v9 already: either the prefetch didn't complete before the form submit (race), or `prefetch.ts` and `search.ts` produce different cache keys (the v9 open question about `form=partial` not being added on the prefetch backend leg). Diagnosing which requires code reading.

**Implications for the rebuild.** The rebuild's pre-render direction needs to be re-grounded. The current architecture's stated intent (POST warms cache, GET hits cache) is not what's producing the speed advantage. The actual mechanism — "GET is fast enough" + "MISS response is used anyway" — is simpler and more direct. If that's preserved, the POST mechanism may be removable, or its purpose may need to be re-articulated as warming rather than caching. The 1003 ms timeout is the critical UX gate and should be a deliberate design parameter, not an incidental implementation detail.

## Tab clicks — four-request fan-out per click

**Tab clicks bypass `/api/search` and go directly to the proxy.** Confirmed via captured URL on a Cody-Ryckman News-tab interaction: `https://funnelback-proxy-dev.vercel.app/proxy/funnelback/search?form=partial&profile=_default&query=cody+ryckman&f.Tabs%7Cseattleu%7Eds-news=News&collection=seattleu%7Esp-search&sessionId=...&clientIp=24.17.18.153`. Initiator is `core-search-manager.js:506`, which is `fetchFromProxy`'s case-`search` branch. The FE dictionary's tab-click entry is confirmed for routing.

**Trinity is FE-forwarded from the Funnelback-generated href.** The captured URL shows `form=partial`, `profile=_default`, `collection=seattleu~sp-search`, plus `f.Tabs|seattleu~ds-news=News` as a tab-facet filter. This matches the FE dictionary's `tab-click` entry: trinity values come from whatever Funnelback templated into the response href; FE strips `sessionId`/`clientIp` and re-injects its canonical values. The trinity-provenance-modes question from v9 is empirically settled: FE-forwarded mode is real, observable, and matches the dictionary's description.

**Tab clicks hit the general `seattleu~sp-search` collection with a tab facet, not source-specific collections.** The captured URL shows `collection=seattleu~sp-search` (the general collection) plus `f.Tabs|seattleu~ds-news=News` (server-side filter scoping to the news source within that general collection). This is the same pattern v9 flagged at the suggest level for `suggestPeople` (general collection plus tab filter). The architectural asymmetry v9 already wanted to fix at the suggest level — align with the `suggestPrograms` direct-collection-hit pattern — exists at the search-page tab level too. **The rebuild's collection-routing decision applies to both surfaces, not just to autocomplete.**

**Each tab interaction fires four parallel search requests, not one.** Two captures showed this: clicking the News tab on the Cody-Ryckman state, and a subsequent interaction. Each cluster contained four `search` requests at ~34 kB each, plus one `/proxy/analytics/supplement` ping (tab-change analytics) and one `/proxy/analytics/click` ping (analytics click beacon). The four search requests have similar response sizes (33.8–34.7 kB each, vs the initial-render response of 124–135 kB), consistent with each one returning a single tab's worth of content rather than the full all-tabs payload.

**The four-request pattern's purpose is undetermined from network observation alone.** Two readings remain:

- **Pre-emptive (all-tabs warming).** Each tab click triggers fetches for all four tabs' content — Results, Programs, Faculty & Staff, News. Subsequent tab clicks within the same query state can render instantly from in-memory state. Pays full cost on first interaction, instant after.
- **Defensive (no client-side state retained).** Each tab click fetches all four tabs because the FE doesn't trust prior state to be current. Repeated clicks repeat the work.

Distinguishing the two requires reading `core-search-manager.js`'s state-handling for the four responses. That's a listener-audit question, not a network-capture one. **Either way, the rebuild's architectural choice is the same: hit dedicated source collections, fetch only the tab being clicked, retain client-side state for prior tabs if-and-only-if the rebuild commits to a state model that makes retention worthwhile.**

**This finding refines v9's "FE cache as primary performance anchor — for the requests it covers" framing.** Tab clicks not only bypass `/api/search` and the FE Redis cache (which v9 already noted), they also fire four times the proxy load per interaction than the dictionary's tab-click entry suggested. The proxy edge rate-limiting headroom calculation needs to account for this multiplier when sized against real interaction patterns.

## Tab/facet/pagination cache architecture — partial answer

The cache-architecture question scoped out of this session — whether the initial `/s/search.html` response contains all-tabs data or only the active tab's content — has a partial empirical answer.

**The initial `/api/search` response contains the active tab's content plus per-tab count metadata for all tabs.** Evidence: the page chrome rendered tab labels with counts immediately after the initial render (Results 25, Programs 0, Faculty & Staff 7, News 29 for the `baseball` query) without firing per-tab requests. So tab metadata (counts, labels) is present in the initial response. Tab content (the actual result HTML) is fetched on tab click. This is the hybrid case: all-tabs metadata in the initial response, single-tab content per response.

This finding doesn't fully resolve the cache-architecture design question — that requires deciding what the rebuild's cache should cover and how. But it clarifies the empirical baseline: the rebuild can render tab chrome immediately from the initial response and load tab content lazily, which matches the current behavior's intent even if the current implementation produces 4× the requests it needs to.

## Suggestion-click flow — the duplicate prefetch is implementation, not requirement

**The duplicate prefetch observed when clicking a suggestion is caused by implementation coupling, not a removable feature.** When the user clicks a suggestion (general or staff), the click handler does several things: fires a search for the suggestion text, updates the URL via `history.pushState`, and writes the suggestion text into the input element. The input write triggers the same `input` event listener that user typing triggers. That listener kicks off a fresh prefetch debounce cycle for the now-populated query, even though a search for that query is already in flight from the click handler itself. The redundant prefetch fires for the same query as the search.

**The side effects themselves are load-bearing for a real requirement.** The search-results page must reflect the user's chosen query at all times, regardless of where the click navigates them next, because users may return from a side-trip (a staff bio in a new tab, a program page in a new tab, in-place navigation for a general suggestion) and expect their last-chosen query's results to be there. The contract is: results match the clicked suggestion, URL keys to the clicked suggestion, input shows the clicked suggestion. None of the side effects are removable.

**The implementation problem is that suggestion-click is modeled as a composite of typing-and-submitting rather than as its own first-class action.** The rebuild's question is how to sequence the side effects without producing redundant work. Three angles considered, in order of structural cleanliness:

- Suppression flag set by the click handler before input mutation, checked by the input listener — simple but leaks coupling between modules.
- Synthetic-input tagging at the source so the input listener can distinguish user typing from code-driven mutations — discrimination logic in one place rather than scattered.
- Suggestion-click modeled as its own action that does its full job (search, URL, input) without going through the typing-and-submit pipeline at all, with the prefetch chain bound to typing only. Cleanest, but contingent on the broader FE state model decision (explicit dispatch layer vs near-direct DOM binding).

Direction lean: third angle. Decision deferred until the FE state model takes shape; the choice must be consistent with how the rebuild handles other action-like flows — session lifecycle through redirects, tab/facet/pagination coordination, cache-key generation.

**Header-page suggestion clicks (clicking a suggestion in autocomplete on a non-search page) are a fourth distinct interaction class not enumerated in the FE dictionary.** Observed during the `global education` capture: the user typed on the `/dev/funnelback-search/` test page, picked a suggestion from the dropdown, and the page redirected. The contract for this case is cleaner than the results-page suggestion click — there's no existing search-results state to coordinate with, no URL-update on the current page, no input population to coordinate, no prefetch chain to suppress. The handler's job is purely "navigate to results page with this query." This is the simpler shape and a useful comparison case for the rebuild's suggestion-click model.

**Case-handling asymmetry is intentional, not accidental.** The search request transports the query lowercased (`query=cody+ryckman`); the URL update preserves the suggestion's display case (`?query=Cody+Ryckman`). University URL convention prefers lowercase for cache-key uniformity and link consistency. Display state preserves the visual form for human readability. The two are deliberately separated. The rebuild's normalization design must distinguish display state (URL, input element, breadcrumbs — preserve case) from transport state (request params, cache keys — normalize). This is a two-form pattern, not a single-form bug.

## FE script loading — chained reload on every page navigation

**Every page transition triggers a full re-fetch of all 11 FE scripts.** Observed across multiple page loads in this session: navigating from `/search-test/?query=basketball` to `/dev/funnelback-search/` to seattleu.edu homepage to `/search-test/?query=academic%20credentials` produced multiple distinct script-load batches in the network log. Each batch contained the same 11 scripts in the same approximate order:

- `SessionService.js` — initiator from page HTML at line ~542
- `search-index.js` — initiator from page HTML at line ~548
- `search-page-autocomplete.js` — initiator from page HTML at line ~544
- `integration.js` — initiator from page HTML at line ~546
- `core-search-manager.js` — initiator from `search-index.js:14`
- `tabs-manager.js` — initiator from `core-search-manager.js:249`
- `facets-manager.js` — initiator from `core-search-manager.js:249`
- `pagination-manager.js` — initiator from `core-search-manager.js:249`
- `spelling-manager.js` — initiator from `core-search-manager.js:249`
- `analytics-manager.js` — initiator from `core-search-manager.js:249`
- `collapse-manager.js` — initiator from `core-search-manager.js:249`

**Browser cache makes the wire cost of repeat loads small but doesn't eliminate the parsing-and-execution cost.** Observed times for repeat loads ranged from 30 ms to 200 ms per script. The shorter times suggest cache hits with 304 revalidation; the longer ones suggest full refetches. Either way, every page transition pays parsing-and-execution cost on all 11 scripts plus their dependency-resolution overhead.

**This is the FE script loading strategy concern from v9 made empirical.** The current four-import shape from T4 PageLayout (`SessionService.js`, `search-page-autocomplete.js`, `integration.js`, `search-index.js`) plus `core-search-manager.js` dynamically importing the seven manager scripts produces an 11-script chained reload on every page. Whether the rebuild collapses this into one bundle, a critical-plus-deferred pair, module-first dynamic imports, or some other shape is the v9 open question; the empirical evidence here is that the current shape is genuinely expensive on every navigation, not just on first load.

## SessionService — through-redirect works, double-initialization is real

**SessionService preserves the session ID across page redirects.** Observed across multiple redirect captures: the same session ID (`sess_1777672126719_a79gblc`) appeared on the originating page's prefetch and analytics requests, persisted through the redirect, and continued on the destination results page's requests. The "fast path optimization for redirect" path in `SessionService.js` fires correctly on each redirect. The redirect-survival contract — session continuity through navigation from a non-search page to the results page — holds.

**SessionService initializes twice on every results-page load.** Observed in every console capture in this session, including basketball, global education, and academic credentials. The pattern is consistent: an early init pass logs `Detected search redirect`, `On search results page, session ID: ...`, `Search redirect detected, using optimized path`. Then a later init pass logs `Detected search redirect`, `Initializing. Redirect detected: true`, `Cleared redirect flag`, `Used fast path optimization for redirect. SessionId: ...`. Two passes through similar logic per page load.

The likely cause: `SessionService.js` runs its own initialization on script load, then `integration.js` invokes session initialization again as part of its own setup. The two paths converge on the same session ID (no inconsistency observed) but do redundant work. The redirect-survival contract is preserved; the implementation doubles up on confirming it.

**SessionService warrants its own audit when session-design work fires up.** The current implementation is the residue of "make redirect-survival work as the highest priority"; the rebuild's framing question is "make redirect-survival efficient." The lifecycle (when does a session start, when does it end, how is it propagated to the proxy and into MongoDB log records) is open design space. The strong rebuild lean already in v9 — one canonical session ID following a user from search-page entry through search-page exit — is reinforced by these observations.

## Confirmed dead via empirical absence

**`tools.js` receives no traffic from the FE.** Across all interactions in this session — initial loads, redirects, tab clicks, facet clicks, pagination clicks, suggestion clicks, autocomplete typing, prefetches, analytics — no request to `/proxy/funnelback/tools` ever appeared in the network log. Combined with the mirror principle (dev FE mirrors prod FE) and the prior elimination of T4 PageLayout JavaScript as a possible caller, the route receives no traffic from any caller in the system. Per v9, `tools.js` is debug-residue from an earlier implementation approach (post-results interactivity via dynamic-path routing) that was superseded by Funnelback href forwarding to `/search` and `/spelling` before the proxy-side cleanup happened.

**`search-bundle.js` is observably inert.** It appears in the network log as a preloaded script resource but never as the initiator of any request across all interactions captured in this session. CLAUDE.md's "preloaded but never executed" reading is empirically sealed.

## Analytics endpoints in production — failures and inventory

**Suggestion-click analytics beacons fail with 400.** Every observed `analytics-suggestion-click` request — initiated from `integration.js:1123` (the `window.trackSuggestionClick` function per the FE dictionary) — returned status 400 from the proxy. Multiple instances captured during the basketball→baseball→Cody Ryckman click chain. Cause not diagnosable from network alone: missing required field, malformed payload, origin-lock failure, or schema validation. **Suggestion-click analytics are silently failing in production right now.**

**This is operational debt in the live system but not rebuild-relevant.** Per v9, the rebuild removes all analytics endpoints. The 400 failures don't change that direction — the endpoints are gone regardless of whether they currently work. Worth flagging that the failure has been silent, since whatever signal value those records would have carried is being lost rather than captured. The centralized-logging design phase needs to reconsider what FE-side click signal is worth capturing in MongoDB log records and how to capture it reliably, rather than inheriting the current broken transport.

**Other analytics endpoints observed firing in this session:** `/proxy/analytics/click` from result-clicks (status varied — some 200, some 400), `/proxy/analytics/supplement` from tab-change events (status 200, fire-and-forget), `/proxy/analytics/clicks-batch` and `/proxy/analytics/` (session) — both configured in `core.config.analyticsEndpoints` but never fired by any caller in any captured interaction. The FE dictionary already flagged these as configured-but-unreachable; this session confirms.

## `integration.js` `performSearch` is the live one — `search-page-autocomplete.js`'s appears dead

**Both general and staff suggestion clicks routed through `integration.js:934` (`performSearch`), not through `search-page-autocomplete.js:666-750`'s local `performSearch`.** The FE dictionary's `search-page-autocomplete-suggestion-click` entry described that local `performSearch` as the dispatcher for clicks on suggestions in the search-page autocomplete dropdown. Empirically, the live initiator on these clicks is `integration.js:934`. The `search-page-autocomplete.js` local `performSearch` may be dead code, or only fires under conditions not exercised in this session.

**This refines v9's "two `performSearch` implementations, collapse to one" cleanup item.** The framing assumed both were exercised. If `search-page-autocomplete.js`'s `performSearch` is genuinely dead and only `integration.js`'s is live, the cleanup is one more piece of debug-residue to remove rather than two competing implementations to reconcile. The listener audit is the right place to verify which dispatch paths are actually reachable from which click handlers.

## Items confirmed against the FE endpoint dictionary

The following dictionary entries were confirmed by direct empirical observation in this session:

- `results-page-initial-render` — trinity, request URL shape, response handling all match.
- `pre-render-content-check` — fires `/api/search`, returns body either way, FE inspects `X-Cache-Status` for HIT/MISS logging only. Matches.
- `header-form-prerender-trigger` — `/api/pre-render` POST exists and fires on form submit. Matches.
- `header-search-suggestions-keystroke` — fan-out via `/api/suggestions` to three proxy legs is observable; query parameter renaming at the FE-server boundary is observable in URL parameters.
- `prefetch-on-keystroke` — fires from both header input (homepage typing) and results-page input (results-page typing). Matches.
- `tab-click` — bypasses `/api/search`, hits `/proxy/funnelback/search` directly via `core-search-manager.js fetchFromProxy`. Matches the routing claim. Refines the per-click request-count claim (one request per click in the dictionary; observed four).
- `analytics-result-click`, `analytics-tab-change`, `analytics-suggestion-click` — all observable as the dictionary describes. Suggestion-click variant fails with 400 (new operational finding).

The following dictionary entries were refined or contradicted:

- `search-page-autocomplete-suggestion-click` — dispatcher described as `search-page-autocomplete.js:666-750`'s local `performSearch`, observed as `integration.js:934`'s `performSearch`. Either the dictionary's source-attribution was wrong, or the local `performSearch` is dead code. Listener audit territory.
- `tab-click` per-click request count — dictionary describes a single `/proxy/funnelback/search` per tab click; observed four parallel requests per click. Discussed in detail under "Tab clicks — four-request fan-out per click."

The following are net-new findings not in either dictionary:

- The 1003 ms timeout on the pre-render check is the critical UX gate.
- POST `/api/pre-render` rarely completes before the subsequent GET; its observable cache-warming benefit is not what the architecture claims.
- Prefetches during typing for the exact eventual query do not produce cache hits on the subsequent search.
- Tab-click fan-out hits the general collection with tab facets, not source-specific collections.
- FE scripts reload on every page navigation, paying parsing-and-execution cost each time.
- Header-page suggestion clicks are a fourth interaction class not enumerated.
- SessionService initializes twice per page load.
- `integration.js` `performSearch` appears to be the only live `performSearch`.

## Items deferred to future audits

**Cache audit.** The cache-architecture question was scoped out of this session and remains open in its full form. The partial answer captured here (initial response = active tab content + per-tab count metadata; tab content fetched on click) is one piece. Open questions for the cache audit: what should the rebuild's cache cover (FE-orchestrated paths only, or also FE-forwarded tab/facet/pagination paths); how should cache keys handle the trinity-provenance modes; whether the prefetch path's missing `form=partial` produces a different cache key from the search path's; whether the proxy cache should be redesigned or removed; how the two cache layers (if both retained) should coordinate.

**Listener audit.** Several observations point at listener-coupling questions: the four-request fan-out per tab click (pre-emptive vs defensive); the duplicate prefetch on suggestion click (the input-listener triggered by code-driven input mutation); whether `search-page-autocomplete.js`'s local `performSearch` is reachable from any handler; the redundant `core-search-manager.js:249`-initiated dynamic imports of manager scripts that the page HTML already loaded. The listener audit is the right place for these.

**SessionService audit.** Double-initialization, redirect-survival lifecycle, the boundaries of what SessionService should and shouldn't do, the coordination with proxy logging.

**Rendering audit.** Already queued in v9. The renderer-to-content-type mapping, where renderer assignment happens in code, the four-live / nine-inherited split.

**Suggestions audits (search-page and non-search-page).** Already queued in v9. The header-page suggestion click as a fourth interaction class, the three-handler fan-out's justification, the parameter renaming at the FE-server boundary.

## Questions raised but not answered

- The exact mechanism producing the four-request fan-out per tab click (pre-emptive vs defensive, both readings). Listener audit.
- Whether `/api/pre-render` POST contributes anything observable beyond container/upstream warming. Server-side timing instrumentation needed.
- Whether prefetch-during-typing's failure to produce cache hits is a race or a cache-key inconsistency. Cache audit + code reading.
- What `search-page-autocomplete.js`'s local `performSearch` dispatches from, if anything. Listener audit.
- The exact source of the analytics-suggestion-click 400 failures. Lower priority — endpoint is removed in the rebuild.

## How this document is meant to be read

This is canonical evidence, not direction. Direction lives in the project instructions (`funnelback-search-project-instructions-v9.md` at time of writing). Where this document's findings imply rebuild requirements, the requirements are stated in the implications subsections; the actual rebuild design decisions remain open. Where this document refines or contradicts the FE or proxy endpoint dictionaries, the refinements should be folded into those dictionaries on their next revision and this document remains as the audit-trail snapshot of when and how the refinement was discovered.
