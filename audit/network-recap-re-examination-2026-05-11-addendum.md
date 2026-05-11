# Network Recap Re-examination — Runtime-Capture Addendum — 2026-05-11

Standalone reference document. Captures the runtime evidence collected after the documentary re-read in `network-recap-re-examination-2026-05-11.md` and supersedes that document's recommendation on v13 cadence item 6. Structured for retrieval; not chronological.

## Scope and posture

**Purpose.** The documentary re-read produced a recommendation to fire item 6 with a runtime capture prepended to constrain the iteration-dimension question. The runtime capture was executed in the same session as the re-read, and its findings materially change the picture: the four-request fan-out is now mechanism-identified, item 6 closes entirely, and two framings catalogued in prior canonical documents (the May 8 audit's §1.2 attachment enumeration and the May 8 audit's Phase 1 latent-defect characterization) require substantive correction.

**Posture.** Live runtime capture on `https://www.seattleu.edu/search-test/` against the dev FE-and-proxy pair. Followed by DevTools Elements-panel and Event Listeners-panel inspection of the rendered DOM and click-listener topology. Two narrow Claude Code reads of `tabs-manager.js` for source-side confirmation. No edits, no commits, no deploys. Single session, single browser, single user — same posture as the May 1 network investigation, deliberately replicated for comparability.

**Relation to the documentary re-read.** This addendum sits alongside `network-recap-re-examination-2026-05-11.md`. The re-read's "newly open" findings are now resolved here; its recommendation on item 6 is superseded by §5 below.

## The runtime capture

**Setup.** Chrome dev tools, Network panel, filter `domain:*.vercel.app`, Preserve log ON, Disable cache ON. Navigation to `https://www.seattleu.edu/search-test/`, query submission for `cody ryckman` (via the autocomplete suggestion click — same end state as a direct submit). Wait for initial render to settle, observe the 11-script chained reload completes and `integration.js:934`'s 124 kB all-tabs render request resolves, then click the News tab.

**Observed cluster.** Following the News-tab click, the network panel shows: one `/proxy/analytics/supplement` preflight, four `/proxy/funnelback/search` requests firing in parallel, then one `/proxy/analytics/supplement` ping. No `/proxy/analytics/click` beacon fired on this tab click — that beacon belongs to result-link clicks per the listener audit, and the May 1 capture's mention of one alongside the tab click was concurrent activity, not part of the fan-out.

**The four URLs.** All four `/proxy/funnelback/search` requests have initiator `core-search-manager.js:506` (the `await fetch(fullUrl)` inside `fetchFromProxy`'s try block). Response sizes 33.9 kB / 33.9 kB / 34.2 kB / 33.8 kB — matches the May 1 capture's 33.8 – 34.7 kB range. Request URLs copied verbatim from the Headers panel: all four are byte-for-byte identical.

```
https://funnelback-proxy-dev.vercel.app/proxy/funnelback/search?form=partial&profile=_default&query=cody+ryckman&f.Tabs%7Cseattleu%7Eds-news=News&collection=seattleu%7Esp-search&sessionId=sess_1778511918358_f96y2fb&clientIp=24.17.18.153
```

**The definitive framing shift.** The "over the four tabs" reading that the May 1 capture's response-size pattern suggested, and that subsequent canonical documents propagated, is empirically falsified. The four parallel requests are not iterating over Results / Programs / Faculty_Staff / News; they are four executions of the same request — same query, same `f.Tabs|seattleu~ds-news=News` discriminator, same trinity, same sessionId, same clientIp. The size-sum coincidence (4 × ~34 kB ≈ ~136 kB ≈ the initial all-tabs render's 124 – 135 kB) was just that — coincidence, anchored in similarly-sized single-tab responses summing to a number that happens to approximate the full-tabs payload.

The rendered News-tab content corroborates: a single Career Aspirations result is visible on the page, and each of the four ~34 kB responses returned the same single-result payload.

## The mechanism

The mechanism took three rounds of investigation to identify completely, and the path through them is worth documenting because each round corrected a partial-truth framing from the prior.

**Round 1 — selector enumeration (Claude Code on `tabs-manager.js` L79–96).** `findTabContainers` uses four selectors: `.tab-list__nav`, `.tab-container`, `[role="tablist"]`, `.tabs`. Mapping each against the captured DOM ancestor chain for the News-tab anchor yielded three matches on three distinct elements: `.tab-list__nav` matches the direct parent, `[role="tablist"]` matches the grandparent `<div class="tab__list">`, `.tabs` matches the great-grandparent. `.tab-container` matches nothing in the chain. N=3 listener-bearing ancestors on the bubble path, not N=4.

