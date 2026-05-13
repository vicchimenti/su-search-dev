# Session Report — HTML Audit Phase C

**Session date:** 2026-05-13
**Audit phase:** C (Squiz stencils contract surface)

**Deliverables produced:**
- `audit/html-audit-phase-c-2026-05-13.json` (canonical, 998 lines, valid JSON, 9 entries, 12 findings, 3 behavioral consumers)
- `audit/html-audit-phase-c-2026-05-13.md` (markdown companion, 452 lines)
- `audit/session-report-2026-05-13-html-audit-phase-c.md` (this file)

**Prior phase status:** Phase A v2 complete; Phase A Findings F8–F14 referenced throughout Phase C; F10 and F11 close out as Findings C6 and C7.

## Methodology recap

Phase C executed against the C.1–C.5 sub-phase methodology in the brief.

**C.1 (Brief ratification):** No-op; brief stood as written. Preserved 5/13 chat findings in the brief narrative provided the substantive C.2 documentary basis without needing a full reread of the FTL templates (which were uploaded to the prior chat and not in this repo).

**C.2 (Documentary characterization):** Conducted via two sources — the brief's preserved 5/13 findings (universal stencils cluster enumeration, FTL template identification, marketing pixels confirmation, module ID map, three-pattern framework) plus a WebFetch on the search-page-injected `main.js` at `https://dxp-us-search.funnelback.squiz.cloud/s/resources/seattleu~sp-search/_default/themes/stencils/js/main.js`. The WebFetch returned literal source code from modules 47462 (`_parseConfiguration`), 79963 (`rg` helper), and 603 (autocomplete-search constructor), which expanded the brief's preserved characterization in five concrete net-new ways.

**C.3 (Targeted investigation pass):** Phase A Findings F10 and F11 closed via Findings C6 and C7 with the new `main.js` source evidence. F8 (header-suggestions create site) unchanged — out of Phase C scope. F12 (ARIA chain asymmetry) referenced in `_seam_autocomplete-concierge-label` as the model for the rebuild's header-side fix. Typeahead status (Finding C8) and React component chunk-source items remain `TO_DETERMINE` pending live DOM inspection and chunk-source read.

**C.4 (Synthesis):** JSON canonical + markdown companion produced. Phase A v2 schema extended with three Phase-C-specific additions: `SQUIZ_FTL_TEMPLATE` source-layer value, `SQUIZ_FRAMEWORK_REACT_COMPONENT` consumer-type value, and three per-entry meta fields (`profile_config_dependencies`, `modifiability`, `three_pattern_relevance`). All twelve findings folded into `meta.findings`.

**C.5 (Amendments queue):** This document.

## Net-new findings beyond the brief's preserved narrative

WebFetch on the live `main.js` produced five concrete net-new data points:

1. **Dataset attribute count: six, not five (Finding C1).** The brief listed five (`data-id`, `data-label`, `data-template`, `data-service-url`, `data-params`). The actual `Array.from(n).map(...)` body in module 47462 reads SIX — `data-adapter` is the sixth. Implication: Pattern 1 (data-feed-only) requires per-channel adapter selection in addition to per-channel service-URL substitution.

2. **`data-configuration` is JSON-parsed with an attribute-mapping table (Finding C2).** Module 47462's `_parseConfiguration` deserializes `data-configuration` as JSON, with at least a `portal` key. Separately, `i.Qj[n.name]` is an attribute-name-to-config-key mapping table that determines which DOM attributes on the portal target get hoisted into the runtime config. The full `i.Qj` table is not enumerated in this audit pass.

3. **Module 603 reads four `data-*` attributes from the host (Finding C3).** The legacy `autocomplete-search` adapter reads `data-emphasis`, `data-suggest-source`, `data-suggest-collection`, `data-suggest-additional-params` plus three child-element `data-component` discriminators. None on the captured search page input — working hypothesis: module 603 is older mechanism (wired via `auto_complete.ftl`), idle on this template.

4. **React lazy-loading uses three chunks and two module IDs (Finding C4).** `Promise.all([n.e(466), n.e(401), n.e(641)]).then(n.bind(n, 38630))` plus a parallel form with `n.bind(n, 25699)`. Two component variants: standard (38630) and modal (25699), both in chunk 641. Brief noted chunk 641 only.

5. **Module 79963's `rg` helper parses innerHTML via div-mutation (Finding C5).** `function o(t,e){const n=t.createElement('div'); return n.innerHTML=e, n.children}`. Implication: dataset configuration spans MUST be direct children of the wrapper — nested grandchildren are not enumerated.

## Items deferred — TO_DETERMINE pending source access

Three classes of open question Phase C cannot resolve from materials available in this audit chat:

**(a) Live DOM inspection required.** Vic to capture: the production search page wrapper's literal `data-configuration` JSON value and the full nested-span dataset set; the wrapper's outerHTML and parent ancestry; the `concierge-search-form` outerHTML; and whether the React component renders into `#autocomplete-suggestions` during a live query (the two-writer uncertainty).

**(b) Funnelback admin profile config inspection required.** Vic to check the current value of `stencils.auto-completion.datasets` (and per-dataset sub-keys). This is the most informative single data point for the three-pattern decision.

**(c) Chunk 641 source read required.** The lazy-loaded React component's rendering behavior, expected data shape per template, render-disabled / render-to-slot mode (Pattern 2 feasibility), and template inventory beyond `organic` are all in the chunk source.

Plus two FTL-source items: reading `hero_banner.ftl` (resolves Finding C8 Typeahead status definitively); reading the three FTL templates uploaded to the prior 5/13 chat.

## v16 project-instructions amendments queue

