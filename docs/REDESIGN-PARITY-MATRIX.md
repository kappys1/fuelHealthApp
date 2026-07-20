# Wellness V2 parity matrix

This is the live acceptance ledger for the redesign. `PENDING` means the current
behavior has not yet been independently reverified after restyling. `GAP` means
the approved concept needs a real additive adapter before it can ship.

Every completed row must link automated evidence, browser evidence, or both.

## Product surfaces

| ID | Surface | Current contract to preserve | V2 acceptance condition | State |
| --- | --- | --- | --- | --- |
| SHELL-01 | App layout | Authenticated shell and current routes | Wellness tokens/fonts in both themes without changing route contracts | PASS |
| SHELL-02 | Bottom nav | `/hoy`, `/plan`, `/progreso`, `/chat` | Base nav, no grey gradient, correct active state, safe area retained | PASS |
| SHELL-03 | Quick add | Existing Today add flow | Floating `+` is visible only on Today and opens the complete add sheet | PASS |
| SHELL-04 | Theme | Theme provider and settings control | Light is primary; light/dark/system remain selectable and persistent | PASS |
| SHELL-05 | Auxiliary routes | Login, offline and loading UI | All adopt V2 tokens without losing their functional states | PASS |
| TODAY-01 | Date header | `/hoy?date=`, previous/next navigation and streak | Tap date opens date picker, arrows work, future dates are blocked, flame follows `N días` | PASS |
| TODAY-02 | Coach entry | `CoachSheet`, `/api/ai/coach`, `/chat?thread=` | Cached greeting card is readable by tap; refresh icon is explicit; no AI call on page load | PASS |
| TODAY-03 | Coach states | Current transient request/error behavior | Empty, cached, stale, loading, offline and retry states use real timestamps/data | PASS |
| TODAY-04 | FuelGauge | Real targets, totals and `gaugeVerdict` | Kcal/P/C rings plus fat bar fit at 320 px; phase marks, partial-day remainder and phase copy are real | PASS |
| TODAY-05 | Water | Current water data/control | Water remains visible and usable in Today | PASS |
| TODAY-06 | Meal timeline | Current grouped entries and expansion | Meals sit directly below gauge; groups expand/collapse; no per-meal add buttons | PASS |
| TODAY-07 | Food edit | Entry detail/edit contract | Tapping an entry edits amount/product and can move it to another meal | PASS |
| TODAY-08 | Food delete | Current delete plus undo behavior | Delete is available in entry detail and existing undo behavior survives | PASS |
| TODAY-09 | Add destination | AddSheet meal selection | Product, plan, photo, describe, label and manual layers retain the selected meal | PASS |
| TODAY-10 | Product CRUD | Product search/register/edit APIs | Camera/barcode/manual registration and product editing remain complete | PASS |
| TODAY-11 | Add helpers | Copy yesterday, templates and planned food | Every current entry point remains reachable and writes the expected entry | PASS |
| TODAY-12 | Bloating | Current daily `bloat` check-in | One clear selector and a timeline marker with a real time; no duplicate explanatory row | PASS |
| TODAY-13 | Training | Current WOD/training card and errors | Training follows meals and preserves detail, loading and error/manual paths | PASS |
| TODAY-14 | Baseline | Health metrics currently stored | HRV, resting HR, sleep and steps show raw value plus delta vs prior 30-day mean | PASS |
| TODAY-15 | Watch context | Existing health/watch metrics and `energyBalance` | Context remains last, sync confidence is explicit, balance says `orientativo ±25%` | PASS |
| TODAY-16 | Offline queue | IndexedDB queue and replay | Reactive 0/pending/syncing/failure indicator is visible in Today | PASS |
| PLAN-01 | Plan switch | Diet/training segment | Toggle gains spacing and professional density without changing the modes | PASS |
| PLAN-02 | Diet targets | Versioned targets/options/variants | Compact target hierarchy and all current edit sheets remain functional | PASS |
| PLAN-03 | Diet import | Photo/PDF import | `Importar dieta (foto/PDF)` stays visually prominent and completes the current flow | PASS |
| PLAN-04 | Training weeks | Current/last applicable training plan | Previous/current week navigation resolves the selected week honestly by URL | PASS |
| PLAN-05 | Training CRUD | Import, edit, assign and delete week/session | All existing actions remain present; empty weeks do not fall back deceptively | PASS |
| PROG-01 | Progress sections | Trend, History and MED segments | Existing segments and filters remain available through URL-addressable state | PASS |
| PROG-02 | Summary period | Existing trend analytics | `Semanal` is trailing 7 days; `Mensual` is today minus 29 through today inclusive | PASS |
| PROG-03 | KPIs | Existing real calculations | Balance from weight, kg/week, real TDEE, adherence 14d and streak use existing formulas only | PASS |
| PROG-04 | Weight chart | Existing weight and MA7 series | Thin raw line plus thicker MA7, no large points, `<8` state is honest | PASS |
| PROG-05 | Intake chart | Existing daily kcal/macros | Each kcal bar segments protein `g×4`, carbs `g×4`, fat `g×9`; discrepancy is separate | PASS |
| PROG-06 | MED segment | Existing measurement CRUD/deltas | MED stays in its own segment; rows open detail instead of duplicating MED in Trend | PASS |
| PROG-07 | Marks summary | Current records and percentages | Recent marks live in History, navigate to detail and invert percentages for time | PASS |
| PROG-08 | Share report | Backup export and visit prep are not equivalent | Share stays hidden until a real 7/30/custom progress report exists | PASS |
| HIST-01 | History filters | 3m/6m/year/all/custom and four content types | All filters, details and `ir al actual` remain after restyling | PASS |
| MED-01 | Measurements | Add, detail, edit, delete, chart and visit prep | Every operation remains reachable; MED and scale data stay distinct | PASS |
| MARK-01 | Marks list | Add, list and open detail | `+ Marca` is the only list-level mutation; rows open full history | PASS |
| MARK-02 | Mark detail | Calculator, history, edit and delete | Edit/delete belong to the selected record in detail, never the exercise overview | PASS |
| CHAT-01 | Thread list | Existing list/open/delete behavior | Relative date, count and topic summary render from real metadata | PASS |
| CHAT-02 | Thread detail | Streaming, copy, offline and keyboard behavior | Open/send/receive/copy/delete survive; AI failure is visible and retryable | PASS |
| CHAT-03 | Coach handoff | Coach can lead into Chat | The cached reading opens the corresponding context/thread without regenerating it | PASS |
| SETTINGS-01 | Preferences | Profile, theme, web search, session map and logout | Every current field/action remains present in the redesigned settings page | PASS |
| SETTINGS-02 | Data tools | Health CSV import, backup and previews | Import/export/preview behavior and validation remain complete | PASS |
| SETTINGS-03 | Sync confidence | Existing sync timestamps/data | `Última sincronización hace X` renders with real `✓/⚠` states | PASS |
| PWA-01 | Install/offline | Manifest, service worker and offline route | Install/update/offline behavior remains operational in both themes | PASS |
| PWA-02 | Share target | Shared image/photo intake | OS share target still reaches the intended photo flow | PASS |
| PWA-03 | Replay | Offline mutation queue | Queued actions replay once, surface failures and never duplicate writes | PASS |

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
| FOUNDATION-UNIT | `pnpm test`: 28 files, 236 tests | Not applicable | Existing fixtures | Integrator | PASS |
| FOUNDATION-BUILD | `pnpm build`: 43 pages; Serwist bundles 55 precache entries | Login/offline checked at 320x568 in both themes | Isolated Neon branch only | Integrator | PASS |
| FOUNDATION-REACT | `react-doctor --scope changed`: no correctness warnings; ordered offline replay retained intentionally | Not applicable | Not applicable | Integrator | PASS |
| FOUNDATION-MOBILE | Runtime checks at 390x844 and 320x568 | Light/dark Today, Plan, Progress, Chat, Settings, Login and Offline; zero horizontal overflow/errors | Inputs compute at 16px; controls ≥44px; no visible text below 10px | Integrator + foundation auditor | PASS |
| PROGRESS-CALC | `progressSummary.test.ts`, existing deficit/adherence/MA7 tests | Not applicable | Inclusive 7/30 windows; exact macro energy; signed discrepancy; streak | Integrator + progress auditor | PASS |
| PROGRESS-DATA | Read-only query against isolated Neon branch | Trend, 7d and 30d values rendered from the same records | 13 logged days; 8 eligible weights; signed balance `-403`; no production writes | Integrator + progress auditor | PASS |
| PROGRESS-URL | Browser back/forward/reload on Trend, MED and History | `range`, `summary`, history range/type/from/to persist in URLs | No fallback or invented filter state | Integrator | PASS |
| PROGRESS-MOBILE | Playwright runtime checks at 390x844 and 320x760 | Light/dark Trend; History custom range; MED form/detail | Zero overflow/errors; visible inputs 16px; controls at least 44px | Integrator | PASS |
| PROGRESS-AA | `pnpm audit:contrast` | Light/dark inverted primary card inspected | Inverted text pairs: light 16.03/10.25; dark 12.24/8.01 | Integrator | PASS |
| PROGRESS-QUALITY | `pnpm test`: 28 files, 236 tests; `pnpm build`: 43 pages | `http://localhost:3012/progreso` in light/dark at 390px and 320px | Isolated Neon branch only | Integrator | PASS |
| CHAT-METADATA | `relative-time.test.ts`; typed aggregate query | Light/dark thread list at 390x844 and 320x700 | Real relative date, non-empty preview and message count | Integrator + chat auditor | PASS |
| CHAT-RECOVERY | Concurrent isolated-Neon turn claim: `claimed/pending`, then exact `complete` replay | Detail and load/send error states at 390x844 and 320x700 | Additive `turn_id`; one owner per turn; temporary test thread deleted | Integrator + chat auditor | PASS |
| CHAT-MOBILE | Runtime DOM scan | Light/dark list/detail/errors; zero horizontal overflow | Textarea 16px; all visible buttons at least 44px | Integrator | PASS |
| SETTINGS-FLOWS | `import-csv.spec.ts`; export and restore-preview requests | Profile disclosure, CSV preview and restore confirmation at 390x844 | No restore applied; isolated Neon branch only | Integrator + chat/settings auditor | PASS |
| SETTINGS-THEME | Browser selection plus reload | Claro/Oscuro/Sistema segmented control at 390x844 and 320x700 | `dark` and `system` persist through `next-themes` | Integrator | PASS |
| SETTINGS-MOBILE | Expanded profile and all controls scanned at 320x700 | Dark/light; zero horizontal overflow | Inputs/selects 16px and 44px; every visible button/link at least 44px | Integrator | PASS |
| OFFLINE-IDEMPOTENCY | Concurrent isolated-Neon insert with one UUID: results `0/2`, persisted indexes `0/1` | IndexedDB replay plus two simultaneous `online` events | One HTTP request, stable mutation id, queue drains to zero; probe rows deleted | Integrator + chat/settings auditor | PASS |
| TODAY-COACH | `coach-chat-handoff.spec.ts` | Cached yesterday reading reopens without a second AI request; 503 state retries in-place | Temporary handoff thread deleted | Integrator | PASS |
| TODAY-BLOAT-OFFLINE | `offline-bloat.spec.ts` | Create, edit-in-flight and delete-in-flight at iPhone viewport | POST→PATCH and compensating DELETE verified; temporary events deleted | Integrator | PASS |
| TODAY-ENTRY-FLOWS | `register-day.spec.ts`, `photo.spec.ts`, `checkin-morning.spec.ts` | Meal destination, photo analysis, historical shortcut and missing share recovery | All temporary entries/weight changes restored | Integrator | PASS |
| DATA-ROUNDTRIP | `pnpm verify:data-safety` | Not applicable | 18 tables / 604 rows restored exactly; truncated v2 rejected | Integrator | PASS |
| TRAINING-ATOMICITY | `pnpm verify:data-safety` | Existing duplicate historical weeks remain readable | Replay stable; new overlap rejected; delete clears denormalized day fields | Integrator | PASS |
| RELEASE-E2E | `playwright`: 11 mobile scenarios | iPhone 13 profile against `http://localhost:3012` | Writes limited to isolated Neon branch and cleaned/restored | Integrator | PASS |

## Release blockers

- Any visible control without a working handler.
- Any current CRUD action, filter, import path or offline path missing from V2.
- Any invented score, timestamp, data point or fallback value.
- Any automatic Coach generation on navigation or page load.
- Any write against production during development or verification.
- Any required gate without reproducible evidence.
