# Wellness V2 parity matrix

This is the live acceptance ledger for the redesign. `PENDING` means the current
behavior has not yet been independently reverified after restyling. `GAP` means
the approved concept needs a real additive adapter before it can ship.

Every completed row must link automated evidence, browser evidence, or both.

## Product surfaces

| ID | Surface | Current contract to preserve | V2 acceptance condition | State |
| --- | --- | --- | --- | --- |
| SHELL-01 | App layout | Authenticated shell and current routes | Wellness tokens/fonts in both themes without changing route contracts | PENDING |
| SHELL-02 | Bottom nav | `/hoy`, `/plan`, `/progreso`, `/chat` | Base nav, no grey gradient, correct active state, safe area retained | PENDING |
| SHELL-03 | Quick add | Existing Today add flow | Floating `+` is visible only on Today and opens the complete add sheet | PENDING |
| SHELL-04 | Theme | Theme provider and settings control | Light is primary; light/dark/system remain selectable and persistent | PENDING |
| SHELL-05 | Auxiliary routes | Login, offline and loading UI | All adopt V2 tokens without losing their functional states | PENDING |
| TODAY-01 | Date header | `/hoy?date=`, previous/next navigation and streak | Tap date opens date picker, arrows work, future dates are blocked, flame follows `N días` | PENDING |
| TODAY-02 | Coach entry | `CoachSheet`, `/api/ai/coach`, `/chat?thread=` | Cached greeting card is readable by tap; refresh icon is explicit; no AI call on page load | GAP |
| TODAY-03 | Coach states | Current transient request/error behavior | Empty, cached, stale, loading, offline and retry states use real timestamps/data | GAP |
| TODAY-04 | FuelGauge | Real targets, totals and `gaugeVerdict` | Kcal/P/C rings plus fat bar fit at 320 px; phase marks, partial-day remainder and phase copy are real | PENDING |
| TODAY-05 | Water | Current water data/control | Water remains visible and usable in Today | PENDING |
| TODAY-06 | Meal timeline | Current grouped entries and expansion | Meals sit directly below gauge; groups expand/collapse; no per-meal add buttons | PENDING |
| TODAY-07 | Food edit | Entry detail/edit contract | Tapping an entry edits amount/product and can move it to another meal | PENDING |
| TODAY-08 | Food delete | Current delete plus undo behavior | Delete is available in entry detail and existing undo behavior survives | PENDING |
| TODAY-09 | Add destination | AddSheet meal selection | Product, plan, photo, describe, label and manual layers retain the selected meal | PENDING |
| TODAY-10 | Product CRUD | Product search/register/edit APIs | Camera/barcode/manual registration and product editing remain complete | PENDING |
| TODAY-11 | Add helpers | Copy yesterday, templates and planned food | Every current entry point remains reachable and writes the expected entry | PENDING |
| TODAY-12 | Bloating | Current daily `bloat` check-in | One clear selector and a timeline marker with a real time; no duplicate explanatory row | GAP |
| TODAY-13 | Training | Current WOD/training card and errors | Training follows meals and preserves detail, loading and error/manual paths | PENDING |
| TODAY-14 | Baseline | Health metrics currently stored | HRV, resting HR, sleep and steps show raw value plus delta vs prior 30-day mean | GAP |
| TODAY-15 | Watch context | Existing health/watch metrics and `energyBalance` | Context remains last, sync confidence is explicit, balance says `orientativo ±25%` | PENDING |
| TODAY-16 | Offline queue | IndexedDB queue and replay | Reactive 0/pending/syncing/failure indicator is visible in Today | GAP |
| PLAN-01 | Plan switch | Diet/training segment | Toggle gains spacing and professional density without changing the modes | PENDING |
| PLAN-02 | Diet targets | Versioned targets/options/variants | Compact target hierarchy and all current edit sheets remain functional | PENDING |
| PLAN-03 | Diet import | Photo/PDF import | `Importar dieta (foto/PDF)` stays visually prominent and completes the current flow | PENDING |
| PLAN-04 | Training weeks | Current/last applicable training plan | Previous/current week navigation resolves the selected week honestly by URL | GAP |
| PLAN-05 | Training CRUD | Import, edit, assign and delete week/session | All existing actions remain present; empty weeks do not fall back deceptively | PENDING |
| PROG-01 | Progress sections | Trend, History and MED segments | Existing segments and filters remain available through URL-addressable state | GAP |
| PROG-02 | Summary period | Existing trend analytics | `Semanal` is trailing 7 days; `Mensual` is today minus 29 through today inclusive | GAP |
| PROG-03 | KPIs | Existing real calculations | Deficit, kg/week, real TDEE, adherence 14d and streak use existing formulas only | PENDING |
| PROG-04 | Weight chart | Existing weight and MA7 series | Thin raw line plus thicker MA7, no large points, `<8` state is honest | PENDING |
| PROG-05 | Intake chart | Existing daily kcal/macros | Each kcal bar segments protein `g×4`, carbs `g×4`, fat `g×9`; discrepancy is separate | GAP |
| PROG-06 | MED summary | Existing measurement CRUD/deltas | Latest MED is a navigable summary, not a duplicate tab replacement | PENDING |
| PROG-07 | Marks summary | Current records and percentages | Recent marks navigate to detail; time metrics invert the record percentage | PENDING |
| PROG-08 | Share report | Backup export and visit prep are not equivalent | Show share only when a real 7/30/custom progress report exists | GAP |
| HIST-01 | History filters | 3m/6m/year/all/custom and four content types | All filters, details and `ir al actual` remain after restyling | PENDING |
| MED-01 | Measurements | Add, detail, edit, delete, chart and visit prep | Every operation remains reachable; MED and scale data stay distinct | PENDING |
| MARK-01 | Marks list | Add, list and open detail | `+ Marca` is the only list-level mutation; rows open full history | PENDING |
| MARK-02 | Mark detail | Calculator, history, edit and delete | Edit/delete belong to the selected record in detail, never the exercise overview | PENDING |
| CHAT-01 | Thread list | Existing list/open/delete behavior | Relative date, count and topic summary render from real metadata | GAP |
| CHAT-02 | Thread detail | Streaming, copy, offline and keyboard behavior | Open/send/receive/copy/delete survive; AI failure is visible and retryable | PENDING |
| CHAT-03 | Coach handoff | Coach can lead into Chat | The cached reading opens the corresponding context/thread without regenerating it | GAP |
| SETTINGS-01 | Preferences | Profile, theme, web search, session map and logout | Every current field/action remains present in the redesigned settings page | PENDING |
| SETTINGS-02 | Data tools | Health CSV import, backup and previews | Import/export/preview behavior and validation remain complete | PENDING |
| SETTINGS-03 | Sync confidence | Existing sync timestamps/data | `Última sincronización hace X` renders with real `✓/⚠` states | GAP |
| PWA-01 | Install/offline | Manifest, service worker and offline route | Install/update/offline behavior remains operational in both themes | PENDING |
| PWA-02 | Share target | Shared image/photo intake | OS share target still reaches the intended photo flow | PENDING |
| PWA-03 | Replay | Offline mutation queue | Queued actions replay once, surface failures and never duplicate writes | PENDING |

