# Wellness V2 baseline evidence

Captured on 2026-07-20 before migrating product surfaces. This file intentionally
contains no database host, user, password or connection string.

## Git isolation

| Check | Result |
| --- | --- |
| Worktree | `myHealthPlanner-wellness-v2` |
| Branch | `feat/wellness-premium-v2` |
| `HEAD` | `3467d13f648c76942ad17a90f27316d8e731cac4` |
| Merge-base with `origin/main` | `3467d13f648c76942ad17a90f27316d8e731cac4` |
| Separate agent worktree touched | No |

## Approved visual source

| Artifact | SHA-256 |
| --- | --- |
| Source `docs/mockups/fuelboard-redesign-concept-v2.html` | `9f0c378f31be18c87a77f5639dd17b163e5ecc01985126a23cd3650002bd8413` |
| Isolated worktree copy | `9f0c378f31be18c87a77f5639dd17b163e5ecc01985126a23cd3650002bd8413` |

The matching hashes prove the approved concept was copied without modification.

## Database isolation

The app and verification branch resolve to different Neon endpoints. The branch
connection exists only in ignored `.env.local` files.

Schema fingerprints include public columns, defaults, constraints and indexes,
sorted before SHA-256 hashing:

| Database | Schema SHA-256 |
| --- | --- |
| Production, read-only comparison | `81973ffe7e020a1a28c181562a024588a5ebfd4ba55211700986632491991321` |
| Isolated Neon branch | `81973ffe7e020a1a28c181562a024588a5ebfd4ba55211700986632491991321` |

Row-count comparison at capture time:

| Table | Production | Isolated branch |
| --- | ---: | ---: |
| `diet_versions` | 4 | 4 |
| `days` | 13 | 13 |
| `meal_entries` | 178 | 178 |
| `health_metrics` | 27 | 27 |
| `training_plans` | 2 | 2 |
| `med_measurements` | 6 | 6 |
| `mark_entries` | 5 | 5 |
| `chat_threads` | 23 | 23 |

No write was issued to production during these checks.

## Baseline quality gates

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS with two pre-existing warnings and zero errors |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 21 files and 196 tests |
| `pnpm audit:contrast` | PASS for all light/dark text and UI pairs |
| `pnpm build` | PASS, Next.js 16.2.10 production build and 42 routes generated |
| `pnpm exec drizzle-kit check` | PASS |

Pre-existing warnings retained for traceability:

- `src/components/chat/chat-client.tsx`: missing `openThread` hook dependency.
- `src/components/hoy/add-sheet.tsx`: unused `_id` binding.

## Reproduction

Git and mock checks:

```bash
git rev-parse HEAD
git merge-base HEAD origin/main
shasum -a 256 docs/mockups/fuelboard-redesign-concept-v2.html
```

Application gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit:contrast
pnpm build
pnpm exec drizzle-kit check
```

Database comparisons must use locally loaded ignored environment files and must
print only fingerprints and aggregate counts, never connection values.
