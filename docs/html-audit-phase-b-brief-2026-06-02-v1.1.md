# HTML Audit Phase B — Brief (v1.1, ratified)

**Phase:** B — FE external-contract consumption (the inverse view; next-and-final HTML audit phase)
**Date:** 2026-06-02
**Status:** Ratified v1.1 (2026-06-02). Supersedes draft v1.0.
**Repo under audit:** `su-search-dev` (FE-authored code: `public/`, `pages/`, `lib/`, `components/`)
**Predecessor phases:** A (FE-authored HTML — canonical), C (Squiz stencils contract surface — canonical), E (Funnelback partial-response per-renderer markup — canonical), D (T4 PageLayout chrome — constraint surface, via synthesis-and-closure)
**Intended file location:** `docs/html-audit-phase-b-brief-2026-06-02-v1.1.md`

---

## Purpose

Phases A, C, D, and E characterized what each contributor to the production HTML *emits*: A the FE-authored HTML, C the Squiz stencils contract surface, E the Funnelback partial-response per-renderer markup, D the T4 PageLayout chrome (now constraint surface). Phase B is the inverse view: what the FE-authored code *consumes* from each of those external surfaces. It closes the seam contracts the emitting-side phases documented, by resolving the specific consumer-enumeration questions those phases flagged and handed forward.

Phase B is the final HTML audit phase. Its completion closes the HTML audit sequence (A → C → E → D → B), modulo one thin documentary residual carried forward (see *Stylesheet-alignment cross-check*).

---

## Constraint framing (locked at brief time)

Per the Phase D methodological lesson — audit briefs should be drafted *after* constraint framing is locked, not before — Phase B's framing is stated as locked before scope. Three architectural constraints govern every Phase B outcome:

- **Visual-design-immutability.** The rebuild makes no changes to the visual design. CSS class names referenced by stylesheets the rebuild does not modify, markup envelopes whose styling depends on exact class assignment, and styled chrome are all preserve-verbatim.
- **Preserve-DOM-contract-by-default-pending-consumer-enumeration.** Every class name, data attribute, ARIA attribute, and selectable element with no audit-confirmed consumer is preserved by default. Removal requires consumer-enumeration-confirmed absence, not assumed absence.
- **Stylesheet-as-binding-contract (new, established this session).** The existing Funnelback stylesheet lives in T4, is dedicated to Funnelback styles, and is itself a binding restriction on the rebuild: everything the rebuild builds must align with the existing stylesheet. This is the *active* form of visual-design-immutability. The passive form was "do not change the appearance"; the active form is "the stylesheet is fixed, and the rebuild's markup must emit the class and selector contracts it already expects." It promotes the CSS surface from *preserve-by-default-pending-enumeration* to *binding contract*: for any styled class, the rebuild does not get to rename it — it emits what the stylesheet targets. (Vic-originated; pending a project-knowledge post that will carry it to project-instruction level. The v19 queue formalizes it as a paired anchor.)

The consequence for Phase B is decisive and shapes the whole audit: **the outcomes are documentary, not cleanup-deciding.** Phase B enumerates consumers to *document the contract*, not to license removal. Under the anchors, even a confirmed-zero-FE-consumer surface is preserved — and, where the stylesheet targets it, emitted-and-aligned by binding constraint. This reframes every handoff item from "should we cut this" to "what consumes this, and is the contract FE-internal, stylesheet-binding, or unconsumed."

---

## Repo-shape sharpening (from the `su-search-dev` tree)

Two facts about the FE-authored surface tighten the grep scope:

1. **The FE-authored surface is four directories of JS/TS:** `public/` (vanilla JS — `integration.js`, `search-page-autocomplete.js`, `js/modules/*`, etc.), `pages/` (API routes plus `_app.tsx` / `index.tsx`), `lib/` (TS), and `components/` (`ResultList.tsx`, `SearchInput.tsx`). `components/ResultList.tsx` is the most likely home of any `.listing-item` / `*Data` envelope consumption; both TSX files are in scope alongside the vanilla-JS surface.