## Additive adapters

These are product work, not mock-only decoration:

| Gap | Required contract | Safety rule |
| --- | --- | --- |
| Coach cache | Store text, generated timestamp and freshness fingerprint in the existing exported `settings` store; refresh only on demand | No `/api/ai/coach` request on page load or when reading cached content |
| Bloating events | Timestamped marker model if multiple/timed events are required | Never display a fabricated time from the current day-level enum |
| Health baseline | Prior 30-day aggregate for HRV, resting HR, sleep and steps | Exclude nulls; preserve a raw sleep `0` but exclude `<=0` from the mean |
| Training week | Stable selected-week query and URL state | Empty selected week stays empty; never substitute the latest plan silently |
| Progress periods | Trailing 7/30-day response and stable URL state | Monthly interval is exactly 30 natural days inclusive |
| Macro kcal | Per-day kcal contributions from stored grams | Use `P×4`, `C×4`, `F×9`; show any kcal discrepancy separately |
| Progress report | Real 7/30/custom shareable artifact | Hide the control until implemented; backup JSON is not a progress report |
| Chat metadata | Relative date input, message count and topic summary | AI-generated titles are lower priority and must not block core chat behavior |
| Offline status | Reactive queue count and replay status | Never imply synced while queued or failed mutations exist |

Before any view-model extension, characterization tests must freeze the current
Health-versus-manual precedence used by Today, Trend and AI. Existing comments and
runtime behavior currently disagree, so the redesign must not choose a new rule
accidentally.

## Evidence record

Use one row per completed scenario. A browser row must include theme and viewport.

| Scenario ID | Automated evidence | Browser evidence | Data evidence | Auditor | Result |
| --- | --- | --- | --- | --- | --- |
| FOUNDATION-CONTRAST | `pnpm audit:contrast` | Pending | Token pairs light/dark | Integrator | PASS |
| FOUNDATION-TYPES | `pnpm typecheck` | Not applicable | Not applicable | Integrator | PASS |
| FOUNDATION-UNIT | `pnpm test`: 21 files, 196 tests | Not applicable | Existing fixtures | Integrator | PASS |
| FOUNDATION-BUILD | `pnpm build`: 42 routes generated | Pending | Neon branch only | Integrator | PASS |
| FOUNDATION-REACT | `react-doctor --diff`: 97/100, no changed-file issues | Not applicable | Not applicable | Integrator | PASS |
| FOUNDATION-MOBILE | Runtime checks at 390x844 and 320x568 | Light/dark Today and Settings; zero horizontal overflow | Inputs compute at 16px; theme meta follows selection | Integrator + foundation auditor | PASS |

## Release blockers

- Any visible control without a working handler.
- Any current CRUD action, filter, import path or offline path missing from V2.
- Any invented score, timestamp, data point or fallback value.
- Any automatic Coach generation on navigation or page load.
- Any write against production during development or verification.
- Any required gate without reproducible evidence.