### Amendment 1 — FE endpoint dictionary `data_star_attributes_on_input` row

**Status:** Queued since 2026-05-11; unlockable by Phase C per the brief; now resolvable.

**Change:** Revise `presumed_consumed_attributes` to remove `data-form` (Finding C6) and list the actually-consumed attributes: `data-component`, `data-autocomplete`, `data-collection`, `data-profile`, `data-max-results`, `data-min-length`, `data-results-container`. Flag that the full `i.Qj` table is not yet enumerated; additional attributes may be consumed if emitted. Cross-reference Findings C2, C6, C7.

### Amendment 2 — Three-pattern decision as flagged development investigation

**Status:** New; rises from Phase C brief's three-pattern framework.

**Change:** Add flagged development investigation entry to audit-cadence section. Investigation tries Patterns 1, 2, 3 empirically in branch builds, evaluates UX fidelity against current production, measures performance, selects one. Pattern 2 feasibility (render-disabled / render-to-slot mode) should be confirmed via chunk 641 source read BEFORE committing experimentation time. Cross-reference Finding C9.

### Amendment 3 — `behavioral_consumers` framing correction for squiz-stencils-main-js

**Status:** Surfaced by Phase C; should fold into next FE endpoint dictionary version.

**Change:** Phase A v2 description "Funnelback partial response on the search page" should be explicit "search page only — NOT loaded on non-search pages". Update `presumed_consumed_attributes` per Amendment 1.

### Amendment 4 — FTL-templates-as-Vic-modifiable architectural principle

**Status:** New; rises from Phase C brief's preserved 5/13 framing.

**Change:** Add to architectural-principles section. The three Vic-controlled FreeMarker templates live inside the Funnelback design system and are Vic-modifiable. Characterization-but-not-modification targets in audit phases. Modifications belong to development phase iff selected three-pattern variant requires them. Audit-posture extends to FTL templates parallel to FE repo posture. Add `SQUIZ_FTL_TEMPLATE` as recognized source-layer value. Cross-reference Finding C11.

### Amendment 5 — Universal stencils cluster strip-out as development work item

**Status:** New; rises from Phase C brief's commitment to defer strip-out to development phase.

**Change:** Add to development-phase work items. Seven-file universal stencils cluster strip-out feasibility per file depends on which Squiz framework features the selected three-pattern variant uses. Empirical experiment, not audit work. Cross-reference Finding C10. Add note about compiled Squiz `main.js` being search-page-only (loaded via Funnelback partial response), not part of the universal cluster.

## Next phases

Per the audit-phase plan, Phase D (T4 PageLayout chrome) and Phase E (Funnelback partial response per-renderer markup) queued after Phase C completes. Phase D folds in `_seam_universal-stencils-cluster-script-imports` and `_seam_inline-marketing-pixel-scripts` open captures, plus head-region scripts and broader T4 chrome around the search header. Phase E covers per-result-type renderers (`news`, `law`, `programs`, `people` — the four live content types per CLAUDE.md), tab markup, facet markup, pagination — all FUNNELBACK_PARTIAL source layer.

Development-phase investigations queued by Phase C:

1. DOM inspection during a live search query (wrapper / nested-span / cluster-ancestry captures)
2. Funnelback admin profile config inspection (current `stencils.auto-completion.datasets` value)
3. Chunk 641 React component source read (rendering target, data-shape expectations, Pattern 2 feasibility)
4. `hero_banner.ftl` macro source read (Finding C8 Typeahead status)
5. Squiz design system template inventory walkthrough (Vic has access; planned as dedicated future chat per brief)
6. Three-pattern decision empirical investigation (after items 1–5 inform order)

## Items explicitly NOT done

- Universal stencils cluster strip-out experiment (deferred — Finding C10 / Amendment 5)
- Three-pattern decision (deferred — Finding C9 / Amendment 2)
- CSS contract audit (separate future audit)
- Phase D and Phase E execution (queued)
- FTL template modification recommendations (out of audit phase scope — Finding C11 / Amendment 4)
- Chunk 641 source inspection beyond parse-site evidence (per Phase C stop rules)

## Tool-environment note

This audit chat's tool environment did not have `Write` / `Edit` / `MultiEdit` loaded despite the project's `.claude/settings.local.json` explicitly permitting them on `audit/**`. Deliverables were written via Bash heredoc append, which the auto-mode classifier intermittently flagged as Write-rule circumvention. User updated session settings mid-session to unblock heredoc writes. Recording here for future audit-session setup — if a Phase D / E chat encounters the same gap, a settings refresh resolves it.

## Cross-references

Audit deliverables Phase C builds on:

- `audit/fe-cache-audit-2026-05-04.md`
- `audit/fe-autocomplete-audit-2026-05-05.md`
- `audit/fe-listener-audit-2026-05-06.md`
- `audit/fe-tabs-manager-audit-2026-05-08-v2.md`
- `audit/network-investigation-2026-05-01.md` (with 5/11 re-examination addendum)
- `audit/network-recap-re-examination-2026-05-11.md`
- `audit/prefetch-archaeology-audit-2026-05-11.md`
- `audit/funnelback-endpoint-dictionary-2026-05-01.json` (proxy-rebuild equivalent role)
- `audit/fe-endpoint-dictionary-2026-05-07.json`
- `audit/html-audit-phase-a-2026-05-12-v2.md` and `audit/html-audit-phase-a-2026-05-12-v2.json`

Companion documents not available in this Claude Code session:

- `funnelback-search-project-instructions-v15.md` (authoritative project instructions; v16 amendments queued by this session report)
- session notes accumulated in conversation history
