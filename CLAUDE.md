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

**The only acceptable changes to this repo right now** are: (1) configuration files that shape *Claude Code's own behavior* in this directory (`.claude/settings.json`, this `CLAUDE.md`), and (2) documentation-only additions that don't alter runtime. Anything that touches application code, dependencies, build configuration, or deployment surface is out of scope until the rebuild design is complete.

## What Claude Code should do here

**Read, traverse, analyze, summarize.** That's the work. Tracing imports, explaining what a handler does, comparing two files, identifying patterns across modules, producing structured summaries of code paths — all valuable.

**Surface findings for human review.** When something notable appears — duplicated logic, inert dependencies, dead code, undocumented behavior, tight coupling that would matter for rebuild design — flag it clearly in output. Do not act on findings. Flagged findings get discussed in the broader architectural conversation and captured into session notes for the rebuild.

**Ask before expanding scope.** If a task seems to require reading files outside the immediate question, or traversing into sibling repos, or running bash commands that produce side effects — pause and ask. Plan mode will block many of these automatically, but the discipline matters beyond what plan mode enforces.

## Key architectural facts Claude Code should know

These facts affect how code in this repo should be read and summarized. They are the product of audit work that has already been done; they are not inferences to re-derive.

**A/B topology is being retired in the rebuild.** The current A/B mirror pattern is not carried forward. Any reasoning about architecture should not treat A/B as a design to preserve. It is a historical choice being undone.

**"One great app vs. front-back pair" is an open architectural question.** The rebuild may merge frontend and proxy into a single Next.js app, or keep them as two separate apps minus the A/B duplication. Not yet decided. Analyses that depend on this fork should flag the dependency rather than assume either answer.

**Four live content-type renderers, not nine.** The Funnelback `partial.ftl` template imports nine result-type templates (news, law, programs, people, video, facebook, events, twitter, instagram), but only the first four are rendered in the Seattle University UX. The other five are inherited Funnelback defaults that the frontend never surfaces. Reason about content-type specialization in terms of the four live renderers plus basic search and autocomplete.

**Three-tier autocomplete pipeline.** Autocomplete flows through three layers: `public/js/search-page-autocomplete.js` on the client (attaches site-wide despite the misleading "search-page" name), `pages/api/suggestions.ts` in this app (the orchestrator), and three proxy endpoints (`suggest`, `suggestPeople`, `suggestPrograms`).

**Hardcoded proxy URL appears in three places.** `public/js/modules/core-search-manager.js`, `public/integration.js`, and `public/js/search-index.js` all hardcode `https://funnelback-proxy-dev.vercel.app/proxy`. No environment variable, no single source of truth. The rebuild will collapse this to one configured value.

**`search-bundle.js` is unused.** The file exists in `public/` and is preloaded by `integration.js`, but nothing actually executes it. It represents an incomplete migration (the planned consolidation of the four-script approach). Safe to note as removal candidate for the rebuild; not to be modified now.

**`core-search-manager.js` only initializes on URL paths containing "search".** It is a search-results-page orchestrator, not a site-wide thing. Autocomplete on non-search pages is powered by `search-page-autocomplete.js` directly.

## Load tier reality

The T4 PageLayout imports four scripts in three load tiers:

1. **High priority** (`fetchpriority="high"`): `SessionService.js`
2. **Synchronous blocking** (no load attribute): `search-page-autocomplete.js`
3. **Deferred**: `integration.js` (`defer`), `search-index.js` (`type="module"`, deferred by default)

Tier 2 being synchronous is a fact, not necessarily a commitment. Whether it needs to be synchronous is a question for the rebuild's bundle-shape review.

## Cache implementation

`lib/cache.ts` implements the frontend cache with five TTL tiers aligned to crawl cadence, plus an in-memory `queryPopularity` map that tracks hit counts and elevates popular queries to longer TTLs. The env var names (`su_search_dev_012026_KV_URL`, etc.) embed a timestamp and are residue from an analytics-dashboard concept that did not land — the rebuild will use stable env var names.

## Outside of scope for this repo

- Any change to the proxy (sibling repo `funnelback-proxy-dev`)
- Any change to the frozen A-side repos (`su-search`, `funnelback-proxy`)
- Any modification of this repo's runtime code, dependencies, or build configuration

## Companion documents (not available in Claude Code sessions)

These documents exist in the broader project context but are not available to read from within a Claude Code session. Findings from Claude Code sessions flow back into conversations where these documents are available.

- `funnelback-search-project-instructions-v6.md` — authoritative project instructions
- `session-notes.md` — accumulated audit findings across sessions

If a Claude Code task seems to require information that should live in those documents, surface the gap rather than improvising context.
