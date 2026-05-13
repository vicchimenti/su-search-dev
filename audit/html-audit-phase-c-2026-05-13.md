# HTML Audit Phase C — Squiz Stencils Contract Surface

**Audit date:** 2026-05-13
**Audit version:** 1.0.0
**Phase:** C (Squiz-stencils-side phase of the five-phase HTML audit)
**Phase stage:** C.4-final
**Companion document:** `audit/html-audit-phase-c-2026-05-13.json` (canonical, machine-consumed)
**Session report:** `audit/session-report-2026-05-13-html-audit-phase-c.md`

## Purpose and posture

This document is the canonical contract-surface record for the Squiz stencils framework's interaction with the search page. Its role for the FE rebuild is structurally equivalent to what Phase A plays for FE-authored HTML, and to what `funnelback-endpoint-dictionary-2026-05-01.json` plays for the proxy rebuild: an external-constraints reference enumerating what's binding and why.

Phase C documents: the `autocomplete-concierge` React component mount point (wrapper div + nested-span dataset configuration), the on-page input element with its full `data-*` configuration set, the seam contracts to `#autocomplete-suggestions` and `#results`, the universal stencils cluster (seven JS files loaded universally by T4 PageLayout), the inline marketing pixels confirmed non-search, and the Squiz behavioral consumers (compiled stencils `main.js` with its module map, the lazy-loaded React component, Twitter Typeahead).

The three Vic-controlled FreeMarker templates (`auto_complete_concierge.ftl`, `auto_complete.ftl`, `partial.ftl`) are characterized as the writer source-layer of the entries they emit. They are documentary characterization targets, not modification targets in this audit phase.

The three-pattern decision (data-feed-only vs controller-only vs full-Squiz-rendering) is scoped here as a flagged development investigation. Phase C does not pick a pattern; each entry's `three_pattern_relevance` field documents what role the surface plays under each pattern, enabling the development investigation to navigate the audit by pattern.

## How to read this document

Each entry below describes one DOM unit or load-tier element's contract surface. Fields per entry: selector and source layer; structural role; writer (file, function, line range, behavior); literal HTML where captured; per-attribute binding annotations (`REQUIRED`, `EXTERNAL_CONSUMER_REQUIRED`, `TO_DETERMINE`, `VESTIGIAL_CANDIDATE`, `NOT_BINDING`); consumer list; seam contract; six-dimension design latitude; render cap; appears-on page list; capture state; gaps; modifiability (who controls, design-system-access required, risk); three-pattern relevance.

`SQUIZ_FTL_TEMPLATE` is a Phase-C-specific source-layer value covering entries whose writer is one of the Vic-controlled FreeMarker templates inside the Funnelback design system. `SQUIZ_FRAMEWORK_REACT_COMPONENT` is a Phase-C-specific consumer-type value for entries consumed by the autocomplete-concierge React component or its lazy-loaded sub-components.

## Scope and stop rules

**In scope.** The HTML contract surface that Squiz stencils framework code and Vic-controlled FreeMarker templates produce or consume on the search page. The autocomplete-concierge wrapper div, the on-page input's `data-*` set, the `#autocomplete-suggestions` source-layer characterization, the `#results` positioning, the universal stencils cluster (seven loaded files), the search-page-injected `main.js` as a behavioral consumer with documented behavioral surface (treated as a black box where internals are reached only enough to enumerate the contract surface).

**Out of scope.** Squiz framework JavaScript internals beyond the documented contract surface — the ally.js accessibility library internals, the React component lazy-loaded chunk source beyond what's needed to characterize its configuration expectations, the Twitter Typeahead bundle internals, the webpack runtime, the core-js polyfill set. The internal Seattle U `main.js` loaded in the document head. CSS rule enumeration (separate future CSS audit). FE-side consumption of stencils HTML (that's Phase B's inverse view). T4 PageLayout chrome (Phase D). The Funnelback partial response content and per-result-type renderers (Phase E). The three-pattern integration decision itself (development investigation).

**Stop rules.** Phase C read the modules in `main.js` that define the public contract surface via WebFetch (modules 47462 `autocomplete-concierge`, 603 `autocomplete-search`, 79963 `rg` helper); it did not fetch the React component chunk 641 source. The three FTL templates (`auto_complete_concierge.ftl`, `auto_complete.ftl`, `partial.ftl`) were not available in this audit chat's source materials (uploaded to the prior 2026-05-13 chat); Phase C characterizes them through their preserved 5/13 findings and through the contract surface their output produces. Phase C does not propose rebuild design decisions inside this document — `TO_DETERMINE` and explicit `gaps` are recorded as findings; the rebuild design phase decides resolution.

