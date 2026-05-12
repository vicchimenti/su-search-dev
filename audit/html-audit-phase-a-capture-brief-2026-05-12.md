# HTML Audit Phase A.3 — Capture Brief (2026-05-12)

Companion to `html-audit-phase-a-partial-2026-05-12.json`. Defines the two captures remaining for Phase A and what each is meant to confirm.

## Captures to take

### Capture 1 — Non-search-page header dropdown populated

**State setup.** Navigate to any non-search page on the seattleu.edu dev environment (a content page, the homepage, anything other than `/search-test/`). Click into the header search input. Type a query that's known to return general suggestions — Vic's pick. The header dropdown should be visible and populated.

**Region to capture.** DevTools → Elements → find the `#header-suggestions` div → right-click → Copy → Copy outerHTML. Then also copy the parent header form (or however much of the header bar's HTML is needed to anchor the form's position relative to the dropdown — at minimum the form + the suggestions container as siblings, ideally the whole `<header>` chrome since this also feeds the Phase D seam capture).

**What this capture confirms.**
- `#header-suggestions` container shape (id, class, role, hidden — empty in idle / populated when shown).
- `.suggestions-list` wrapper presence and exact attribute set.
- `.suggestion-item` flat-list shape with `role="option"` and `data-index`. **No** `data-type`, **no** `data-url`, **no** anchor wrapping — verifies the header variant per A.2 Finding F7.
- The number of items rendered for the query — this pins the upstream render cap (A.2 Finding F1) that the rebuild's API-side `show=N` parameter will need to honor. Vic, please note the query used and the count.
- Whether `<span class="suggestion-text">` content is rendered escaped or unescaped — if unescaped HTML appears (e.g., `<strong>` tags from query-term highlighting), that's a new XSS-surface finding for the audit.
- The exact insertion position of `#header-suggestions` relative to the header `<form>` — confirms the `insertBefore(suggestionsContainer, headerForm.nextSibling)` contract.

**Items to flag if seen.**
- Any unpredicted attributes on the elements (e.g., a `data-*` attribute on `#header-suggestions` that the FE doesn't emit — would indicate T4 PageLayout is wrapping or modifying the FE-created container).
- Any T4-emitted siblings that the FE depends on positionally without naming.
- If `#header-suggestions` pre-exists in the DOM (i.e., is part of T4 PageLayout chrome rather than FE-created on findSearchComponents), the FE's create-fallback path at integration.js:268-280 is dead code — flag this directly.

### Capture 2 — Non-search-page idle header (CONDITIONAL)

**Condition for taking.** A.2 did not surface any FE-emitted HTML that's only present at idle (the header dropdown is the only FE-emitted body-level content on non-search pages, and it's not present at idle). So this capture is **optional** — its purpose is seam confirmation rather than Phase A entry confirmation.

**Take it if:** Vic wants the Phase D (T4 PageLayout) seam capture started early. Many of the seam parents in the partial JSON's skeleton entries (`_seam_search-input`, the header form, `#site-search--button-toggle`, `.site-search__toggle`) live in the T4 header chrome — capturing the idle header now gives Phase D a head start.

**Skip it if:** Phase D will be its own audit cycle and this capture isn't needed for Phase A's deliverable.

**State setup.** Same non-search page, header input empty / unclicked. Standard idle page.

**Region to capture.** The full `<header>` element (or whatever the T4 PageLayout's outer header wrapper is). DevTools → Elements → find the header → Copy outerHTML.

**What this capture confirms.**
- That `#header-suggestions` does NOT exist at idle (FE-created on first interaction, not T4-pre-emitted).
- The `#search-input` element's attribute surface (Phase D — input id, name, type, any data-* attributes, ARIA, placeholder).
- The header form's structure (`<form>` action, method, any data-* attributes).
- The `#site-search--button-toggle` and `.site-search__toggle` elements that integration.js:152-153 references but Phase A does not currently catalog as seam parents — A.3 capture would surface these and Phase D would document.
- Any SVG sprite `<symbol id="...">` definitions inline in the header — possibly including the `#add` and `#subtract` symbols referenced by the tab-group toggle button (per the `_seam_svg-sprite-symbols` skeleton entry).

## Generalization policy (reminder, per A.1 brief)

Default: real-content placeholders. In captures, replace:
- Faculty/staff names → `{{FACULTY_NAME}}`
- Real result titles → `{{RESULT_TITLE}}`
- Real URLs to people/pages → `{{PERSON_URL}}` / `{{PROGRAM_URL}}` / `{{RESULT_URL}}`
- Faculty department / role / college text → `{{FACULTY_ROLE}}` / `{{FACULTY_DEPARTMENT}}` / `{{FACULTY_COLLEGE}}`
- Email addresses, phone numbers, room numbers → `{{EMAIL}}` / `{{PHONE}}` / `{{LOCATION}}`

Structural HTML is preserved as-is. Query strings (`?query=biology`) can stay if they help reproduce state; replace only PII or user-content text.

Override available — if Vic wants real content preserved for a specific capture, flag at capture time.

## Capture-time alertness (per A.1 brief, restated)

A.3 watches for HTML in the captures that A.2's static analysis didn't predict. Unpredicted elements, attributes, or script tags get flagged as **gaps for the relevant later phase** (most likely Phase D for T4 PageLayout chrome, Phase E for Funnelback partial content, Phase C for Squiz stencils boilerplate) rather than getting analyzed here. Phase A's territory is FE-authored only.

If a capture surfaces something that genuinely contradicts an A.2 finding (e.g., `data-index` is read by an HTML attribute selector somewhere visible in the capture, or `#header-suggestions` IS pre-emitted by T4), flag it directly — A.2's finding gets revised, not Phase A's interpretation.

## Hand-off

Captures posted into a follow-up chat (or this chat if A.4 synthesis happens here) become the inputs to A.4. A.4 folds them into the JSON's `literal_html` fields where currently `TO_CAPTURE` and resolves gaps where capture data confirms or contradicts A.2's reads. A.4 then writes the markdown companion document and ships both as the Phase A deliverable.
