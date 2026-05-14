# HTML Audit Phase E — Funnelback partial response per-renderer markup

**Audit date:** 2026-05-14
**Phase:** E (Funnelback partial response — third axis of the three-axes framing)
**Companion JSON:** `audit/html-audit-phase-e-2026-05-14.json` (canonical evidence)
**Brief:** `audit/html-audit-phase-e-brief-2026-05-14.md` (v1.1 ratified)
**Predecessor audits:** Phase A v2 (2026-05-12), Phase C (2026-05-13)
**Successor audits queued:** Phase D (T4 PageLayout chrome), Phase B (FE external-contract consumption)

## Headlines

- 27 Vic-canonical templates characterized in full, plus utilities.icons.ftl as a Squiz-platform snapshot. Five inactive-renderer FTL files (results.video/facebook/events/twitter/instagram.ftl) recorded as one-line DEAD_IMPORT per the brief's stop rules.
- **40 findings** in three streams: 20 CONTRACT_SURFACE, 7 DEAD_IMPORT, 13 UNUSED_FEATURE.
- **10 dead `<#import>` statements** in partial.ftl alone (the duplicate curator + four whole-feature dead imports + five inactive renderers).
- **Phase C Finding C8 closes definitively**: Twitter Typeahead is fully dead code on Seattle U's template set. The auto_complete namespace has zero textual invocations across all 27 in-scope templates; the universal-stencils-cluster Typeahead bundle is a confirmed strip-out candidate.
- **SVG sprite**: 93 symbols defined in utilities.icons.ftl, **10 referenced** from partial-response templates. The 83 unreferenced symbols are partial-response-only-unreferenced; T4 PageLayout chrome (Phase D) may consume some.
- **Sessions subsystem** is two-tiered. Tier 1 (LastVisitedLink) is the only feature actively wired. Tier 2 (shortlist drawer, search-history drawer, SessionCart JS init, Controls toggle) is wholly unwired — fully UNUSED_FEATURE even when `ui.modern.session=true`.

## Three-stream findings index

### CONTRACT_SURFACE (20 findings — binding constraints for the rebuild)

| ID | Title | Where |
|---|---|---|
| E2 | AfterSearchOnly gate asymmetry — six macros sit outside the gate | partial.ftl L221-236 |
| E3 | hero_banner.SearchForm invokes Concierge, no Typeahead init | hero_banner.ftl:39 |
| E5 | Phase A F2 region-to-emitter map fully enumerated | (cross-cutting) |
| E6 | SVG sprite contract: 93 defined, 10 referenced from partial response | utilities.icons.ftl |
| E7 | DOM id typo `funnelbach` not `funnelback` on two anchor elements | partial.ftl:121, :211 |
| E8 | Brief CTA URL list contains `/directory` which does not appear in source | partial.ftl L138-158 |
| E9 | results.news.ftl has course-shaped residue (self-id comment, `listing-item--course` class) | results.news.ftl:47-48 |
| E10 | curator.ftl stray `"` after class binding | curator.ftl:31 |
| E12 | tabs.ftl calls `@base.Result` which is not defined in base.ftl | tabs.ftl:249 |
| E13 | counts.ftl mismatched `<p>` / `</span>` tags | counts.ftl:13, :63 |
| E14 | tier_bars.ftl duplicate class attribute (drops intended sr-only treatment) | tier_bars.ftl:19 |
| E15 | facets.ftl special-case casing for "past week"/"past month" labels only | facets.ftl:124 |
| E16 | `<label for="bannerQuery">` references an ID that does not exist as written | hero_banner.ftl:22 |
| E17 | Five inactive renderer namespaces structurally callable but functionally inert | partial.ftl L75-79 |
| E18 | Tab-conditional CTA region contains product-fixed REQUIRED content | partial.ftl L130-172 |
| E19 | Renderer dispatch key: `stencils.template.result.${result.collection}` | result_list.ftl:65 |
| E20 | Cross-renderer shared listing-item BEM envelope plus per-renderer modifier/data-class | (all five renderers) |
| E21 | Curator "promoted" label is lowercase in source (CLAUDE.md framed as PROMOTED) | curator.ftl:41 |
| E22 | Sessions Tier 1 (LastVisitedLink) is the only actively wired session feature | sessions.ftl:11-20 |
| E23 | data-pnp-component seam contracts — Squiz Plug-and-Play team component naming | search_tools.ftl:13, sessions.search_history.ftl:58 |
| (E1) | Duplicate curator import (listed as DEAD_IMPORT below) | partial.ftl:44, :54 |
| (others) | See JSON for full evidence and implication blocks | — |