## Capture provenance

Phase C inherits captures 1, 2/3, 4, and 5 from Phase A (taken 2026-05-12, folded into Phase A's v2 document). Phase C does not take new captures; the captures sufficient for Phase C's documentary characterization are already in Phase A. Specific captures' Phase C usage:

- **Capture 1** (search-initial): the on-page input's `data-*` attribute set is sourced here. The `#autocomplete-suggestions` and `#results` containers' idle state captured here.
- **Capture 5** (non-search-idle): confirms the autocomplete-concierge wrapper is NOT present on non-search pages — the wrapper is search-page-only.
- **Captures 2/3, 4** are FE-rendered-output captures; Phase C references them through Phase A's analysis rather than re-deriving.

New empirical data points queued for the development phase: DOM inspection during a live query (to capture the wrapper's literal `data-configuration` JSON and nested-span set); Funnelback admin profile-config inspection (current `stencils.auto-completion.datasets` value); Squiz design system template inventory; chunk 641 source read for React component contract.

## Cross-references

- audit/html-audit-phase-a-2026-05-12-v2.json — Phase A canonical (Findings F8, F9, F10, F11, F12 close out here)
- audit/html-audit-phase-a-2026-05-12-v2.md — Phase A markdown companion
- audit/fe-autocomplete-audit-2026-05-05.md
- audit/fe-listener-audit-2026-05-06.md
- audit/fe-tabs-manager-audit-2026-05-08-v2.md
- audit/fe-cache-audit-2026-05-04.md
- audit/network-investigation-2026-05-01.md
- audit/network-recap-re-examination-2026-05-11.md and addendum
- audit/prefetch-archaeology-audit-2026-05-11.md
- audit/funnelback-endpoint-dictionary-2026-05-01.json — proxy-rebuild equivalent
- audit/fe-endpoint-dictionary-2026-05-07.json

## Behavioral consumers

Three external JS systems consume Phase C contract surface. Documented in the canonical JSON's `meta.behavioral_consumers`; summarized here.

### squiz-stencils-main-js

URL: `https://dxp-us-search.funnelback.squiz.cloud/s/resources/seattleu~sp-search/_default/themes/stencils/js/main.js`

Loaded by the Funnelback partial response on the **search page only** (not on non-search pages — this is a Phase C clarification of Phase A's `loaded_by` framing). Compiled webpack bundle containing the Squiz stencils framework. Module map:

- **47462** — `autocomplete-concierge` bootstrap, defines `_parseConfiguration` (Finding C2)
- **603** — `autocomplete-search` legacy adapter (Finding C3)
- **79963** — `rg` helper for innerHTML-to-children parsing (Finding C5)
- **38630** / **25699** — React component targets (standard / modal) lazy-imported from chunk 641 (Finding C4)

Lazy-loaded chunks: 466, 401, 641 (chunk 641 hash `e501a609afe40e692932`).

Consumed attributes on the wrapper: `data-component="autocomplete-concierge"` (discriminator), `data-configuration` (JSON blob, parsed for top-level config including `portal` key per Finding C2), wrapper innerHTML (parsed for nested-span datasets per Finding C5).

Consumed dataset attributes on nested spans: `data-id`, `data-label`, `data-template`, `data-service-url`, `data-adapter`, `data-params` (six attributes — Finding C1 corrects the brief's preserved-narrative count of five by adding `data-adapter`).

`data-form` on the input is **not** in the consumed set (Phase A Finding F10 / Phase C Finding C6 closes the gap — `data-form` REMOVED from Phase A's presumed-consumed list).

### autocomplete-concierge-react-component

URL: `https://dxp-us-search.funnelback.squiz.cloud/s/resources/seattleu~sp-search/_default/themes/stencils/js/641.<hash>.js`

Lazy-imported from main.js module 47462. Receives the parsed wrapper configuration and per-dataset array; renders the autocomplete UI. Rendering target, data-shape expectations, and template inventory all `TO_DETERMINE` pending chunk-source inspection in the development phase.

### squiz-typeahead-bundle

URL: `https://cdnjs.cloudflare.com/ajax/libs/typeahead.js/0.11.1/typeahead.bundle.min.js`

Loaded universally as part of the seven-file stencils cluster. Working hypothesis (per Finding C8): loaded but idle in current production — no `tt-*` DOM signatures observed in any captured state. Confirmation requires reading `hero_banner.ftl` macro source or runtime DOM inspection during a query.

## Findings

Phase C produces twelve findings, summarized below. Full evidence and implications are in the canonical JSON's `meta.findings`.

### C1 — The nested-span dataset attribute set is six, not five

WebFetch on `main.js` retrieved module 47462's `Array.from(n).map(...)` body: the dataset attributes extracted are `id`, `label`, `template`, `serviceUrl`, `adapter`, `params` (six). The brief's preserved-narrative listed five. `data-adapter` is the sixth — the adapter class is named per dataset and transforms the upstream response into the React component's expected shape. Pattern 1 (data-feed-only) contract surface for the rebuild therefore requires BOTH per-channel service-URL routing through the proxy AND per-channel adapter selection.

### C2 — `data-configuration` is JSON-parsed and feeds an attribute-mapping table

Module 47462's `_parseConfiguration` body confirmed via WebFetch: `t` is the parsed JSON (deserialized from the wrapper's `data-configuration`), `e` is the wrapper element. The JSON schema includes at least a `portal` key (`r=t.portal||null`). Separately, `i.Qj[n.name]` is an attribute-name-to-config-key mapping table — DOM attributes on the portal target whose names match `i.Qj` keys get hoisted into the runtime config. The full `i.Qj` table is not enumerated in this audit pass; the development investigation should grep for the `Qj` definition.

### C3 — Module 603 (autocomplete-search) reads four `data-*` attributes from the host element

`this.emphasis=t.dataset.emphasis`; `this.remoteAddress=\`${t.dataset.suggestSource}?collection=${t.dataset.suggestCollection}&${t.dataset.suggestAdditionalParams}&fmt=json++\``. None of these appear on the captured on-page input. Working hypothesis: module 603 is wired via `auto_complete.ftl` (older mechanism); search page does not invoke that macro. Confirmation requires reading `hero_banner.ftl`.

### C4 — React lazy-loading uses three webpack chunks and two module IDs

Module 47462 contains: `(0,r.lazy)(()=>Promise.all([n.e(466),n.e(401),n.e(641)]).then(n.bind(n,38630)))` and a parallel form with `n.bind(n,25699)`. Two component variants exist: standard (38630) and modal (25699), both in chunk 641. Which variant mounts depends on wrapper configuration — likely a `modal` flag in the JSON.

### C5 — Module 79963's `rg` helper parses innerHTML via div-mutation

`function o(t,e){const n=t.createElement('div'); return n.innerHTML=e, n.children}`. Module 47462 calls `(0,i.rg)(document, e.innerHTML)` where `e` is the wrapper. Implication: dataset configuration spans MUST be direct children of the wrapper — nested grandchildren would not be enumerated. Rigid contract for the rebuild.

### C6 — Phase A Finding F10 closed: `data-form` is not consumed by `main.js`

`_parseConfiguration` body reads `id`, `label`, `template`, `serviceUrl`, `adapter`, `params` on nested spans plus `i.Qj`-mapped attributes on the portal target. None of these include `form`. The rebuild does not need to emit `data-form` on the on-page input. Phase B's `data_star_attributes_on_input` row amendment can now be finalized — see C.5 amendments queue in the session report.

### C7 — Phase A Finding F11 clarified: `data-results-container="results"` is React-component-internal config

The input element's `data-*` attributes get hoisted into the React component's runtime config via `i.Qj` mapping (Finding C2). The consumer is the React component, not an out-of-component routing mechanism. Phase A's F11 "two readings" both collapse: the attribute is internal configuration (rendering target, ARIA wiring, or scroll target — pending chunk-source inspection), NOT a "Squiz autocomplete writes to `#results`" mechanism that would collide with FE's writes.

### C8 — Typeahead status remains `TO_DETERMINE` pending `hero_banner.ftl` read

No `tt-*` DOM signatures observed in any captured state. Twitter Typeahead is loaded universally but no binding site is visible in `main.js`'s autocomplete-concierge or autocomplete-search modules — Typeahead is jQuery-API-bound via `$.typeahead({...})` which would appear elsewhere. Working hypothesis (loaded but idle on this template) is consistent with observed absence of DOM signatures. Confirmation requires reading `hero_banner.ftl` or live DOM inspection during a query.

### C9 — Three-pattern decision contract-surface implications enumerated

Each Phase C entry carries a `three_pattern_relevance` field. Aggregating across entries: Pattern 1 keeps the wrapper + nested spans + React component but substitutes per-channel `data-service-url` (and `data-adapter`) values to route through the proxy. Pattern 2 keeps the wrapper but configures the React component for render-disabled or render-to-slot mode (TO_DETERMINE feasibility — depends on chunk-source-confirmed support). Pattern 3 extends the dataset configuration to cover the full tri-modal UX and retires FE's `renderResultsPageSuggestions`. The development investigation has the contract surface mapped per pattern.

### C10 — Universal stencils cluster enumerated as seven JS files

Load order: jQuery → popper → Typeahead bundle → Handlebars → es6-promise → stencils.js → handlebars-helpers.js. All seven load on every page (universal, not search-specific). Compiled `main.js` loads separately on the search page only and is NOT part of this cluster. Strip-out experiment is development-phase work; Phase C records the cluster.

### C11 — FTL templates are Vic-modifiable platform content, not Squiz framework internals

The three FTL templates (`auto_complete_concierge.ftl`, `auto_complete.ftl`, `partial.ftl`) live inside the Funnelback design system to which Vic has admin access. They are characterization-but-not-modification targets in this audit phase. Modifications belong to development phase if and only if the selected three-pattern variant requires them. `SQUIZ_FTL_TEMPLATE` is added to Phase C's `source_layers` enumeration to distinguish FTL-emitted entries from Squiz framework internals.

### C12 — Inline marketing pixel scripts in PageLayout confirmed non-search

The inline `<script>` tags in T4 PageLayout (Snapchat, TikTok ×3, Basis/Centro, Facebook Pixel) are marketing/analytics — NOT search infrastructure. Recorded so future audit phases don't re-investigate.

## Entries

### `autocomplete-concierge-wrapper-div`

**Selector:** `div[id="autocomplete-concierge"][data-component="autocomplete-concierge"]`
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** search page only
**Captured in:** `TO_CAPTURE` — Phase A captured the inputField inside but not the wrapper itself

The React component mount point. The bootstrap in `main.js` module 47462 queries `[data-component="autocomplete-concierge"]` after DOM ready, calls `_parseConfiguration` on each match, then lazy-imports the React component chunk and mounts it.

**Writer:** `auto_complete_concierge.ftl` (Vic-controlled FreeMarker template inside Funnelback design system). The macro emits the outer wrapper, the `data-configuration` JSON blob, and the inner dataset configuration spans. Macro invocation site is `partial.ftl` on the search page, likely via the `hero_banner.SearchForm` component chain (pending confirmation).

**Literal HTML:** `TO_CAPTURE`. Working shape: `<div id="autocomplete-concierge" data-component="autocomplete-concierge" data-configuration='{"portal":"...","template":"organic",...}'>{ nested dataset spans }</div>`

**Attributes:**

- `id` (`TO_DETERMINE`) — value: `autocomplete-concierge`. Captured on the inputField selector pattern; the wrapper id itself may be a CSS/labelling hook rather than functional. main.js queries by `[data-component="autocomplete-concierge"]` not by id.
- `data-component` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `autocomplete-concierge`. Per Finding C2, the discriminator that `main.js` module 47462 uses to select wrapper elements. Required for the React component mount.
- `data-configuration` (`EXTERNAL_CONSUMER_REQUIRED`) — JSON string deserialized by `main.js` into a configuration object with at least a `portal` key. Full JSON schema not enumerated; literal value pending DOM inspection.

**Consumers:**

- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `main.js` module 47462's `_parseConfiguration`. The wrapper is the host for the React component mount.
- `SQUIZ_FRAMEWORK_REACT_COMPONENT` — chunk 641 (hash `e501a609afe40e692932`), module 38630 (standard) or 25699 (modal). React.lazy target; receives the parsed configuration and renders the autocomplete UI.

**Seam:**

Parent: `TO_DETERMINE` — the wrapper is inside the search-results form region (`concierge-search-form` cluster per Phase A Capture 1), exact ancestry not enumerated.

Contract dependencies: Wrapper must be in DOM at `main.js` bootstrap time; wrapper's innerHTML must contain the dataset configuration spans as direct children (per Finding C5).

**Design latitude:** `inner_dom_structure`: `BOUNDED` · `attribute_set`: `BOUNDED` · `content_schema`: `BOUNDED`. Direct-child spans required by Finding C5. `data-component` and `data-configuration` required; id conventional.

**Modifiability:** Vic controls via FTL emission; Squiz controls via main.js consumption; Funnelback admin tunes via `stencils.auto-completion.*` profile config. Requires design system access. Medium modification risk.

**Three-pattern relevance:**

- Pattern 1 (data-feed-only): `REQUIRED` — wrapper continues to mount the React component; nested-span `data-service-url` rewritten to FE proxy endpoints.
- Pattern 2 (controller-only): `REQUIRED` — wrapper still mounts the React component as controller; render mode suppressed if chunk supports it.
- Pattern 3 (full-Squiz-rendering): `REQUIRED` with extended schema — wrapper hosts full Squiz rendering; FE's renderer retires.

**Gaps:** Literal `data-configuration` JSON value pending DOM inspection. Wrapper's outerHTML and parent ancestry pending. Whether wrapper id is functionally required or merely conventional.

**Notes:** The highest-leverage contract surface in Phase C. All three patterns require it; the difference is configuration and consumption rules. Vic to DOM-inspect production for current `data-configuration` value, plus check `stencils.auto-completion.datasets` profile config — those two data points together inform development investigation order.

---

### `autocomplete-concierge-nested-span-dataset`

**Selector:** `div[data-component="autocomplete-concierge"] > span` (or other direct children with the dataset attribute set; exact element tag pending FTL read)
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** inside the wrapper — search page only
**Captured in:** `TO_CAPTURE`

Per-dataset configuration block. Each span declares one autocomplete column / source (general suggestions, staff people, academic programs). `main.js` module 47462 iterates these via `Array.from(n).map(...)` and produces a configuration array passed to the React component.

**Writer:** `auto_complete_concierge.ftl`. Iterates the Funnelback profile config `stencils.auto-completion.datasets` (comma-separated list) and emits one direct-child span per dataset name, with the six dataset attributes read from per-dataset profile config keys.

**Literal HTML:** `TO_CAPTURE`. Working shape: `<span data-id="general" data-label="Suggestions" data-template="organic" data-service-url="..." data-adapter="..." data-params="..."></span><span data-id="staff" ...></span><span data-id="programs" ...></span>`

**Attributes (all `EXTERNAL_CONSUMER_REQUIRED`):**

- `data-id` — per-dataset identifier (e.g. `general`, `staff`, `programs`). Per Finding C1.
- `data-label` — column header text.
- `data-template` — React template name (`organic` is the default referenced in the brief; other templates pending Squiz design system documentation lookup).
- `data-service-url` — upstream service URL. **Pattern 1 substitution point**: pointing this at the FE proxy endpoint routes the data feed through the rebuild's pipeline.
- `data-adapter` — named adapter class for response transformation. **Sixth attribute** beyond the brief's preserved-narrative count (Finding C1).
- `data-params` — additional query parameters appended to the service URL.

**Consumers:**

- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `main.js` module 47462 `_parseConfiguration`. Iterated via `Array.from(n).map(...)`.
- `SQUIZ_FRAMEWORK_REACT_COMPONENT` — chunk 641. React component renders one section per dataset.

**Seam:**

Parent: `div[data-component="autocomplete-concierge"]` (`SQUIZ_FTL_TEMPLATE`).

Contract dependencies: Spans must be DIRECT children of the wrapper (Finding C5 — `rg` helper returns only `n.children`); wrapper's `data-configuration` JSON parse must succeed before iteration; each span's six dataset attributes must be present and string-valued.

**Design latitude:** `inner_dom_structure`: `FIXED` (flat spans, no nested content) · `attribute_set`: `FIXED` (the six attributes per Finding C1) · `content_schema`: `BOUNDED`.

**Profile config dependencies:**

- `stencils.auto-completion.datasets` (comma-separated dataset name list)
- `stencils.auto-completion.datasets.${dataset}.label`
- `stencils.auto-completion.datasets.${dataset}.template`
- `stencils.auto-completion.datasets.${dataset}.service-url`
- `stencils.auto-completion.datasets.${dataset}.adapter`
- `stencils.auto-completion.datasets.${dataset}.params`

**Modifiability:** Vic via FTL + Funnelback admin profile config. Requires design system access. Medium risk.

**Three-pattern relevance:**

- Pattern 1: `REQUIRED` with substitution — per-dataset `data-service-url` rewritten to FE proxy endpoints; per-dataset `data-adapter` selected for the proxy's response shape.
- Pattern 2: `REQUIRED` in current shape — datasets drive the React component's controller-layer wiring.
- Pattern 3: `REQUIRED` with extension — datasets cover the full tri-modal UX; custom templates may need to be authored if `organic` doesn't fit staff/programs row shapes.

**Gaps:** Literal HTML pending DOM inspection (span count, exact tag, per-attribute values). Current `stencils.auto-completion.datasets` profile config value. Available React template names beyond `organic`.

**Notes:** Pattern 1's leverage point — substituting `data-service-url` values routes data feed without removing the React component. Pattern 3's constraint — each dataset's React template must exist in the Squiz design system. Pattern 2 feasibility depends on render-suppression mode that hasn't been confirmed to exist.

---

### `_seam_autocomplete-concierge-inputField`

**Selector:** `input#autocomplete-concierge-inputField[data-component]`
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** search page
**Captured in:** `search-initial` (Phase A Capture 1) — confirmed

The user-input element on the search page. Receives keystrokes and is the binding target for the autocomplete-concierge React component's input-event listeners. Also referenced by FE's `search-page-autocomplete.js` `handleInput` via `getElementById('autocomplete-concierge-inputField')` at line 1088 — **two consumers attach to this same input**.

**Writer:** `auto_complete_concierge.ftl`. Emits the input element; the `data-*` set hoists into the main.js runtime config via `i.Qj` mapping (Finding C2). The label element is paired via `for=id`.

**Literal HTML:** Per Phase A Capture 1: `<input type="search" id="autocomplete-concierge-inputField" name="query" class="..." autocomplete="off" spellcheck="false" autofocus="" data-component="..." data-autocomplete="..." data-collection="..." data-profile="..." data-max-results="10" data-min-length="..." data-results-container="results">`

**Attributes:**

- `id` (`REQUIRED`) — value: `autocomplete-concierge-inputField`. FE's `getElementById` lookup; label `for=` binding; React component binding target.
- `type` (`REQUIRED`) — value: `search`. Browser-native search semantics; asymmetric vs the header consumer's `type="text"` (intentional).
- `name` (`REQUIRED`) — value: `query`. Form-submission parameter name.
- `autocomplete` (`REQUIRED`) — value: `off`. Disables browser autocomplete to give Squiz/FE UI exclusive control.
- `spellcheck` (`TO_DETERMINE`) — value: `false`. UX convention; not a binding contract.
- `autofocus` (`TO_DETERMINE`) — boolean attribute (present). UX policy; rebuild decides.
- `data-component` (`EXTERNAL_CONSUMER_REQUIRED`) — value: TO_DETERMINE exact value. Per Finding C2, in main.js's parse path.
- `data-autocomplete` (`EXTERNAL_CONSUMER_REQUIRED`) — consumed by `i.Qj` mapping.
- `data-collection` (`EXTERNAL_CONSUMER_REQUIRED`) — Funnelback collection name; consumed by `i.Qj` mapping.
- `data-profile` (`EXTERNAL_CONSUMER_REQUIRED`) — Funnelback profile name.
- `data-max-results` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `10`. Per Phase A Finding F13 the upstream cap source; passed to Funnelback as `show=N`.
- `data-min-length` (`EXTERNAL_CONSUMER_REQUIRED`) — minimum input characters before suggest fires.
- `data-results-container` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `results`. Per Finding C7 hoisted into React component's runtime config; the `results` value names an element ID for internal reference (rendering target, ARIA wiring, or scroll target — pending chunk-source inspection). NOT a parallel-pipeline routing mechanism.
- `data-form` (`NOT_BINDING`) — **NOT EMITTED** on the captured input. Per Findings F10/C6: main.js does not read a `form` attribute; the Phase A presumed-consumed list is revised to remove it. **Closed.**

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:1088` — `getElementById('autocomplete-concierge-inputField')` at DOMContentLoaded; if absent the entire handler early-returns at line 1093. FE's `handleInput` binds here.
- `EXTERNAL_JS_LOADED_BY_FUNNELBACK` — `main.js` module 47462 `i.Qj` attribute mapping. The input is also the React component's focus/typing target.
- `SQUIZ_FRAMEWORK_REACT_COMPONENT` — chunk 641. Binds input-event listeners.
- `ASSISTIVE_TECH_INFERRED` — paired with `autocomplete-concierge-label` via `for=`.

**Seam:**

Parent: `form#concierge-search-form` (per Phase A Capture 1 cluster). Source layer: `SQUIZ_FTL_TEMPLATE`.

Contract dependencies: Element must exist before search-page-autocomplete.js's DOMContentLoaded handler (verified at idle in Capture 1); must exist before main.js's bootstrap (Funnelback-partial-injected timing should be compatible). **Two distinct consumers attach input-event listeners** — whether they compete or coexist is the central question of the three-pattern decision.

**Design latitude:** `attribute_set`: `BOUNDED`. id, type, name, autocomplete, and the data-* set are `REQUIRED` or `EXTERNAL_CONSUMER_REQUIRED`. `data-form` is `NOT_BINDING` (Finding C6). The rebuild's three-pattern variant controls whether the data-* set is retained.

**Modifiability:** Vic via FTL; Funnelback admin profile config for some values. Requires design system access. Medium risk.

**Three-pattern relevance:**

- Pattern 1: Attribute set retained; `data-collection`/`data-profile` may need reconfiguration if proxy-routed datasets use different upstream collections.
- Pattern 2: Attribute set retained; `data-results-container` may need adjustment if render mode is suppressed.
- Pattern 3: Attribute set retained, possibly extended for modal mode or additional features.

**Gaps:** Exact `data-component` value pending DOM inspection. Full `i.Qj` table (other attributes that would be consumed if emitted). Exact behavior of `data-results-container="results"` inside the React component pending chunk-source inspection.

**Notes:** Phase C upgrades from Phase A's skeleton seam to a full entry with attribute bindings enumerated. The central two-consumer surface: FE attaches one listener, React component attaches another. The selected three-pattern variant determines whether they compete (current state — brief's symbiotic-not-competing commitment), cooperate (Pattern 2), or one retires (Pattern 1 / Pattern 3).

---

### `_seam_autocomplete-concierge-label`

**Selector:** `label#autocomplete-concierge-label[for="autocomplete-concierge-inputField"]`
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** search page
**Captured in:** `search-initial` (Phase A Capture 1) — confirmed

Accessible label for the on-page input. Per Phase A Capture 1: `<label id="autocomplete-concierge-label" for="autocomplete-concierge-inputField" class="sr-only" aria-live="polite">{label text}</label>`.

The `sr-only` class visually hides the label while preserving it in the accessibility tree (unlike the header's broken `hidden=""` pattern that removes from a11y tree — Phase A Finding F12). The `aria-live="polite"` channel is presumably the React component's screen-reader announcement surface.

**Attributes:**

- `id` (`REQUIRED`) — referenced by `#autocomplete-suggestions`'s `aria-labelledby` for the ARIA chain.
- `for` (`REQUIRED`) — binds label to input.
- `class` (`REQUIRED`) — value: `sr-only`. Keeps in a11y tree while hiding visually.
- `aria-live` (`EXTERNAL_CONSUMER_REQUIRED`) — value: `polite`. Live-region announcement channel; writers pending chunk-source inspection.

**Three-pattern relevance:** Retained as-is across all three patterns.

**Notes:** The model for fixing Phase A Finding F12 — the rebuild should apply this on-page pattern (sr-only + aria-live) to the header consumer.

---

### `_seam_autocomplete-suggestions-container`

**Selector:** `div#autocomplete-suggestions[role="listbox"][aria-labelledby="autocomplete-concierge-label"]`
**Source layer:** `TO_DETERMINE` — likely `SQUIZ_FTL_TEMPLATE` (working hypothesis pending FTL read)
**Appears on:** search page
**Captured in:** `search-initial` (Capture 1) and `search-on-page-dropdown-all-columns` (Capture 2/3)

Container for the on-page autocomplete suggestions. Both the FE (via `search-page-autocomplete.js` `renderResultsPageSuggestions` writing innerHTML at line 501) **and possibly the React component** populate this container.

**Literal HTML:** `<div id="autocomplete-suggestions" role="listbox" aria-labelledby="autocomplete-concierge-label" hidden="">{populated by FE or React component}</div>`

**Attributes (all `REQUIRED`):** id, role=listbox, aria-labelledby=autocomplete-concierge-label, hidden (toggled).

**Consumers:**

- `IN_REPO_FE` — `public/search-page-autocomplete.js:501` writes the tri-modal `.suggestions-list` structure.
- `SQUIZ_FRAMEWORK_REACT_COMPONENT` — `TO_DETERMINE` whether the React component writes here. **Two-writer uncertainty is the central Phase C question.**
- `ASSISTIVE_TECH_INFERRED` — listbox + aria-labelledby chain.

**Seam:** Parent `TO_DETERMINE` pending DOM inspection. Two-writer contract — whichever writer goes second wins; competing writes may cause flashes / lost state.

**Three-pattern relevance:**

- Pattern 1: Writer surface remains shared; coordination needed.
- Pattern 2: FE owns writes; React component configured to not render here.
- Pattern 3: React component owns writes; FE's renderer retires.

**Gaps:** Source layer pending — whether FTL-emitted or main.js / chunk 641-created. Whether React component writes here in addition to FE — pending chunk-source inspection.

**Notes:** One of the higher-leverage open questions. If FTL-emitted, rebuild's Pattern 1/2 wrapper-substitute must reproduce. Resolution via DOM inspection of the cluster ancestry.

---

### `_seam_results-container`

**Selector:** `div#results`
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** search page
**Captured in:** `search-initial` (Capture 1) — confirmed empty at idle

The search results container. FE writes the `funnelback-search-container-response` wrapper into its innerHTML via five distinct sites (Phase A Finding F2). May also be referenced internally by the React component via `data-results-container="results"` (Finding C7).

**Literal HTML:** Idle: `<div id="results"></div>`. Populated: `<div id="results"><div id="funnelback-search-container-response" class="funnelback-search-container">{Funnelback partial response}</div></div>`.

**Attributes:**

- `id` (`REQUIRED`) — referenced by FE's five wrapper-writer sites; referenced by the input's `data-results-container="results"` for React component internal reference.

**Consumers:**

- `IN_REPO_FE` — five sites per Phase A Finding F2.
- `SQUIZ_FRAMEWORK_REACT_COMPONENT` — `TO_DETERMINE` specific behavior. Likely ARIA-controls or scroll target rather than rendering target (Finding C7).

**Three-pattern relevance:**

- Pattern 1: FE owns writes; React component reference internal-only.
- Pattern 2: FE owns writes (controller mode doesn't write to a render container).
- Pattern 3: Coexistence question — full Squiz rendering of AUTOCOMPLETE doesn't mean Squiz writes to `#results` (which is search-RESULTS, distinct from `#autocomplete-suggestions`). `#results` remains FE-owned in all three patterns unless rebuild explicitly delegates search-results rendering.

**Notes:** Phase C upgrades from Phase A's skeleton. `data-results-container="results"` does not necessarily mean React component writes here — likely ARIA wiring or scroll-into-view. FE ownership of `#results` content is undisturbed by Patterns 1 or 2.

---

### `_seam_concierge-search-form`

**Selector:** `form#concierge-search-form`
**Source layer:** `SQUIZ_FTL_TEMPLATE`
**Appears on:** search page
**Captured in:** `TO_CAPTURE` — Phase A referenced the cluster but did not capture the form outerHTML

Search form on the results page. Native form submission would post the input's `query` parameter; FE intercepts and dispatches to its own handler.

**Attributes:**

- `id` (`REQUIRED`) — referenced by FE's search-page setup code; referenced by Phase A's seam pointers.

**Gaps:** Form outerHTML, action, method, name pending DOM inspection.

**Notes:** Skeleton seam entry. Form's existence is binding (it wraps the cluster) but specific attributes do not appear to have consumers beyond the form-submit-intercept pattern.

---

### `_seam_universal-stencils-cluster-script-imports`

**Selector:** T4 PageLayout body region: seven `<script>` tags loading the universal stencils JS cluster
**Source layer:** `T4_PAGELAYOUT`
**Appears on:** all pages where T4 PageLayout renders (universal)
**Captured in:** `TO_CAPTURE` (Phase D)

Foundation JS dependency layer. Load order: jQuery → popper → Twitter Typeahead bundle → Handlebars → es6-promise → stencils.js → handlebars-helpers.js. All seven load universally (not search-specific). Compiled Squiz `main.js` loads separately on the search page only via the Funnelback partial response — **not part of this cluster**.

**Attributes:** Seven script src attributes; binding `TO_DETERMINE` per Finding C10 + C8 — strip-out experiment is development-phase work.

**Three-pattern relevance:** Cluster retained across all three patterns (React component continues to mount in all three; depends on the cluster).

**Notes:** Per Finding C10, the seven-file enumeration is the basis for the development-phase strip-out experiment. Phase C records the cluster; the experiment is not Phase C work. Discovery-phase posture preserved by deferring empirical strip-out to development.

---

### `_seam_inline-marketing-pixel-scripts`

**Selector:** T4 PageLayout inline `<script>` tags emitting third-party marketing pixels
**Source layer:** `T4_PAGELAYOUT`
**Appears on:** all pages where T4 PageLayout renders (universal)
**Captured in:** N/A (out of scope)

Marketing / analytics tracking — Snapchat, TikTok ×3, Basis/Centro, Facebook Pixel. **NOT search infrastructure.** Recorded so future audit phases or rebuild design conversations do not re-investigate these as potential search-related scripts.

All design-latitude dimensions `NOT_BINDING`. All three patterns: untouched by search rebuild.

**Notes:** Per Finding C12, exists solely to document confirmed-non-search status.

---

## Summary

Phase C documents nine entries (two wrapper-and-spans, four seam parents on the search page, one universal cluster, one marketing-pixels) plus three behavioral consumers (`main.js`, the lazy-loaded React component, Typeahead bundle) and twelve findings (C1–C12). The audit closes Phase A Findings F10 and F11 (data-form and data-results-container clarifications); leaves F8 (header-suggestions create site) and F12 (ARIA chain asymmetry) untouched as those are header-side concerns not Phase C's scope.

The three-pattern decision (data-feed-only / controller-only / full-Squiz-rendering) is mapped per entry but not resolved. The development investigation has the contract surface enumerated; resolution depends on empirical work — DOM inspection during a live query, Funnelback admin profile config inspection, chunk 641 source read, and Squiz design system template inventory. Phase C scopes these queue items; the development phase executes.
