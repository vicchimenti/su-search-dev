# HTML Audit Phase A Brief — 2026-05-12

## Purpose and posture

Phase A of the HTML audit produces a canonical binding-requirements document for the FE-authored HTML in `su-search-dev` — the HTML that originates from this repo's code rather than from T4 PageLayout, Squiz stencils boilerplate, or Funnelback partial response content. Its role for the FE rebuild is structurally equivalent to what `funnelback-endpoint-dictionary-2026-05-01.json` plays for the proxy rebuild: an external-constraints reference, not a snapshot for context, not a cleanup target list. The proxy's upstream Funnelback wire shapes can't change because Funnelback won't accept anything different. The FE-authored HTML can't change freely because Squiz stencils main.js reads the page's input-element data-* attributes, the FE's own selectors read its own emitted classes and IDs, assistive technology consumes the ARIA contract, and CSS rules style by class. This document defines that contract by enumeration.

Phase A is one of five phases (A through E) into which the HTML audit was split during the 2026-05-11 session — see `html-audit-plan-2026-05-11.md` for the multi-phase plan and `session-report-2026-05-11-html-audit-pivot.md` for the substantive findings carried in. Phase A is the FE-side phase; B documents what the FE consumes from external surfaces; C, D, and E document the Squiz stencils, T4 PageLayout, and Funnelback partial contract surfaces respectively. Phase A is finishable in a single audit chat cycle because the seam contracts can be documented from the FE side without waiting for the other phases.

The "exact same HTML" constraint is operationalized this way in the document: byte-identical isn't the bar (whitespace, attribute ordering, and comment text aren't load-bearing), but stable element IDs, class names, ARIA roles and attributes, data-* attribute names and value semantics, structural nesting where selectors expect specific ancestor or descendant relationships, click-mechanism contracts (anchor-wrapping versus pure JS handling per item type), and the presence or absence of specific elements that other layers test for — all of those are load-bearing and form the contract this document defines. Render-time truncation caps are a separate display contract layered on top of the data contract and are captured in their own field.

The audit also stays alert to the "reactive accretion masquerading as design" pattern that the prefetch archaeology audit established as generalizable. On the FE HTML side this looks like attributes that exist on emitted elements but are never read by any code in this repo or any external consumer, classes that appear in HTML but have no matching CSS or JS hook, and structural conventions that look like contracts but are residue. Findings of this shape get recorded as `VESTIGIAL_CANDIDATE` with the rebuild's interpretation deferred to the design phase.

## Scope

**In scope.** HTML originating from FE code in `su-search-dev`, plus the seam contracts the FE-authored HTML depends on from its parent containers. Specifically:

- The `#header-suggestions` container created by `findSearchComponents` in `integration.js` (lines 268–284) and its `.suggestion-item` flat children written by `renderHeaderSuggestions`. Container is FE-authored; its position in the DOM (next sibling of header form) and parent ancestry are seam dependencies on T4 PageLayout.
- The contents written into `#autocomplete-suggestions` by `search-page-autocomplete.js` — the three-column tri-modal layout with general, staff, and programs columns, each carrying its own card schema and click-contract. The container itself is Squiz stencils boilerplate (deferred to Phase C); the contents inside are FE-authored.
- The `<div id="funnelback-search-container-response" class="funnelback-search-container">` wrapper around search results, pending Phase A.2 static-analysis confirmation that FE writes this wrapper (rather than Funnelback emitting it as part of the partial response). Treat as in-scope-pending-confirmation; if A.2 shows Funnelback emits the wrapper, the entry moves to Phase E.
- Per-suggestion-item HTML strings with their `data-type`, `data-url`, `data-index` attributes; per-column embedded-anchor patterns (general items have no anchor wrapping; staff items wrap in `<a class="staff-link" target="_blank" rel="noopener noreferrer">`; program items wrap in `<a class="program-link" target="_blank" rel="noopener noreferrer">`); render-cap policies per column.
- Any other dynamic insertion the static-analysis pass surfaces from the four HTML-loaded scripts (`integration.js`, `search-page-autocomplete.js`, `SessionService.js`, `search-index.js`) plus the dynamically-loaded `core-search-manager.js` and the six per-feature managers (`AnalyticsManager`, `TabsManager`, `FacetsManager`, `PaginationManager`, `SpellingManager`, `CollapseManager`).
- Seam contracts: for each FE-authored entry, the parent container's identity and source-layer ownership, plus the cross-seam contract attributes the FE depends on from that parent (the container existing with a specific ID, the container accepting innerHTML replacement, the container's position in document order, etc.).