2. **There is no stylesheet anywhere in the repo,** and the stylesheet that does exist is T4-served and binding (above). This cleanly routes *every* CSS-consumer question to the T4-served surface rather than complicating the FE grep. The practical effect: the FE-side grep for class/ID selectors is a JS/TS-selector grep only. Any CSS consumer of a class or ID is, by construction, on the T4 stylesheet — which under stylesheet-as-binding-contract means the rebuild's posture is *emit-and-align*, not preserve-pending-evidence. An FE-side miss on a styled class is therefore a resolved outcome (CONSUMER_EXTERNAL / emit-and-align), not an open question.

---

## Scope (in)

Static consumer enumeration against the FE-authored code, resolving the four consumer-enumeration questions handed forward from Phases E and D:

1. **E7 — typo-ID consumers.** Grep FE source (JS/TS) for `funnelbach-search-facets` and `funnelbach-search-body` — the `funnelbach`/`funnelback` typo on the two DOM IDs emitted at `partial.ftl:121` and `:211`.
   - FE-side **positive** → the rebuild must migrate the FE consumers when it standardizes on `funnelback` spelling.
   - FE-side **negative** → the typo is cosmetic on the rebuild-controlled FE surface; proceed to the conditional T4-side check (below). Note the stylesheet angle: the same elements carry correctly-spelled *class* names, so a stylesheet selector would target the class, not the typo'd ID — making a stylesheet consumer of the typo'd ID unlikely but not assumed. The T4-side check settles it.

2. **E8 — CTA URL fixture-data consumers.** Determine whether any FE code reads, parses, or depends on the tab-conditional CTA content (heading / body / link URL / button text) hardcoded as inline FTL string literals at `partial.ftl:130–172`. The rebuild's plan is to externalize this content; E8 establishes whether externalization carries an FE-coordination dimension or is purely an FTL/content concern. (CTA content is not a styled-class question, so the stylesheet constraint does not bear on E8.)

3. **E9 — `listing-item--course` consumers.** Determine whether any FE JS selector targets `.listing-item--course` on news cards (the copy-paste-residue modifier class on `results.news.ftl`). **Rebuild posture is settled by stylesheet-as-binding-contract: emit-and-align regardless.** The FE grep resolves only the JS-hook dimension (does FE code key off this class). The stylesheet-styled status — is `.listing-item--course` live-styled or residue the stylesheet ignores — is documentary completeness, carried to the stylesheet-alignment cross-check; it does not gate any rebuild decision.

4. **dataListing / per-type `*Data` consumers.** Grep FE source for `dataListing` and the per-type suffixes `genericData`, `lawData`, `newsData`, `programData`, `peopleData` on the cross-renderer `.listing-item` envelope. The D7 working read is that the camelCase paired generic-plus-per-type pattern suggests JS hook selectors more than visual or ARIA semantics; the FE grep confirms or corrects this. The JS-hook dimension closes fully here (CONSUMER_CONFIRMED if FE keys off them; CONSUMER_ABSENT if not). The visual dimension, like E9, is emit-and-align under the stylesheet constraint, with live-styled-vs-residue carried to the cross-check.

---

## Scope (conditional)

- **E7 T4-side runtime DOM check.** Fires **only** if the E7 FE-side grep returns negative. A runtime DOM inspection of a live search page determines whether T4 chrome — or the T4-served Funnelback stylesheet — references the typo'd IDs. Confirms whether the typo is fully cosmetic (no consumer anywhere → rebuild corrects freely) or has a T4-side consumer (→ rebuild coordinates the correction with T4 chrome). T4 chrome is constraint surface; this check determines coordination need, not modification rights.

- **Optional runtime computed-style spot-check (belt-and-suspenders).** A live-page computed-style read on a news result card and on representative `.listing-item` envelopes can *partially* anticipate the stylesheet-alignment cross-check — confirming whether `.listing-item--course` and the `*Data` classes resolve to any non-default styling without waiting for the stylesheet source. Optional; opt in at execution if you want partial coverage before the source lands. Not a substitute for the source-level cross-check.

