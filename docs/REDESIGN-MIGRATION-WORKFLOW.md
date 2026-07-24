# Wellness V2 migration workflow

This document is the operating contract for migrating Fuelboard to the approved
`fuelboard-redesign-concept-v2.html` direction without losing existing behavior.

## Current release status · 2026-07-24

- Gates 0–4 have a recorded evidence snapshot at commit `965e992`.
- F10, F11 and ingest fix `363fa61` landed after that snapshot. Gate 4 must be
  interpreted with that boundary; prior `PASS` rows remain historical evidence.
- The automated Gate 4 suite is green on the current HEAD: lint, typecheck,
  247 tests, contrast audit, Drizzle check and production build.
- Alex approved Gate 5 on 2026-07-24 after two days of real use without
  incidents. This real-device acceptance replaces a new exhaustive screenshot
  freeze for this personal, single-user app (DECISIONS #73).
- Neon reports all 16 migrations `0000–0015` applied. Gate 6 is pending: sync the
  latest `main`, run the final non-destructive verification, merge through review,
  deploy and observe production.

## Confidence model

`99%` is a release-readiness threshold, not a mathematical promise that software
cannot fail. A release candidate may be proposed only when it scores at least
`99/100`, every blocking gate is green, and every supported workflow has linked
evidence.

| Area | Weight | Evidence required |
| --- | ---: | --- |
| Functional parity | 30 | Every route and user workflow in the parity matrix passes |
| Automated verification | 25 | Lint, types, unit/integration tests, build and contrast audit pass |
| Visual and responsive QA | 20 | Approved screenshots in both themes and target viewports |
| Data safety and correctness | 15 | Neon branch checks, metric formulas and write/read-back checks pass |
| Independent review | 10 | Spec, regression and final browser audits have no blockers |

A score cannot compensate for a failed blocking gate.

## Sources of truth

Use this precedence when two sources disagree:

1. Current production behavior and contracts on `origin/main`.
2. Explicit user feedback captured in the parity matrix.
3. Visual language and composition in
   `docs/mockups/fuelboard-redesign-concept-v2.html`.
4. Existing implementation patterns in the repository.

The mockup defines appearance, hierarchy and intended interactions. It does not
authorize deleting a current workflow, inventing a metric, changing a formula or
altering an API contract.

## Agent workflow

Only the integrator edits files. Audit agents are read-only and report findings
with file/line references and reproducible evidence. This avoids conflicting
patches while still obtaining independent review.

| Role | Responsibility | May edit? | Exit artifact |
| --- | --- | --- | --- |
| Integrator | Owns implementation, tests, commits and conflict resolution | Yes | Working vertical slice |
| Spec auditor | Compares mockup and feedback with every current feature | No | Parity gaps and acceptance checks |
| Regression auditor | Reviews routes, APIs, data contracts, tests and rollback risk | No | Risk register and missing tests |
| Browser verifier | Exercises the completed slice across themes and viewports | No | Screenshots, console log and flow report |

Rules for all agents:

- Work only in `myHealthPlanner-wellness-v2` on `feat/wellness-premium-v2`.
- Treat the separate `restyle-v2` worktree as external and never modify it.
- Do not share file ownership between agents.
- Record a finding before proposing a change; include the expected and actual
  behavior plus a reproduction path.
- The integrator resolves findings and reruns the relevant gate. An auditor then
  verifies the resolution independently.

## Required parity matrix

Every row must record route, entry point, action, expected result, API or server
action, data written, test evidence, browser evidence and status. No row may be
marked complete because a control merely renders.

Minimum coverage:

| Surface | Workflows that must survive the redesign |
| --- | --- |
| Today | Navigate by arrows and date picker; refresh Coach on demand; open Coach chat; view kcal/macros/water; add food; select meal; edit amount/product; move entry between meals; delete entry; expand/collapse meals; add/view bloating markers; offline queue and sync state; training; baseline; watch context; partial-day and phase states |
| Plan | Switch diet/training; navigate current and previous weeks; inspect day; import diet by photo/PDF; preserve all existing plan actions and states |
| Progress | Switch weekly/monthly summary; 30-day dietitian view; weight and MA7 graph; segmented macro-kcal intake; all existing filters; empty states; open MED; add/edit/delete measurement; open marks; add a mark; inspect exercise history; edit/delete a selected mark |
| Chat | List threads with relative dates and summaries; open thread; send/receive; retain history; open from Coach; expose AI errors and retry behavior |
| Settings | Toggle light/dark; retain every existing option; show last sync confidence; preserve account, integrations and destructive actions |
| Shared sheets | Product search; barcode/camera/manual registration; meal destination; product editing; validation; cancel/back; success/error states; keyboard and safe-area behavior |
| App shell | Bottom navigation; Today-only floating add button; active states; PWA install/update/offline; no inert share or navigation controls |

Any newly discovered flow is added to the matrix before its implementation is
changed.

## Migration sequence

### Gate 0: isolation and baseline

- Branch from the exact current `origin/main` commit in a dedicated worktree.
- Use a dedicated Neon branch, never the production connection string.
- Compare table counts and schema fingerprint with production using read-only
  queries.
- Capture baseline lint, typecheck, tests and build output.
- Copy the approved mockup and store its checksum.

Status: complete for this migration. Reproducible evidence is recorded in
`docs/REDESIGN-BASELINE.md`.

### Gate 1: contract freeze

- Inventory routes, layouts, components, server actions, API handlers, schemas,
  calculations, feature flags and PWA behavior.
- Complete the parity matrix before replacing a surface.
- Freeze Health-versus-manual precedence and every analytics formula with
  characterization tests before extending its view-model.
- Label each proposed change as `visual-only`, `presentation-derived`, or
  `behavioral`. Behavioral changes require explicit approval.
- Add characterization tests where production behavior is not already protected.

Exit: every current workflow has an owner, expected result and verification path.

### Gate 2: shared visual foundation

- Implement semantic tokens, Onest, Plus Jakarta Sans, light/dark themes, shared
  cards, controls, charts and shell primitives.
- Keep component public props and route contracts stable.
- Verify all required text pairs at `>=4.5:1` and meaningful UI fills/boundaries
  at `>=3:1` in both themes.
- Verify every sheet input is at least `16px`, touch targets are at least `44px`,
  and there is no horizontal overflow.

Exit: token audit, typecheck and focused component tests pass.

### Gate 3: vertical slices

Implement and accept one complete slice at a time:

1. Today and all food/product/marker/Coach flows.
2. Plan and import/week-navigation flows.
3. Progress, summary, charts, MED and marks flows.
4. Chat, Settings, History and remaining shared sheets.

For each slice, follow the same loop:

1. Freeze its parity rows and capture before screenshots.
2. Add missing characterization tests.
3. Restyle using existing selectors, actions and data contracts.
4. Run focused tests, lint, typecheck and contrast audit.
5. Verify real CRUD against the Neon branch, including write/read-back/delete.
6. Run browser flows in both themes and all target viewports.
7. Ask the spec and regression auditors to inspect the diff.
8. Resolve every blocker, rerun evidence and create one reversible commit.

No later slice is used to hide a failed earlier gate.

### Gate 4: full-system verification

Required automated commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit:contrast
pnpm build
pnpm exec drizzle-kit check
```

Required browser matrix:

| Mode | Viewports |
| --- | --- |
| Light | 320x568, 390x844, 430x932, desktop |
| Dark | 320x568, 390x844, 430x932, desktop |

At every viewport verify initial render, expanded content, bottom sheets, keyboard
open, loading, empty, partial, error, offline and long-content states. Capture
screenshots and fail on console errors, request failures, clipped content,
overlap, layout shift or inert controls.

The normal Playwright configuration disables the service worker. PWA install,
share-target, offline boot and replay therefore require a separate production-build
browser run with the service worker enabled.

### Gate 5: preview acceptance

- Deploy a preview using the isolated Neon branch.
- Run the complete parity matrix against the preview URL.
- Compare critical metric values and formulas with production fixtures.
- Obtain explicit visual approval for Today, Plan, Progress, Chat and Settings.
- Freeze the approved screenshot set before merge.

Exit: readiness is at least `99/100`, with zero blocking failures.

### Gate 6: merge and observation

- Rebase or merge the latest `main`, then rerun Gate 4 in full.
- Merge through a reviewed pull request; do not point the preview branch at
  production before approval.
- Observe client errors, failed requests, web vitals and sync behavior after
  release.
- Delete the temporary database branch and rotate its credential after the
  migration is complete.

## Blocking conditions

The release stops for any of the following:

- A production workflow is missing, inert or behaves differently without approval.
- A metric is invented or an existing formula changes without a domain test.
- Any required automated command fails.
- Any required contrast pair fails AA.
- A browser flow produces a console error, failed request or data mismatch.
- A write targets production during migration verification.
- A destructive schema change is required without a separately reviewed migration
  and rollback plan.
- A visual-only slice changes `src/server/db/schema.ts` or `drizzle/`.
- A mobile input renders below `16px`, a primary target below `44px`, or content
  overlaps/clips at a required viewport.

## Data and rollback policy

- Visual work must not require schema changes. If a schema change becomes
  necessary, make it additive first and deploy code that tolerates both schemas.
- Coach caching should use the existing exported `settings` store unless a genuine
  history requirement is approved. Timestamped/multiple bloating events require an
  additive table while the existing day-level value remains compatible.
- Test every mutation on the Neon branch using a known fixture and verify its
  persisted result through the same read path used by the UI.
- Commit by accepted vertical slice. Never bundle unrelated cleanup with the
  redesign.
- The immediate code rollback is a revert of the affected slice commit.
- The database rollback is normally unnecessary because migrations are additive;
  otherwise it must be rehearsed on a fresh Neon branch before approval.
- Preserve the previous deploy until post-release observation is clean.

## Definition of done

The migration is done only when all of these are true:

- `100%` of parity rows have automated or browser evidence.
- `0` test, type, lint, build or contrast errors.
- `0` console errors and `0` unexpected failed requests in the browser matrix.
- `0` inert or orphaned controls.
- `0` unexplained differences in stored or displayed domain values.
- Both themes and every required viewport have approved screenshots.
- All independent audit blockers are resolved and reverified.
- The preview is approved before any merge or production data connection.
