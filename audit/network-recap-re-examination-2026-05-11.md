# Network Recap Re-examination — 2026-05-11

Standalone reference document. Captures a documentary re-read of `audit/network-investigation-2026-05-01.md` against the findings of `audit/fe-tabs-manager-audit-2026-05-08.md`, narrowly scoped to the four-request fan-out question. Structured for retrieval; not chronological.

## Scope and posture

**Purpose.** Determine whether the May 1 network investigation, re-read against the tabs-manager audit's findings, narrows the hypothesis space for the structural source of the four-request fan-out observed on tab click. Exit deliverable is a recommendation on whether v13's item 6 (four-request fan-out source identification audit) still needs to fire, and if so, with what scope-narrowing.

**Posture.** Documentary re-read only. No file-level traversal, no Claude Code session, no runtime instrumentation, no live network capture. Both source artifacts are read directly from project knowledge. Scope is tight: May 1 vs. tabs-manager only. Cross-references to the listener audit's puzzle 1 elimination logic and the autocomplete audit are catalogued as open questions in §6 rather than treated as in-scope evidence to re-evaluate.

**Inputs.** `audit/network-investigation-2026-05-01.md` (specifically the §"Tab clicks — four-request fan-out per click" section and adjacent paragraphs). `audit/fe-tabs-manager-audit-2026-05-08.md` (specifically Phase 1.5 on `fetchFromProxy` call sites, Phase 2's Puzzle 1 resolution, and the "Artifacts to amend" notes).

**Stop rule applied.** No source code read. No audit artifacts other than the two named inputs consulted for in-scope evidence. Questions that would require those sources are logged in §6.

## What May 1 claimed about the four-request fan-out

The May 1 investigation captured the four-request pattern on two separate tab-click interactions and recorded the following. Five claims are **observed** — directly visible in the network panel or in copied URLs. Four are **inferred** — derived from the observed material by reasoning that the document itself flagged as a reading rather than a measurement.

**Observed.** Each tab click fires four `/proxy/funnelback/search` requests in parallel, plus one `/proxy/analytics/supplement` (tab-change) and one `/proxy/analytics/click` (analytics click beacon). All four search requests share initiator `core-search-manager.js:506`, the `await fetch` inside `fetchFromProxy`'s case-`search` branch. Response sizes for the four are 33.8 – 34.7 kB each (the document records this as a tight range, not as four identical numbers). One URL out of the four was copied verbatim — the News-tab variant `…/proxy/funnelback/search?form=partial&profile=_default&query=cody+ryckman&f.Tabs%7Cseattleu%7Eds-news=News&collection=seattleu%7Esp-search&sessionId=…&clientIp=…`.

**Inferred.** Each of the four responses represents a single tab's worth of content (derived from the size range plus the fact that 4 × ~34 kB ≈ ~136 kB which approximates the initial-render full-tabs payload of 124 – 135 kB). The four requests therefore cover the four live tabs (Results, Programs, Faculty_Staff, News). The fan-out's source is "almost certainly" a single per-feature manager iterating over the four live tabs and firing one `fetchFromProxy` per tab. The framing question for the rebuild is "pre-emptive (warm all four, render from memory on subsequent clicks) vs defensive (re-fetch all four every time)."

The May 1 document itself explicitly flagged the source-attribution as undetermined from network observation alone, noting that "the four-request pattern's purpose is undetermined from network observation alone" and that distinguishing pre-emptive from defensive "requires reading `tabs-manager.js`." The "almost certainly tabs-manager" attribution was added later in the listener audit's puzzle 1 and folded back into the May 1 framing through canonical-document amendments to `fe-endpoint-dictionary`.

## What the tabs-manager audit changed

The tabs-manager audit's Phase 1.5 inventory and Puzzle 1 resolution invalidate one of the inferred claims directly. `tabs-manager.js` issues exactly one `fetchFromProxy` per invocation at both call sites: `loadTabContent` at L363 calls with a single `href`, and `enhancedPerformSearch` at L437 calls with a single sniffed query. The `handleTabClick` handler at L223 resolves the clicked element via `closest()` with an early `return` on first selector match, so it never operates on more than one tab per click. There is no iteration anywhere in the file. The audit also documents that `tabs-manager.js` carries no client-side cache structure for tab content — no Map, no object keyed by tab name or URL, no LRU.

The audit closes the "pre-emptive vs defensive" framing as premise-displaced. The framing presupposed multi-tab iteration inside tabs-manager. With that ruled out, the framing's antecedent is gone, and on a per-tab basis the actual pattern in tabs-manager is "always fresh, no FE memory of prior fetches" — defensive on a per-tab basis, but not the multi-tab phenomenon the May 1 capture observed.

The audit explicitly carries the redirected question forward: *where does the four-request fan-out come from, given that tabs-manager isn't the source?* Resolution paths it suggested were a static-analysis audit of the other per-feature managers, runtime instrumentation via `console.trace` at the `fetchFromProxy` entry, or a fresh network-layer capture with all four request URLs recorded.

## Confirmed, falsified, open

**Confirmed by the tabs-manager audit, no change.** All four requests share the same initiator (`core-search-manager.js:506`); they all flow through `fetchFromProxy`. They fire in parallel, not sequentially, which rules out a MutationObserver M1 cascade as the multiplier. The trinity is FE-forwarded from the Funnelback-templated tab anchor's `href`, not constructed inside any per-feature manager. The tab-click path bypasses `lib/cache.ts` entirely — proxy-side caching is the only mediator.

**Falsified by the tabs-manager audit.** The inference that the four requests come from `tabs-manager.js` iterating over the four live tabs is wrong. The pre-emptive vs defensive framing is wrong as posed. The `fe-endpoint-dictionary` entries already record this; the residual superseded framing in `cross_cutting_observations.tab_click_assumption_result` was flagged in the dictionary's own changelog as inline-out-of-date.

**Newly open.** The structural source of the fan-out is unidentified. The May 1 capture does not contain the URL-level detail required to constrain it further: only one of the four URLs was copied verbatim, and that one is the obvious News-tab content fetch that `tabs-manager.js`'s `loadTabContent` produces on the click itself. The other three URLs were not recorded.

This is the single most important narrowing the re-examination produces, and it cuts both ways. It cuts in our favour because it identifies exactly which observation is the load-bearing primary source that needs to be re-captured before the question can be answered with confidence (the request URLs of all four parallel calls). It cuts against us because the May 1 artifact, taken alone, contains less information than the listener audit and the tabs-manager audit's downstream framings implied — the "four tabs being warmed" reading was always an inference from the response-size pattern, never an observation of distinct tab-discriminators across the four URLs.

**A subtler open point.** The size-sum-matches-full-tabs-render reasoning (4 × ~34 kB ≈ ~136 kB ≈ 124 – 135 kB) is suggestive but not definitive on its own. Sums of similar quantities can coincide with many totals, and the May 1 capture's tight 33.8 – 34.7 kB range across the four is consistent with multiple shapes: four different tabs each returning their own content, four repeated requests for the same content (with slight size variation from session-id or timestamp differences in the response envelope), or four requests over some dimension other than tabs that happen to produce similarly-sized responses. The "over the four tabs" reading is the most natural interpretation, but it is not the only one the size data alone supports.

## Recommendation on item 6

**Fire item 6, with the scope explicitly broadened from "which per-feature manager iterates over tabs" to "what produces four parallel requests on tab click, and over what dimension are they varying."** The re-examination's central narrowing is that the May 1 capture does not contain enough detail to identify the iteration dimension. Item 6 as previously framed assumed the dimension was tabs and the question was only which manager iterates; that assumption rests on the inferred response-size reading, not on observed URL-level data.

The cheapest path to a definitive answer is a fresh runtime capture: reproduce the tab click on `/search-test/`, copy the URLs of all four parallel requests verbatim, and compare their query parameters. If they differ only in a tab discriminator (`f.Tabs|…=Results` vs `…=Programs` vs `…=Faculty_Staff` vs `…=News`), the "over four tabs" framing is empirically confirmed and the static-analysis route becomes the right way to find the iterator. If they differ in some other dimension, the puzzle's framing was wrong on a different axis and the static-analysis route would have been searching for the wrong pattern.

This makes the recommended sequence: re-capture first, then decide. A runtime-capture session does not need a full audit; it is a single directed dev-tools interaction at the same shape as the May 1 session. After the URLs are in hand, item 6's static-analysis scope can be set with confidence.

If a runtime capture is not viable in the next session for any reason, item 6 should fire as a static-analysis audit of the four candidate per-feature managers with `fetchFromProxy` call sites outside tabs-manager (`facets-manager.js` L100 / L135, `pagination-manager.js` L86, `spelling-manager.js` L87) plus a re-read of `core-search-manager.js` with the fan-out question in mind. The tabs-manager audit catalogued these call sites in its §1.5 supporting greps but explicitly did not follow them.

**Stand-down is not the right call.** The fan-out is documented as 4× the proxy-edge load per tab click that the FE dictionary describes, and the rebuild's tab-navigation design cannot make an informed lazy-vs-warm decision while the source of the current pattern is unknown.

## Open questions catalogued for downstream work

The re-examination's stop rule excluded these from in-scope evidence; they are surfaced here for whichever audit or session does the next-step work.

The listener audit's puzzle 1 elimination logic ruled out three alternatives to the tabs-manager-iterating hypothesis (listener overlap, MutationObserver cascade, structural patterns in `core-search-manager`). The first two remain ruled out regardless of the tabs-manager finding — they were ruled out on grounds independent of which manager iterates. The third (no fan-out pattern in `core-search-manager` itself) was based on the listener audit's own read of `core-search-manager.js`, not the tabs-manager audit's. Whether that read covered the question "could core-search-manager fan out on click" with the same care as it covered "could core-search-manager fan out via M1" is worth confirming in item 6's scope.

The autocomplete audit catalogued the duplicate-prefetch-on-suggestion-click phenomenon and traced it to the input-listener firing on programmatic input mutation. That phenomenon is structurally distinct from the four-request fan-out and is not a candidate explanation here, but item 6 should keep in mind that the codebase has at least one other documented instance of "more requests fire than the dictionary describes" so that the design pattern being identified is general, not single-site.

The `cross_cutting_observations.tab_click_assumption_result` field in `audit/fe-endpoint-dictionary-2026-05-08.json` still carries the inline "iterating over the four live tabs" framing flagged in the dictionary's own changelog as superseded. Next canonical-document update should rewrite that observation rather than leave the corrective framing only in the `tab-click` entry's gaps.

## Status block (close)

Re-examination complete. The May 1 artifact's information content for the four-request fan-out question is more limited than downstream framings implied: one URL captured out of four, response-size pattern suggestive but not definitive, source attribution always an inference. The tabs-manager audit removed the most natural candidate iterator and left the question open. Item 6 should fire, preceded ideally by a directed runtime capture of all four URLs. The framing should be broader than "which manager iterates over tabs" — it should be "what produces four parallel requests, and over what dimension."

No source code was read in producing this document. No audit artifacts other than the two named inputs were consulted for in-scope evidence.