---

## Scope (out)

- No modification of any FE application code, dependencies, or build configuration (discovery-phase freeze; per `CLAUDE.md`).
- No modification of FTL templates, Squiz framework JS, or T4 chrome. No stylesheet work — the Funnelback stylesheet is T4-served binding constraint surface, and the CSS audit is dropped (the rebuild does not touch the stylesheet; it conforms to it).
- No re-characterization of the emitting surfaces. A/C/D/E are canonical; Phase B consumes their findings, it does not redo them.
- No new contract-surface enumeration beyond the consumer side of the four handoff items — unless the grep surfaces an unflagged consumer dependency worth recording (see stop rules).

---

## Stop rules

- Phase B is consumer enumeration against the FE repo. If a question requires re-reading framework JS bundle internals or FTL macro bodies to resolve, that is out of scope — the emitting side is canonical. Record the gap and defer rather than reopening a prior phase.
- The E7 T4-side check is the only *required* conditional runtime element, gated on FE-side negative. The computed-style spot-check is optional. Do **not** take further runtime captures for E8, E9, or dataListing — their FE dimension is static-grep-resolvable and their visual dimension is emit-and-align by constraint.
- If consumer enumeration surfaces a dependency that changes a *rebuild decision* (rather than merely documenting a contract), flag it for conversation rather than resolving it in-audit. Phase B documents contracts; it does not make rebuild architecture calls.

---

## Execution shape — single-phase (ratified)

**Single-session execution.** The reasoning:

- **Constraint framing is locked** (the three constraints above), so the audit is not exposed to the mid-execution scope shift that collapsed Phase D.
- **The work surface is bounded and enumerable** — four consumer-enumeration questions against four FE directories, resolvable by grep, with one conditional runtime check and one optional spot-check.
- **Outcomes are documentary under the anchors**, and the stylesheet constraint *resolves* rather than opens the visual dimension of E9 and dataListing, so no handoff item forks into a sub-investigation or a rebuild-decision branch inside the audit.

This is the inverse of the Phase D risk profile. Phase D shrank because its framing locked mid-execution; Phase B's framing is locked at brief time, so the scope it states is the scope it executes.

**Explicit space for contraction or expansion (the Phase D belt-and-suspenders):** if the FE-side grep surface turns out broader than the four handoff items imply — e.g., the `*Data` enumeration reveals a consumer family that opens a fifth question, or E8 surfaces an FE CTA dependency with rebuild-decision weight — the audit flags it *at that point* and we decide whether to fold it in or split. No mid-write splitting; the decision is made at the flag, not retroactively.

---

## Stylesheet-alignment cross-check (carried-forward documentary residual)

One named dependency is carried past Phase B execution: confirming, against the stylesheet source, *which* envelope and modifier classes are live-styled versus residue the stylesheet ignores (specifically `.listing-item--course` on news, and the `dataListing` / per-type `*Data` classes in their visual dimension). This does not gate any rebuild decision — all of these are emit-and-align under the stylesheet-as-binding-contract constraint regardless of outcome. It is documentary completeness only: it tells a later optimization pass which classes a markup-trim could touch without visual effect.

The stylesheet source is not in the repo; Vic will post it to project knowledge. Resolution is a short follow-on once the source lands. The optional computed-style spot-check (conditional scope) can provide partial coverage in the interim.

**Consequence for closure framing:** Phase B closes the FE-consumption seam — the FE-internal-consumer dimension of all four handoff items resolves in-session. It does *not* close the stylesheet-alignment dimension, which is carried as this one documented residual. The session report records the HTML-audit sequence as closed-with-one-documentary-residual rather than closed-clean.

---

## Deliverables

Per the per-topic audit chat pattern with canonical deliverables:

