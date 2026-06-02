# HTML Audit Phase B — FE external-contract consumption

**Audit date:** 2026-06-02
**Phase:** B (FE external-contract consumption — the inverse view; final HTML audit phase)
**Companion JSON:** `audit/html-audit-phase-b-2026-06-02.json` (canonical evidence)
**Brief:** `docs/html-audit-phase-b-brief-2026-06-02-v1.1.md` (ratified v1.1; provided inline by Vic this session — see session report for the brief-not-on-disk gap)
**Predecessor phases:** Phase A v2 markdown + v3 JSON, Phase C, Phase E, Phase D (Phase D referenced via CLAUDE.md restatement; deliverable files not on disk in this repo)

## Headlines

- **Four handoff items resolved:** E7 (typo IDs), E8 (CTA fixtures), E9 (`listing-item--course`), dataListing/per-type `*Data` (D7).
- **Ten findings B1-B10** in two streams: 6 CONSUMER_ABSENT, 4 CROSS_REFERENCE. Zero CONSUMER_CONFIRMED and zero CONSUMER_EXTERNAL — every handoff item came back ABSENT on every dimension grepped this session.
- **Stylesheet-alignment cross-check fired in-session.** Vic provided the T4-served Funnelback stylesheet (v3.1.2, dated 2026-02-02) inline; the brief's named carried-forward documentary residual collapses to one narrower residual (RES1).
- **One named open residual:** RES1 — the T4-shipped JS dimension of E7 (whether Squiz framework JS or T4 page-layout chrome JS targets the typo'd IDs at runtime). Vic elected to close E7 with this narrower residual rather than wait for live-page capture this session.
- **HTML audit sequence closes** (A → C → E → D → B) with one named residual.
- **D7 hypothesis negatively confirmed on both binding-evidence surfaces.** The camelCase paired generic-plus-per-type pattern (dataListing + `*Data` suffixes) has no JS-hook consumer and no stylesheet consumer.
- **Two housekeeping gaps recorded** (not blocking): the Phase B brief and the Phase D deliverables are absent from the repo on disk despite being referenced as canonical. Operative content for both came from CLAUDE.md restatement or Vic's inline paste.

## Finding index

### CONSUMER_ABSENT (6 findings — no consumer on the surface grepped)

| ID | Title | Where the absence was confirmed |
|---|---|---|
| B1 | E7 typo IDs have no FE consumer | `public/`, `pages/`, `lib/`, `components/` — 0 hits for either spelling |
| B2 | E7 typo IDs not bound by T4-served stylesheet (either spelling) | Funnelback Stylesheet v3.1.2 — 0 ID selectors for `funnelbach-*` or `funnelback-*-facets`/`-body` |
| B4 | E8 CTA URLs and labels have no FE consumer | FE source — 0 hits across 4 URLs + 5 heading/label strings |
| B5 | `.listing-item--course` has no FE JS-hook consumer | FE source — 0 hits for `--course`; 7 base-class consumers all target `.listing-item` or `.listing-item__title` |
| B6 | `.listing-item--course` has no T4-served stylesheet consumer | Stylesheet — 0 occurrences; styled-modifier set enumerated (does not include `--course`) |
| B7 | dataListing + per-type `*Data` have no FE JS-hook consumer | FE source — 0 hits per token across all six class names |
| B8 | dataListing + per-type `*Data` have no T4-served stylesheet consumer | Stylesheet — 0 occurrences per token |

(B7 + B8 jointly close D7. See `closures.phase_d_D7` in the JSON.)

### CROSS_REFERENCE (3 findings — closure framing relative to prior phases and the brief)

| ID | Title | Subject |
|---|---|---|
| B3 | E7 T4-shipped JS dimension recorded as named open residual (RES1) | Conditional T4-side check; T4-JS half elected as residual |
| B9 | Stylesheet-alignment cross-check fired in-session — projected residual collapses to a narrower one | Brief v1.1's "Stylesheet-alignment cross-check" section |
| B10 | HTML audit sequence (A → C → E → D → B) closes with one named residual | Sequence closure |

## Handoff-item outcomes (per-item summary)

### E7 — typo IDs `funnelbach-search-facets` and `funnelbach-search-body`

- **What was emitted:** `partial.ftl:121` emits `id="funnelbach-search-facets"`; `:211` emits `id="funnelbach-search-body"`. Class names on the same elements use correctly-spelled `funnelback` (`.funnelback-search__side`, `.funnelback-search__body`).
- **FE-side outcome:** CONSUMER_ABSENT (B1). Zero hits across `public/`, `pages/`, `lib/`, `components/` for either spelling. Bare `funnelbach` substring also zero, repo-wide case-insensitive.
- **T4-stylesheet outcome:** CONSUMER_ABSENT (B2). The stylesheet binds neither spelling of the IDs. It targets the *classes* on those elements (with rule bodies commented out within `.stencils__main` scopes), not the IDs.
- **T4-shipped JS outcome:** OPEN RESIDUAL (RES1; recorded under `residuals_open`).
- **Implication:** Rebuild can correct typo on FE side and stylesheet side without coordination. Whether T4-shipped JS / page-layout chrome JS references the IDs at runtime is contingent on RES1's live-page capture.

### E8 — tab-conditional CTA URL and label fixtures

- **What was emitted:** Four hardcoded CTA blocks at `partial.ftl:130-172`. URLs: `/visit`, `/academics/all-programs`, `https://redhawks.sharepoint.com/sites/Intranet-Home`, `/newsroom`. Headings and button labels per `partial.ftl`.
- **FE-side outcome:** CONSUMER_ABSENT (B4). Zero hits across all four URLs and all heading/button-label strings. The only `/visit` hits in the repo are `@typescript-eslint/visitor-keys` substring matches in `package-lock.json` — not the CTA URL.
- **Stylesheet dimension:** Not applicable (CTA content is not a styled-class question per the brief).
- **Implication:** Externalization of CTA content is purely an FTL/content concern. No FE-coordination dimension. Note: the brief listed `Redhawk Hub` as a button label; Phase E E8 established `Redhawk Hub` is the heading and `Explore Resources` is the button label of the Faculty & Staff section — both strings were grepped, both absent. Recorded for v19 amendments.

### E9 — `.listing-item--course` modifier on news cards

- **What was emitted:** `results.news.ftl:47-48` — self-id comment and `<article class='listing-item listing-item--course listing-item--background-grey10 listing-item--color-black dataListing newsData'>`. The `--course` modifier is copy-paste residue from a courses template lineage.
- **FE JS-hook outcome:** CONSUMER_ABSENT (B5). Seven `.listing-item` consumer sites exist across five files, all targeting the base class or the `.listing-item__title` BEM element. None target the `--course` modifier.
- **T4-stylesheet outcome:** CONSUMER_ABSENT (B6). The stylesheet defines styled modifiers `--people`, `--event`, `--person`, `--document`, `--social-media`, `--video`, `--promoted`, `--background-shadow` — `--course` is absent from this set.
- **Implication:** Residue with no consumer on any binding-evidence surface. Under preserve-DOM-contract anchor, emit by default. The two sibling modifiers on the same news article element (`--background-grey10`, `--color-black`) are likewise absent from the stylesheet — also residue at the cross-renderer envelope level, though outside Phase B's direct scope.

### dataListing + per-type `*Data` suffixes (Phase D D7)

- **What was emitted:** Cross-renderer shared `.listing-item` BEM envelope plus `dataListing` class plus per-renderer per-type `*Data` suffix: fallback → `genericData`, news → `newsData`, law → `lawData`, programs → `programData`, people → `peopleData`.
- **FE JS-hook outcome:** CONSUMER_ABSENT (B7). Zero hits for any of the six class names across FE source. No `data-class` attribute consumer pattern either. (Other `data-*` attribute consumers exist in FE — `data-type`, `data-index` on suggestion-item elements — confirming the grep methodology surfaces `data-*` patterns where they exist.)
- **T4-stylesheet outcome:** CONSUMER_ABSENT (B8). No stylesheet rule targets any of the six class names.
- **D7 hypothesis status:** Negatively confirmed on both binding-evidence surfaces. The camelCase paired generic-plus-per-type pattern has no FE JS-hook consumer and no stylesheet consumer.

## Consumer-enumeration evidence summary

Scope dirs (`public/`, `pages/`, `lib/`, `components/`) contain only `.js` (12 files), `.ts` (10), `.tsx` (4). No `.css`/`.scss`/`.html`/`.jsx` files exist there or anywhere in the repo outside `node_modules` / `.next` — confirming the brief's repo-shape sharpening that any CSS-consumer question routes to the T4-served stylesheet by construction.

Primary grep ran against the four scope dirs per token; widened recheck repo-wide case-insensitive across all source extensions (excluding `node_modules`, `.next`, `audit`, `docs`) per token. Full evidence in the JSON's `consumer_enumeration_evidence` block.

The `.listing-item` base class is consumed at seven FE sites (analytics-manager.js:51,133,138; integration.js:990; search-page-autocomplete.js:801; search-bundle.js:422 [known-dead file]; components/ResultList.tsx:38) — all targeting the base block or the `.listing-item__title` element selector. The base envelope is the binding FE-internal contract; modifiers and per-type `*Data` suffixes have no FE consumer.

## Stylesheet enumeration summary

Source: T4-served Funnelback Stylesheet v3.1.2 dated 2026-02-02 (provided inline by Vic this session). Method: manual full-read.

Token grep:

| Token | Stylesheet result |
|---|---|
| `funnelbach` (substring) | 0 occurrences |
| `#funnelbach-search-facets` / `#funnelbach-search-body` (ID selectors, typo) | 0 |
| `#funnelback-search-facets` / `#funnelback-search-body` (ID selectors, correct) | 0 |
| `.funnelback-search__body` / `.funnelback-search__side` (class selectors on same elements) | Selectors matched; rule bodies commented within `.stencils__main` scopes |
| `.funnelback-search-facets-breadcrumb` / `.funnelback-facet` | Many active styled selectors (different elements — the breadcrumb above facets and the facet block, not the typo'd ID's element) |
| `.listing-item--course` | 0 |
| `.listing-item` styled-modifier set actually present | `--people`, `--event`, `--person`, `--document`, `--social-media`, `--video`, `--promoted`, `--background-shadow` |
| `.listing-item` modifiers absent from stylesheet | `--course`, `--background-grey10`, `--color-black` |
| `dataListing` / `genericData` / `lawData` / `newsData` / `programData` / `peopleData` | 0 per token |

## Residuals

### Open

- **RES1 — E7 T4-shipped JS / live-page DOM consumer.** The T4-shipped JS dimension of E7 was not closed in this session per Vic's election. The stylesheet half of the T4-side check is closed (B2). The remaining half requires a live-page DOM/inline-script check (`document.querySelectorAll('[id*="funnelbach"], [id*="funnelback-search-facets"], [id*="funnelback-search-body"]')` plus view-source `funnelbach` substring search across inline `<script>` blocks and T4-served JS bundle URLs). Rebuild impact: if T4-JS consumer exists, rebuild coordinates the spelling correction with T4 chrome modifications; if absent, rebuild corrects freely. Either outcome leaves Phase B's documentary classification intact.

### Closed in-session

- **Stylesheet-alignment cross-check** (the brief's named one carried-forward documentary residual). Brief v1.1 carved the visual-dimension cross-check for `.listing-item--course` and dataListing/per-type `*Data` classes as one named residual past Phase B execution, pending stylesheet source landing. Vic provided the stylesheet inline this session; the cross-check fires here and resolves CONSUMER_ABSENT across all three subject class sets (B6 and B8).

## Closure framing for the HTML audit sequence

**Sequence:** A → C → E → D → B. **Status:** closed with one named residual (RES1, narrower than the brief's projected residual).

Prior phase closures:
- Phase A F2 closed via Phase E E5
- Phase A F10, F11 closed via Phase C C6, C7
- Phase C C8 closed via Phase E E11

Phase B closures:
- E7 PARTIAL_CLOSED (B1 + B2 + B3); RES1 records the T4-JS dimension as open
- E8 CLOSED (B4)
- E9 CLOSED (B5 + B6)
- D7 CLOSED (B7 + B8)
- Stylesheet-alignment cross-check CLOSED_IN_SESSION (B9 + B6 + B8)

## Outstanding work (post-Phase-B, outside this session)

Per the brief's sub-phase 5 (amendments queue) — happens outside this session:

1. **CLAUDE.md single pass.** The five identified edits: current-audit-phase line update; stylesheet-as-binding-contract anchor added to Key architectural facts; D7 framing updated with B7/B8 closure; companion-docs v18 → v19 reference; audit-documents list gains the Phase B pair, session report, and ratified brief (and re-records the Phase D missing-from-disk gap if Vic decides to leave the Phase D deliverables in broader project context).
2. **v18 → v19 project-instructions revision.** Folds in Phase B findings, the HTML-audit-sequence closure, the stylesheet-as-binding-contract constraint as a paired anchor with visual-design-immutability, GAP1 and GAP2 housekeeping items, and the E8 button label brief-citation correction.
3. **RES1 closure.** Vic runs the live-page DOM/inline-script check whenever convenient; outcome folds into v19.

Audit-cadence items beyond the HTML sequence (conditional SessionService, security/middleware, listener-coordination audits) are not Phase B's concern.

## Sign-off

Phase B executed end-to-end in a single Claude Code session 2026-06-02 against `/home/vic/repos/vercel/su-search-dev`. Three deliverables written to `audit/`. Canonical JSON sealed at 400 lines and validates as JSON. Brief v1.1 ratified inline by Vic 2026-06-02; execution complies with its scope, posture, stop rules, and the contraction/expansion escape hatch (which did not fire). Findings ready for human review and the v19 amendments queue.
