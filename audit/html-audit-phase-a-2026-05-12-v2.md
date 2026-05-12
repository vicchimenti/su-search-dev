# HTML Audit Phase A — FE-Authored HTML Contract

**Audit date:** 2026-05-12  
**Audit version:** 1.0.0 (v2)  
**Phase:** A (FE-side phase of the five-phase HTML audit; B/C/D/E cover external surfaces)  
**Phase stage:** A.4-final  
**Companion document:** `audit/html-audit-phase-a-2026-05-12-v2.json` (canonical, machine-consumed by Claude Code during rebuild design and implementation)

## Purpose and posture

This document is the canonical binding-requirements record for FE-authored HTML in `su-search-dev`. Its role for the FE rebuild is structurally equivalent to what `funnelback-endpoint-dictionary-2026-05-01.json` plays for the proxy rebuild: an external-constraints reference. The proxy's upstream Funnelback wire shapes are binding because Funnelback won't accept anything different. The FE-authored HTML is binding because Squiz stencils main.js reads the on-page input's data-* attributes, Squiz Typeahead binds to inputs and may create DOM, the FE's own selectors read its own emitted classes and IDs, assistive technology consumes the ARIA contract, and CSS rules style by class.

Phase A is one of five phases (A through E) into which the HTML audit was split during the 2026-05-11 session. Phase A is the FE-side phase; B documents what the FE consumes from external surfaces; C, D, and E document the Squiz stencils, T4 PageLayout, and Funnelback partial contract surfaces respectively. Phase A can be finished in a single audit cycle because seam contracts can be documented from the FE side without waiting for the other phases.

## How to read this document

Each entry below describes one element or structural unit's contract surface. The fields are: a selector and source-layer label; a structural-role summary; the writer (file, function, line range) and its behavior; the literal HTML produced (in captured-state form, with PII generalized to placeholders like `{{FACULTY_NAME}}` per the brief's generalization policy); per-attribute binding annotations (`REQUIRED`, `EXTERNAL_CONSUMER_REQUIRED`, `TO_DETERMINE`, `VESTIGIAL_CANDIDATE`, `NOT_BINDING`); a consumer list with provenance type; the seam contract with the parent container and the dependencies the FE assumes about it; the design latitude across six dimensions; the render cap (where one exists); open gaps; and notes.

The binding label is the document's load-bearing field. `REQUIRED` means an in-repo or assistive-tech consumer reads it. `EXTERNAL_CONSUMER_REQUIRED` means an external consumer (Squiz stencils main.js, Squiz Typeahead) reads it. `TO_DETERMINE` flags an open question, typically pending the CSS audit or a Phase B/C/D/E pass. `VESTIGIAL_CANDIDATE` means the attribute is written but no consumer was found — the rebuild design phase decides whether to honor or drop. `NOT_BINDING` means the rebuild can change freely.

## Scope and stop rules

In scope: HTML originating from FE code in `su-search-dev` — the four HTML-loaded scripts (`integration.js`, `search-page-autocomplete.js`, `SessionService.js`, `search-index.js`), the dynamically-loaded `core-search-manager.js`, and the six per-feature managers — plus the seam contracts the FE-authored HTML depends on from its parent containers.

Out of scope: CSS rule enumeration (CSS audit), JS event listener attachment behavior (listener audit), the renderer-to-producer mapping (rendering audit), and full structural detail of the seam parents themselves (Phase C for Squiz stencils, Phase D for T4 PageLayout, Phase E for Funnelback partial content). Seam parents appear here as skeleton entries with capture-confirmed attribute data where available — full treatment belongs in their owning phase.

Stop rules. A.2 read the four HTML-loaded scripts plus the manager files in full for HTML-emitting code; did not chase into FTL templates, T4 PageLayout templates, Squiz stencils main.js, or Squiz Typeahead source. A.4 synthesis did not re-derive findings from prior audits where cross-references suffice. A.4 does not propose rebuild design decisions inside this document — `VESTIGIAL_CANDIDATE` and open `gaps` are recorded as findings; the rebuild design phase decides whether to honor or drop them.

## Capture provenance

Five captures were taken on 2026-05-12 and folded into this document:

- **Capture 1** — search-page idle (`#results` empty + `concierge-search-form` cluster outerHTML)
- **Capture 2/3** — search-page on-page dropdown populated, all three columns for query "computer" (one capture serves both states since the on-page dropdown always renders three columns conditional on per-column response size)
- **Capture 4** — non-search-page header dropdown populated for query "biology" (10 general items)
- **Capture 5** — non-search-page idle full `<header>` chrome

Capture 2/3's faculty PII (names, photo URLs, profile URLs, position/affiliation/department/college text) has been generalized to placeholder tokens (`{{FACULTY_NAME}}`, `{{FACULTY_PROFILE_URL}}`, `{{FACULTY_PHOTO_URL}}`, etc.) per the brief's generalization policy. Public-corpus content (Capture 4's query-term suggestions like "biology", Capture 5's nav link labels, "College of Science & Engineering" as a public org name) is kept as-illustrative.

## Cross-references

- audit/fe-autocomplete-audit-2026-05-05.md §10 (handoff to rendering — class names, ARIA, data attributes, element IDs)
- audit/fe-autocomplete-audit-2026-05-05.md §11 (cross-cutting observations — background-search-on-link-click, programs payload variance)
- audit/fe-endpoint-dictionary-2026-05-07.json (endpoint-level config; no HTML emission fields — Phase A fills that gap)
- audit/fe-listener-audit-2026-05-06.md (static element IDs, two performSearch implementations, prefetch-handoff race)
- audit/fe-tabs-manager-audit-2026-05-08.md (tabs-manager.js single-file audit — confirms tabs-manager fires one fetch per click, fragility findings carry forward)
- audit/html-audit-plan-2026-05-11.md (multi-phase plan A through E)
- audit/html-audit-phase-a-brief-2026-05-12.md (Phase A.1 brief — schema definition, methodology, deliverable shape)
- session-report-2026-05-11-html-audit-pivot.md (four findings: data-* external consumer, tri-modal column structure, click-mechanism asymmetry, render-cap UX policy)


## Head-mounted resource hints

Resource hints emitted into `<head>` at FE init time, warming the browser's connection and asset caches for the search subsystem. Single entry covering five `<link>` tags.

### `preload-link-tags`

**Selector:** `head > link[rel=preconnect|preload|prefetch] (5 tags emitted by preloadSearchResources)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** all pages where integration.js loads (universally per T4 PageLayout)  
**Captured in:** non-search-idle (head DOM)

Head-mounted resource hints for the search subsystem. preconnect warms TLS to the API and proxy origins; preload tags warm script caches; prefetch warms the search results page template.

**Writer:** `public/integration.js` · `preloadSearchResources` · `202-242`

Builds a DocumentFragment with five <link> elements (preconnect to apiBaseUrl, preconnect to proxyBaseUrl, preload SessionService.js as script, preload search-bundle.js as script, prefetch /search-test/) and appends to document.head. Called once during integration.js init.

_api-preconnect:_
```html
<link rel="preconnect" href="https://su-search-dev.vercel.app">
```

_proxy-preconnect:_
```html
<link rel="preconnect" href="https://funnelback-proxy-dev.vercel.app/proxy">
```

_session-service-preload:_
```html
<link rel="preload" href="https://su-search-dev.vercel.app/js/SessionService.js" as="script">
```

_search-bundle-preload:_
```html
<link rel="preload" href="https://su-search-dev.vercel.app/search-bundle.js" as="script">
```

_search-page-prefetch:_
```html
<link rel="prefetch" href="/search-test/">
```

**Attributes:**

- `rel` (`REQUIRED`) — value: `preconnect | preload | prefetch`. Browser resource-hint contract; consumed by the rendering engine, not by JS.
- `href` (`REQUIRED`) — value: `config.apiBaseUrl | config.proxyBaseUrl | url to JS asset | /search-test/`. Target of the hint; required by browser contract.
- `as` (`REQUIRED`) — value: `script`. preload requires explicit as= per browser spec; omitting it nullifies the preload.

**Consumers:**

- `CSS_INFERRED` — `N/A` — No CSS or JS consumer in the page; the browser's resource loader is the consumer.


**Seam:**

Parent: `document.head` (T4_PAGELAYOUT).

Contract dependencies:

- document.head must accept appendChild of <link> elements without external rebinding (standard browser contract; no project-specific risk)


**Design latitude:**

`visual_appearance`: **NOT_BINDING** · `class_names`: **NOT_BINDING** · `inner_dom_structure`: **FIXED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **FIXED** · `content_schema`: **OPEN**

Resource hints have no visual or interactive surface. The set of hints emitted (which URLs and which rel modes) is OPEN — the rebuild may add/remove/reorganize based on its bundle shape. The shape of each <link> element is fixed by browser contract.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Fixed five-element set; no iteration.

**Gaps:**

- search-bundle-preload references search-bundle.js, which CLAUDE.md flags as unused — the preload tag exists for a script that nothing executes. Rebuild dropping the preload would parallel the rebuild dropping search-bundle.js entirely.


**Notes:** Per CLAUDE.md, search-bundle.js is unused — the preload-link emission at line 226-230 is residue from an incomplete migration. Flagged as cleanup candidate for the rebuild but not modified now per discovery-phase posture. The five <link> writes happen at script init time; document.head must be available, which is true for all standard T4 PageLayout placements.


---


## Header-bar suggestions

The autocomplete dropdown attached to the universal header search input. Three entries: the container element (which Capture 5 surfaces as pre-existing at idle, with the FE's create-fallback path being dead code per Finding F8), the inner `.suggestions-list` wrapper, and the flat `.suggestion-item` children. The header dropdown returns only general suggestions; staff and programs columns are exclusive to the on-page dropdown. Findings F7, F8, F9, F12 cluster on this region.

### `header-suggestions-container`

**Selector:** `#header-suggestions`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** all pages where #search-input exists (universal per T4 PageLayout)  
**Captured in:** non-search-idle (Capture 5), non-search-header-dropdown (Capture 4)

Container for header-bar autocomplete suggestions. Populated by renderHeaderSuggestions (integration.js:601) with a .suggestions-list wrapper containing flat .suggestion-item children. Visibility controlled by container.hidden boolean (innerHTML cleared and hidden=true on empty fetch, error, or outside click; hidden=false on populated render).

**Writer:** `TO_DETERMINE — A.2 read integration.js:268-284 as create site, but per Finding F8 the production element pre-exists at the FE's findSearchComponents lookup time, so the create branch is dead in production. Actual create site is likely Squiz Typeahead (loaded from cdnjs.cloudflare.com via PageLayout's script imports) or a Squiz init script — outside Phase A's static-analysis scope per stop rules.` · `N/A (production create site unknown)` · `N/A (A.2's integration.js:268-284 read describes dead code in production)`

In production: container is created by some script before integration.js's findSearchComponents runs (visible at idle in Capture 5). FE's role: (1) finds existing container via if-guard reuse branch at integration.js:281-284; (2) writes innerHTML via renderHeaderSuggestions at integration.js:623 on populated render; (3) toggles the `hidden` attribute (presence on idle/empty/error/outside-click; absence on populated).

_idle (Capture 5):_
```html
<div id="header-suggestions" class="header-suggestions-container" hidden=""></div>
```

_populated (Capture 4):_
```html
<div id="header-suggestions" class="header-suggestions-container"><div class="suggestions-list">{ .suggestion-item children — see entry header-suggestion-item }</div></div>
```

**Attributes:**

- `id` (`REQUIRED`) — value: `header-suggestions`. Queried at integration.js:268, 283 (findSearchComponents reuse branch); used as outside-click boundary at integration.js:424-431. CSS hook plausible (.header-suggestions-container class is the more common styling hook).
- `class` (`TO_DETERMINE`) — value: `header-suggestions-container`. Captured but no FE consumer reads. CSS audit pending; CSS_INFERRED REQUIRED is the likely resolution.
- `role` (`VESTIGIAL_CANDIDATE`) — value: `ABSENT in production (NOT emitted)`. Per Finding F9, the setAttribute('role', 'listbox') A.2 attributed to integration.js:272 lives in a dead create branch (Finding F8). Captures 4 and 5 confirm no role attribute. The ARIA chain is incomplete — see cross-cutting Finding F12. Rebuild design phase decides whether to add role=listbox.
- `hidden` (`REQUIRED`) — value: `boolean attribute, toggled (presence on idle/empty/error/outside-click; absence on populated)`. Visibility-state mechanism. Set at integration.js initial state, 395, 430, 590, 606 (hide cases) and removed at 624 (show on populated). Captures 4 and 5 confirm the toggle pattern: Capture 5 (idle) has hidden="", Capture 4 (populated) has no hidden attribute.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:281-284, 395, 430, 605, 623` — Reuse-branch lookup (281-284); innerHTML write target — clear-on-empty (395, 430, 605) and populate-on-render (623) write here from renderHeaderSuggestions/handleInput.
- `IN_REPO_FE` — `public/integration.js:424-431` — Outside-click dismissal — document click handler tests !container.contains(e.target) and clears innerHTML, sets hidden=true.
- `IN_REPO_FE` — `public/integration.js:627` — querySelectorAll('.suggestion-item') traversal — click-handler attachment binds per-item listeners.
- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `see meta.behavioral_consumers.squiz-typeahead-bundle` — Likely create site for the container per Finding F8 — Typeahead binds to inputs and creates sibling/wrapper dropdown DOM. Phase C investigates.


**Seam:**

Parent: `form#searchForm (the header search form)` (T4_PAGELAYOUT).

