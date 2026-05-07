# CLAUDE.md — su-search-dev

This file is auto-loaded into every Claude Code session launched in this repo. It provides the operational posture and essential context needed to work here productively.

## What this repo is

`su-search-dev` is the B-side (development) frontend application for Seattle University's search system. It is a Next.js app deployed on Vercel. The system as a whole has four currently-deployed apps:

- `su-search` — A-side frontend (production)
- `su-search-dev` — B-side frontend (this repo)
- `funnelback-proxy` — A-side proxy (production)
- `funnelback-proxy-dev` — B-side proxy (sibling repo)

The frontend is the public-facing layer that T4 (the CMS managing seattleu.edu) imports scripts from. The proxy is the intermediary between the frontend and Funnelback/Squiz, holding credentials and handling the upstream search calls.

## Operational posture: discovery phase, read-only

This repo is in the **discovery phase** of a planned rebuild. The current system is being audited and understood before any rebuild design or implementation work begins.

**The existing system is frozen.** No code changes, no dependency updates, no configuration modifications, no commits that alter runtime behavior. The frozen four-app system serves as the emergency fallback during the rebuild transition, and its value as fallback depends on remaining unchanged from the state currently running in production.

**Findings from audit become rebuild requirements, not retroactive patches.** When audit work reveals dead code, wasteful patterns, or obvious cleanups in the current system, those findings are captured for implementation *in the new system*. They are not applied to this repo. This discipline prevents incremental erosion of the fallback's reliability.

**The only acceptable changes to this repo right now** are: (1) configuration files that shape *Claude Code's own behavior* in this directory (`.claude/settings.json`, `.claude/settings.local.json`, this `CLAUDE.md`), (2) documentation-only additions that don't alter runtime, and (3) audit deliverables written to the `audit/` directory under audit-scoped write permissions in `.claude/settings.local.json`. Anything that touches application code, dependencies, build configuration, or deployment surface is out of scope until the rebuild design is complete.

## What Claude Code should do here

**Read, traverse, analyze, summarize.** That's the work. Tracing imports, explaining what a handler does, comparing two files, identifying patterns across modules, producing structured summaries of code paths — all valuable.

**Surface findings for human review.** When something notable appears — duplicated logic, inert dependencies, dead code, undocumented behavior, tight coupling that would matter for rebuild design — flag it clearly in output. Do not act on findings. Flagged findings get discussed in the broader architectural conversation and captured into audit documents for the rebuild.

**Distinguish intentional behavior from residue.** Some current-system surface area looks like a quirk on first read but turns out to be deliberate UX driven by specific user-flow concerns. The header autocomplete consuming only general suggestions (despite the fan-out also returning staff and programs), and the search-page suggestion click firing a background search alongside the user's chosen navigation, are both intentional product behaviors — not cleanup targets. When something looks odd, the question is "is this intentional or residue" before "should this be flagged for cleanup."

**Ask before expanding scope.** If a task seems to require reading files outside the immediate question, or traversing into sibling repos, or running bash commands that produce side effects — pause and ask. Plan mode will block many of these automatically, but the discipline matters beyond what plan mode enforces.

## Key architectural facts Claude Code should know

These facts affect how code in this repo should be read and summarized. They are the product of audit work that has already been done; they are not inferences to re-derive. The canonical audit documents in `audit/` (see "Audit documents available in this repo" below) hold the evidence; this section holds the headlines.

**A/B topology is being retired in the rebuild.** The current A/B mirror pattern is not carried forward. Any reasoning about architecture should not treat A/B as a design to preserve. It is a historical choice being undone.

**"One great app vs. front-back pair" is an open architectural question.** The rebuild may merge frontend and proxy into a single Next.js app, or keep them as two separate apps minus the A/B duplication. Not yet decided. Analyses that depend on this fork should flag the dependency rather than assume either answer.

**Four live content-type renderers, not nine.** The Funnelback `partial.ftl` template imports nine result-type templates (news, law, programs, people, video, facebook, events, twitter, instagram), but only the first four are rendered in the Seattle University UX. The other five are inherited Funnelback defaults that the frontend never surfaces. Reason about content-type specialization in terms of the four live renderers plus basic search and autocomplete.