This falsified the May 8 audit's framing of the latent defect as a single-element-matched-by-multiple-selectors problem. The actual structural pattern was distinct ancestors each matched by one selector, with the click bubbling through all three.

**Round 2 — document-level listener grep (Claude Code on `tabs-manager.js`).** `installTabClickHandlers` at L101–110 is a conditional: if `this.tabContainers.length > 0` attach to each container (L105), else attach a document-level delegate (L109). Within a single invocation the branches are mutually exclusive. This appeared to falsify the 1+3=4 layered-attachment hypothesis: if the per-container branch is taken, no document-level listener is attached, so the fourth listener has to come from somewhere else.

**Round 3 — DevTools Event Listeners panel (live runtime inspection).** Direct topological evidence of every click listener attached to every element in the bubble path. Filtering to `tabs-manager.js`-sourced listeners produced exactly four entries: one on `document`, one on `div.tabs.tabs--center`, one on `div.tab__list`, one on `div.tab-list__nav`. All four bound to the same `handleTabClick` function. Both branches' listeners are present at runtime simultaneously.

This falsified Round 2's "mutually exclusive at runtime" reading. The branches are mutually exclusive **within a single call**, but the four listeners come from **two different attachment events at two different lifecycle moments**.

**The actual mechanism.** On initial page load, `initialize()` runs before any tab DOM exists. `#results` is empty; no element in the document matches any of the four container selectors; `findTabContainers()` returns an empty array. `installTabClickHandlers()` runs with `this.tabContainers.length === 0`, takes the else branch, attaches the document-level delegate at L109. This is the first listener.

The query is then submitted. The response renders the tab bar into `#results`. The M1 MutationObserver fires. `handleDomChanges()` runs, finds three new ancestor elements matching the four selectors (the `.tab-container` selector remains unmatched), and attaches a click listener to each. These are the second, third, and fourth listeners — coming from the May 8 audit's §1.2 attachment 3 (the per-container re-binding in `handleDomChanges`), not from the §1.2 attachment 1 forEach in `installTabClickHandlers` (which never re-fires because `initialize()` runs once).

On every subsequent tab click, the click event bubbles through all three listener-bearing ancestors and also reaches `document`. `handleTabClick` fires four times. `loadTabContent` fires four times. `fetchFromProxy` fires four times. Four identical requests reach the proxy.

## The defect, properly framed

This is neither selector-overlap (the May 8 audit's framing) nor layered-attachment-strategy in the sense of "two strategies running concurrently by design" (the framing I held mid-investigation after Claude Code's L101–110 read). It is a **deferred-DOM-availability defect**: the install method runs at module-init time, before the DOM the method is supposed to find has been rendered, and it falls back to a document-level delegate as a hedge. A separate lifecycle path (M1-driven `handleDomChanges`) then adds per-container listeners on top of the now-orphaned fallback. The document-level listener was meant as a fallback for the case where containers don't exist; it is never removed when containers do appear.

The audit's L532 `this.tabContainers.includes(container)` dedup check is structurally irrelevant to this defect. It protects the `this.tabContainers` *array* from duplicate entries across multiple invocations of the discovery method, but the four runtime listeners are attached to four distinct elements (one document, three ancestors), so an includes-style dedup guard would not collapse them. The defect is not deduplication; it is lifecycle coordination across two attachment paths.

The May 8 audit's §1.2 attachment enumeration treated attachments 1, 2, and 3 as catalogued attachment sites without explicitly modeling the lifecycle relationships between them. Attachments 1 and 2 are alternates within `installTabClickHandlers()`. Attachment 3 is structurally separate from both (it runs from `handleDomChanges`, not from install) and fires on a different trigger. The audit's narrative treated 1 and 2 as if they could coexist, which is true at runtime across calls but not within a single call. Both readings are partial. The complete reading is: attachment 2 fires once during the pre-DOM-render install, attachment 3 fires later during the post-DOM-render mutation pass, and the two are additive across the lifecycle even though within `installTabClickHandlers()` they would have been alternates.

## Item 6 closure

V13's cadence catalogued item 6 as the four-request fan-out source identification audit, conditional on the May 1 re-examination not resolving the question. The re-examination didn't resolve it; the runtime capture documented in this addendum does. The structural source is identified, the mechanism is closed, the framing is locked. **Item 6 closes without firing.**

