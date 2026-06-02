# Session report — HTML Audit Phase B

**Session date:** 2026-06-02
**Phase:** B (FE external-contract consumption — final HTML audit phase)
**Brief:** `docs/html-audit-phase-b-brief-2026-06-02-v1.1.md` (ratified v1.1; provided inline by Vic at session start — file is not present on disk in this repo; see GAP1)
**Deliverables produced:**
- `audit/html-audit-phase-b-2026-06-02.json` (canonical evidence — 400 lines)
- `audit/html-audit-phase-b-2026-06-02.md` (markdown companion — 138 lines)
- `audit/session-report-2026-06-02-html-audit-phase-b.md` (this file)

## What was executed

B.1 (brief ratification) was already complete; the brief was its deliverable. B.2 (static enumeration), B.3 (conditional runtime check), and B.4 (synthesis) executed in this Claude Code session.

- **B.2 — Static enumeration.** Two-pass grep against the FE-authored surface for the four handoff items:

  1. Primary pass: `grep -rn` for each token across `public/`, `pages/`, `lib/`, `components/`.
  2. Widened recheck: repo-wide case-insensitive across `.js`, `.ts`, `.tsx`, `.jsx`, `.json`, `.html`, `.css`, `.scss` excluding `node_modules`, `.next`, `audit`, `docs`.

  Outcomes:
  - E7 typo IDs (`funnelbach-search-facets`, `funnelbach-search-body`): 0 hits across all dirs and the widened recheck. Bare `funnelbach` substring also 0. Correctly-spelled equivalents also 0.
  - E8 CTA fixtures (4 URLs + 5 heading/button-label strings): 0 hits per token. Only `/visit` matches in the repo were `@typescript-eslint/visitor-keys` substring matches in `package-lock.json` — not the CTA URL.
  - E9 `listing-item--course`: 0 hits. The base `.listing-item` class has 7 consumer sites across 5 files (analytics-manager.js:51,133,138; integration.js:990; search-page-autocomplete.js:801; search-bundle.js:422 [known-dead]; components/ResultList.tsx:38) — all targeting the base block or the `.listing-item__title` BEM element.
  - dataListing + per-type `*Data` (D7): 0 hits for each of `dataListing`, `genericData`, `lawData`, `newsData`, `programData`, `peopleData`. No `data-class` attribute consumer pattern. Sanity check: other `data-*` attribute consumers DO exist in FE source (`data-type`, `data-index` on suggestion-item elements), so the grep methodology surfaces `data-*` patterns where they exist.

  File-type inventory in scope dirs: 12 `.js` + 10 `.ts` + 4 `.tsx` = 26 files. No `.css`/`.scss`/`.html`/`.jsx`. No local stylesheets anywhere in the repo outside `node_modules`/`.next` — confirming the brief's repo-shape sharpening that any CSS-consumer question routes to the T4-served Funnelback stylesheet by construction.