**Autocomplete: two consumers, one shared backbone.** Header autocomplete (in `public/integration.js`, on every page where `#search-input` exists) and search-page autocomplete (in `public/search-page-autocomplete.js`, attaching site-wide despite the file name but only doing useful work on `/search-test/`) are two separate consumers. Both hit the same FE-server endpoint at `pages/api/suggestions.ts`, which fans out to three proxy endpoints (`/funnelback/suggest`, `/suggestPeople`, `/suggestPrograms`) in parallel. The header consumer renders only the general bucket from the response; the search-page consumer renders all three in a three-column layout. The "three-tier autocomplete" framing in earlier docs referred to the `type=general/staff/programs` branches in `pages/api/suggestions.ts:79-91` — these are structurally unreachable from FE consumers (both consumers send `{ query, sessionId }` and exercise only the default fan-out). The endpoint is one tier with three internal legs in the default branch.

**Two `performSearch` implementations exist and are wire-distinguishable.** `integration.js`'s private `performSearch` (line 899, with `window.performSearch` wrapper at line 1280) sends `form=partial` explicitly; `search-page-autocomplete.js`'s local `performSearch` (line 666) does not. The May 6 listener audit's puzzle 3 confirmed via static analysis that both search-page click-handler call sites (L550 inside the staff/program inner-`<a>` setTimeout, L564 in the main branch) lexically resolve to the local L666 function — function declarations are hoisted to the module scope and found before identifier resolution reaches `window.performSearch`. The May 1 network capture's attribution of `integration.js:934` as the live initiator on suggestion clicks is in tension with this static read; the most plausible reconciliation is misattribution from a coincident in-flight request, but a definitive answer requires runtime instrumentation. Regardless of which fires in current production, the rebuild collapses these to one canonical dispatcher with `form` as an explicit parameter.

**Pre-render helpers live in the autocomplete file.** `checkForPreRenderedContent` (search-page-autocomplete.js:168) and `displayPreRenderedResults` (line 290) are exposed globally at lines 1133-1134 for `integration.js`'s `processUrlParameters` to call. The file owns two responsibilities — autocomplete plus pre-render display — that the rebuild may want to split.

**Hardcoded URLs are scattered.** `proxyBaseUrl` (`https://funnelback-proxy-dev.vercel.app/proxy`) appears as five literal occurrences across four FE files: `public/integration.js:29`, `public/search-page-autocomplete.js:601` and `:843`, `public/js/search-index.js:20`, `public/js/modules/core-search-manager.js:23`. Plus a sixth instance server-side at `lib/api-client.ts:17` with an env-var override path (`process.env.BACKEND_API_URL || ...`). Earlier "three places" framing was an undercount. `apiBaseUrl` (`https://su-search-dev.vercel.app`) has its own four-place hardcoding pattern: `integration.js:28`, `search-page-autocomplete.js:182`, `:634`, `:678`. The rebuild collapses both through one configured value.

**`search-bundle.js` is unused.** The file exists in `public/` and is preloaded by `integration.js`, but nothing actually executes it. It represents an incomplete migration (the planned consolidation of the four-script approach). Safe to note as removal candidate for the rebuild; not to be modified now.

**`core-search-manager.js` only initializes on URL paths containing "search".** It is a search-results-page orchestrator, not a site-wide thing. Autocomplete on non-search pages is powered by `search-page-autocomplete.js` directly.

## Load tier reality

The T4 PageLayout imports four scripts in three load tiers:

1. **High priority** (`fetchpriority="high"`): `SessionService.js`
2. **Synchronous blocking** (no load attribute): `search-page-autocomplete.js`
3. **Deferred**: `integration.js` (`defer`), `search-index.js` (`type="module"`, deferred by default)

Tier 2 being synchronous is a fact, not necessarily a commitment. Whether it needs to be synchronous is a question for the rebuild's bundle-shape review.

Beyond the four HTML-loaded scripts, six per-feature managers (`tabs-manager.js`, `facets-manager.js`, `pagination-manager.js`, `spelling-manager.js`, `analytics-manager.js`, `collapse-manager.js`) load dynamically via `import()` at `core-search-manager.js:249`. They are not in the HTML. The full per-page-navigation chain is: HTML → `search-index.js:14` imports `core-search-manager.js` → `core-search-manager.js:249` imports each per-feature manager. The May 6 listener audit's puzzle 7 confirmed this is the sole load path for the per-feature managers; there is no double-import and no double-initialization.