There is no per-feature manager iteration to find. Reading `facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, and `collapse-manager.js` to look for one would be searching for a thing that doesn't exist. The substitute work item — *fix the deferred-DOM-availability defect* — is rebuild-design work, not audit work, and is captured below.

## Rebuild-design implications

The cleanest rebuild pattern, given the defect we just identified, is a single document-level delegated click listener established at module-init time and never replaced. The pattern handles dynamic DOM correctly (containers can come and go; `closest()` on the click target resolves the right tab regardless), requires no MutationObserver-driven re-attachment, has no lifecycle coordination between attachment paths, and produces exactly one fetch per click by construction. The per-container listener strategy is the redundant one here, not the document-level one.

A broader pattern observed in the Event Listeners panel during this investigation, captured as rebuild context rather than addendum scope: at least five separate manager modules (tabs, facets, pagination, spelling, analytics) attach delegated click listeners somewhere on the page, plus document-level listeners from `integration.js` and `search-page-autocomplete.js`. The codebase has a delegation-strategy-proliferation pattern that is not tab-specific. The rebuild's listener-coordination design will need to confront this; it is not addressed by the deferred-DOM-availability fix alone.

## Framing corrections to other canonical documents

**`audit/fe-tabs-manager-audit-2026-05-08.md`.** §1.2's three-attachment enumeration is structurally right (the three sites do exist) but lifecycle-incomplete (1 and 2 are alternates within a single call; 1+3 are alternates across the install vs M1 paths; 2+3 is the combination that fires in production). Phase 1's framing of the latent defect as a selector-overlap problem is wrong — the runtime evidence shows selectors match distinct elements, not the same element. The implied fix direction (add a dedup guard on selector matches) would not address the defect. A substantive amendment is warranted: a §1.2 lifecycle annotation, a Phase 1 latent-defect re-characterization, and a forward-reference to this addendum.

**`audit/fe-listener-audit-2026-05-06.md`.** Puzzle 1's elimination logic ruled out three alternatives within its in-scope evidence and inferred-by-elimination that tabs-manager iterates over four tabs. The tabs-manager audit falsified that inference; this addendum closes the redirected question with a mechanism that the listener audit's in-scope evidence couldn't have surfaced (the M1-driven re-attachment plus pre-DOM-render fallback combination required runtime evidence to identify). The audit's elimination logic remains correct within its scope; the elimination-as-proof note already added to v13's anti-patterns covers the lesson.

**`audit/network-investigation-2026-05-01.md`.** §"Tab clicks — four-request fan-out per click" attributes the pattern's purpose to "pre-emptive vs defensive" framings, both of which presupposed multi-tab iteration. Neither framing applies; the actual pattern is request duplication via a deferred-DOM-availability defect. The mention of a `/proxy/analytics/click` ping alongside the fan-out is concurrent activity, not part of the fan-out — today's capture shows only the `/proxy/analytics/supplement` ping fires on a tab click. Both clarifications belong in the next canonical-document pass.

**`audit/fe-endpoint-dictionary-2026-05-08.json`.** The `tab-click` entry's gaps section already records that the fan-out source was unidentified as of the May 8 audit. That entry should now be updated to record the resolution: four-listener duplication via deferred-DOM-availability defect; identified via 2026-05-11 runtime capture + Event Listeners panel inspection. The `cross_cutting_observations.tab_click_assumption_result` field's residual "iterating over the four live tabs" framing, flagged in the dictionary's own changelog as superseded, should also be rewritten to match this addendum's mechanism description.

## Status block (close)

Runtime capture complete. Four byte-identical `/proxy/funnelback/search` URLs observed on a News-tab click, all from `core-search-manager.js:506` with identical query strings. DevTools Event Listeners panel confirms four `click` listeners on `tabs-manager.js`-sourced code paths: one document-level, three per-container. The fourth listener that the documentary re-read flagged as unaccounted-for is the document-level fallback from `installTabClickHandlers` L109, attached during pre-DOM-render `initialize()`. The three per-container listeners are attached later via M1-driven `handleDomChanges`. Both groups coexist at runtime because they originate from different lifecycle paths.

The structural source of the four-request fan-out is a deferred-DOM-availability defect in `tabs-manager.js`. V13 cadence item 6 closes without firing. The May 8 audit and the May 1 network investigation both require corrective amendments; this addendum carries the corrective framing for both. The rebuild's listener-coordination design needs to confront a broader delegation-strategy-proliferation pattern across multiple manager modules, of which the tabs-manager defect is one instance.

No source code beyond `tabs-manager.js` was read in producing this addendum. No audit artifacts other than those named in §6 above were consulted for in-scope evidence.