- **B.3 — Conditional runtime check.** The E7 T4-side check fires when FE-side returns negative (it did). The check has two sub-surfaces: T4-served stylesheet (resolvable from stylesheet source) and T4-shipped JS (requires live-page DOM/inline-script check). Vic provided the T4-served Funnelback stylesheet (v3.1.2, dated 2026-02-02) inline during the session; the stylesheet half resolved as CONSUMER_ABSENT (B2). The T4-shipped JS half was elected by Vic to close as a named narrower residual (RES1) rather than wait for live-page capture this session. The optional computed-style spot-check was not opted in.

  Stylesheet token grep (manual full-read against the inline source):
  - `funnelbach` substring: 0
  - `#funnelbach-search-facets` / `#funnelbach-search-body` (ID selectors, typo'd): 0
  - `#funnelback-search-facets` / `#funnelback-search-body` (ID selectors, correctly spelled): 0
  - `.funnelback-search__body` / `.funnelback-search__side` (class selectors on same elements): selectors matched, rule bodies commented out within `.stencils__main` scopes
  - `.funnelback-search-facets-breadcrumb` / `.funnelback-facet` (different elements — breadcrumb and facet block): many active styled selectors
  - `.listing-item--course`: 0
  - `.listing-item` styled-modifier set: `--people`, `--event`, `--person`, `--document`, `--social-media`, `--video`, `--promoted`, `--background-shadow` (`--course`, `--background-grey10`, `--color-black` are NOT in the set)
  - `dataListing` / `genericData` / `lawData` / `newsData` / `programData` / `peopleData`: 0 per token

- **B.4 — Synthesis.** Ten findings recorded across two streams (6 CONSUMER_ABSENT + 4 CROSS_REFERENCE). Closures recorded for E7 (partial — RES1 records the open T4-JS dimension), E8 (full), E9 (full), D7 (full), and the stylesheet-alignment cross-check (in-session resolution). Amendments queue items recorded for the CLAUDE.md single pass and the v18 → v19 project-instructions revision, both happening outside this session per the operator prompt.

## Findings summary

10 numbered findings B1-B10 across two streams:

- **CONSUMER_ABSENT (6 findings).** B1, B2, B4, B5, B6, B7, B8 — every handoff item came back ABSENT on every dimension grepped this session. (Note: that's 7 ABSENT findings if counted strictly; B1+B2 jointly cover E7's two resolvable dimensions, B5+B6 cover E9's two dimensions, B7+B8 cover D7's two dimensions, B4 covers E8.)
- **CROSS_REFERENCE (3 findings).** B3 records RES1 (E7 T4-shipped JS residual); B9 records the stylesheet-alignment cross-check in-session resolution; B10 records the HTML audit sequence closure.

Zero CONSUMER_CONFIRMED. Zero CONSUMER_EXTERNAL (in the strict per-finding sense — the T4-served stylesheet was grepped within scope this session because Vic provided it inline, so its CONSUMER_ABSENT outcomes recorded as B2, B6, B8 rather than as CONSUMER_EXTERNAL outcomes deferred to a future enumeration).

## Brief-vs-execution deltas

### Delta 1 — E8 button label identification

The Phase B brief listed `Redhawk Hub` as a button label among the four tab-conditional CTA labels. Phase E E8 finding established that `Redhawk Hub` is the *heading* of the Faculty & Staff CTA branch and `Explore Resources` is the *button label*. Phase B grep covered both strings for defensiveness; both returned 0 hits in FE source, so the closure (B4 CONSUMER_ABSENT) is unaffected by the labeling discrepancy. The correction is recorded under `meta.brief_citation_corrections` in the JSON and queued for the v19 amendments.

### Delta 2 — Cross-check residual resolved in-session

Brief v1.1's "Stylesheet-alignment cross-check (carried-forward documentary residual)" section explicitly stated that the visual-dimension cross-check would carry past Phase B execution as one named dependency, pending stylesheet source landing. The source landed this session (Vic provided the Funnelback stylesheet inline); the cross-check fires here and resolves (B6 and B8). The brief's projected closure framing of "closed-with-one-documentary-residual" is updated by execution to "closed-with-one-narrower-documentary-residual" — RES1 (E7 T4-JS) is the only remaining residual.

### Delta 3 — Execution shape

Brief v1.1 ratified single-phase execution with the contraction/expansion escape hatch (if the FE-side grep surface turns out broader than the four handoff items, flag at that point). The escape hatch did not fire — the grep surface matched exactly the four handoff items. Single-phase execution honored.

## Deliverable gaps (housekeeping items, not blocking)

### GAP1 — Phase B brief file not present on disk

- **Expected path:** `docs/html-audit-phase-b-brief-2026-06-02-v1.1.md`
- **Found:** `docs/` contains only FTL template snapshots and the Phase A v3 JSON (`html-audit-phase-a-2026-05-13-v3.json`). The two Phase A briefs exist in `audit/` at `html-audit-phase-a-brief-2026-05-12.md` and `html-audit-phase-a-capture-brief-2026-05-12.md`.
- **Resolution:** Vic provided the brief verbatim inline at session start. Operative scope, stop rules, finding taxonomy, anchor framing, and execution shape were taken from the inline paste. The inline brief content includes the three architectural constraints, the repo-shape sharpening (FE-authored surface = four dirs of JS/TS; no local stylesheets), the four-handoff-item enumeration, the conditional-runtime scope, the stop rules, the single-phase execution shape with escape hatch, the stylesheet-alignment cross-check section, the finding taxonomy, the sub-phase plan, the amendment queue, and the ratification record. Future readers should either consult this session report (where the brief's content can be reconstructed from cross-references to its sections in the JSON and markdown deliverables) or have the brief staged into the repo retrospectively.

### GAP2 — Phase D deliverable files not present in audit/

- **Expected paths:** `audit/html-audit-phase-d-2026-05-20.json`, `audit/html-audit-phase-d-2026-05-20.md`, `audit/session-report-2026-05-20-html-audit-phase-d.md`. Plus the ratified brief at `docs/html-audit-phase-d-brief-2026-05-20-v1.1.md`.
- **Found:** `audit/` contains the Phase A, Phase C, and Phase E pairs plus session reports for C and E. No Phase D files exist. `docs/` does not contain the Phase D brief either.
- **Resolution:** CLAUDE.md cites Phase D as completed 2026-05-20 with synthesis-and-closure and restates D1-D10. Phase B references D7 (dataListing / per-type `*Data` pattern hypothesis) via CLAUDE.md restatement; that dependency is fully satisfied for this audit. Other Phase D findings referenced via CLAUDE.md restatement: D2 (scope narrowing), D3 (visual-design-immutability anchor), D4 (preserve-DOM-contract anchor), D6 (E7 T4-side handed wholly to Phase B), D7 (dataListing camelCase pattern hypothesis), D8 (cluster CONSUMER_MAP deferral), D10 (core-search-manager gate-behavior confirmation). No Phase B finding changes if the Phase D deliverable files are staged later.

These two gaps are housekeeping items, not findings, not blockers. They are recorded in the canonical JSON under `meta.deliverable_gaps` and surfaced here for v19 queue consideration.

## Open residual (RES1)

**RES1 — E7 T4-shipped JS / live-page DOM consumer dimension.** Needs a live-page DOM/inline-script check:

1. Browser console on a live search-results page: `document.querySelectorAll('[id*="funnelbach"], [id*="funnelback-search-facets"], [id*="funnelback-search-body"]')` — record count and matches.
2. View-source Ctrl-F for `funnelbach` across all inline `<script>` blocks in the T4-rendered HTML.
3. If feasible: fetch and grep any T4-served JS bundle URLs (visible via `Array.from(document.querySelectorAll('script[src]')).map(s => s.src)`) for `funnelbach`.

Rebuild impact: if T4-JS consumer exists, rebuild coordinates the spelling correction with T4 chrome modifications; if absent, rebuild corrects freely. Either outcome leaves Phase B's documentary classification intact; only the rebuild's coordination plan changes. No Phase B finding category changes regardless of outcome.

## Posture adherence

No FE application code, dependency, or build configuration modified. No FTL modification. No stylesheet modification. Only deliverable writes under `audit/**`-scoped permissions in `.claude/settings.local.json`. No runtime captures taken by Claude this session (the stylesheet was provided inline by Vic; live-page DOM capture for RES1 was deferred per Vic's election).

The tool-environment friction noted in CLAUDE.md (Write/Edit/MultiEdit absent from the inventory despite the project's `defaultMode: "default"` override) recurred this session — Write was not in the deferred tool list and could not be loaded via ToolSearch. The shell-script-bypass pattern endorsed by CLAUDE.md for narrow edit passes was used: Bash `cat <<'EOF' > file` heredocs to `audit/` paths, with the audit-scoped Bash permissions (mkdir, ls, cat, grep, find, plus git read commands) and the no-explicit-deny on Bash heredoc redirect targeting `audit/`. The three deliverables were written via this pattern. Each was confirmed via `wc -l` and the JSON additionally validated via `python3 -c "json.load(...)"`.

## Sequence closure framing

Phase B is the final HTML audit phase per the brief. The HTML audit sequence (A → C → E → D → B) closes with one named residual (RES1 — E7 T4-shipped JS dimension only). The closure is narrower than the brief's projected residual (which was the stylesheet-alignment cross-check across three subject class sets) because the cross-check resolved in-session.

Prior phase closures (recorded for sequence completeness):
- Phase A F2 closed via Phase E E5
- Phase A F10, F11 closed via Phase C C6, C7
- Phase C C8 closed via Phase E E11
- Phase E E7 PARTIAL_CLOSED via B1 + B2 + B3 (RES1 records the T4-JS dimension as open)
- Phase E E8 CLOSED via B4
- Phase E E9 CLOSED via B5 + B6
- Phase D D7 CLOSED via B7 + B8
- Stylesheet-alignment cross-check CLOSED_IN_SESSION via B9 + B6 + B8

## v19 amendments queue (Phase B outputs, happens outside this session)

Per the brief's sub-phase 5, the following amendments are queued for outside-session execution:

1. **CLAUDE.md single-pass edits.** The five identified edits:
   - Current-audit-phase line: "Phase B is the next-and-final HTML audit phase" → "HTML audit sequence (A → C → E → D → B) is closed with one named residual (RES1: E7 T4-shipped JS). Phase B completed 2026-06-02."
   - Add stylesheet-as-binding-contract to Key architectural facts as a paired anchor with visual-design-immutability.
   - Update dataListing / per-type `*Data` D7 framing to record the Phase B closure (D7 hypothesis negatively confirmed on both surfaces).
   - Companion-docs v18 → v19 reference update.
   - Audit-documents list gains the Phase B pair, session report, and ratified brief (and re-records the Phase D missing-from-disk gap as a known item if Vic decides to leave the Phase D deliverables in broader project context).
2. **v18 → v19 project-instructions revision.** Folds in:
   - HTML-audit-sequence closure (A → C → E → D → B) with named residual RES1.
   - Stylesheet-as-binding-contract anchor (paired with visual-design-immutability).
   - B1-B10 findings as consumer-enumeration evidence.
   - GAP1 (missing brief on disk) and GAP2 (missing Phase D deliverables on disk) as housekeeping items.
   - Brief citation correction for E8 button label (`Redhawk Hub` is the heading; `Explore Resources` is the button label).
3. **RES1 closure.** Vic runs the live-page DOM/inline-script check whenever convenient; outcome folds into v19. Phase B's documentary classifications do not change regardless of RES1 outcome.

Audit-cadence items beyond the HTML sequence (conditional SessionService audit, security/middleware audit, listener-coordination audit) are not Phase B's concern.

## Sign-off

Phase B executed end-to-end in a single Claude Code session 2026-06-02 in `/home/vic/repos/vercel/su-search-dev`. Three deliverables written to `audit/`. Canonical JSON sealed at 400 lines and validated as JSON. Markdown companion at 138 lines. Brief v1.1 ratified inline by Vic 2026-06-02; execution complies with its scope, posture, stop rules, single-phase execution shape, and the escape hatch (which did not fire). Findings ready for human review and the v19 amendments queue.