Contract dependencies:

- Per Capture 5: #header-suggestions is a CHILD of form#searchForm in production, sitting between #search-input and the hidden #search-button submit. NOT nextSibling-of-form as A.2's read of integration.js suggested.
- Per Finding F8, the create site is upstream of integration.js. The reuse branch at integration.js:281-284 depends on the container existing at findSearchComponents time — which is true in production (per Capture 5 idle).
- FE's create-fallback insertion target (headerForm.parentNode.insertBefore(suggestionsContainer, headerForm.nextSibling) at integration.js:282) is dead in production but would, if reached, place the container in a different DOM position than T4/Typeahead's emission — latent fragility flagged for rebuild.


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **TO_DETERMINE** · `attribute_set`: **BOUNDED** · `content_schema`: **FIXED**

inner_dom_structure BOUNDED — rebuild controls inner shape via innerHTML writes; .suggestion-item flat children with role=option must remain queryable via querySelectorAll for line 627's click-binding to succeed. content_schema FIXED — API returns flat string[] or {display:string}[] for general (per autocomplete-audit §11 — header reads only data.general). attribute_set BOUNDED — id REQUIRED, hidden-toggling pattern REQUIRED, role=listbox currently ABSENT (rebuild may add to fix ARIA per F12). click_mechanism TO_DETERMINE — current is pure JS click via querySelectorAll iteration.

**Render cap:** no FE-side truncation. Truncation location: `N/A — no FE-side truncation`. Per Finding F1, renderHeaderSuggestions iterates over ALL items in data.general without slicing. The visible UX cap (header dropdown shows N items, where N is bounded) is upstream — most likely Funnelback show=N parameter at the suggestions endpoint. Phase B will map the upstream cap. The header consumer reads only data.general (the staff and programs buckets returned by the fan-out are unused per autocomplete-audit §11).

**Gaps:**

- Production create site not pinned by Phase A — likely Squiz Typeahead per Vic 2026-05-12; queued as rebuild-design follow-up rather than Phase A gap (per stop rules)
- Whether .header-suggestions-container has CSS rules — CSS audit pending
- Whether the rebuild adds role="listbox" + aria-labelledby to fix F9/F12 ARIA defect — rebuild design decision, not Phase A contract


**Notes:** Container survives across page sessions in production because it's pre-emitted (Capture 5 idle). The FE's role is innerHTML population and hidden-attribute toggling, not creation. Per Findings F8 and F9, two A.2 reads need revision: (a) the writer.file=integration.js claim describes a dead create branch; (b) the role="listbox" attribute the FE setAttribute would assign is never reached in production. Captures 4 and 5 are the authoritative contract source for this entry.


---

### `header-suggestions-list-wrapper`

**Selector:** `#header-suggestions > .suggestions-list`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** #header-suggestions when populated (any page with a non-empty general suggestions response on a long-enough query)  
**Captured in:** non-search-header-dropdown (Capture 4) — confirmed

Sole structural wrapper inside #header-suggestions between the container and the flat list of .suggestion-item children. Single-child contract — no per-column or per-bucket subdivision (compare to on-page consumer which adds .suggestions-columns and .suggestions-column inside this wrapper).

**Writer:** `public/integration.js` · `renderHeaderSuggestions` · `610-623`

Outer wrapper opened at line 610 ('<div class="suggestions-list">'), closed at line 621 ('</div>'). Concatenates suggestion-item children inside. Written to container.innerHTML at line 623.

```html
<div class="suggestions-list">{ .suggestion-item children — see entry header-suggestion-item }</div>
```

**Attributes:**

- `class` (`TO_DETERMINE`) — value: `suggestions-list`. No FE consumer; CSS hook plausible. Same class name used by the on-page consumer's outer wrapper, so a single CSS rule may serve both. CSS audit pending.

**Consumers:**

- `CSS_INFERRED` — `N/A` — Visual wrapper for the suggestion list — almost certainly CSS-styled.


**Seam:**

Parent: `#header-suggestions` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent must accept full innerHTML replacement at line 623 — no external consumers holding references to child nodes between renders


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **FIXED**

inner_dom_structure BOUNDED — the rebuild can replace this single wrapper with a different element type (ul, ol, nav), but the .suggestion-item children's flat structure must remain queryable from the parent container via .suggestion-item selector. content_schema FIXED — header shows only general suggestions per autocomplete-audit §11.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. See header-suggestions-container render_cap.

**Notes:** Single-purpose wrapper. The CLASS name is shared with the on-page consumer's outer wrapper (search-page-autocomplete.js:378), but the children inside differ — header is flat, on-page nests into .suggestions-columns > .suggestions-column. Capture 4 confirms the outer wrapper opens on populated render and closes after the last item; no whitespace mutations from concatenation.


---

### `header-suggestion-item`

**Selector:** `#header-suggestions .suggestions-list > .suggestion-item`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** #header-suggestions when populated  
**Captured in:** non-search-header-dropdown (Capture 4) — confirmed

One header suggestion. Click sets the header input value to the suggestion text, normalizes, and redirects to /search-test/?query=... via window.location.href (integration.js:384-386).

**Writer:** `public/integration.js` · `renderHeaderSuggestions` · `612-619`

Per-item HTML template concatenated into .suggestions-list inside a forEach loop. The display value is sourced from `suggestion.display || suggestion` (handles both string and {display:string} item shapes per autocomplete-audit §10).

```html
<div class="suggestion-item" role="option" data-index="{N}"><span class="suggestion-text">{suggestion_text}</span></div>
```

_captured_example_biology_query (Capture 4):_
```html
<div class="suggestion-item" role="option" data-index="0"><span class="suggestion-text">biology</span></div>
```

**Attributes:**

- `class` (`REQUIRED`) — value: `suggestion-item`. Queried at integration.js:627 (querySelectorAll('.suggestion-item')) for click-handler attachment. Required for the binding to find items. Same class name used by all three on-page item variants (general, staff, program) — the click-handler pattern relies on it.
- `role` (`REQUIRED`) — value: `option`. ARIA contract paired with role=listbox on parent container. ASSISTIVE_TECH_INFERRED consumer.
- `data-index` (`VESTIGIAL_CANDIDATE`) — value: `integer (forEach loop index, 0-based)`. Per Finding F3: zero FE readers across in-scope files. Header click handler uses querySelector('.suggestion-text').textContent (line 629), not data-index. No external consumer documented. Rebuild may drop.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:627-628` — querySelectorAll('.suggestion-item').forEach — click-handler attachment loop. Each handler reads `this.querySelector('.suggestion-text').textContent` (line 629) to get the suggestion text.
- `ASSISTIVE_TECH_INFERRED` — `N/A` — role=option contract — paired with role=listbox on #header-suggestions.
- `CSS_INFERRED` — `N/A` — Visual styling by .suggestion-item class — CSS audit pending will pin the rules; the active-state class .active is NOT used on the header consumer (only the search-page consumer uses it, per addKeyboardNavigation in search-page-autocomplete.js; that handler is bound to the search-page input only).


**Seam:**

Parent: `#header-suggestions > .suggestions-list` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-list must exist as a queryable ancestor for the click-handler-attachment querySelectorAll at line 627
- Sibling .suggestion-text element must be a descendant for the click handler's querySelector at line 629 to succeed
- No external consumers must hold per-item references across innerHTML replacements (which would create stale-reference leaks)


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **TO_DETERMINE** · `attribute_set`: **BOUNDED** · `content_schema`: **FIXED**