### DEAD_IMPORT (7 findings — namespace-binding-level dead imports)

| ID | Namespace | partial.ftl line | Status |
|---|---|---|---|
| E1 | curator (duplicate) | L54 (also at L44) | Idempotent — no runtime defect, structural trim candidate |
| E24 | az_listing (a-z_listing.ftl) | L50 | Zero `@az_listing.*` invocations anywhere |
| E25 | auto_complete | L52 | Zero `@auto_complete.*` invocations anywhere — closes Phase C C8 |
| E26 | extra_search | L57 | Zero `@extra_search.*` invocations anywhere |
| E27 | client_includes | L59 | Zero `@client_includes.*` invocations anywhere |
| E28 | video, facebook, events, twitter, instagram (5 inactives) | L75-79 | No crawler feeds these content types per Vic |

**Total dead `<#import>` statements in partial.ftl: 10** (counting E28's five as five distinct imports).

### UNUSED_FEATURE (13 findings — macros wired but not surfaced in production output)

| ID | Where | What |
|---|---|---|
| E4 | sessions.* | Tier 2 (Controls, Configuration, Templates, ShortlistDrawer, SearchHistoryAndShortlist, ShortlistControl, SessionCart JS init) — wholly unwired. Provisional E4 confirmed at E.5. |
| E29 | sessions.* | Same as E4, formalized at synthesis. Closes E4. |
| E30 | results.news.ftl | ShortlistTemplate (Handlebars cart template) and QuickView (modal) — course-shaped residue, ~225 lines, transitively unreached |
| E31 | tabs.ftl | TabsAsRadio, FacetCategoriesRadio, Preview — three macros, ~165 lines |
| E32 | facets.ftl | DropdownFacet, ListFacets, ClearAllFacets, IsSelected, IsNotSelected — five macros, ~145 lines |
| E33 | curator.ftl | HasCurator, HasBestBets filtering macros — fine-grained category distinction defined but only union (HasCuratorOrBestBet) is invoked |
| E34 | search_tools.ftl | IsDisplayMode macro — defined but unreached |
| E35 | extra_search.ftl + tabs.ftl | Two near-duplicate Preview macros — both unreached |
| E36 | a-z_listing.ftl | Whole-file browse-mode feature (BrowseModeToggle/On/Off, BrowseByFilter) — closes E24 |
| E37 | client_includes.ftl | Whole-file CMS-injection feature (HTMLHeader/ContentHeader/ContentFooter/ClientInclude) — closes E27 |
| E38 | hero_banner.ftl | SearchBoxOnly macro (no-overlay alternative to SearchForm) — unreached |
| E39 | utilities.icons.ftl | 83 of 93 sprite symbols unreferenced from partial-response templates (Phase D may show broader-DOM consumption) |
| E40 | tabs.ftl | Commented-out `stencils.tabs.icon.<label>` profile-config consumer — never enabled |

## Import-usage map summary

Of the **31 import statements** in partial.ftl (counting the duplicate curator), **10 are dead at namespace-binding level**:

- 1 duplicate (curator at L54)
- 4 whole-feature dead imports (az_listing, auto_complete, extra_search, client_includes)
- 5 inactive-renderer imports (video, facebook, events, twitter, instagram)

The other **21 alive imports** decompose:

- 12 alive direct from partial.ftl (hero_banner, search_tools, query_blending, spelling_suggestions, curator at L44, tabs, facets_breadcrumbs, facets, pagination, contextual_navigation, result_list, no_results)
- 4 alive transitive (base via search_tools+concierge, counts via search_tools, tier_bars via result_list, concierge via hero_banner)
- 5 alive runtime-dispatch (results fallback + four active renderers news/law/programs/people)
- (sessions is alive partial — Tier 1 only)
- (s, fb at L27-28 are Squiz platform core references — alive but out-of-scope for body characterization)

## Renderer dispatch cross-reference

| Renderer | Modifier class | Data class | Title metadata | Body | Footer |
|---|---|---|---|---|---|
| `results.ftl` (fallback) | `--generic` | `genericData` | `t` (+ pdf icon) | `c` or `summary` | `title` split-pipe |
| `results.news.ftl` | `--course` ⚠️ E9 | `newsData` | `t` | `c` (most paths commented) | `type \| department` |
| `results.law.ftl` | `--generic` | `lawData` | `lawTitle` → `t` → `title` + " \| School of Law" | `c` truncated 150 | `title` |
| `results.programs.ftl` | `--program` | `programData` | `t` | `c` truncated 200 | `title` |
| `results.people.ftl` | `--people` | `peopleData` | `t` (+ `peoplePosition` / `peopleDepartment` subtitle) | `expertiseArea` pills only | `affiliation \| college` |

All five renderers invoke `@sessions.LastVisitedLink` (Tier 1 of sessions subsystem; gated by `ui.modern.session` profile flag).

## SVG sprite cross-reference (top consumers)

| Symbol | References | Sites |
|---|---|---|
| `#add` | 6 | facets.ftl:29,64,142 + tabs.ftl:125,160,215 |
| `#close` | 6 | facets.ftl:79 + facets.breadcrumbs.ftl:20 + sessions.search_history.ftl:36 + sessions.shortlist.ftl:40,123 + results.news.ftl:301 (unreachable) |
| `#subtract` | 4 | facets.ftl:32,67 + tabs.ftl:128,163 |
| `#information` | 2 | spelling_suggestions.ftl:11 + query_blending.ftl:12 |
| `#chevron` | 2 | pagination.ftl:20,66 |
| `#time` | 1 | results.news.ftl:248 (unreachable ShortlistTemplate) |
| `#overflow-menu` | 1 | tabs.ftl:92 |
| `#no-results` | 1 | no_results.ftl:13 |
| `#map` | 1 | results.news.ftl:259 (unreachable ShortlistTemplate) |
| `#arrow` | 1 | sessions.shortlist.ftl:27 (unreached Drawer chain) |

83 symbols defined but unreferenced from any partial-response template. The full unreferenced list is in the companion JSON's `sprite_symbol_map.unreferenced_list`.

## Phase A and Phase C cross-references resolved

- **Phase A Finding F2 (Funnelback-partial-content region enumeration)** — closes here via E5. Each region in the partial response now has its emitting template + macro + line number documented.
- **Phase C Finding C8 (Typeahead status)** — closes here via E3 + E11 jointly. Twitter Typeahead is fully dead code on SU's template set.
- **Phase C Finding C10 (universal-stencils-cluster strip-out candidates)** — partial closure via E11 + E25. Typeahead bundle is the first confirmed strip-out candidate. The other six cluster files (jQuery, popper, Handlebars, es6-promise, stencils.js, handlebars-helpers.js) remain to be evaluated against broader-DOM consumers (Phase D + future cross-cluster audit).

## Latent defects flagged (CONTRACT_SURFACE markup defects)

Four markup defects identified, all bounded by being either inside unreachable macros or in tag-tolerant browser behavior:

1. **E10**: `curator.ftl:31` stray `"` after class binding expression.
2. **E12**: `tabs.ftl:249` calls `@base.Result` which is not defined in `base.ftl`. Bounded by `Preview` being unreached.
3. **E13**: `counts.ftl` opens `<p>` (L13) closes `</span>` (L63) — mismatched tags.
4. **E14**: `tier_bars.ftl:19` two `class` attributes on same element — second silently dropped, intended sr-only treatment lost.

Plus accessibility seam concern:
5. **E16**: `<label for="bannerQuery">` references an ID that doesn't exist as emitted (input id is `query` or the configured `stencils.auto-completion.input_id` value).

## Outstanding open items for downstream phases

- **Phase B amendments**: E7 (funnelbach typo) — whether FE/CSS consumes these IDs. E8 (CTA URL correction) — feeds into endpoint-dictionary content fixtures.
- **Phase D**: Sprite consumer enumeration for the broader DOM (T4 PageLayout). Resolves whether 83 unreferenced symbols are globally unused or PageLayout-consumed.
- **Vic profile-config inspection**: `ui.modern.session` flag value (gates E22 Tier 1 surface). `stencils.template.result.<collection>` mappings (gates E19 dispatch routing for the four active collections). `stencils.auto-completion.datasets` profile config (gates the autocomplete-concierge dataset surface).
- **Rebuild design**: Decide on retain-vs-discard for sessions Tier 2 (E29/E30), quick-view modal (E30), browse-mode (E36), client-include CMS injection (E37), per-tab CTA externalization (E18).

## Sign-off

E.1 brief locked 2026-05-14 (v1.1). E.2-E.5 executed in Claude Code session 2026-05-14. E.6 synthesis written 2026-05-14. Canonical evidence: `audit/html-audit-phase-e-2026-05-14.json`. Session report: `audit/session-report-2026-05-14-html-audit-phase-e.md`.