- `audit/html-audit-phase-b-2026-06-02.json` — canonical evidence (consumer-enumeration results per handoff item, with grep evidence and resolution).
- `audit/html-audit-phase-b-2026-06-02.md` — markdown companion.
- `audit/session-report-2026-06-02-html-audit-phase-b.md` — session report, including brief-versus-execution deltas, the stylesheet-alignment carried-forward residual, and the HTML-audit-sequence closure note.

Written under `audit/**`-scoped write permissions in `.claude/settings.local.json`.

---

## Finding taxonomy (ratified)

Per the v18 note that stream taxonomy follows audit shape: Phase B is consumer-enumeration-shaped, so findings are framed around consumer-enumeration outcomes.

- **CONSUMER_CONFIRMED** — the surface has an enumerated FE consumer; the contract is binding and the rebuild migrates or preserves the consumer explicitly.
- **CONSUMER_ABSENT** — no FE consumer found; preserved by default per the anchors, flagged for the rebuild's pre-launch DOM audit.
- **CONSUMER_EXTERNAL** — the consumer is on a non-FE surface (T4 chrome, or the T4-served Funnelback stylesheet). For the stylesheet case, the rebuild posture is *emit-and-align* (binding), and the stylesheet-alignment cross-check is the documentary step that confirms which external classes are live-styled versus residue.
- **CROSS_REFERENCE** — closure / handoff / correction relative to prior phases.

---

## Sub-phase plan

1. **Brief** (this document) — ratified.
2. **Static enumeration** — grep the FE surface for the four handoff items' selectors/strings; record evidence per item.
3. **Conditional runtime check** — E7 T4-side, only if the FE-side grep is negative; optional computed-style spot-check if opted in.
4. **Synthesis** — classify each handoff item by outcome; record findings; record the carried-forward stylesheet-alignment residual.
5. **Amendments queue** — the CLAUDE.md update (the five edits already identified, as a single pass), the v18 → v19 project-instructions amendments, and the HTML-audit-sequence closure note.

---

## Amendment queue (Phase B outputs)

- **CLAUDE.md update** — single pass, sub-phase 5. The five edits already identified: current-audit-phase line (Phase D complete, Phase B next-and-final → on completion, sequence closed); the two v18 anchors added to Key architectural facts; the dataListing / `*Data` D7 framing added to renderer-dispatch; companion-docs v17 → v19; audit-documents list gains the Phase D pair, session report, and ratified brief — plus the Phase B pair on completion.
- **v18 → v19 project-instructions revision** — folds in Phase B findings, the HTML-audit-sequence closure, and the **stylesheet-as-binding-contract** constraint as a new key architectural anchor *paired with* visual-design-immutability (distinct binding surface — "do not change the look" versus "conform to the stylesheet's contracts" — same logic that kept preserve-DOM-contract a separate anchor rather than a sub-bullet). Pending Vic's project-knowledge post of the constraint.
- **Older canonical-document worklist items — resolved, dropped.** The May 1 network-investigation amendment and the FE endpoint dictionary amendment are confirmed already handled (the FE endpoint dictionary was updated 2026-05-13). They do not carry into the Phase B queue.

---

## Post-Phase-B

Phase B closes the HTML audit sequence (with the one documentary residual above). Audit-cadence items beyond the HTML sequence (the conditional SessionService, security/middleware, and listener-coordination audits) are not Phase B's concern. The CLAUDE.md update and the v19 project-instructions revision are Phase B's amendment-queue outputs.

---

## Ratification record (2026-06-02)

- **A/B stylesheet decision:** Option A — proceed now, FE-side complete; stylesheet-alignment dimension carved as one named carried-forward dependency.
- **Q1 single-phase:** ratified, with the contraction/expansion escape hatch.
- **Q2 finding taxonomy:** ratified (four categories above).
- **Q3 amendment-queue scope:** older worklist items resolved/dropped; queue is CLAUDE.md + v19.
- **Q4 CLAUDE.md sequencing:** brief-first confirmed; CLAUDE.md lands as a single pass in sub-phase 5.
- **New constraint:** stylesheet-as-binding-contract established this session; queued for v19 as a paired anchor pending Vic's PK post.