class_names BOUNDED — `.suggestion-item` is required for the click-handler binding pattern; the rebuild may change it but the consumer at line 627 must change in lockstep. inner_dom_structure BOUNDED — a single text-bearing descendant queryable via .suggestion-text is required (or the click handler's read pattern at line 629 needs to change). attribute_set BOUNDED — role=option REQUIRED, data-index VESTIGIAL_CANDIDATE (can drop). click_mechanism TO_DETERMINE — current is pure JS click (no anchor wrapping); the rebuild may switch to anchor-wrapping for native middle-click/cmd-click support per the search-page staff/program pattern (Finding 3 in 2026-05-11 session), but the header's redirect-to-search-page flow doesn't require it — pure JS click suffices for the same-tab redirect to /search-test/?query=... (integration.js:384-386).

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1, no FE-side truncation. Each item in data.general gets rendered.

**Gaps:**

- Capture 4 shows suggestion-text content rendered as plain text (no <strong> tags or escaped HTML markup) — no XSS surface observed for the query 'biology'. XSS audit on adversarial query inputs is a separate concern.


**Notes:** Header item is the simplest of three FE suggestion-item variants. No data-type, no data-url, no anchor wrapping (confirmed by Capture 4). Click is intercepted by an attached listener; navigation happens via window.location.href in the same tab, not via native link behavior.


---


## On-page autocomplete dropdown

The tri-modal autocomplete dropdown on the search-results page, written into the Squiz-stencils-emitted `#autocomplete-suggestions` container. Seven entries: the outer `.suggestions-list` wrapper, three column entries (general, staff, programs), and three per-item entries with different click-mechanism contracts. The general column uses pure JS click (no anchor wrapping); staff and programs items wrap in `<a target="_blank" rel="noopener noreferrer">` for native middle-click/cmd-click navigation. Findings F3 (data-index vestigial), F4 (keyboard nav bug), F5 (synonymous class assignments), F7 (item-shape asymmetry), F13 (render cap source) all cluster here.

### `on-page-suggestions-list-wrapper`

**Selector:** `#autocomplete-suggestions > .suggestions-list`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page (any context where #autocomplete-suggestions is populated)  
**Captured in:** search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Top-level wrapper inside #autocomplete-suggestions when any suggestion bucket has results. Encloses the .suggestions-columns multi-column grid.

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `377-498`

Outer wrapper opened at line 378 ('<div class="suggestions-list">') and closed at line 497. Contains a single .suggestions-columns child. Empty case (all three buckets empty) sets container.innerHTML='' and container.hidden=true at lines 371-373 — no .suggestions-list wrapper emitted.

```html
<div class="suggestions-list"><div class="suggestions-columns">{ conditional .suggestions-column children — see entries on-page-suggestions-column-general, -staff, -programs }</div></div>
```

**Attributes:**

- `class` (`TO_DETERMINE`) — value: `suggestions-list`. Same class as the header consumer's wrapper. No FE reader. CSS hook likely. Note: search-page-autocomplete.js:506 reads .suggestion-item from the container via querySelectorAll — the .suggestions-list wrapper itself is not queried.

**Consumers:**

- `CSS_INFERRED` — `N/A` — Multi-column grid styling — likely provides the visual frame; CSS audit pending.


**Seam:**

Parent: `#autocomplete-suggestions` (SQUIZ_STENCILS_BOILERPLATE).

Contract dependencies:

- #autocomplete-suggestions must exist in the DOM at search-page-autocomplete.js DOMContentLoaded handler time (line 1088 getElementById) — if absent, the handler early-returns at line 1093 and no autocomplete is initialized
- Parent must accept full innerHTML replacement at line 501 — search-page-autocomplete.js's renderResultsPageSuggestions writes here


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **FIXED**

inner_dom_structure BOUNDED — rebuild can replace .suggestions-list and .suggestions-columns wrappers with different element types, but per-column children must remain queryable via .suggestion-item for the click-handler binding at line 506 and via .suggestions-column for keyboard-nav column traversal at line 875 (note: keyboard nav is currently broken per Finding F4, so its selector contract is partially vestigial).

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Notes:** Single-purpose wrapper. The .suggestions-columns inner wrapper is what carries the multi-column layout — that's a separate structural element worth examining if the rebuild restructures, but it's never queried by FE code so it has no contract beyond being the parent of .suggestions-column children.


---

### `on-page-suggestions-column-general`

**Selector:** `#autocomplete-suggestions .suggestions-columns > .suggestions-column (first, when general.length > 0)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when /api/suggestions returns non-empty data.general  
**Captured in:** search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

First column of the tri-modal on-page autocomplete dropdown. Renders general (text-only) suggestions sourced from the Funnelback suggest endpoint via /api/suggestions fan-out general leg.

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `381-397`

Conditional column emitted when data.general.length > 0. Ternary at line 380 emits the full column block; else empty string. Column contains a static .column-header text ('Suggestions') and an iteration of .suggestion-item children built from data.general[].map.

```html
<div class="suggestions-column"><div class="column-header">Suggestions</div>{ .suggestion-item children — see entry on-page-suggestion-item-general }</div>
```

**Attributes:**

- `class` (`REQUIRED`) — value: `suggestions-column`. Queried at search-page-autocomplete.js:875 (container.querySelectorAll('.suggestions-column')) for keyboard-nav column traversal — currently dead code per Finding F4 (keyboard handler always early-returns due to misspelled .suggestions-item selector), but the selector contract exists in code. Also referenced at line 953, 963, 981, 1005, 1012, 1040, 1047 for inter-column navigation logic.

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:875` — querySelectorAll('.suggestions-column') for keyboard-nav column array. Dead-code-gated by Finding F4.
- `CSS_INFERRED` — `N/A` — Three-column grid styling — the visual layout depends on CSS.


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-list > .suggestions-columns` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-columns must exist (FE-emitted in same render pass at line 379)


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **FIXED**

class_names BOUNDED — .suggestions-column is consumed by keyboard-nav code path even if dead. content_schema FIXED — single static header ('Suggestions') plus per-item children. The .column-header text 'Suggestions' is hardcoded; rebuild may parameterize but the header-text-per-column pattern is preserved across all three columns.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1 — entire data.general array rendered.

**Gaps:**

- If keyboard nav is rehabilitated in the rebuild (Finding F4), the .suggestions-column selector becomes a hard REQUIRED contract; until then it's REQUIRED-for-dead-code, effectively VESTIGIAL_CANDIDATE for the column selector specifically


**Notes:** First of three columns in the on-page dropdown's tri-modal layout. The header 'Suggestions' is the only column header that doesn't name a specific bucket — compare 'Faculty & Staff' (staff) and 'Programs' (programs). Rebuild may rename for clarity but the column-header pattern is binding.


---

### `on-page-suggestion-item-general`

**Selector:** `#autocomplete-suggestions .suggestions-column > .suggestion-item:not(.staff-item):not(.program-item) (general column items)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when general column is populated  
**Captured in:** search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Text-only general suggestion in the on-page dropdown. Click sets the on-page input value, normalizes the query, performs a background search, updates the URL, and (per Finding F7 / autocomplete-audit §11) does NOT navigate — it stays on the search page and replaces results in-place via the local performSearch.

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `385-394 (inside the general column block)`

Per-item template inside data.general[].map(). The display value is sourced from `suggestion.display || suggestion` mirroring the header consumer pattern.

```html
<div class="suggestion-item" role="option" data-index="{N}" data-type="general"><span class="suggestion-text">{suggestion_text}</span></div>
```

_captured_example_computer_query (Capture 2/3):_
```html
<div class="suggestion-item" role="option" data-index="0" data-type="general"><span class="suggestion-text">computer</span></div>
```

**Attributes:**

- `class` (`REQUIRED`) — value: `suggestion-item`. Queried at search-page-autocomplete.js:506 (querySelectorAll('.suggestion-item')) for click-handler attachment. Also queried at lines 953, 963, 981, 1005, 1012, 1040, 1047 for keyboard-nav item arrays (dead code per Finding F4, but selector contract exists).
- `role` (`REQUIRED`) — value: `option`. ARIA contract — paired with role=listbox on container (though #autocomplete-suggestions does not appear to be FE-emitted with role=listbox; the container is Squiz stencils, and whether it has role=listbox is a Phase C question). ASSISTIVE_TECH_INFERRED consumer regardless of the container ARIA status — role=option on items is meaningful.
- `data-index` (`VESTIGIAL_CANDIDATE`) — value: `integer (.map index, 0-based)`. Per Finding F3. No reader.
- `data-type` (`REQUIRED`) — value: `general`. Read by click handler at search-page-autocomplete.js:509 (this.dataset.type). Determines the click dispatch branch: general type bypasses the staff/program anchor-wrapping branch (line 543) and proceeds to the bottom-of-handler performSearch path (line 562).

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:506-511` — querySelectorAll('.suggestion-item').forEach click-handler attachment. Reads this.querySelector('.suggestion-text').textContent (line 508), this.dataset.type (509), this.dataset.url (510).
- `IN_REPO_FE` — `public/search-page-autocomplete.js:562-566` — Click handler's general-type path performs a local performSearch and updateUrl.
- `ASSISTIVE_TECH_INFERRED` — `N/A` — role=option contract.
- `CSS_INFERRED` — `N/A` — Visual styling by .suggestion-item; active-state by .active class (when keyboard nav is enabled).


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-column (the general column)` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-column must exist as queryable ancestor
- .suggestion-text descendant must exist for click handler's textContent read at line 508
- No external consumers must hold per-item references across innerHTML replacements


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **BOUNDED** · `attribute_set`: **BOUNDED** · `content_schema`: **FIXED**

click_mechanism BOUNDED — current is pure JS click (no anchor wrapping). The rebuild may switch to anchor wrapping but must preserve the in-place performSearch / updateUrl behavior (no full-page navigation). content_schema FIXED — one text span per item. attribute_set BOUNDED — role=option REQUIRED, data-type=general REQUIRED for dispatch, data-index VESTIGIAL_CANDIDATE.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Notes:** Differs from header-suggestion-item by adding data-type='general'. Click dispatch routes via data-type to the general path which performs search-in-place rather than navigation. Per autocomplete-audit §11, search-page-autocomplete.js's click handler does NOT normalize the query before calling performSearch (unlike the header consumer); the rebuild's normalization rule should be settled at the wire boundary.


---

### `on-page-suggestions-column-staff`

**Selector:** `#autocomplete-suggestions .suggestions-columns > .suggestions-column (second, when staff.length > 0)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when /api/suggestions returns non-empty data.staff  
**Captured in:** search-on-page-dropdown-staff-focused, search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Second column of the on-page tri-modal dropdown. Renders staff suggestions as person cards with image, name, role/affiliation, department/college.

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `401-457`

Conditional column emitted when data.staff.length > 0. Same column structure as general (column-header + per-item iteration) but with header text 'Faculty & Staff'.

```html
<div class="suggestions-column"><div class="column-header">Faculty &amp; Staff</div>{ .suggestion-item.staff-item children — see entry on-page-suggestion-item-staff }</div>
```

**Attributes:**

- `class` (`REQUIRED`) — value: `suggestions-column`. Same as on-page-suggestions-column-general — keyboard-nav consumer (dead code per Finding F4 but selector contract exists).

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:875+` — Keyboard-nav column array (dead code per Finding F4).
- `CSS_INFERRED` — `N/A` — Three-column grid styling.


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-list > .suggestions-columns` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-columns must exist


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **FIXED**

Same as general column. The header text 'Faculty & Staff' is hardcoded — rebuild may parameterize.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Notes:** Second of three columns. Per Finding F13, the visible cap is 10 (set by data-max-results on the input); the captured 5-item count for "computer" reflects per-query response size, not a separate column cap. The 6-item count in the 2026-05-11 UX capture was a different query's response.


---

### `on-page-suggestion-item-staff`

**Selector:** `#autocomplete-suggestions .suggestion-item.staff-item`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when staff column is populated  
**Captured in:** search-on-page-dropdown-staff-focused, search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Staff suggestion in the on-page dropdown. Click navigates to the person's profile URL in a new tab (anchor-driven) while simultaneously firing a background search for the suggestion text in the current tab (search-page-autocomplete.js:543-554).

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `407-451 (inside the staff column block)`

Per-item template inside data.staff[].map(). Conditional inner elements based on truthy person fields (image, position, affiliation, department, college). Outer <div class='suggestion-item staff-item'> wraps an <a class='staff-link' target='_blank' rel='noopener noreferrer' href> which wraps a .staff-suggestion div containing optional .staff-image (with .staff-thumbnail img) and a .staff-info div with the textual content.

```html
<div class="suggestion-item staff-item" role="option" data-index="{N}" data-type="staff" data-url="{{FACULTY_PROFILE_URL}}"><a href="{{FACULTY_PROFILE_URL}}" class="staff-link" target="_blank" rel="noopener noreferrer"><div class="staff-suggestion"><div class="staff-image"><img src="{{FACULTY_PHOTO_URL}}" alt="{{FACULTY_NAME}}" class="staff-thumbnail" loading="lazy"></div><div class="staff-info"><span class="suggestion-text">{{FACULTY_NAME}}</span><span class="staff-role">{{FACULTY_POSITION_AND_DEPT_SHORT}}</span><span class="staff-role">{{FACULTY_AFFILIATION}}</span><span class="staff-department">{{FACULTY_DEPARTMENT}}</span><span class="staff-department">{{FACULTY_COLLEGE}}</span></div></div></a></div>
```

_all_fields_present (Capture 2/3):_
```html
See literal_html — Capture 2/3 staff items all had image, position, affiliation, department, college present.
```

_conditional_branches (per source):_
```html
Per search-page-autocomplete.js:407-451, the inner elements are wrapped in `${person.image ? ... : ''}` and similar truthy guards for position, affiliation, department, college. A staff item with no image renders without the .staff-image div; a staff item with no affiliation renders without the second .staff-role span; etc. Captures 2/3 happened to show all-fields-present for the 5 staff items returned.
```

**Attributes:**

- `class (outer div)` (`REQUIRED`) — value: `suggestion-item staff-item`. .suggestion-item queried at line 506 for click-handler binding. .staff-item presumed CSS hook (not read by FE; CSS audit pending; could be VESTIGIAL_CANDIDATE if no CSS rule, but the visual differentiation in the 2026-05-11 capture suggests CSS_INFERRED REQUIRED).
- `role` (`REQUIRED`) — value: `option`. ARIA contract.
- `data-index` (`VESTIGIAL_CANDIDATE`) — value: `integer (.map index)`. Per Finding F3.
- `data-type` (`REQUIRED`) — value: `staff`. Read by click handler at line 509 to dispatch the staff/program path at line 543 (which uses the anchor for navigation and fires the background performSearch).
- `data-url` (`REQUIRED`) — value: `person.url || '#'`. Read by click handler at line 510. Used at line 543-558 to determine staff/program path and as the `url` arg to trackSuggestionClick (line 536). NB: this value duplicates the anchor's href attribute — the click handler reads data-url, not the anchor href.
- `href (anchor)` (`REQUIRED`) — value: `person.url || '#'`. Anchor's href — required for native middle-click/cmd-click navigation and for the e.target.closest('a') check at line 545 to find an anchor to navigate via.
- `target (anchor)` (`REQUIRED`) — value: `_blank`. Required for new-tab navigation per the UX contract — staff suggestions open in a new tab while the background search runs in the current tab (autocomplete-audit §11 / Finding 3 in 2026-05-11 session).
- `rel (anchor)` (`REQUIRED`) — value: `noopener noreferrer`. Security hygiene for target=_blank — prevents window.opener access and referrer leakage.
- `class (anchor)` (`TO_DETERMINE`) — value: `staff-link`. No FE consumer. CSS hook plausible. CSS audit pending.
- `loading (img)` (`NOT_BINDING`) — value: `lazy`. Browser-native lazy-loading hint. Performance optimization, not a contract — rebuild may drop or replace with intersection-observer-based lazy loading.
- `alt (img)` (`REQUIRED`) — value: `person.title || ''`. Accessibility — alt text required for images. The empty-string fallback when person.title is absent is a weak default (screen readers will skip the image silently); rebuild should ensure meaningful alt text.
- `class (img)` (`TO_DETERMINE`) — value: `staff-thumbnail`. CSS hook plausible. CSS audit pending.
- `class (.staff-suggestion / .staff-image / .staff-info)` (`TO_DETERMINE`) — value: `staff-suggestion | staff-image | staff-info`. Wrapper classes — no FE readers. CSS hooks plausible.
- `class (.suggestion-text / .staff-role / .staff-department)` (`REQUIRED`) — value: `suggestion-text | staff-role | staff-department`. .suggestion-text queried by click handler at line 508 for text retrieval. .staff-role queried at line 515 and .staff-department at line 516 for title-string augmentation in trackSuggestionClick. Per Finding F5, .staff-role and .staff-department each carry two semantic slots — the click handler reads only the first match via querySelector.

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:506-525` — Click handler binding. Reads .suggestion-text, .staff-role, .staff-department, data-type, data-url.
- `IN_REPO_FE` — `public/search-page-autocomplete.js:543-558` — Click handler's staff/program dispatch — if click target's closest('a') exists (i.e., user clicked on the staff-link anchor or a descendant), allows native navigation in the new tab while firing a 100ms-delayed background performSearch in the current tab.
- `ASSISTIVE_TECH_INFERRED` — `N/A` — role=option contract; img alt text.
- `CSS_INFERRED` — `N/A` — Visual card design — .staff-item, .staff-link, .staff-thumbnail, .staff-suggestion, .staff-image, .staff-info, .staff-role, .staff-department classes.


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-column (the staff column)` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-column must exist
- Container must accept full innerHTML replacement (no external consumers holding references to children)


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **FIXED** · `attribute_set`: **BOUNDED** · `content_schema`: **BOUNDED**

click_mechanism FIXED — must use <a target='_blank' rel='noopener noreferrer' href=...> wrapping per Finding 3 (2026-05-11 session) for native middle-click/cmd-click navigation and security hygiene. content_schema BOUNDED — six API slots (image, title, position, affiliation, department, college); rebuild can drop slots but adding new ones requires API change. attribute_set BOUNDED — data-type and data-url REQUIRED, data-index VESTIGIAL. inner_dom_structure BOUNDED — the .suggestion-text / .staff-role / .staff-department classes are required by click handler reads; the surrounding wrapper structure (.staff-suggestion, .staff-image, .staff-info) is OPEN. class_names BOUNDED — outer .suggestion-item / .staff-item required for binding.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Gaps:**

- Captures 2/3 show 5 staff items for query "computer"; no item had a missing field, so conditional-branch behavior is inferred from source rather than captured.
- person.url fallback to '#' produces an inert href — the click handler at line 543 checks `url && url !== '#'` to guard the navigate-and-background-search branch; A.3 captures did not surface this edge case


**Notes:** Per autocomplete-audit §11, the background-search-on-link-click behavior is intentional product UX: user clicks faculty card → faculty profile opens in new tab → original tab's results update to show full result set for that query. Captures 2/3 confirm the anchor wrapping, the .staff-suggestion / .staff-image / .staff-info structure, and Finding F5's .staff-role / .staff-department duplication (each captured staff item had two .staff-role spans for position+affiliation and two .staff-department spans for department+college).


---

### `on-page-suggestions-column-programs`

**Selector:** `#autocomplete-suggestions .suggestions-columns > .suggestions-column (third, when programResults.length > 0)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when /api/suggestions returns non-empty programs  
**Captured in:** search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Third column of the on-page tri-modal dropdown. Renders program suggestions as title-school-description cards.

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `461-494`

Conditional column emitted when programResults.length > 0. programResults is sourced from `Array.isArray(programs) ? programs : programs.programs || []` (lines 361-363) to handle both response shapes per autocomplete-audit §11.

```html
<div class="suggestions-column"><div class="column-header">Programs</div>{ .suggestion-item.program-item children — see entry on-page-suggestion-item-program }</div>
```

**Attributes:**

- `class` (`REQUIRED`) — value: `suggestions-column`. Same as general/staff column.

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:875+` — Keyboard-nav column array (dead code per Finding F4).
- `CSS_INFERRED` — `N/A` — Three-column grid styling.


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-list > .suggestions-columns` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-columns must exist


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **FIXED**

Same shape as general/staff columns. Header text 'Programs' hardcoded.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Gaps:**

- Programs payload shape variance (autocomplete-audit §11): programs may be Array or {programs: [...]}; the rebuild's response-contract design must pin the shape. Captures 2/3 showed the array shape.


**Notes:** Third column. Pinning the upstream programs response shape is a rebuild design issue, not a Phase A contract issue.


---

### `on-page-suggestion-item-program`

**Selector:** `#autocomplete-suggestions .suggestion-item.program-item`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when programs column is populated  
**Captured in:** search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

Program suggestion in the on-page dropdown. Same click contract as staff (background-search-while-navigating).

**Writer:** `public/search-page-autocomplete.js` · `renderResultsPageSuggestions` · `467-489 (inside the programs column block)`

Per-item template inside programResults[].map(). Conditional inner spans for program.details?.school and program.description. Outer <div class='suggestion-item program-item'> wraps an <a class='program-link' target='_blank' rel='noopener noreferrer' href> which wraps a .program-suggestion div with the textual content.

```html
<div class="suggestion-item program-item" role="option" data-index="{N}" data-type="program" data-url="{{PROGRAM_URL}}"><a href="{{PROGRAM_URL}}" class="program-link" target="_blank" rel="noopener noreferrer"><div class="program-suggestion"><span class="suggestion-text">{{PROGRAM_NAME}}</span><span class="suggestion-type">{{PROGRAM_SCHOOL}}</span><span class="program-description">{{PROGRAM_DESCRIPTION}}</span></div></a></div>
```

**Attributes:**

- `class (outer div)` (`REQUIRED`) — value: `suggestion-item program-item`. .suggestion-item required for click-handler binding (line 506); .program-item CSS_INFERRED (visual differentiation).
- `role` (`REQUIRED`) — value: `option`. ARIA contract.
- `data-index` (`VESTIGIAL_CANDIDATE`) — value: `integer (.map index)`. Per Finding F3.
- `data-type` (`REQUIRED`) — value: `program`. Read by click handler at line 509. Dispatches to the staff/program path (data-type === 'program' satisfies the type==='staff' || type==='program' check at line 543). Click handler also reads .suggestion-type for the title-string augmentation in the program branch at lines 520-525.
- `data-url` (`REQUIRED`) — value: `program.url || '#'`. Same role as data-url on staff items.
- `href (anchor)` (`REQUIRED`) — value: `program.url || '#'`. Anchor href — same role as staff anchor.
- `target (anchor)` (`REQUIRED`) — value: `_blank`. Same UX contract as staff anchor.
- `rel (anchor)` (`REQUIRED`) — value: `noopener noreferrer`. Security hygiene.
- `class (anchor)` (`TO_DETERMINE`) — value: `program-link`. CSS hook plausible.
- `class (.program-suggestion / .program-description)` (`TO_DETERMINE`) — value: `program-suggestion | program-description`. Wrapper / content classes — no FE readers; CSS hooks plausible.
- `class (.suggestion-text / .suggestion-type)` (`REQUIRED`) — value: `suggestion-text | suggestion-type`. .suggestion-text queried at line 508; .suggestion-type queried at line 521 for the program-branch title-string augmentation.

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:506-525` — Click handler — same binding pattern as staff and general items, with the program branch reading .suggestion-type for title augmentation.
- `IN_REPO_FE` — `public/search-page-autocomplete.js:543-558` — Click handler's staff/program dispatch — same as staff.
- `ASSISTIVE_TECH_INFERRED` — `N/A` — role=option.
- `CSS_INFERRED` — `N/A` — Visual card design.


**Seam:**

Parent: `#autocomplete-suggestions .suggestions-column (the programs column)` (FE_DYNAMIC_INSERTION).

Contract dependencies:

- Parent .suggestions-column must exist
- Container must accept full innerHTML replacement


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **FIXED** · `attribute_set`: **BOUNDED** · `content_schema`: **BOUNDED**

Same constraint shape as staff item. content_schema BOUNDED — three API slots (title, details.school, description). class_names BOUNDED — outer .suggestion-item / .program-item required; inner .suggestion-text / .suggestion-type required by click handler reads.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Per Finding F1.

**Notes:** Same click-contract as staff item; differs by content slots and class names. The .suggestion-type class is shared with nothing else in this audit's emission inventory — name implies a generic typing class but is used only on program items currently. Captures 2/3 confirm the three-slot content schema (title, school, description) with all five captured program items showing all three slots present.


---


## Search results region

The `#results`-targeting display surface: the FE-authored `#funnelback-search-container-response` wrapper that hosts the Funnelback partial response, the `.search-error` block emitted on fetch failure, and the `.results-loading` indicator that Vic confirmed (2026-05-12) is intended-killed in production (JS write path live, visual suppressed — most likely by CSS). Finding F2 (10 wrapper write sites) and F6 (pre-render display path) cluster here.

### `funnelback-search-container-response-wrapper`

**Selector:** `#results > #funnelback-search-container-response`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page (any successful search, tab click, or pre-rendered display)  
**Captured in:** search-initial (Capture 1) — #results is empty at idle, confirming wrapper is created on first search/tab-click

FE-emitted wrapper around the Funnelback partial response HTML. Provides a stable id and class hook for FE code that traverses or styles the search-results region. All search-results display paths (live fetch, pre-render display, tab content, window.SearchManager.updateResults API) converge on this wrapper.

**Writer:** `MULTIPLE (5 success sites + 5 error variants)` · `performSearch | displayPreRenderedResults | updateResults | loadTabContent | enhancedPerformSearch` · `see behavior`

Per Finding F2, the wrapper is written from 10 FE sites: SUCCESS — integration.js:956-960 (header-redirect-fallback performSearch), search-page-autocomplete.js:311-315 (displayPreRenderedResults instant-display path), search-page-autocomplete.js:720-724 (search-page local performSearch), core-search-manager.js:558-562 (window.SearchManager.updateResults API), tabs-manager.js:372-376 (loadTabContent tab-click path), tabs-manager.js:442-446 (enhancedPerformSearch tab-nav-detected path). ERROR — integration.js:973-978, search-page-autocomplete.js:743-748, tabs-manager.js:382-388, tabs-manager.js:460-464 (these write a .search-error block as the wrapper's INNER content rather than the wrapper itself; the wrapper structure is bypassed in the error path). All success-path writes use the byte-identical template: <div id="funnelback-search-container-response" class="funnelback-search-container">${html}</div>.

```html
<div id="funnelback-search-container-response" class="funnelback-search-container">${funnelback_partial_response_html}</div>
```

_empty-fallback (core-search-manager + tabs-manager):_
```html
<div id="funnelback-search-container-response" class="funnelback-search-container">No results found.</div>
```

_Funnelback-partial-content:_
```html
Wrapper contains the full Funnelback response: <stencils-injected hidden div> + <script src=...stencils/js/main.js> + tab bar + facets sidebar + results list + pagination + spelling block + curator/best-bet slots — all PHASE E territory
```

**Attributes:**

- `id` (`TO_DETERMINE`) — value: `funnelback-search-container-response`. No FE call site reads this ID (verified via grep for getElementById and querySelector with 'funnelback-search-container-response' or '#funnelback-search-container-response'). Plausible CSS hook (the .funnelback-search-container class is the more common styling hook). The id may be a debug/log reference or external-consumer surface — Squiz stencils main.js could read it; Phase C may resolve. Note: this is structurally significant — every FE search-results display path emits this id.
- `class` (`TO_DETERMINE`) — value: `funnelback-search-container`. No FE reader. CSS hook plausible. CSS audit pending.

**Consumers:**

- `CSS_INFERRED` — `N/A` — Plausible CSS class hook.
- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `see meta.behavioral_consumers.squiz-stencils-main-js` — Squiz stencils main.js, loaded inside this wrapper, may scope its DOM traversal to it. Source not inspected.


**Seam:**

Parent: `#results` (TO_DETERMINE (Squiz stencils boilerplate? T4 PageLayout? — A.3 idle-search-page capture should pin this)).

Contract dependencies:

- #results must exist in the DOM at innerHTML write time — getElementById('results') at search-page-autocomplete.js:300, 548, 562, 1085 (effective); core-search-manager.js:550-557 (via this.config.resultsContainerSelector = '#results' at search-index.js:32); tabs-manager.js:353, 366, 379, 391, 418 (via getElementById('results'))
- #results must accept full innerHTML replacement (no external consumers holding references to children — but per Phase E, Funnelback's injected Squiz stencils main.js DOES live inside, so each innerHTML replacement re-loads main.js, which may be load-bearing per Finding 1 in 2026-05-11 session)


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **TO_DETERMINE** · `content_schema`: **FIXED**

content_schema FIXED — Funnelback partial response (Phase E) goes inside. inner_dom_structure BOUNDED — the wrapper is a single div; rebuild may unify, but the Funnelback contents inside have their own contract. attribute_set TO_DETERMINE — whether id and class are required externally is open; if Phase C/E confirms no external consumer, this is OPEN.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Wrapper around full response; no truncation.

**Gaps:**

- Pin whether the id 'funnelback-search-container-response' has any external consumer (Squiz stencils main.js? Funnelback session-tracking script? T4 widget?) — A.3 captures showed only idle state, not populated; Phase C/E audits will resolve
- If id has no external consumer, the binding resolves to NOT_BINDING and rebuild can drop the id — but the class probably remains as a CSS hook


**Notes:** This wrapper is the single most-written FE-authored DOM element in the system (10 emission sites). The rebuild design's first major collapse opportunity is consolidating these 10 writers into one canonical dispatcher (which aligns with the CLAUDE.md note about collapsing the two performSearch implementations and the autocomplete-audit §12 lesson about minimal-handoff state across redirects). The wrapper's contract surface is small (id, class, single-child structure); most of the complexity is in what goes inside (Phase E).


---

### `search-error-block`

**Selector:** `#results .search-error`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page when fetch fails  
**Captured in:** not in standard captures; would require forcing a failure scenario

User-facing error message when a search or tab fetch fails. Replaces the search results display.

**Writer:** `MULTIPLE (4 sites)` · `performSearch error handler | loadTabContent error handler | enhancedPerformSearch error handler` · `integration.js:973-978; search-page-autocomplete.js:743-748; tabs-manager.js:382-388; tabs-manager.js:460-464`

Two text variants: 'Error Loading Results' (integration.js, search-page-autocomplete.js) and 'Error Loading Tab Content' (tabs-manager.js). Block replaces the entire results container's innerHTML when fetch fails — no funnelback-search-container-response wrapper in the error path.

```html
<div class="search-error"><h3>Error Loading Results</h3><p>${error.message}</p></div>
```

_tab-error:_
```html
<div class="search-error"><h3>Error Loading Tab Content</h3><p>${error.message}</p></div>
```

**Attributes:**

- `class` (`TO_DETERMINE`) — value: `search-error`. No FE reader. CSS hook plausible (error-state styling). CSS audit pending.

**Consumers:**

- `CSS_INFERRED` — `N/A` — Error-state visual styling.


**Seam:**

Parent: `#results (or the container arg passed to performSearch)` (TO_DETERMINE).

Contract dependencies:

- Parent container must accept full innerHTML replacement
- Replaces the funnelback-search-container-response wrapper (the wrapper is not present in the error state) — Squiz stencils main.js script is NOT injected in the error path, so any state it would have set up is unavailable


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **OPEN** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **OPEN**

Error state has full latitude — the rebuild can completely redesign error UX. The current static h3+p structure is a minimal placeholder. Surfacing error.message directly to the user is a UX risk (may expose stack traces or internal details); rebuild should sanitize.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Static block; no iteration.

**Gaps:**

- Surfacing error.message directly is a UX risk — rebuild should sanitize before display


**Notes:** Distinct from the funnelback-search-container-response wrapper — the error block replaces the wrapper rather than living inside it. The two text variants ('Error Loading Results' vs 'Error Loading Tab Content') diverge by writer site, not by error type. Not captured in A.3 — would require forcing a failure scenario; flagged for a future deliberate-failure capture cycle if rebuild UX changes warrant.


---

### `results-loading-indicator`

**Selector:** `#results > .results-loading (appended, not replacing)`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page during search-page-autocomplete.js's performSearch (between fetch start and either success or error)  
**Captured in:** not in standard captures; would require slowing the network

Visual loading indicator displayed during search-page's local performSearch. Shows a spinner with 'Loading search results...' text. Appended into the results container alongside any existing content (does not replace).

**Writer:** `public/search-page-autocomplete.js` · `setLoadingState` · `752-774`

When isLoading=true and container does not already contain .results-loading, creates a <div class='results-loading'> via document.createElement, sets innerHTML to a spinner + loading-text template, and appendChild's it to the container. Also adds 'loading' class to the container itself. When isLoading=false, removes the .results-loading element via element.remove() and removes 'loading' class from container. Called from search-page-autocomplete.js's performSearch at lines 669 (set true) and 738/741 (set false on success/error).

```html
<div class="results-loading"><div class="spinner"></div><p>Loading search results...</p></div>
```

**Attributes:**

- `class (.results-loading)` (`REQUIRED`) — value: `results-loading`. Queried at search-page-autocomplete.js:756 (container.querySelector('.results-loading') as a presence check before appending) and 768 (querySelector for removal target). Required for the appendChild dedupe and removal logic.
- `class (.spinner)` (`TO_DETERMINE`) — value: `spinner`. No FE reader. CSS hook required for the visual spinner animation. CSS audit pending.

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:756, 768` — Dedupe and removal logic in setLoadingState.
- `CSS_INFERRED` — `N/A` — Spinner animation requires CSS — .spinner and .results-loading both need styling rules.


**Seam:**

Parent: `the results container passed to performSearch (typically #results)` (TO_DETERMINE).

Contract dependencies:

- Parent must accept appendChild without external consumers blocking the insertion
- Parent must persist between the loading-on call and loading-off call (no innerHTML wipe in between) — note that the success and error paths of performSearch DO innerHTML-wipe at lines 720 and 743, which would orphan any in-progress loading indicator. The setLoadingState(false) call at lines 738/741 happens AFTER the innerHTML write, so the .results-loading element has already been wiped and the querySelector('.results-loading') at line 768 returns null — making the removal call a no-op in those code paths. The 'loading' class removal at 772 still runs against the container itself


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **OPEN** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **OPEN** · `content_schema`: **OPEN**

Visual design is OPEN. class_names BOUNDED — .results-loading is required for the dedupe/removal logic in setLoadingState; rebuild can rename but must update both sides in lockstep.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Static block; one indicator per loading state.

**Gaps:**

- Per Vic 2026-05-12: loading indicator is intended-killed in production — JS write path (lines 752-774) remains live but visual is suppressed. Mechanism not pinned; CSS audit likely answers (probable `.results-loading { display: none }` or equivalent). Rebuild should remove both the JS write and the suppression rule.
- The setLoadingState(true) → setLoadingState(false) sequence has a structural quirk: the success/error paths innerHTML-wipe the container BEFORE calling setLoadingState(false), so the removal of the .results-loading element is a no-op. This is benign (the indicator is wiped along with everything else) but reflects loose ordering — flag for rebuild


**Notes:** Currently used only by search-page-autocomplete.js's performSearch. The other performSearch (integration.js:899) and the tabs-manager paths use container.classList.add('loading') without a visual spinner indicator. Three loading-state patterns across writers — rebuild's loading UX should consolidate. Per Vic, the visual indicator is intended-killed; rebuild target is no spinner, with the JS write path and the CSS suppression removed together.


---


## Tab group enhancements

FE-injected enhancements inside Funnelback-rendered tab groups. Single entry covering the mobile-only Show/Hide-Filters toggle button that `collapse-manager.js` inserts into each tab group via MutationObserver. Per Vic 2026-05-12, the button is mobile-only — it lets users collapse the tabs nav to reach results on narrow viewports. Finding F14 (SVG sprite source) bears on this entry.

### `tab-group-toggle-button`

**Selector:** `[data-tab-group-element="tab-list-nav"] previousSibling — button.tab-group__toggle`  
**Source layer:** `FE_DYNAMIC_INSERTION`  
**Appears on:** search page, mobile viewport only (per Vic 2026-05-12 — desktop renders the tabs nav fully and does not show the toggle)  
**Captured in:** not in standard captures; would surface in any search-page capture showing tab groups (but the four 2026-05-11 captures focused on autocomplete dropdown states, not the underlying results region)

Mobile-only Show/Hide-Filters control inserted into Funnelback-rendered tab groups. Lets mobile users collapse the tabs nav to reach the results directly (the tabs nav can occupy significant vertical space on narrow viewports). Toggles the visibility (display:none/'' plus aria-hidden true/false) of the tab list nav, and tracks expand/collapse events for analytics. Adds .tab-group__toggle--collapsed class to itself on collapse.

**Writer:** `public/js/modules/collapse-manager.js` · `addToggleButtonToTabGroup` · `208-262`

Creates a <button type='button' class='tab-group__toggle' aria-expanded='true'> via document.createElement, sets innerHTML to a multi-SVG-icon + text template (Show Filters / Hide Filters), inserts via tabListNav.parentNode.insertBefore(toggleButton, tabListNav) — i.e., as previousSibling of the tab-list-nav element. Adds 'data-toggle-initialized'='true' to the tab group to prevent double-init.

```html
<button type="button" class="tab-group__toggle" aria-expanded="true"><svg class="tab-group__icon tab-group__icon--closed"><use href="#add"></use></svg><svg class="tab-group__icon tab-group__icon--open"><use href="#subtract"></use></svg><span class="tab-group__text tab-group__text--show">Show Filters</span><span class="tab-group__text tab-group__text--hide">Hide Filters</span><span class="sr-only">Toggle filters visibility</span></button>
```

**Attributes:**

- `type` (`REQUIRED`) — value: `button`. Browser contract — without type=button, a <button> inside a form defaults to type=submit which would trigger form submission. Defensive default.
- `class (button)` (`TO_DETERMINE`) — value: `tab-group__toggle`. No FE reader for the base class; BEM naming pattern matches Funnelback/Squiz convention. CSS_INFERRED REQUIRED is the likely resolution. Note: 'tab-group__toggle--collapsed' modifier class is toggled by FE (line 244).
- `aria-expanded` (`REQUIRED`) — value: `boolean string, toggled (initial 'true')`. ARIA contract for disclosure pattern. Read at line 241 (toggle state check). Set at line 217 (initial), 243 (toggle).
- `class (.tab-group__icon)` (`TO_DETERMINE`) — value: `tab-group__icon tab-group__icon--closed | tab-group__icon tab-group__icon--open`. CSS hooks for icon swap (open icon shown when collapsed; closed icon shown when expanded — the BEM naming may seem inverted, but the --closed icon (#add / plus sign) is shown when content is closed, encouraging expand). CSS audit pending.
- `href (svg use)` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `#add | #subtract`. SVG sprite reference — refers to <symbol id='add'> and <symbol id='subtract'> elements that must be defined elsewhere in the document (typically T4 PageLayout's SVG sprite sheet or an inline <svg style='display:none'> sprite at the top of the body). If the sprite is missing, the icons render blank. The sprite source is a Phase D (T4 PageLayout) or Phase E (Funnelback partial) seam dependency.
- `class (.tab-group__text)` (`TO_DETERMINE`) — value: `tab-group__text tab-group__text--show | tab-group__text tab-group__text--hide`. CSS hooks for show/hide text swap based on expanded state. CSS audit pending.
- `class (.sr-only)` (`REQUIRED`) — value: `sr-only`. Screen-reader-only text contract — .sr-only is the standard class to visually hide content while keeping it accessible. Required for ASSISTIVE_TECH consumers. CSS rule for .sr-only must exist in the stylesheet (T4 PageLayout or Squiz theme); if absent, the 'Toggle filters visibility' text would be visually displayed alongside the show/hide texts. CSS audit pending will pin the rule.

**Consumers:**

- `IN_REPO_FE` — `public/js/modules/collapse-manager.js:240-258` — Click handler bound on the button — reads aria-expanded, toggles aria-expanded, toggles .tab-group__toggle--collapsed class, sets/clears tab-list-nav display, sets tab-list-nav aria-hidden, calls trackTabGroupEvent.
- `ASSISTIVE_TECH_INFERRED` — `N/A` — aria-expanded disclosure contract; .sr-only text.
- `CSS_INFERRED` — `N/A` — .tab-group__toggle base styling; --collapsed modifier; icon and text swap rules.


**Seam:**

Parent: `tab-list-nav's parentNode (a Funnelback-rendered tab group container)` (FUNNELBACK_PARTIAL).

Contract dependencies:

- [data-tab-group-element='tab-list-nav'] must exist as a descendant of a [role='tablist']-bearing tab group container (verified via line 232 querySelector)
- The tab-list-nav element must have a parentNode that accepts insertBefore at the previousSibling position
- An <svg> sprite or inline definition for <symbol id='add'> and <symbol id='subtract'> must exist somewhere in the document (likely T4 PageLayout's SVG sprite sheet) — Phase D and/or Phase E will confirm
- A CSS rule for .sr-only must exist (T4 PageLayout or Squiz theme stylesheet)


**Design latitude:**

`visual_appearance`: **OPEN** · `class_names`: **BOUNDED** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **FIXED** · `attribute_set`: **BOUNDED** · `content_schema`: **FIXED**

click_mechanism FIXED — <button type=button> with aria-expanded disclosure pattern is the right primitive; rebuild may swap implementation details but the pattern is binding. inner_dom_structure BOUNDED — the button must contain something user-discoverable (icons or text); the specific Show Filters / Hide Filters strings are content_schema FIXED for the current copy but the rebuild can change wording. class_names BOUNDED — the --collapsed modifier class is consumed by the FE's classList.toggle at line 244, so the rebuild must keep both sides in lockstep. attribute_set BOUNDED — aria-expanded REQUIRED, type=button REQUIRED, base class TO_DETERMINE pending CSS audit.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. One toggle button per tab group; iteration is per tab-group, not per item.

**Gaps:**

- SVG sprite source — per Finding F14, NOT in T4 PageLayout's captured header chrome. Most likely Funnelback partial response (Phase E) or inline body sprite. Phase D or E pins.
- .sr-only class CSS rule — where defined? CSS audit pending
- Trigger mechanism for mobile-only behavior: likely a CSS media query hiding the always-rendered button on desktop, or a JS viewport check. Per Vic 2026-05-12 we accepted 'mobile-only, trigger mechanism TBD' without verifying via Claude Code; flagged for CSS audit or rebuild-design pass.
- Whether tab groups appear on all search-page tabs or only some (e.g., facets sidebar specifically) — the addToggleButtonToTabGroup is called from the collapse-manager's initialize and from the MutationObserver in handleDomChanges; the trigger condition is presence of '[data-tab-group-element="tab-list-nav"]'


**Notes:** Per the tabs-manager audit, the FE never invokes destroy() on per-feature managers, so the toggle button persists for the page's lifetime and gets re-bound on Funnelback content re-renders via the M1 MutationObserver in core-search-manager.js. The data-toggle-initialized guard at line 209/261 prevents double-binding. Per Vic 2026-05-12, this is a mobile-only feature — the button lets mobile users hide the tabs nav and go direct to results, addressing a real-estate-on-small-screens UX concern that doesn't apply on desktop.


---


## Cross-cutting findings

Fourteen findings emerged from A.2 static analysis (F1-F7) and A.3 capture-driven discoveries (F8-F14). Each is recorded with evidence and implication; rebuild design decisions are explicitly deferred per the stop rules. Findings that directly contradict A.2 reads (notably F8 contradicting A.2's writer-file claim for `header-suggestions-container`) are recorded as supersedes-by-capture, with the corresponding entry's writer field updated to reflect captured reality.

### F1 — FE has NO render caps on suggestion rendering

**Evidence.** renderHeaderSuggestions (integration.js:601-624) iterates suggestions.forEach over all items. renderResultsPageSuggestions (search-page-autocomplete.js:354-502) uses .map().join() over all general, staff, and programResults items. Neither function slices or limits the array.

**Implication.** The visible 10/5/5 caps observed in Captures 2/3 and the 10-cap in Capture 4 are NOT FE-side render truncation. Per Finding F13 (A.4 capture-driven), the cap source is upstream and pinned to the on-page input's data-max-results="10" attribute (Capture 1) — Squiz Typeahead / stencils main.js presumably passes this to Funnelback as the show=N param. The brief's render_cap.value placeholders for header/general/staff/program items are revised to null with truncation_location=N/A; the cap is captured as an UPSTREAM_CONTRACT cross-cutting finding (F13) rather than an FE attribute. Phase B (FE external-contract consumption) should map the suggestions API request params to confirm.



### F2 — FE writes the #funnelback-search-container-response wrapper from 10 sites

**Evidence.** Five success sites (integration.js:956, search-page-autocomplete.js:311 displayPreRenderedResults, search-page-autocomplete.js:720 performSearch, core-search-manager.js:558 updateResults, tabs-manager.js:372 loadTabContent, tabs-manager.js:442 enhancedPerformSearch) plus five error sites (integration.js:973, search-page-autocomplete.js:743, tabs-manager.js:382, tabs-manager.js:460, plus the success-path error fallback). The wrapper structure is byte-identical across all five success sites: <div id="funnelback-search-container-response" class="funnelback-search-container">${html}</div>.

**Implication.** Resolves the Phase A brief's 'pending A.2 confirmation' for this entry: it IS FE-authored, not Funnelback-emitted. The Funnelback partial response HTML is inserted INSIDE this wrapper. Five FE sites write the wrapper, with two text variants for error states ('Error Loading Results' vs 'Error Loading Tab Content'). Rebuild collapses to one wrapper writer.



### F3 — data-index attribute is VESTIGIAL_CANDIDATE — zero consumers across in-scope files

**Evidence.** grep for dataset.index, getAttribute('data-index'), [data-index] across integration.js, search-page-autocomplete.js, SessionService.js, search-index.js, core-search-manager.js, and the six per-feature managers: zero reads. Keyboard navigation in addKeyboardNavigation (search-page-autocomplete.js:868-1066) uses Array.from(items).indexOf(activeItem) for position tracking (lines 964, 982, 1013, 1048), not data-index. Click handlers (integration.js:627-629, search-page-autocomplete.js:506-511) do not read data-index.

**Implication.** Confirms the Phase A brief's VESTIGIAL_CANDIDATE expectation. The attribute is emitted on every suggestion-item across header and on-page consumers (integration.js:615, search-page-autocomplete.js:389, 408, 468) but has no in-repo reader and no external behavioral consumer documented. The rebuild can drop data-index, but the design decision is deferred to the rebuild design phase per Phase A stop rules.



### F4 — Search-page keyboard navigation is structurally dead due to selector typo

**Evidence.** search-page-autocomplete.js:908 gates the keydown handler with `container.hidden || container.querySelector(".suggestions-item") === null` — but the emitted class is `.suggestion-item` (singular, no terminal 's'). The misspelled query always returns null, so the OR's second clause is always true, so the handler always returns early. Verified across all FE emission sites: integration.js:615, search-page-autocomplete.js:389, 408, 468 all use `.suggestion-item` singular. No emission of `.suggestions-item` (plural) anywhere in public/.

**Implication.** Keyboard arrow-key navigation on the search-page on-page dropdown does not work in current production. The Enter-key shortcut path inside the handler (line 930-934) is also never reached. Per Vic 2026-05-12: the typo is a bug; the rebuild MUST fix it (selector .suggestions-item → .suggestion-item). The selector contract on .suggestion-item is therefore REQUIRED, not REQUIRED-for-dead-code. Active-state class .active emission and keyboard-nav DOM walking become live behavior in the rebuild. The keyboard-nav-related REQUIRED bindings on .suggestion-item across general/staff/program items remain unqualified REQUIRED — the typo-fix is the rebuild's responsibility, not a contract revision.



### F5 — Two distinct synonymous class assignments in staff card emission

**Evidence.** search-page-autocomplete.js:430 emits <span class="staff-role">${person.position}</span> and search-page-autocomplete.js:435 emits <span class="staff-role">${person.affiliation}</span> — same class for two semantically distinct slots. Similarly lines 440 and 445 emit <span class="staff-department"> for both person.department and person.college.

**Implication.** Two CSS class names each carry two semantic slots. The click handler at search-page-autocomplete.js:515-516 reads only the FIRST .staff-role and .staff-department it finds (via .querySelector singular), so the affiliation/college variants get DOM presence but not click-handler consumption. For the rebuild, the data contract has six distinct semantic slots (photo, title, position, affiliation, department, college) collapsed onto four DOM classes. content_schema BOUNDED reflects this collapse.



### F6 — Pre-render display path is a third FE consumer of the search-results wrapper

**Evidence.** displayPreRenderedResults (search-page-autocomplete.js:290-351) writes the funnelback-search-container-response wrapper at line 311-315 with pre-rendered HTML from sessionStorage handoff. This is structurally identical to the live performSearch write (line 720-724), differing only in source of the html string. The function is exposed globally at line 1133-1134 for integration.js's processUrlParameters consumer.

**Implication.** The wrapper is written from three distinct FE paths per page session: (1) header redirect → search page load → processUrlParameters → displayPreRenderedResults (instant) or fallback performSearch from search-page-autocomplete.js, (2) on-page input → handleInput debounce → search-page-autocomplete.js's performSearch, (3) tab clicks → tabs-manager's loadTabContent or enhancedPerformSearch. Plus core-search-manager.js's updateResults method, which is invoked via window.SearchManager.updateResults from displayPreRenderedResults at line 326-328. The wrapper writer surface is more diffuse than CLAUDE.md's framing suggests.



### F7 — Header dropdown emits suggestion-item without data-type or data-url; on-page general column emits with data-type="general" but no data-url

**Evidence.** Header (integration.js:615): <div class="suggestion-item" role="option" data-index="${index}"><span class="suggestion-text">${display}</span></div>. On-page general (search-page-autocomplete.js:389): <div class="suggestion-item" role="option" data-index="${index}" data-type="general"><span class="suggestion-text">${display}</span></div>. On-page staff (search-page-autocomplete.js:408) and program (search-page-autocomplete.js:468) emit both data-type and data-url plus anchor wrapping.

**Implication.** Three semantically distinct suggestion-item shapes: (a) header (no data-type, no data-url, no anchor), (b) on-page general (data-type=general, no data-url, no anchor), (c) on-page staff/program (data-type=staff|program, data-url=URL, anchor-wrapped target=_blank). Per Finding 3 (2026-05-11 session), this click-mechanism asymmetry is binding for the rebuild: native middle-click/cmd-click navigation on staff/program requires the anchor-wrapping pattern; general items use pure JS click. Header is purely pure-JS-click.



### F8 — #header-suggestions pre-exists at FE lookup time; integration.js create branch is dead in production

**Evidence.** Capture 5 (non-search-page idle) shows <div id="header-suggestions" class="header-suggestions-container" hidden=""></div> already present in the DOM at idle, sitting inside <form id="searchForm"> between #search-input and the hidden submit button. integration.js's findSearchComponents (line 268-280) guards createElement with `if (!headerSuggestionsContainer)` — the existing element is found, so the create branch (which would set role=listbox at line 272 and insertBefore at line 282) never executes. The reuse branch at line 281-284 takes the existing element as-is.

**Implication.** The container's actual create site is NOT integration.js. Likely candidates per Vic 2026-05-12: the PageLayout-emitted Squiz Typeahead bundle (which creates dropdown DOM as part of binding to inputs), or a Squiz-side init script. Source layer for #header-suggestions stays FE_DYNAMIC_INSERTION at the code level (PageLayout's <script> imports are FE-controlled), but the writer field reflects A.2 read superseded by capture. Pinning the actual production create site is a rebuild-design follow-up rather than a Phase A gap — Phase A's stop rules limit static analysis to the four HTML-loaded scripts + managers; Typeahead and Squiz init scripts are out of that scope.



### F9 — #header-suggestions lacks role="listbox" in production; ARIA contract dead

**Evidence.** Captures 4 and 5 both show #header-suggestions WITHOUT a role attribute. The setAttribute('role', 'listbox') call A.2 attributed to integration.js:272 lives in the create branch (per F8), which never fires. The container's emitted shape in both idle and populated states is <div id="header-suggestions" class="header-suggestions-container" [hidden]>...</div> — no role, no aria-labelledby.

**Implication.** The header dropdown's role="option" children (per F7, each .suggestion-item) are orphan options without a listbox container. Screen readers will not announce the dropdown as a listbox structure. Compare the on-page dropdown which has #autocomplete-suggestions with role="listbox" + aria-labelledby="autocomplete-concierge-label" (captured), correctly wired. Cross-cutting Finding F12 records the header-vs-on-page ARIA asymmetry as a single observation. The rebuild should fix; Phase A records the contract surface (current production has no role) without prescribing the fix.



### F10 — On-page input does NOT emit data-form attribute

**Evidence.** Capture 1 shows the captured #autocomplete-concierge-inputField with: type, id, name, class, autocomplete, spellcheck, autofocus, data-autocomplete, data-collection, data-profile, data-max-results, data-min-length, data-results-container. No data-form attribute. A.2's behavioral_consumers.squiz-stencils-main-js.presumed_consumed_attributes list included data-form.

**Implication.** data-form removed from the behavioral_consumers presumed-consumed list (meta update). Either Squiz stencils main.js defaults data-form internally to 'default' or the attribute is unused on this template. Phase C resolves by inspecting main.js. The data-form question is specifically queued as a Phase C gap in _seam_autocomplete-concierge-inputField's notes.



### F11 — On-page input data-results-container="results" routes to search-results container, not the autocomplete dropdown

**Evidence.** Capture 1 shows data-results-container="results" — the unprefixed string "results", which by Squiz stencils convention is treated as an element ID. That points at #results (the search-results container) rather than at #autocomplete-suggestions (the autocomplete dropdown). Vic confirmed (2026-05-12) that Squiz's Typeahead is doing something in production, which closes the previous uncertainty about whether the data-* attributes are vestigial.

**Implication.** Two readings remain open: (a) Squiz stencils main.js / Typeahead consumes data-results-container to route SEARCH-results output (not autocomplete output) to #results — running a parallel/alternative search pipeline; (b) the attribute is consumed for a different purpose entirely (form-submit redirect target, debug routing). Either way, the data-* set on the input remains EXTERNAL_CONSUMER_REQUIRED per 2026-05-11 Finding 1, with Phase C resolving the actual consumer behavior.



### F12 — ARIA chain asymmetry between header and on-page dropdowns

**Evidence.** Captured surface contrast:
  HEADER: <input id="search-input" type="text"> + <label for="search-input" hidden>Search</label> (hidden attribute removes label from a11y tree) + <div id="header-suggestions" class="header-suggestions-container"> (no role, no aria-*) + .suggestion-item children with role="option".
  ON-PAGE: <input id="autocomplete-concierge-inputField" type="search"> + <label id="autocomplete-concierge-label" for="autocomplete-concierge-inputField" class="sr-only" aria-live="polite"> (visually hidden via sr-only, kept in a11y tree) + <div id="autocomplete-suggestions" role="listbox" aria-labelledby="autocomplete-concierge-label" hidden> + .suggestion-item children with role="option".

**Implication.** On-page dropdown is correctly wired as an ARIA listbox with labelled options. Header dropdown emits role="option" children orphaned from any listbox container, and the input's label is removed from the a11y tree by the HTML `hidden` attribute (vs sr-only which keeps it). Two distinct ARIA defects on the header side. Rebuild should unify: role="combobox" or wrapper / role="listbox" on container / aria-controls / aria-expanded / sr-only label class. Phase A records the captured contract; rebuild design decides remediation.



### F13 — Upstream render cap is 10 — sourced from on-page input's data-max-results attribute

**Evidence.** Capture 1 shows <input ... data-max-results="10">. Capture 2/3 shows the on-page dropdown rendering 10 general items, 5 staff items, 5 program items for query "computer" — general column hits the cap, staff and programs fall short of it. Capture 4 shows 10 general items in the header dropdown for query "biology" — the same cap appears to govern the header consumer's general response. The 9/6/6 figure in A.2 Finding F1 (from the 2026-05-11 UX capture) reflects per-query response size for a different query, not a different cap.

**Implication.** Updates F1's implication: the upstream cap source is concretely data-max-results="10" on the on-page input, which Squiz stencils main.js / Typeahead presumably passes through to the Funnelback suggestions endpoint as the show=N param. Whether the header consumer reads the same attribute (the header input lacks data-max-results — visible in Capture 5) or hardcodes its own cap is open; the observed 10-cap for header could be a Funnelback endpoint default. Phase B (FE external-contract consumption) maps the API call params to confirm.



### F14 — SVG sprite definitions (#add, #subtract) NOT in the captured header chrome

**Evidence.** Capture 5 covers the full <header class="site-header site-header--at-top"> element including the site-search panel, search form, and #header-suggestions. No <symbol id="add"> or <symbol id="subtract"> definitions are visible. The collapse-manager.js tab-group toggle button references these via <use href="#add"> / <use href="#subtract">.

**Implication.** Resolves the _seam_svg-sprite-symbols skeleton entry's source-layer hypothesis: NOT in T4 PageLayout's header chrome. The sprite definitions must live in the page body — most likely candidates: (a) inline at the top of <body> as a hidden <svg> sprite sheet (common Squiz convention), (b) inside the Funnelback partial response (Phase E territory), (c) somewhere else in T4 PageLayout body region not captured here. Phase D or E captures will pin. The tab-group toggle button's icon contract is therefore confirmed to be a cross-layer dependency whose source must be identified before the rebuild can confidently emit the toggle button.




## Seam dependencies (deferred to later phases)

Eight seam-skeleton entries enumerate the parent containers and external elements the FE-authored HTML depends on. Each is labeled with its source layer and the Phase that owns full treatment. Where Captures 1 and 5 provided real attribute data, the entries are capture-confirmed; otherwise the `literal_html` is `TO_CAPTURE` and the gaps point at the owning Phase. The two net-new seam entries (`_seam_header-form` and `_seam_site-search-button-toggle`) were surfaced by Capture 5 and not predicted by A.2; they hand off to Phase D for full treatment but already carry capture-confirmed attribute data here.

### `_seam_search-input`

**Selector:** `#search-input`  
**Source layer:** `T4_PAGELAYOUT`  
**Appears on:** all pages where T4 PageLayout renders the header bar  
**Captured in:** non-search-idle (Capture 5) — confirmed

Header search input. Triggers header autocomplete (debounced suggestions fetch + prefetch fetch).

**Writer:** `EXTERNAL — T4 PageLayout template (out of repo)` · `N/A` · `N/A`

TO_CAPTURE in Phase D

```html
<input id="search-input" class="sq-search" name="query" type="text">
```

**Attributes:**

- `id` (`REQUIRED`) — value: `search-input`. Queried at integration.js:255, 633 (primary header input reference); SessionService.js:1065 (session-restoration on header form submit).
- `class` (`TO_DETERMINE`) — value: `sq-search`. No FE reader. Likely Squiz CSS hook (sq-search naming convention matches Squiz framework). CSS audit pending.
- `name` (`REQUIRED`) — value: `query`. Form-submission parameter name. Matches the on-page input's name=query and the URL parameter ?query= consumed by search-page logic. Form submits to https://su-search-dev.vercel.app/search-test (per parent form's action attribute, Capture 5).
- `type` (`TO_DETERMINE`) — value: `text`. Contrast with on-page input's type="search" (which adds browser-native X clear button affordance). Probably not contract-binding but worth noting. Rebuild may unify both inputs to type="search" for consistency.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:255, 633` — getElementById('search-input') — primary header input reference.
- `IN_REPO_FE` — `public/js/SessionService.js:1065` — getElementById('search-input') for session-restoration on header form submit.


**Seam:**

Parent: `form#searchForm (captured in Capture 5)` (T4_PAGELAYOUT).

Contract dependencies:

- Sibling of #header-suggestions and the hidden #search-button inside form#searchForm
- Phase D captures the form's parent chain (site-header > site-header__sticky-container > grid-container > ... > div.site-search > div.search-block-form > div[data-resultsurl] > form#searchForm)


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **TO_DETERMINE** · `click_mechanism`: **TO_DETERMINE** · `attribute_set`: **TO_DETERMINE** · `content_schema`: **TO_DETERMINE**

Full entry deferred to Phase D (T4 PageLayout contract surface).

**Render cap:** no FE-side truncation. Truncation location: `N/A`. N/A — input element, not iteration.

**Gaps:**

- Full Phase D capture of the surrounding header chrome is materially complete via Capture 5; Phase D's deliverable folds in


**Notes:** Skeleton entry promoted to capture-confirmed via Capture 5. Phase A depends on the input as a seam parent for #header-suggestions (integration.js's findSearchComponents queries it). Full Phase D treatment of the header chrome can proceed from Capture 5's outerHTML.


---

### `_seam_autocomplete-concierge-inputField`

**Selector:** `#autocomplete-concierge-inputField`  
**Source layer:** `SQUIZ_STENCILS_BOILERPLATE`  
**Appears on:** search results page  
**Captured in:** search-initial (Capture 1) — confirmed

On-page search input on the search results page. Triggers on-page autocomplete (debounced suggestions fetch) and on-page search submit.

**Writer:** `EXTERNAL — Squiz stencils template inside Funnelback partial response (out of repo)` · `N/A` · `N/A`

TO_CAPTURE in Phase C

```html
<input type="search" id="autocomplete-concierge-inputField" name="query" class="on-page-sq-search" autocomplete="off" spellcheck="false" autofocus="" data-autocomplete="" data-collection="seattleu~sp-search" data-profile="_default" data-max-results="10" data-min-length="3" data-results-container="results">
```

**Attributes:**

- `id` (`REQUIRED`) — value: `autocomplete-concierge-inputField`. Queried at integration.js:288, search-page-autocomplete.js:528, 878, 1085, spelling-manager.js:28 — multiple FE consumers. Also referenced as the for= target of #autocomplete-concierge-label.
- `type` (`TO_DETERMINE`) — value: `search`. Contrast with header #search-input's type="text". HTML5 search type adds X clear button. Rebuild may unify.
- `name` (`REQUIRED`) — value: `query`. Form-submission parameter name; matches header form's input name. URL ?query= parameter.
- `class` (`TO_DETERMINE`) — value: `on-page-sq-search`. Likely Squiz CSS hook. CSS audit pending.
- `autocomplete` (`REQUIRED`) — value: `off`. Disables browser-native autocomplete to prevent collision with the FE/Squiz autocomplete dropdown.
- `spellcheck` (`TO_DETERMINE`) — value: `false`. Disables spellcheck UI. Likely UX preference; rebuild may keep or drop.
- `autofocus` (`TO_DETERMINE`) — value: `(boolean attribute, present)`. Input autofocuses on page load. May conflict with deep-link flows or accessibility preferences; rebuild design may revisit.
- `data-autocomplete` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `(empty string)`. Per Finding F11, Squiz Typeahead and/or stencils main.js consumes. Empty value likely boolean-presence semantic.
- `data-collection` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `seattleu~sp-search`. Funnelback collection identifier. Consumed by Squiz autocomplete pathway (Typeahead and/or main.js) for the suggestions endpoint config.
- `data-profile` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `_default`. Funnelback profile identifier.
- `data-max-results` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `10`. Per Finding F13, this is the upstream render cap source. Captured 10-item general column for "computer" query confirms.
- `data-min-length` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `3`. Minimum query length before autocomplete fires. Likely Typeahead/stencils config.
- `data-results-container` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `results`. Per Finding F11, the unprefixed value 'results' points at element #results (the search-results container, not the autocomplete dropdown). Phase C investigates whether Squiz consumes this to route output.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:288-296` — Results-page input detection in findSearchComponents.
- `IN_REPO_FE` — `public/search-page-autocomplete.js:528, 878, 1085` — Click-handler input-value setter, keyboard-nav listener target, DOMContentLoaded init.
- `IN_REPO_FE` — `public/js/modules/spelling-manager.js:28` — Search input reference for spelling-suggestion logic.
- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `see meta.behavioral_consumers.squiz-stencils-main-js` — Reads data-* attributes for autocomplete config.


**Seam:**

Parent: `form#concierge-search-form (captured in Capture 1)` (SQUIZ_STENCILS_BOILERPLATE).

Contract dependencies:

- Per Capture 1: input sits inside form#concierge-search-form (method=GET, action=""), alongside the .search-config hidden inputs (collection, profile, f.Tabs|programMain, f.Tabs|seattleu~ds-staff), the visible label #autocomplete-concierge-label, the search-controls (.search-submit-button), and #autocomplete-suggestions
- form#concierge-search-form's class is autocomplete-concierge__form — BEM naming pattern suggesting Squiz convention
- Phase C captures the full concierge-search-form cluster


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **TO_DETERMINE** · `click_mechanism`: **TO_DETERMINE** · `attribute_set`: **BOUNDED** · `content_schema`: **TO_DETERMINE**

attribute_set BOUNDED — the data-* configuration attributes are EXTERNAL_CONSUMER_REQUIRED; full enumeration is Phase C.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Input element.

**Gaps:**

- data-form attribute: A.2 presumed this was emitted but Capture 1 shows it's NOT. Per Finding F10, removed from behavioral_consumers list. Phase C resolves whether main.js defaults internally or the attribute is unused.
- Whether Squiz Typeahead, stencils main.js, both, or neither consume the data-* attributes in production — Phase C investigation per Finding F11.


**Notes:** Skeleton entry promoted to capture-confirmed via Capture 1. The data-* attribute set is the canonical example of the 'reactive accretion masquerading as design' inversion — what looked vestigial from FE-scope analysis is actually a load-bearing external contract (per 2026-05-11 Finding 1, reinforced by Vic's 2026-05-12 confirmation that Typeahead is doing something). The specific consumer behavior is Phase C territory.


---

### `_seam_autocomplete-suggestions`

**Selector:** `#autocomplete-suggestions`  
**Source layer:** `SQUIZ_STENCILS_BOILERPLATE`  
**Appears on:** search results page  
**Captured in:** search-initial (Capture 1), search-on-page-dropdown-all-columns (Capture 2/3) — confirmed

On-page autocomplete dropdown container. Receives FE-authored innerHTML writes from renderResultsPageSuggestions (search-page-autocomplete.js:501).

**Writer:** `EXTERNAL — Squiz stencils template (out of repo)` · `N/A` · `N/A`

TO_CAPTURE in Phase C

```html
TO_CAPTURE in Phase C
```

_idle (Capture 1):_
```html
<div id="autocomplete-suggestions" class="autocomplete-concierge__results" role="listbox" aria-labelledby="autocomplete-concierge-label" hidden=""></div>
```

_populated (Capture 2/3):_
```html
<div id="autocomplete-suggestions" class="autocomplete-concierge__results" role="listbox" aria-labelledby="autocomplete-concierge-label">{ .suggestions-list with .suggestions-columns and three .suggestions-column children }</div>
```

**Attributes:**

- `id` (`REQUIRED`) — value: `autocomplete-suggestions`. Queried at integration.js:294, search-page-autocomplete.js:1088; presumed Squiz consumer via the input's data-results-container attribute (but per Finding F11, that attribute points at "results" not "#autocomplete-suggestions" — so the Squiz pathway may NOT target this container).
- `class` (`TO_DETERMINE`) — value: `autocomplete-concierge__results`. BEM naming pattern matching .autocomplete-concierge__form on the parent form. Likely Squiz CSS hook.
- `role` (`REQUIRED`) — value: `listbox`. ARIA contract — paired with role="option" on .suggestion-item children. Captured in both idle and populated states. ASSISTIVE_TECH_INFERRED consumer. Compare to header dropdown which lacks this attribute (Finding F9).
- `aria-labelledby` (`REQUIRED`) — value: `autocomplete-concierge-label`. ARIA chain — labels the listbox using the sr-only label element. Captured. ASSISTIVE_TECH_INFERRED consumer.
- `hidden` (`REQUIRED`) — value: `boolean attribute, toggled (presence on idle/empty; absence on populated)`. Visibility-state mechanism set by search-page-autocomplete.js's render functions. Captured: Capture 1 (idle) has hidden="", Capture 2/3 (populated) has no hidden attribute.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:294` — findSearchComponents results-side suggestions container reference.
- `IN_REPO_FE` — `public/search-page-autocomplete.js:1088, 311, 371, 501, 539, 659, 938, 1104, 1122` — Container reference, innerHTML clear/write target across renderResultsPageSuggestions, fetchSuggestions, displayPreRenderedResults, keyboard escape, debounce-handler clears.


**Seam:**

Parent: `TO_CAPTURE (Phase C — search controls / concierge-search-form parent cluster)` (SQUIZ_STENCILS_BOILERPLATE).

Contract dependencies:

- Container must exist at search-page-autocomplete.js DOMContentLoaded time
- Must accept full innerHTML replacement


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **FIXED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **TO_DETERMINE** · `content_schema`: **FIXED**

Container is Phase C; the CONTENTS (.suggestions-list etc.) are FE-authored Phase A entries. inner_dom_structure FIXED for the container shape; OPEN for the contents (per the Phase A entries above).

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Container.

**Gaps:**

- The role="listbox" attribute is captured as present — resolves the A.2 gap about whether the container had this attribute. Phase C confirms whether it's emitted by Squiz template or set by an external script.


**Notes:** Skeleton seam entry promoted to capture-confirmed via Captures 1 and 2/3. The container is correctly ARIA-wired as a listbox — contrast with header dropdown's missing role attribute (Finding F9). The CONTENTS (.suggestions-list etc.) are FE-authored Phase A entries; the container itself is Phase C.


---

### `_seam_results-container`

**Selector:** `#results`  
**Source layer:** `TO_DETERMINE (likely SQUIZ_STENCILS_BOILERPLATE, but pending Phase C confirmation)`  
**Appears on:** search results page  
**Captured in:** search-initial (Capture 1) — confirmed empty at idle

Top-level search-results container. Parent of the FE-authored funnelback-search-container-response wrapper.

**Writer:** `EXTERNAL` · `N/A` · `N/A`

TO_CAPTURE in Phase C or D

```html
TO_CAPTURE
```

_idle (Capture 1):_
```html
<div id="results"></div>
```

_populated_search (per Phase A entry funnelback-search-container-response-wrapper):_
```html
<div id="results"><div id="funnelback-search-container-response" class="funnelback-search-container">{ Funnelback partial response — Phase E }</div></div>
```

**Attributes:**

- `id` (`REQUIRED`) — value: `results`. Queried at search-page-autocomplete.js:300, 548, 562; integration.js:293; tabs-manager.js:353, 366, 379, 391, 418; all the per-feature managers' getElementById('results') for their core reference. Also referenced via core-search-manager.js's resultsContainerSelector config '#results' (set in search-index.js:32). Also potentially the target of the on-page input's data-results-container="results" (per Finding F11).

**Consumers:**

- `IN_REPO_FE` — `MULTIPLE — see structural_role consumers list:see above` — innerHTML write target across ~10 sites. Reference target across all six per-feature managers.


**Seam:**

Parent: `form#concierge-search-form (captured in Capture 1 — sits OUTSIDE the form? Let Phase C confirm exact position)` (SQUIZ_STENCILS_BOILERPLATE).

Contract dependencies:

- Per Capture 1: #results is empty at idle (<div id="results"></div>), positioned somewhere relative to form#concierge-search-form. The DOM extract didn't include the parent ancestry between #results and the body, so the exact position is Phase C territory.
- Must exist before any FE script attempts innerHTML write (verified — present at idle in Capture 1)
- Must accept full innerHTML replacement


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **BOUNDED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **TO_DETERMINE** · `content_schema`: **FIXED**

inner_dom_structure BOUNDED — contents are the FE-authored funnelback-search-container-response wrapper (Phase A entry above); the container shape itself is Phase C/D.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Container.

**Gaps:**

- Exact position of #results relative to form#concierge-search-form — Capture 1 captured the form cluster and #results separately; their relative positioning in the page is Phase C-clarifies.


**Notes:** Skeleton seam entry capture-confirmed for the empty/idle state. The FE-authored funnelback-search-container-response wrapper goes inside this container; the parent #results is the seam. Per Finding F11, this container is also the apparent target of the on-page input's data-results-container="results" — which may mean Squiz autocomplete writes here too (collision territory for Phase C).


---

### `_seam_svg-sprite-symbols`

**Selector:** `<symbol id="add"> and <symbol id="subtract"> (referenced via <use href="#add"> and <use href="#subtract">)`  
**Source layer:** `TO_DETERMINE (likely T4_PAGELAYOUT, but pending Phase D confirmation)`  
**Appears on:** TO_CAPTURE  
**Captured in:** TO_CAPTURE (would surface in any full-page outerHTML capture, but the four 2026-05-11 captures focused on autocomplete regions only)

SVG sprite definitions referenced by the tab-group toggle button's icons (#add for collapsed state, #subtract for expanded state).

**Writer:** `EXTERNAL` · `N/A` · `N/A`

TO_CAPTURE in Phase D (or Phase E if Funnelback partial defines them)

```html
TO_CAPTURE
```

**Attributes:**

- `id (symbols)` (`REQUIRED`) — value: `add | subtract`. Referenced via <use href='#add'> and <use href='#subtract'> at collapse-manager.js:221, 224. The toggle button icons depend on these symbols existing in the document scope.

**Consumers:**

- `IN_REPO_FE` — `public/js/modules/collapse-manager.js:221, 224` — SVG sprite reference in tab-group toggle button HTML.


**Seam:**

Parent: `TO_CAPTURE (likely an inline <svg style='display:none'> sprite sheet at the top of <body> per common practice)` (TO_DETERMINE).

Contract dependencies:

- Symbol definitions must exist somewhere in the document at the time the tab-group toggle button is rendered (collapse-manager initialization, post-Funnelback-content-load)


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **TO_DETERMINE** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **BOUNDED** · `content_schema`: **TO_DETERMINE**

Full latitude pending Phase D capture. The rebuild may swap to inline icons, emoji, or icon-font glyphs — but if it keeps the SVG sprite pattern, the symbol IDs '#add' and '#subtract' are REQUIRED unless collapse-manager is changed in lockstep.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. Static sprite definitions.

**Gaps:**

- Source layer pending Phase D capture
- Whether the sprite is defined inline in body, inline in head, or loaded from an external SVG file via <use href='external.svg#add'> — collapse-manager uses the local-fragment form '#add' which requires same-document definitions


**Notes:** Skeleton seam entry. If Phase D shows the sprite is in T4 PageLayout, the tab-group toggle button's icon contract is a cross-layer dependency that the rebuild must coordinate on.


---

### `_seam_data-tab-group-element-tab-list-nav`

**Selector:** `[data-tab-group-element="tab-list-nav"]`  
**Source layer:** `FUNNELBACK_PARTIAL`  
**Appears on:** search results page  
**Captured in:** TO_CAPTURE

Tab list navigation container inside a Funnelback-rendered tab group. Parent of the FE-emitted tab-group-toggle-button (inserted as previousSibling).

**Writer:** `EXTERNAL — Squiz FTL templates rendering Funnelback tabs (out of repo)` · `N/A` · `N/A`

TO_CAPTURE in Phase E

```html
TO_CAPTURE in Phase E
```

**Attributes:**

- `data-tab-group-element` (`REQUIRED`) — value: `tab-list-nav`. Queried at collapse-manager.js:232 (tabGroup.querySelector('[data-tab-group-element="tab-list-nav"]')) to find the insertion target for the toggle button. Also referenced indirectly via the broader tab group selector in core-search-manager's MutationObserver patterns.

**Consumers:**

- `IN_REPO_FE` — `public/js/modules/collapse-manager.js:232` — querySelector — finds the tab-list-nav element inside each tab group for toggle-button insertion.


**Seam:**

Parent: `TO_CAPTURE (Funnelback tab group container — Phase E)` (FUNNELBACK_PARTIAL).

Contract dependencies:

- TO_CAPTURE in Phase E


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **TO_DETERMINE** · `click_mechanism`: **TO_DETERMINE** · `attribute_set`: **BOUNDED** · `content_schema`: **TO_DETERMINE**

Full entry deferred to Phase E. The data-tab-group-element='tab-list-nav' attribute is REQUIRED for the FE's toggle-button-injection contract.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. N/A.

**Gaps:**

- Full Phase E capture pending


**Notes:** Skeleton seam entry. The tab-group-toggle-button entry depends on this element's existence as an insertion anchor.


---

### `_seam_header-form`

**Selector:** `form#searchForm`  
**Source layer:** `T4_PAGELAYOUT`  
**Appears on:** all pages where T4 PageLayout renders the header bar (universal)  
**Captured in:** non-search-idle (Capture 5) — confirmed

Header search form. Contains #search-input, #header-suggestions, and the hidden #search-button submit. Submits to su-search-dev.vercel.app/search-test on form submission (full-page navigation), but in normal use the FE intercepts and redirects via window.location.href to /search-test/?query=... in the same tab.

**Writer:** `EXTERNAL — T4 PageLayout template (out of repo)` · `N/A` · `N/A`

Emitted by T4 PageLayout's site-header template. Wrapped in <div data-resultsurl="/search-test/">.

```html
<form id="searchForm" action="https://su-search-dev.vercel.app/search-test" method="GET">
  <label for="search-input" hidden="">Search</label>
  <input id="search-input" class="sq-search" name="query" type="text">
  <div id="header-suggestions" class="header-suggestions-container" hidden=""></div>
  <input hidden="" id="search-button" type="submit" value="Submit">
</form>
```

**Attributes:**

- `id` (`REQUIRED`) — value: `searchForm`. Used by integration.js:256 via closest('form') from #search-input. Anchor for the FE's header-form lookup pattern.
- `action` (`REQUIRED`) — value: `https://su-search-dev.vercel.app/search-test`. Form-submission fallback target — if FE JS fails to intercept, native form submission goes here. Note: cross-origin from seattleu.edu to su-search-dev.vercel.app. Captures FE rebuild's fail-safe path.
- `method` (`REQUIRED`) — value: `GET`. Query parameter via URL. Matches search-test page expectation of ?query= param.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:256-259` — closest('form') from #search-input — anchors the header components lookup. Existence is gated.
- `IN_REPO_FE` — `public/js/SessionService.js:1065 (per A.2)` — Session-restoration on header form submit.


**Seam:**

Parent: `div[data-resultsurl="/search-test/"] > form#searchForm (per Capture 5)` (T4_PAGELAYOUT).

Contract dependencies:

- Phase D captures the wrapping div[data-resultsurl] and the broader header chrome (site-search > search-block-form > data-resultsurl wrapper > form)
- The data-resultsurl attribute on the wrapper div may be consumed by FE or external JS for redirect-target configuration; not enumerated in A.2 — Phase D investigates


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **FIXED** · `click_mechanism`: **NOT_BINDING** · `attribute_set`: **BOUNDED** · `content_schema`: **FIXED**

inner_dom_structure FIXED — the form contains the input, the suggestions container, and the hidden submit (per Capture 5). The order matters for the FE's outside-click test (#header-suggestions must be a child of the same form so that container.contains(e.target) tests work correctly).

**Render cap:** no FE-side truncation. Truncation location: `N/A`. N/A — form element.

**Gaps:**

- Wrapping <div data-resultsurl="/search-test/"> attribute behavior pending Phase D


**Notes:** New seam entry surfaced by Capture 5. A.2 noted the header form as a seam parent for #header-suggestions but did not enumerate it as a standalone entry. The cross-origin form action and the wrapping data-resultsurl attribute are net-new Phase D concerns.


---

### `_seam_site-search-button-toggle`

**Selector:** `button#site-search--button-toggle`  
**Source layer:** `T4_PAGELAYOUT`  
**Appears on:** all pages where T4 PageLayout renders the header bar  
**Captured in:** non-search-idle (Capture 5) — confirmed

Accordion-pattern toggle button that opens/closes the search panel (form#searchForm and its wrapper). Provides the entry point to the header search UI. Listener audit references it at integration.js:152-153 but Phase A did not previously catalog it as a seam parent.

**Writer:** `EXTERNAL — T4 PageLayout template (out of repo)` · `N/A` · `N/A`

Emitted by T4 PageLayout's site-search template as an accordion-pattern toggle button controlling the search panel's visibility.

```html
<button type="button" class=" site-search__toggle button-toggle" data-button-open-text="Open the search panel" data-button-close-text="Close the search panel" data-button-enable-at="0" data-button-disable-at="-1 " data-button-open-class="search-panel-open" data-button-open-class-element="" aria-live="polite" aria-label="Search Seattle University" id="site-search--button-toggle" aria-controls="search-block-form" data-toggle-type="accordion" aria-expanded="true"><span class="show-for-sr">Open the search panel</span></button>
```

**Attributes:**

- `id` (`REQUIRED`) — value: `site-search--button-toggle`. Referenced by integration.js:152-153 per listener audit. Anchor for FE's toggle-button lookup.
- `class` (`TO_DETERMINE`) — value: `site-search__toggle button-toggle (note leading whitespace in captured class attribute)`. BEM-style class. Likely T4/Squiz CSS hook. CSS audit pending.
- `type` (`REQUIRED`) — value: `button`. Defensive default to prevent form-submit semantics inside any parent form.
- `aria-controls` (`REQUIRED`) — value: `search-block-form`. ARIA contract — identifies the controlled region (the search-block-form panel). ASSISTIVE_TECH consumer.
- `aria-expanded` (`REQUIRED`) — value: `boolean string, toggled (captured 'true' — but Capture 5 was idle non-search page, so expanded state may reflect a different state model than expected)`. ARIA disclosure-pattern state.
- `data-toggle-type` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `accordion`. Consumed by a T4 or Squiz accordion-toggle script. Phase D investigates.
- `data-button-open-text / data-button-close-text / data-button-enable-at / data-button-disable-at / data-button-open-class / data-button-open-class-element` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `(see literal_html)`. Configuration attributes for an external toggle behavior script. Not consumed by FE. Phase D enumeration.

**Consumers:**

- `IN_REPO_FE` — `public/integration.js:152-153 (per listener audit cross-reference)` — Referenced for toggle interaction; specific consumer behavior pending listener-audit-to-Phase-A cross-walk in Phase A.5
- `EXTERNAL_JS_LOADED_BY_T4` — `TO_CAPTURE (Phase D)` — data-toggle-type="accordion" suggests a T4 or Squiz accordion-init script consumes the data-button-* attributes
- `ASSISTIVE_TECH_INFERRED` — `N/A` — aria-controls + aria-expanded disclosure pattern


**Seam:**

Parent: `div.site-search > button#site-search--button-toggle (per Capture 5)` (T4_PAGELAYOUT).

Contract dependencies:

- Sibling of #search-block-form panel (which aria-controls references)


**Design latitude:**

`visual_appearance`: **TO_DETERMINE** · `class_names`: **TO_DETERMINE** · `inner_dom_structure`: **TO_DETERMINE** · `click_mechanism`: **FIXED** · `attribute_set`: **TO_DETERMINE** · `content_schema`: **TO_DETERMINE**

Full latitude pending Phase D analysis. The accordion-toggle pattern is the contract; specific config-attribute set is Phase D enumeration.

**Render cap:** no FE-side truncation. Truncation location: `N/A`. N/A.

**Gaps:**

- T4 toggle-init script source pending Phase D
- Full data-button-* attribute consumer behavior pending Phase D


**Notes:** New seam entry surfaced by Capture 5. The toggle button was referenced in the listener audit but A.2 did not include it as a seam entry. Phase D treats it as a full T4 PageLayout entry.


---


## Behavioral consumers (external JS)

External JS loaded into the page that consumes FE-authored HTML's attribute surface. Source code not inspected; consumer behavior inferred from framework conventions and confirmed-active status from captures.


### `squiz-stencils-main-js`

**URL:** `https://dxp-us-search.funnelback.squiz.cloud/s/resources/seattleu~ds-search/_default/themes/stencils/js/main.js`  
**Loaded by:** Funnelback partial response (script tag injected inside the funnelback-search-container-response wrapper on the search page)


**Presumed consumed attributes:**

- `data-autocomplete`
- `data-collection`
- `data-profile`
- `data-max-results`
- `data-min-length`
- `data-results-container`

External JS loaded into the page; consumes input-element data-* configuration on #autocomplete-concierge-inputField. Source code not inspected. Per Finding F10, data-form is NOT emitted on the captured input (A.2 incorrectly presumed it). Per Finding F11, data-results-container='results' (not '#autocomplete-suggestions'), which complicates the Squiz-vs-FE autocomplete-ownership question — Phase C investigates. Phase A treats the input element as a seam parent (SQUIZ_STENCILS_BOILERPLATE); the data-* attribute set is enumerated in Phase C.


### `squiz-typeahead-bundle`

**URL:** `https://cdnjs.cloudflare.com/ajax/libs/typeahead.js/0.11.1/typeahead.bundle.min.js`  
**Loaded by:** T4 PageLayout script imports (visible in PageLayout-emitted <script> tags alongside jQuery, popper, handlebars, etc., before the FE bundle loads)


**Presumed consumed attributes:**

- `(unknown — Typeahead binds to inputs and reads its own config; the specific attribute set is Phase C territory)`

Twitter Typeahead, jQuery-based autocomplete library bundled by Squiz. Vic confirmed (2026-05-12) that Typeahead is doing something — likely binding to one or both search inputs. If Typeahead is bound to #autocomplete-concierge-inputField, the input's data-* attributes are EXTERNAL_CONSUMER_REQUIRED for Typeahead's configuration. If Typeahead creates DOM (its convention is to wrap inputs and inject a sibling .twitter-typeahead container with dropdown markup), the production create site for #header-suggestions may trace here. Phase C investigation queued.


---

_Document generated by `synthesize_md.py` from `html-audit-phase-a-2026-05-12-v2.json`. Hand-written prose for the preamble, section intros, and findings narrative; per-entry sections templated from the JSON to keep both documents in lockstep._