**Out of scope.** Each of the other Phase A through E phases owns a region not covered here:

- Phase B (FE's external-contract consumption) — every `getElementById`, `querySelector`, `closest`, and attribute read in FE code, mapped to the external HTML it assumes. Phase A's seam sub-objects partially cover this territory but don't enumerate it.
- Phase C (Squiz stencils contract surface) — the `concierge-search-form` cluster: form, label, the input element with its `data-collection` / `data-profile` / `data-form` / `data-autocomplete` / `data-max-results` / `data-min-length` / `data-results-container` configuration attributes, the hidden `<div class="search-config">`, the `<div class="search-controls">`, the `#autocomplete-suggestions` container itself (as container; its FE-written contents are Phase A).
- Phase D (T4 PageLayout contract surface) — `site-header`, `page-wrapper`, the `su-listing` / `searchAreaWrapper` / `searchArea` chrome nesting, the header bar structure on non-search pages.
- Phase E (Funnelback partial contract surface) — per-renderer markup (news, programs, people, law, basic); tab bar; facets sidebar; pagination; spelling block; curator/best-bet slots; the hidden `<div style="display:none">` and `<script src="…stencils/js/main.js">` injected into `#funnelback-search-container-response` from the Funnelback response side.

CSS styling rules, JS event listener attachment behavior (covered in the listener audit), the renderer-to-producer mapping (rendering audit, item 9), and the `/funnelback/tools` proxy-endpoint traffic-source question are all out of scope for the HTML audit phases generally. Any of these that surface during Phase A captures get flagged and queued, not pursued.

## Source layers

Every entry carries a `source_layer` field with one of five values, defining who controls the HTML:

- **`FE_DYNAMIC_INSERTION`** — written by JS in this repo. Rebuild has full control; current implementation is the contract baseline. Most Phase A entries fall here.
- **`T4_PAGELAYOUT`** — emitted by Seattle U's T4 CMS template. Rebuild has zero direct control. Phase A entries with this source_layer appear only as seam parents; full T4 entries belong in Phase D.
- **`SQUIZ_STENCILS_BOILERPLATE`** — the `concierge-search-form` cluster and any related markup emitted by Squiz stencils templates as part of the Funnelback response. Structurally distinct from T4 chrome (which is Seattle U's CMS) and from Funnelback partial response content (which is dynamic per query). Phase A entries with this source_layer appear only as seam parents; full Squiz stencils entries belong in Phase C.
- **`FUNNELBACK_PARTIAL`** — emitted by Funnelback or Squiz FTL templates as part of the search-results response body. Phase A entries with this source_layer appear only as seam parents or as wrapper elements pending source confirmation; full Funnelback partial entries belong in Phase E.
- **`SQUIZ_INJECTED`** — any HTML present in production that none of the above explain. Reserved for captures that surface a fifth source (analytics widgets, A/B testing tooling, externally-loaded chat tools). Phase A flags these for later phase resolution rather than analyzing them.

## Methodology

Phase A is itself a five-step sub-process. To avoid confusion with the broader Phase A through E split, the sub-steps are numbered A.1 through A.5.

**Phase A.1 — this brief.** Assembled in chat and locked as a markdown artifact. Today's deliverable.

**Phase A.2 — Claude Code static-analysis session against `su-search-dev`.** Enumerates every FE-controlled HTML insertion, query, and attribute read in the four HTML-loaded scripts plus the dynamically-loaded `core-search-manager.js` and the six per-feature managers. Produces a partial JSON document covering all `FE_DYNAMIC_INSERTION` entries fully — `literal_html_variants`, `attributes` with `binding` annotations, `consumers` lists, `seam` sub-object, `design_latitude` per dimension, `render_cap` where applicable. Skeleton entries get created for the seam parents (the T4 PageLayout, Squiz stencils, and Funnelback partial elements that Phase A's FE-authored entries depend on), marked with their `source_layer` and a `TO_CAPTURE` placeholder where structural detail belongs — those skeletons hand off to the future Phase C, D, and E audits rather than getting filled in here. Cross-references rather than re-derives findings already in the autocomplete audit §10, the listener audit, and the FE endpoint dictionary.

**Phase A.3 — Vic's runtime DOM capture pass.** With the partial JSON in hand, capture targets are explicit and placeholder-tagged. The four DOM captures from the 2026-05-11 session already cover the search-page side: search-page initial state, on-page dropdown with staff column focused, on-page dropdown with all three columns rendered for "biology", and the rendered UX of the on-page dropdown for "biology". Two captures remain to be taken in A.3: the header dropdown populated on a non-search page (anchors `#header-suggestions` populated state and the `.suggestion-item` flat-layout contract), and a non-search-page idle header capture if A.2's static analysis surfaces FE-controlled HTML that isn't visible on the search page. Captures use DevTools "Copy → Copy outerHTML" on the relevant DOM region. Posted into a follow-up chat for synthesis or into this chat if the static-analysis pass runs separately as is typical.

**Phase A.4 — synthesis.** Captures get folded into the JSON, the markdown companion document is written from the JSON, both ship as audit deliverables. The JSON is the document Claude Code consumes during rebuild design and implementation phases; the markdown is the human-readable companion.

**Phase A.5 — project-instructions update.** Mark audit-cadence sub-item 8a complete in v16 of the project instructions, reference the new canonical document, queue Phase A's follow-ups (any anomalies that surface during captures). Update CLAUDE.md to reference the Phase A audit document rather than pointing at autocomplete audit §10 for FE-authored HTML contract.

## JSON schema

The document is a JSON object with a top-level `meta` object and an `entries` array. Each entry is keyed by stable `id` and captures one element or structural unit's contract. The full schema:

```json
{
  "meta": {
    "audit_date": "2026-05-XX",
    "audit_version": "1.0.0",
    "phase": "A",
    "scope": "Canonical FE-authored HTML requirements for su-search rebuild — header dropdown and on-page autocomplete dropdown contents, plus seam contracts to parent containers",
    "binding_status": "REQUIREMENTS — rebuild MUST reproduce the contract surfaces marked REQUIRED or EXTERNAL_CONSUMER_REQUIRED",
    "source_layers": [
      "FE_DYNAMIC_INSERTION",
      "T4_PAGELAYOUT",
      "SQUIZ_STENCILS_BOILERPLATE",
      "FUNNELBACK_PARTIAL",
      "SQUIZ_INJECTED"
    ],
    "binding_values": [
      "REQUIRED",
      "EXTERNAL_CONSUMER_REQUIRED",
      "TO_DETERMINE",
      "VESTIGIAL_CANDIDATE",
      "NOT_BINDING"
    ],
    "behavioral_consumers": [
      {
        "id": "squiz-stencils-main-js",
        "url": "https://dxp-us-search.funnelback.squiz.cloud/s/resources/seattleu~ds-search/_default/themes/stencils/js/main.js",
        "loaded_by": "Funnelback partial response",
        "presumed_consumed_attributes": [
          "data-autocomplete",
          "data-collection",
          "data-profile",
          "data-max-results",
          "data-min-length",
          "data-results-container"
        ],
        "notes": "External JS loaded into the page; consumes input-element data-* configuration. Source code not inspected; consumption inferred from Squiz stencils framework conventions and confirmed-active status from 2026-05-11 capture."
      }
    ],
    "capture_states": [
      "non-search-idle",
      "non-search-header-dropdown",
      "search-initial",
      "search-on-page-dropdown-staff-focused",
      "search-on-page-dropdown-all-columns",
      "search-on-page-dropdown-rendered-ux"
    ],
    "cross_references": [
      "audit/fe-autocomplete-audit-2026-05-05.md §10",
      "audit/fe-endpoint-dictionary-2026-05-08.json",
      "audit/fe-listener-audit-2026-05-06.md",
      "audit/html-audit-plan-2026-05-11.md",
      "session-report-2026-05-11-html-audit-pivot.md"
    ]
  },
  "entries": [
    {
      "id": "string — stable identifier, kebab-case",
      "selector": "string — CSS selector or structural description that uniquely identifies this element",
      "source_layer": "enum from meta.source_layers",
      "writer": {
        "file": "string — file path, or EXTERNAL with description for non-repo layers",
        "function": "string — function name when applicable",
        "line_range": "string — line numbers when applicable",
        "behavior": "string — what the writer does, when, and under what condition"
      },
      "structural_role": "string — one-sentence description of what this element does in the page",
      "literal_html": "string — the exact HTML this element produces in its captured state (multi-line ok)",
      "literal_html_variants": {
        "state-name": "string — HTML for this element in a specific state if it varies"
      },
      "attributes": {
        "attribute-name": {
          "value": "string — the value or value pattern",
          "binding": "enum from meta.binding_values",
          "rationale": "string — why this binding status, with file:line evidence when REQUIRED or EXTERNAL_CONSUMER_REQUIRED"
        }
      },
      "consumers": [
        {
          "consumer_type": "enum: IN_REPO_FE | EXTERNAL_JS_LOADED_BY_FUNNELBACK | ASSISTIVE_TECH_INFERRED | CSS_INFERRED",
          "file": "string — file path, or reference to a meta.behavioral_consumers entry for external consumers",
          "line": "integer or string range, omitted for external consumers",
          "context": "string — what this consumer does with the element"
        }
      ],
      "seam": {
        "parent_container_id": "string — the parent container this element is written into",
        "parent_container_source_layer": "enum from meta.source_layers — who owns the parent",
        "contract_dependencies": [
          "string — what the FE depends on from the parent (e.g., 'parent must exist as element with this ID at innerHTML write time', 'parent must accept innerHTML replacement without external consumers losing references', 'parent must be in document order before #results')"
        ]
      },
      "design_latitude": {
        "visual_appearance": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE — what the rebuild can change versus what's fixed",
        "class_names": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE",
        "inner_dom_structure": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE",
        "click_mechanism": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE",
        "attribute_set": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE",
        "content_schema": "enum: OPEN | FIXED | BOUNDED | TO_DETERMINE",
        "notes": "string — brief statement per dimension where the enum alone doesn't carry the contract"
      },
      "render_cap": {
        "value": "integer or null — render-time truncation cap",
        "truncation_location": "string — file:line where the truncation happens",
        "rationale": "string — brief note on why this value, if known"
      },
      "appears_on": ["array of page contexts where this element is present"],
      "captured_in_state": "string — which capture_state(s) sourced this entry",
      "gaps": ["array of strings — open questions, items needing capture or follow-up"],
      "notes": "string — anything else the rebuild needs to know about this element"
    }
  ]
}
```

A few field-level notes.

**`binding`** is the field that carries the actual contract. `REQUIRED` means the rebuild must reproduce this exactly because an in-repo consumer or assistive-tech contract reads it. `EXTERNAL_CONSUMER_REQUIRED` means the rebuild must reproduce this because an external consumer (Squiz stencils main.js, principally) reads it — Phase A entries don't directly enumerate FE call sites for these since the consumer is outside the repo, but the `behavioral_consumers` meta array names the consumer and the rationale field cites it. `TO_DETERMINE` flags attributes whose contractual status isn't yet known. `VESTIGIAL_CANDIDATE` means the attribute is written but no consumer was found anywhere — the data-* input-element situation that the FE endpoint dictionary flagged as `data_star_attributes_on_input: "NONE"` was a `VESTIGIAL_CANDIDATE` reading; the 2026-05-11 session's Finding 1 reclassified those attributes as `EXTERNAL_CONSUMER_REQUIRED` once the Squiz stencils main.js consumer surfaced.

**`design_latitude`** carries six dimensions with explicit enum values. `OPEN` means the rebuild can freely change this dimension. `FIXED` means the rebuild must preserve this dimension's contract. `BOUNDED` means the rebuild has partial latitude — typically that the dimension can change within a constraint (e.g., `content_schema` for the staff column is `BOUNDED` because the rebuild can drop slots but not add new ones without API changes). `TO_DETERMINE` means the dimension's latitude depends on Phase B/C/E findings not yet in hand. The `notes` field carries the specific constraint when `BOUNDED` or where `FIXED` needs explanation.

**`render_cap`** captures the binding display contract that's separate from the data contract — the FE renders up to N items per column even when the API returns more. The 2026-05-11 UX capture suggested 9 for general, 6 for staff, 6 for programs; A.2 static analysis pulls the canonical values from the source.

**`seam`** carries the parent-container dependency surface. The `contract_dependencies` array enumerates what the FE assumes about its parent without becoming Phase B's job (Phase B catalogues FE's external-contract consumption comprehensively across all FE code; Phase A's seam fields capture just the parent dependencies for each FE-authored entry).

**`consumers[].consumer_type`** lets the rebuild distinguish in-repo consumers (which the rebuild controls) from external consumers (which the rebuild must accommodate). The `IN_REPO_FE` consumers can change if the rebuild changes them; the `EXTERNAL_JS_LOADED_BY_FUNNELBACK`, `ASSISTIVE_TECH_INFERRED`, and `CSS_INFERRED` consumers can't.

Two sample entries for reference, one fully FE-authored and one with significant seam dependencies:

```json
{
  "id": "header-suggestions-container",
  "selector": "#header-suggestions",
  "source_layer": "FE_DYNAMIC_INSERTION",
  "writer": {
    "file": "public/integration.js",
    "function": "findSearchComponents",
    "line_range": "268-284",
    "behavior": "Created if not pre-existing in DOM; inserted as nextSibling of header form."
  },
  "structural_role": "Container for header-bar autocomplete suggestions; populated by renderHeaderSuggestions.",
  "literal_html_variants": {
    "empty": "<div id='header-suggestions' class='header-suggestions-container' role='listbox' hidden></div>",
    "populated": "Same outer element; innerHTML replaced at integration.js:623 with .suggestions-list wrapper containing .suggestion-item children — see entry 'header-suggestion-item'."
  },
  "attributes": {
    "id": { "value": "header-suggestions", "binding": "REQUIRED", "rationale": "Queried at integration.js:610; used as outside-click boundary at integration.js:424" },
    "class": { "value": "header-suggestions-container", "binding": "TO_DETERMINE", "rationale": "No FE consumer; CSS hook plausible (T4 stylesheet) — CSS audit needed to confirm" },
    "role": { "value": "listbox", "binding": "REQUIRED", "rationale": "ARIA contract paired with role=option on .suggestion-item children; ASSISTIVE_TECH_INFERRED consumer" },
    "hidden": { "value": "boolean attribute, toggled", "binding": "REQUIRED", "rationale": "Visibility state controlled by integration.js:431 outside-click dismissal" }
  },
  "consumers": [
    { "consumer_type": "IN_REPO_FE", "file": "public/integration.js", "line": 424, "context": "Outside-click dismissal boundary" },
    { "consumer_type": "IN_REPO_FE", "file": "public/integration.js", "line": 610, "context": "innerHTML write target for renderHeaderSuggestions" },
    { "consumer_type": "ASSISTIVE_TECH_INFERRED", "file": "N/A", "context": "role=listbox paired with role=option on children" }
  ],
  "seam": {
    "parent_container_id": "header form element (closest('form') ancestor of #search-input)",
    "parent_container_source_layer": "T4_PAGELAYOUT",
    "contract_dependencies": [
      "Header form must exist in DOM at findSearchComponents time (defensive fallback to dynamic creation if absent)",
      "Form must accept a nextSibling insertion at insertBefore call site (line 282) without external consumers depending on the position",
      "#search-input must be a descendant of the form for the closest('form') traversal to succeed"
    ]
  },
  "design_latitude": {
    "visual_appearance": "OPEN",
    "class_names": "TO_DETERMINE",
    "inner_dom_structure": "BOUNDED",
    "click_mechanism": "TO_DETERMINE",
    "attribute_set": "BOUNDED",
    "content_schema": "FIXED",
    "notes": "inner_dom_structure BOUNDED — rebuild can change item element type/wrapping as long as flat .suggestion-item list with role=option children is preserved. content_schema FIXED — API returns flat string[] or {display: string}[]; per-item content is one text span."
  },
  "render_cap": {
    "value": "TO_CAPTURE",
    "truncation_location": "public/integration.js renderHeaderSuggestions — line range pending A.2",
    "rationale": "Cap value not yet pinned; visible UX suggests bounded but exact value pending source read"
  },
  "appears_on": ["all pages where #search-input exists"],
  "captured_in_state": "non-search-header-dropdown (A.3-pending)",
  "gaps": [
    "Header dropdown render cap value pending A.2",
    "Whether .header-suggestions-container has CSS rules in T4 stylesheets pending future CSS audit"
  ],
  "notes": "FE-controlled in creation; position in DOM (nextSibling of header form) determined by T4 layout. Rebuild must preserve id, role, hidden-toggling behavior, and next-sibling positioning."
}
```

```json
{
  "id": "on-page-suggestion-item-staff",
  "selector": ".suggestion-item.staff-item",
  "source_layer": "FE_DYNAMIC_INSERTION",
  "writer": {
    "file": "public/search-page-autocomplete.js",
    "function": "buildSuggestionsHTML (and surrounding render logic)",
    "line_range": "400-458 per autocomplete-audit §10",
    "behavior": "Per-item HTML string built and concatenated into the staff column's innerHTML write to #autocomplete-suggestions."
  },
  "structural_role": "One staff suggestion within the on-page autocomplete dropdown's staff column; presents person card with click navigation to faculty profile URL.",
  "literal_html": "<div class='suggestion-item staff-item' role='option' data-index='{N}' data-type='staff' data-url='{person.url}'><a href='{person.url}' class='staff-link' target='_blank' rel='noopener noreferrer'><img class='staff-thumbnail' src='{photo or fallback}'>...<div class='staff-info'>...</div></a></div>",
  "attributes": {
    "class": { "value": "suggestion-item staff-item", "binding": "REQUIRED", "rationale": "Queried by keyboard-nav handler; CSS_INFERRED for visual contract; design_latitude for class_names is TO_DETERMINE pending CSS audit" },
    "role": { "value": "option", "binding": "REQUIRED", "rationale": "ARIA contract paired with role=listbox on container" },
    "data-index": { "value": "integer string", "binding": "TO_DETERMINE", "rationale": "No FE call site reads data-index per autocomplete audit; keyboard nav uses array position. Pending VESTIGIAL_CANDIDATE confirmation in A.2." },
    "data-type": { "value": "'staff'", "binding": "REQUIRED", "rationale": "Read by click handler at search-page-autocomplete.js (line range pending A.2) for analytics payload and click-routing" },
    "data-url": { "value": "person.url", "binding": "REQUIRED", "rationale": "Read by click handler for analytics; also the href on the embedded staff-link anchor" }
  },
  "consumers": [
    { "consumer_type": "IN_REPO_FE", "file": "public/search-page-autocomplete.js", "line": "click handler line range pending A.2", "context": "Click handler reads data-type and data-url; sets input value; fires performSearch or follows anchor navigation" },
    { "consumer_type": "IN_REPO_FE", "file": "public/search-page-autocomplete.js", "line": "keyboard handler line range pending A.2", "context": "Keyboard navigation cycles activeItem across .suggestion-item elements" },
    { "consumer_type": "ASSISTIVE_TECH_INFERRED", "file": "N/A", "context": "role=option contract" },
    { "consumer_type": "CSS_INFERRED", "file": "N/A", "context": "Visual card design styled by .staff-item class" }
  ],
  "seam": {
    "parent_container_id": "#autocomplete-suggestions > .suggestions-list > .suggestions-columns > .suggestions-column (staff column)",
    "parent_container_source_layer": "SQUIZ_STENCILS_BOILERPLATE (outer container only; inner columns are FE-authored)",
    "contract_dependencies": [
      "#autocomplete-suggestions must exist in DOM at search-page-autocomplete.js innerHTML write time",
      "Container must accept full innerHTML replacement (no external consumers holding references to children)"
    ]
  },
  "design_latitude": {
    "visual_appearance": "OPEN",
    "class_names": "TO_DETERMINE",
    "inner_dom_structure": "BOUNDED",
    "click_mechanism": "FIXED",
    "attribute_set": "BOUNDED",
    "content_schema": "BOUNDED",
    "notes": "click_mechanism FIXED — must use <a target='_blank' rel='noopener noreferrer' href=...> wrapping per Finding 3 (2026-05-11) for native middle-click/cmd-click navigation and security hygiene. content_schema BOUNDED — six slots from API (photo, name, position, affiliation_type, department, college); rebuild can drop slots but adding requires API change. attribute_set BOUNDED — data-type and data-url required; data-index TO_DETERMINE. class_names TO_DETERMINE — CSS audit pending."
  },
  "render_cap": {
    "value": "6 (suggested by 2026-05-11 UX capture; canonical value TO_CAPTURE from source in A.2)",
    "truncation_location": "public/search-page-autocomplete.js — line range pending A.2",
    "rationale": "Staff cards are visually expensive (multi-line); 6-cap keeps dropdown vertical footprint bounded per Finding 4 (2026-05-11)"
  },
  "appears_on": ["search page when on-page input has typed query producing staff results"],
  "captured_in_state": "search-on-page-dropdown-staff-focused, search-on-page-dropdown-all-columns, search-on-page-dropdown-rendered-ux",
  "gaps": [
    "Canonical render cap value from source pending A.2",
    "Click handler and keyboard handler line ranges pending A.2",
    "data-index binding classification pending A.2 — VESTIGIAL_CANDIDATE or TO_DETERMINE depending on keyboard-handler read pattern"
  ],
  "notes": "Per Finding 2 (2026-05-11), staff column is one of three tri-modal column types; entry captures staff contract independently from general and programs columns. Per Finding 3, click-mechanism asymmetry across columns is binding — staff uses anchor wrapping, general uses pure JS click."
}
```

## Capture list

Two captures remain for Phase A.3. The four captures from the 2026-05-11 session already cover the search-page side and are folded into the JSON during A.4 synthesis.

The non-search-page captures are: idle header chrome (anchors the static form, the toggle button, and surrounding navigation if relevant — primarily a seam-context capture rather than a Phase A entry capture, since FE-authored content isn't present idle on a non-search page); and header chrome with dropdown visible after typing into the header input on a non-search page (anchors `#header-suggestions` populated state and `.suggestion-item` flat-layout contract).

The non-search-page-idle capture is conditional — A.2's static analysis may surface FE-controlled HTML that isn't observable in the populated capture but exists at idle, in which case the idle capture matters. If A.2 surfaces nothing of the sort, the populated capture alone suffices.

Vic's choice of query for the populated capture drives the timing — any query that surfaces header suggestions (which only returns general items, not staff or programs) is fine.

A capture-time alertness item: A.3 watches for any HTML in the captures that the static analysis didn't predict. Unpredicted DOM elements, attributes, or script tags get flagged as gaps for the relevant later phase rather than getting analyzed here (since they're likely T4 PageLayout, Squiz stencils, Funnelback partial, or Squiz-injected content — Phase A's territory is FE-authored only).

## Stop rules

A.2 reads the four HTML-loaded scripts in full, plus `core-search-manager.js` and the six per-feature managers for HTML-emitting code. Does not chase into FTL templates (not in repo), T4 PageLayout templates (not in repo), Squiz stencils main.js (not in repo), or any other external HTML source. Does not enumerate every theoretical HTML state — only the FE-authored insertions get full entries; non-FE-authored elements that appear as seam parents get skeleton entries with the structural detail deferred to their owning phase.

A.4 synthesis does not re-derive findings from the autocomplete audit §10, the FE endpoint dictionary, the listener audit, or the 2026-05-11 session report. Where prior findings cover an element fully, the new entry cites them and adds only delta — typically the binding annotations, seam sub-object, design_latitude object, and render_cap field that are net-new to the HTML audit framing.

A.4 does not propose rebuild design decisions inside the document. Findings flagged as `VESTIGIAL_CANDIDATE` or with open `gaps` are recorded as findings; the rebuild design phase, not this audit, decides whether to honor or drop them. The `design_latitude` field is descriptive of what the contract permits, not prescriptive of what the rebuild should do.

## Cross-references to prior audits

The **autocomplete audit's §10** (`audit/fe-autocomplete-audit-2026-05-05.md`) has the dropdown contract surfaces — class names (`.suggestions-list`, `.suggestions-columns`, `.suggestions-column`, `.column-header`, `.suggestion-item`, `.suggestion-text`, `.staff-item`, `.staff-link`, `.program-item`, `.program-link`, etc.), ARIA (`role="listbox"` / `role="option"`), data attributes consumed by handlers (`data-type`, `data-url`, `data-index`), and element IDs. These fold into JSON as-is with binding annotations and the new schema fields layered on. The autocomplete audit's lifecycle findings about `findSearchComponents` and the render seam at `container.innerHTML = html` (line 501) become the writer-evidence for Phase A entries.

The **FE endpoint dictionary** (`audit/fe-endpoint-dictionary-2026-05-08.json`) has the empty-finding `data_star_attributes_on_input: "NONE"` for the on-page input element's `data-collection` / `data-profile` / `data-form` attributes. Per 2026-05-11 Finding 1, that finding was correct within scope (no FE call site reads the attributes) but the implied conclusion was generalized too far — Squiz stencils main.js is the external consumer. Phase A's entries for the input element (treated as seam parent, full entry in Phase C) reflect this as `EXTERNAL_CONSUMER_REQUIRED` binding. The FE endpoint dictionary's row needs amendment to reflect the Squiz stencils finding; that amendment ships when Phase C completes (per the plan document's amendment queue).

The **listener audit** (`audit/fe-listener-audit-2026-05-06.md`) catalogues static element IDs (`#search-input`, `#autocomplete-concierge-inputField`, `#header-suggestions`, `#autocomplete-suggestions`, `#results`, `#site-search--button-toggle`, `.site-search__toggle`, `#on-page-search-button`). These become anchor IDs for Phase A entries and their `consumers` arrays cite the listener audit's evidence. Seam dependencies that the listener audit established (e.g., `#autocomplete-concierge-inputField` and `#autocomplete-suggestions` co-existing in the search-page DOM at `findSearchComponents` time) become `contract_dependencies` in the seam sub-objects.

The **HTML audit plan document** (`html-audit-plan-2026-05-11.md`) and **session report** (`session-report-2026-05-11-html-audit-pivot.md`) carry the four findings that motivate Phase A's schema additions. Findings are referenced in entry `notes` and `gaps` fields where applicable rather than re-derived.

## Deliverable shape

Two files in `audit/`:

- `audit/html-audit-phase-a-2026-XX-XX.json` — canonical binding document, consumed by Claude Code during rebuild design and implementation. Adheres to the schema above.
- `audit/html-audit-phase-a-2026-XX-XX.md` — readable companion mirroring the JSON's organization. Structure: preamble (purpose, posture, binding interpretation, Phase A scope statement), Header-bar suggestions section (header-suggestions container, header-suggestion-item), On-page autocomplete dropdown section with subsections for the suggestions-list wrapper, the suggestions-columns layout, and per-column entries (general, staff, programs), Search-results wrapper section (if A.2 confirms FE writes the `funnelback-search-container-response` wrapper), followed by a Cross-cutting findings section for patterns spanning multiple entries (click-mechanism asymmetry, render-cap policy, vestigial-candidate inventory, ARIA contract summary). Each entry renders as a brief prose paragraph plus a fenced-code HTML snippet plus a structured summary of attributes, seam, and design_latitude.

## Generalization policy for captured content

Default: real-content placeholders. Faculty names get replaced with `{{FACULTY_NAME}}`, real result titles with `{{RESULT_TITLE}}`, URLs to specific people or pages with `{{PERSON_URL}}` or `{{PROGRAM_URL}}`, faculty department / role text with `{{FACULTY_ROLE}}` / `{{FACULTY_DEPARTMENT}}`. The structural HTML is preserved; the content inside text nodes and attribute values gets generalized. This keeps the audit doc shareable and focused on structure rather than dev-environment content. Exception: query strings used in URL parameters (`?query=biology`) can stay as captured if they help reproduce the state; replace only PII or user-content text.

Override available if Vic wants real content preserved for any specific capture — flag at capture time.