## Cache implementation

`lib/cache.ts` implements the frontend cache. The cache audit (`audit/fe-cache-audit-2026-05-04.md`) is the canonical reference. Headlines: a narrow `getCachedData` / `setCachedData` get/set surface that fails safely on Redis errors; five TTL tiers aligned to crawl cadence; an in-memory `queryPopularity` map whose TTL-tuning half is alive on exactly one call path (search miss-fetch) but bounded by serverless container warmth, and whose metrics-rollup half is dead with no consumer. Five call sites with four different normalization patterns and five different TTL behaviors. The env var names (`su_search_dev_012026_KV_URL`, etc.) embed a timestamp and serve as the system's actual cache-flush mechanism — renaming the env var to repoint at a fresh KV store is the only effective full-flush practice. The rebuild will use stable env var names with explicit versioning if needed.

**Suggestions caching is structurally distinct from search caching.** Two layers of distinction: the `suggestions:` cache-key prefix in `pages/api/suggestions.ts:57` bypasses the popularity-tier surface in `lib/cache.ts` (the prefix sniff matches only `search:` and `tab:`); and `pages/api/suggestions.ts:71` does not pass `cacheAware: true` to `createApiClient`, so suggestions does not assert the X-Cache-Aware contract on the upstream proxy that `search.ts` and `pre-render.ts` do. Whether this dual divergence is intentional or accidental is rebuild design space.

## Outside of scope for this repo

- Any change to the proxy (sibling repo `funnelback-proxy-dev`)
- Any change to the frozen A-side repos (`su-search`, `funnelback-proxy`)
- Any modification of this repo's runtime code, dependencies, or build configuration

## Audit documents available in this repo

The `audit/` directory holds canonical findings from completed audits. Claude Code can read these in-session for context.

- `audit/proxy-audit-2026-04-29.md` — proxy shared-core handler audit (sibling-repo proxy code, but the audit doc lives here for reference).
- `audit/funnelback-endpoint-dictionary-2026-05-01.json` — proxy-side endpoint dictionary (upstream URL surface, request shapes, cross-cutting observations).
- `audit/fe-endpoint-dictionary-2026-05-01.json` — FE-side endpoint dictionary (eighteen FE-originated request types, trinity provenance modes, configuration source distribution). The May 5 autocomplete-audit amendments are folded into the body; two listener-audit-sourced updates (the `tab-click` entry's structural framing of the four-request fan-out and the `pre-render-content-check` / `header-form-prerender-trigger` cache-namespace caveat) are pending.
- `audit/network-investigation-2026-05-01.md` — live-traffic observations (tab-click four-request fan-out, prefetch-handoff timing, FE-script reload-on-every-navigation).
- `audit/fe-cache-audit-2026-05-04.md` — FE cache layer audit.
- `audit/fe-autocomplete-audit-2026-05-05.md` — FE autocomplete subsystem audit (full lifecycle: source → FE-server boundary → both consumers → click dispatch → redirect → handoff to rendering).
- `audit/fe-listener-audit-2026-05-06.md` — FE listener inventory + reachability map across the three listener-bearing FE files (`integration.js`, `search-page-autocomplete.js`, `core-search-manager.js`). Sixteen DOM event listeners plus two MutationObservers catalogued; twelve user-action classes traced through to first network call. Resolves seven puzzles including the prefetch-handoff race, the `pages/api/search.ts:127–145` substring-inference fallback's cache-namespace mismatch (form=partial requests route to tab-cache rather than search-cache), the input-mutation re-firing hypothesis (disproved — programmatic value assignment does not dispatch `input` events), and the per-feature-manager double-import hypothesis (disproved — `core-search-manager.js:249` is the sole loader).

When reading existing code, cross-reference the relevant audit document rather than re-deriving findings. When findings in an audit document conflict with text in this `CLAUDE.md`, the audit document is more recent and authoritative — surface the conflict for human review.

## Companion documents (not available in Claude Code sessions)

These documents exist in the broader project context but are not available to read from within a Claude Code session. Findings from Claude Code sessions flow back into conversations where these documents are available.

- `funnelback-search-project-instructions-v12.md` — authoritative project instructions
- session notes accumulated in conversation history

If a Claude Code task seems to require information that should live in those documents, surface the gap rather than improvising context.
