# Session report — HTML Audit Phase E

**Session date:** 2026-05-14
**Phase:** E (Funnelback partial response per-renderer markup)
**Brief:** `audit/html-audit-phase-e-brief-2026-05-14.md` (v1.1 ratified, executed verbatim)
**Deliverables produced:**
- `audit/html-audit-phase-e-2026-05-14.json` (canonical evidence — 791 lines)
- `audit/html-audit-phase-e-2026-05-14.md` (markdown companion)
- `audit/session-report-2026-05-14-html-audit-phase-e.md` (this file)

## What was executed

E.1 (brief ratification) was already complete; the brief itself was its deliverable. E.2 through E.6 executed in this Claude Code session against the 30 FTL files in `/home/vic/repos/vercel/su-search-dev/docs/`.

- **E.2** — Full body walk of `partial.ftl`. Recorded the duplicate curator import (E1), tab-conditional CTA region with the four hardcoded URLs (E18, E8), three curator slot invocations, renderer-dispatch entry via `result_list.ResultList`, the AfterSearchOnly gate plus the six macros that sit outside it (E2), the `main.js` script tag, every first-layer macro invocation (the import-usage map's seed), and the utilities.icons.ftl include. Flagged the `funnelbach`-not-`funnelback` DOM id typo (E7).

- **E.3** — `results.ftl` (the fallback renderer; the dispatcher actually lives in `result_list.ftl`), `result_list.ftl` (the actual dispatch logic), and the four active per-renderer templates (`results.news.ftl`, `results.law.ftl`, `results.programs.ftl`, `results.people.ftl`). Recorded per-renderer markup contracts, the shared listing-item BEM envelope (E20), the renderer-dispatch profile-config key `stencils.template.result.${collection}` (E19), the inactive-renderer reachability question (E17/E28), and the news-renderer course-shaped residue (E9).

- **E.4** — `tabs.ftl`, `facets.ftl`, `facets.breadcrumbs.ftl`, `pagination.ftl`, `spelling_suggestions.ftl`, `query_blending.ftl`, `curator.ftl`, `utilities.icons.ftl`. Enumerated the 93-symbol SVG sprite and cross-referenced against `<use href="#…">` references across all 27 in-scope templates → 10 referenced, 83 unreferenced (E6, E39). Recorded curator markup defect (E10), facets special-case label casing (E15), tabs/facets/curator UNUSED_FEATURE macros (E31, E32, E33), tier_bars duplicate class attribute (E14), counts mismatched tags (E13).

- **E.5** — `hero_banner.ftl`, `auto_complete.ftl`, `auto_complete.concierge.ftl`, `sessions.ftl` + `sessions.search_history.ftl` + `sessions.shortlist.ftl`, `search_tools.ftl`, `counts.ftl`, `tier_bars.ftl`, `result_list.ftl` (re-read for QuickView pathways), `no_results.ftl`, `extra_search.ftl`, `a-z_listing.ftl`, `contextual_navigation.ftl`, `client_includes.ftl`, `base.ftl`. Closed Phase C C8 via E3+E11 jointly. Resolved E4 (sessions two-tier structure) with the canonical evidence that Tier 2 is wholly unwired. Confirmed `@base.Result` latent defect (E12). Identified `<label for="bannerQuery">` accessibility seam issue (E16).

- **E.6** — Aggregated findings into the three-stream categorization, finalized the import-usage map, wrote canonical JSON + markdown companion + this session report.

## Findings summary

40 numbered findings across three streams:

- **CONTRACT_SURFACE**: 23 findings. Binding constraints for the rebuild's reproduction of the partial-response surface. Includes the renderer-dispatch profile-config key, the shared markup envelope, the AfterSearchOnly gate asymmetry, the PNP component naming convention seam, and five markup/wiring defects (E10/E12/E13/E14/E16).
- **DEAD_IMPORT**: 6 findings naming 10 dead `<#import>` statements in `partial.ftl` (the duplicate curator + four whole-feature dead imports + five inactive renderers).
- **UNUSED_FEATURE**: 11 findings covering ~22 uninvoked macros + the 83-symbol unreferenced SVG sprite subset.

## Brief citation corrections (for v17 project-instructions amendments queue)

The execution surfaced two factual deltas between the brief and the FTL source. These are flagged here for v17 amendments rather than corrected in the brief retroactively:

1. **Phase A version reference**. The brief v1.1 references Phase A v3 dated 2026-05-13 (`audit/html-audit-phase-a-2026-05-13-v3.json` and `.md`). Only Phase A v2 dated 2026-05-12 (`audit/html-audit-phase-a-2026-05-12-v2.json` and `.md`) exists in this repo. No v3 file is present at the cited path. The Phase E deliverables cite v2 throughout. The brief's cross-reference should be corrected, or a v3 should be produced if the brief author intended changes that haven't been written.

2. **CTA URL list (partial.ftl L130-172)**. The brief v1.1 E.2 section lists the four hardcoded CTA URLs as `/visit, /academics/all-programs, /directory, /newsroom`. The actual partial.ftl values are `/visit` (default), `/academics/all-programs` (Programs), `https://redhawks.sharepoint.com/sites/Intranet-Home` (Faculty & Staff "Redhawk Hub"), `/newsroom` (News). No `/directory` value appears in source; the Faculty & Staff branch uses an external SharePoint URL. The count of four is correct; one URL identification was incorrect.

Both deltas are recorded inside the canonical JSON at `meta.brief_citation_corrections` and at finding E8.

## Inventory count delta from brief

The brief locked an inventory of 30 files in upload, decomposed as "27 Vic-canonical in scope + 1 Squiz snapshot + 2 platform-core reference (out of scope) + 5 inactive renderers (one-line only)". Execution counted **29 Vic-canonical in-scope files** because the four active renderer files (results.news/law/programs/people.ftl) were characterized in full. The 5 inactive renderer files (results.video/facebook/events/twitter/instagram.ftl) were not opened per the brief's stop rules; they're counted as in-scope-imported-but-bodies-unread, and characterized as a single one-line finding (E28). The total of 30 in upload matches the brief; the breakdown bookkeeping differs harmlessly. Recorded in `meta.template_inventory.note_on_counts`.

## Posture adherence

No FTL was modified. All work was read-and-record. The 27 in-scope templates were read in full; 5 inactive-renderer templates remained unread per the brief's stop rules. No runtime captures were taken (the brief left this as conditional; the source-first reading proved sufficient for the contract-surface enumeration). Findings flagged for human review; no actions taken on them.

## Outstanding items handed back

- Vic profile-config inspection: `ui.modern.session` (gates E22 Tier 1 surface), `stencils.template.result.<collection>` mappings for the four active collections, `stencils.auto-completion.datasets` value. These three config keys' values are not determinable from FTL source alone.
- Phase D will enumerate T4 PageLayout sprite consumers to resolve whether the 83 unreferenced sprite symbols are globally unused (full strip-out candidate) or PageLayout-consumed (retain).
- Phase B will resolve whether anything in `lib/`, `pages/`, or `public/` selects on `#funnelbach-search-facets` or `#funnelbach-search-body` (E7 — if no consumer, the typo is cosmetic-only; if consumers exist, rebuild needs migration).
- Rebuild design decisions enumerated in the markdown companion's "Outstanding open items" section.

## v17 amendments queue

Recommended amendments to project instructions / future briefs based on Phase E execution:

1. **Update the Phase A reference** in the canonical cross-reference list to either `2026-05-12-v2` (if v3 was never produced) or `2026-05-13-v3` (if v3 should be produced and isn't yet).
2. **Correct the CTA URL list** preserved in any narrative documents that mention it: it is `/visit`, `/academics/all-programs`, `https://redhawks.sharepoint.com/sites/Intranet-Home`, `/newsroom` — not `/directory`.
3. **Correct the curator "promoted" label framing**: the source text is lowercase `promoted`. Display rendering relies on CSS text-transform if the visible label is uppercase. CLAUDE.md and any narrative docs that say "PROMOTED" should clarify this is the rendered casing, not the source casing.
4. **Add an explicit note** about `<#import>` idempotence in FreeMarker — the duplicate curator import (E1) is structurally a residue but not a runtime defect; rebuild dev should treat duplicate imports as trim candidates rather than bugs.
5. **Resolve the inventory-count framing** for future audit briefs that include both active and inactive renderer imports. Either count both in the headline number, or be explicit that the headline excludes inactive imports.

## Sign-off

Phase E executed end-to-end in a single Claude Code session 2026-05-14. Three deliverables written to `audit/`. Canonical JSON sealed at 791 lines. Brief v1.1 ratified by Vic 2026-05-14; execution complies with its scope, posture, and stop rules. Findings ready for human review and downstream phase consumption.
