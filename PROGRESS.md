# PROGRESS

## Submission handoff — implementation only; user owns testing

User explicitly stopped QA and live rehearsals to prioritize submission. The visual-QA worker was stopped before it edited files or launched any tests. No additional live session was started. Older `gate-9/qa/play-1440x900.png` predates the hoop upgrade; it is not evidence of a current flat-green-ring regression.

Final recovery changes: staging errors preserve compiled source/label/checks and direction on Retry, fixing the ready-state dead end caused by dropping source metadata; listening offers Type instead through the existing abort/phase transition; cartridge recapture catches render failures, reports missing frames, and ignores results after leaving the originating result state. Result errors preserve the existing cartridge. Generic failure copy now says rings rather than arches.

`pnpm typecheck` and `git diff --check` pass after these edits. HTTP GET on `http://127.0.0.1:3000/` returned 200. The existing live-only Next dev server remains running; it was not restarted. No browser or functional tests were run for these final changes, at the user's request. Full live rehearsals, real microphone verification, and qualitative style/overlay alignment remain unverified and handed to the user. Architecture remains omitted. No submission prose, secrets, or user edits were overwritten.

## Flight upgrade — image-driven appearance and optional Adventure kit

User expanded scope to longer/faster flight, dimensional hoops, and a dash/grapple/combat prototype, then clarified that appearance must support arbitrary uploaded images. Interrupted workers were restarted on disjoint files; all three finishing workers completed.

- Image continuity: compiler instructions now lead with the actual source medium, palette, texture and surface treatment instead of generic environment nouns. The runtime camera contract no longer adds cinematic lighting. Generic continuity prose prescribes no ink, water, stone or fixed scenery. Fresh-image fallback now uses generic reference-based world prose and labels; only the known ink-fixture SHA selects its fixture-specific fallback.
- Hoops: cached 48×8 torus meshes with tube depth, perspective, shading, near-plane clipping, and small rim highlights replace flat green circles. Colors are sampled from each prepared image into shadow/midtone/highlight bands and also applied to Adventure targets/rope. Fully dark, bright and transparent inputs have readable bounded palettes. Gate passage now checks the actual opening plane with continuous intersection, so hoops do not vanish on entering an invisible sphere. Fixed a pitch projection sign error as part of this work.
- Pacing: base/boost speeds 32/48, default fixture distance 1500 with alternating x 75/-110/125/-40 and varied altitude, default timer 70 s. Candidate limits require 1250–1700 forward distance, at least 140 lateral span and two horizontal reversals. The model still authors placement and labels within those limits. After opening-plane correction, headless pilot wins in 35.82 s boosted or 51.93 s without boost, with no respawns. These are deterministic runtime measurements, not a new empirical calibration of video translation speed.
- Adventure kit: optional input checkbox enables Shift dash (0.35 s burst, 2.5 s cooldown), held E grapple to the active hoop's visible upper rim with steering assistance/release conditions, and F pulse target combat with range, aim, health, cooldowns and score. Targets derive from the supplied course, not demo coordinates. All motion uses the same fixed-step collision path. This is a bounded prototype, not arbitrary generated enemy AI or a separate grapple genre. LingBot remains appearance only. No nonempty camera-pose steering was introduced.
- Input safety: blur pauses the deterministic flight, cancels active abilities and releases world controls. Resume flight or a new flight input continues. Keyboard and pointer controls both reach the same ability actions.

Verification: lint/typecheck passed; 84 Node tests passed. `pnpm test:e2e --reporter=line` built the production app and passed 17 browser tests with 3 opt-in tests skipped, including the full longer original/patch/replay/download arc and pulse/grapple/dash integration. A focused image-colors rerun passed after adding a rendered-frame wait and a 320px no-overflow assertion. Inspected screenshots: `docs/evidence/flight-upgrade/grapple.png`, `image-colors.png`, and `image-colors-mobile.png`. Their fake badge is intentional: they came from the isolated automated server, not the live-only normal app. Offline Playwright now builds/starts production on 3100 rather than competing with the user's Next dev lock on 3000.

One live compiler probe (no new Reactor session) used the neon-canyon image SHA `cb1ade1074f0e803cc10b14900f3844c02b00bee154c50abc6b586daa00da896`: Kimi K3 returned `Neon Ring Run` in 6574 ms, 75 s duration, z 0/300/700/1100/1500, x span 240, three direction changes, pilot win 36.9 s, composed prompt 1568 characters. All six checks passed. The model described the source's steel/glass, colored lighting and depicted wet-asphalt reflections rather than an ink world.

Still unverified: reduced style drift over a long live LingBot stream with the user's actual image; qualitative video/3D-overlay alignment; live dash/grapple feel and full live rehearsals. The current changes do not claim image-perfect scene geometry, video occlusion, or model-owned combat.

## Reactor retry fix — verified without live service calls

The reported 429 was `quota_exceeded` / `sessions_per_minute`, not a GPU-capacity response. A mocked browser reproduction on the development server observed three `/sessions` POSTs from one page load and the incorrect pool-full label.

The provider's automatic connection and internal multi-attempt behavior are disabled (`autoConnect: false`, `maxAttempts: 1`). The adapter still prewarms on mount, but one cancellable lifecycle owns initial connect, scheduled retry, manual reconnect, and disconnect. Initial scheduling survives React development effect replay without starting duplicate requests. At most one connection attempt and one retry timer are active. Typed error parsing distinguishes rate limits, unavailable capacity, authentication, and network errors; retry delays use the greater of the server hint and 8/16/32/60/60-second backoff, then stop. Retry hints above the timer range cannot turn into immediate timer loops. Authentication and unknown failures stop automatically; the UI exposes Retry connection and a cooldown countdown. Disconnect cancels pending retries and suppresses follow-up attempts from in-flight responses. Terminal connection errors now stop staging with an honest message rather than always claiming the pool is full.

Fresh verification: `pnpm check` exited 0 (lint, typecheck, 42 Node tests, production build). `REAL_REACTOR=1 pnpm exec playwright test e2e/reactor-retry.spec.ts e2e/operator.spec.ts --grep 'one startup|capacity is distinct|disconnect during|manual reconnect|live mode without a key' --reporter=line` passed 5 tests in 8.9 s. Despite the server-reuse flag name, these five tests mock token/session responses and block other external requests; no real session was created. Browser coverage proves one startup request, cooldown/backoff enforcement, no automatic auth retries, disconnect during waiting/in-flight start, and no manual bypass or duplicate retry.

Live quota and capacity availability remain external constraints; this fix does not claim that a live connection or full live rehearsal succeeded.

## Current change — live-only user flow

The user requested removal of fake-world output from the app. This supersedes the older operator level-4 selection requirement below. Normal dev/production pages always select live Reactor, including old `?world=fake` URLs; `NEXT_PUBLIC_WORLD` no longer selects the renderer. Fake rendering is restricted to the automated server's explicit `GOLEM_TEST_WORLD=fake` setting, and retains its warning label there. Operator/error surfaces no longer offer a fake-world switch. Offline Playwright runs on port 3100; normal dev and opt-in live rehearsals use port 3000.

Verification: `pnpm lint && pnpm typecheck` exited 0; `pnpm exec playwright test e2e/operator.spec.ts --reporter=line` passed 2 tests in 6.0 s. A browser check against normal port 3000 with `?operator=1&world=fake&compiler=off` confirmed mode `live`, no fake badge, and no fake switching controls. Token requests were mocked; this check allocated no live sessions. The live-only dev server was restarted on port 3000 with test-mode environment variables cleared.

The Reactor retry issue reported during this change is fixed in the entry above. Full live rehearsals and the remaining visual review are still outstanding. No architecture artifact is required after the user's scope change.

Gate 0 — complete. Gate 1 — **PASS**. Gates 2–4 — **complete** (live compiler qualified). Gate 5 is next.

# Gates 2–4 — trusted GameSpec, semantic validation, live compiler

## Works

- `src/game/spec.ts`: strict Zod contract. Model-facing `GameSpecCandidateSchema` omits `referenceImageId`/`world.seed`; the validator injects both from the prepared image. `SPEC_LIMITS` holds every budget and the Gate 1 course envelope (lane ±60 x, 0–60 y, 0–500 z; spacing 60–130; Δx ≤ 40, Δy ≤ 20 per segment; radii cp 8–16 / goal 10–20 / start 2–6; duration 20–45; multipliers 0.5–2). Branded `ValidatedGameSpec` / `ValidatedGameSpecPatch`. `z.toJSONSchema` produces the strict compiler schema from the same definition.
- `src/game/validate.ts`: schema → references → bounds → route order/envelope → deterministic pilot (`simulateCourse`) → prompt budget; ≤16 issues, 160-code-point messages; `applyGlideTurnPatch` is transactional and enforces runtime + Reactor `≤30°` bounds.
- `src/game/fallback.ts`: ink-islands game as a model-shaped candidate; `fallbackSpec()` always validates.
- `src/compiler/request.ts`: app-owned system prompts (Glide-only capabilities, live bounds, budgets, injection resistance), `buildGameRequest` (image data URL + bounded direction + one bounded repair turn), `buildPatchRequest`, `callCompiler` (native fetch, 30 s / 12 s aborts, parses only `message.content`, never reasoning content, never leaks bodies or keys).
- `src/compiler/client.ts`: first call → validate → ONE repair → known fallback; 503 skips to fallback; abort-safe.
- `src/app/api/compile/route.ts` (multipart, Sharp revalidates 1664×960 WebP) and `src/app/api/patch/route.ts` (re-parses the full trusted spec, clamps transcript to 240 code points; does not apply the patch).
- Experience: four truthful staging rows (Reading the seed / Writing the rules / Testing the game / Warming the world) with repair/fallback states; ready surface shows title, tagline, WORLD/GAME/RULE/GOAL and a source pill (live / repaired / prepared); `?compiler=off` for offline runs; `fallbackLevel` 1/3/4 in debug.
- Live adapter: 429 "no available capacity" now triggers slow reconnect attempts (every 8 s, up to 20) instead of giving up after the SDK's three fast retries; `WorldDriver.reconnect()` added.

## Compiler qualification (`docs/evidence/gate-4/`)

- Endpoint: Modal Shared Endpoint for `moonshotai/Kimi-K3` via `https://inference.us-west.modal.direct/v1` (model id = endpoint hostname). `/v1/models` reports `input_modalities: [text, image]`, `supported_features: [structured_outputs, json_mode, reasoning, tools]`, reasoning effort `low|high|max`. Proxy token created with `modal workspace proxy-tokens create`; values written to `.env.local` only.
- `node --env-file=.env.local scripts/probe-compiler.ts <3 fixtures>`: game **8549 / 5114 / 6253 ms** (median 6253, max 8549 ≤ 30 s) — all three schema-valid AND fully validated first try (no repair needed). Patch probes **1843 / 1818 / 1309 ms** (median 1818 ≤ 8 s): "Double the turn rate" → 2, "make it turn way slower and smoother" → 0.5, "twice as sharp turns please" → 2.
- Three materially different seeds (all 1664×960 WebP, Runware `openai:gpt-image@2.5-sunburst`, prompts in `scripts/generate-design-assets.mjs`): `glide-ink-islands` (monochrome ink), `glide-neon-canyon` (rain-slick neon street: "Neon Ring Run", magenta/cyan/gold rings), `glide-red-canyon` (sandstone slot canyon: "Arches of the Ember Canyon"). Candidates saved as `*.candidate.json`; none hand-edited.
- Live browser flow (`REAL_REACTOR=1`): Make playable → Kimi K3 compiled "Ink Sea of Stone Moons" (source live, 6/6 checks, fallbackLevel 1) → pool was full (5 × 429) → auto-retry obtained a session → first frame at 50 s → turn commands confirmed in `active_action`. Evidence in `docs/evidence/gate-1/live-timeline.json`.

## Verification

- `node --test` → 20/20 pass (glide 6, spec 6, compiler-client 5, reactor-contract 2, smoke 1).
- `pnpm lint`, `pnpm typecheck`, `pnpm build` → clean; routes `/`, `/api/compile`, `/api/patch`, `/api/reactor/token`.
- `pnpm test:e2e` → 2 passed, 1 skipped (fake flow uses `?world=fake&compiler=off`, asserts `spec.source === "fallback"` and the fixture SHA-256 as `referenceImageId`; no paid calls in tests).

## Notes / deviations

- Within the calibrated envelope the pilot always wins (verified with the hardest in-envelope course at 20 s: the extreme route test). The `unreachable` code therefore fires only if a future envelope/calibration change breaks that relationship — which is exactly what it guards.
- Modules imported by `node --test` use explicit `.ts` specifiers.
- A React "maximum update depth" loop (staging effect re-running on each step dispatch) was found by the e2e and fixed with a run-id guard.

# Gate 1 — deterministic Glide + live LingBot coupling

## Works

- `src/game/glide.ts`: fixed-step (1/60) functional Glide core — `createGlideState`, `stepGlide`, `pilotInput`, `simulateCourse`, `segmentHitsSphere`, `projectPoint`, one `GLIDE_CALIBRATION`, frozen `FIXTURE_COURSE` (start, 3 checkpoints, goal; 30 s).
- `src/world/world.ts`: smallest shared `WorldDriver` seam (status store, `controlsFromInput`, `reactorTurnDeg`, `waitForStatus`).
- `src/world/fake.tsx`: deterministic canvas fake world (fallback level 4, always labelled "FAKE WORLD — not live generation").
- `src/world/lingbot.tsx`: live adapter — module-scoped coalesced JWT resolver, stable auto-connect provider, event-driven status (never optimistic), own `<video>` with first-frame timing, diffed persistent control commands, release → all idle + empty camera pose, frame capture.
- `src/world/prompts.ts`: app-owned camera contract + fixture world prose, budget-checked composer.
- `src/app/api/reactor/token/route.ts`: scoped token broker (`reactor/lingbot-world-2`, `expires_after 3600`, `max_sessions 3`, `max_session_duration_seconds 3600`, `private, no-store`, upstream body never forwarded).
- `src/experience/*`: phase reducer (input → staging → ready → playing → finished / error), RAF fixed-step loop, projected ring overlay, DOM HUD, keyboard + ≥44px pointer controls, release on blur/hidden/exit/unmount.
- `src/testing/debug.ts`: read-only `window.__ANYTHING_PLAY__.snapshot()` in fake or `?operator=1` mode.
- `?world=fake` / `NEXT_PUBLIC_WORLD=fake` selects the fake world; Playwright's web server runs in fake mode.

## Verification (fresh, this session)

- `node --test tests/glide.test.ts` → 6/6 pass (determinism over 1,800 inputs, segment–sphere fast pass, out-of-order gate rejected, pilot wins in order, respawn at last checkpoint, timeout fails).
- `node --test` → 9/9 pass. `pnpm check` → exit 0 (lint, typecheck, tests, `next build`: `/` and `/api/reactor/token` dynamic).
- `pnpm test:e2e` → 2 passed, 1 skipped (`real-reactor` is opt-in). Fake flow wins by real keyboard input with completed `["cp1","cp2","cp3","goal"]`, fallbackLevel 4, zero console/page errors. Screenshot `docs/evidence/gate-1/fake-play.png`.
- `REAL_REACTOR=1 pnpm playwright test e2e/real-reactor.spec.ts` → 2 successful live sessions (plus 2 attempts refused upstream with HTTP 429 "no available capacity").

## Evidence (`docs/evidence/gate-1/`)

- Seed: `public/fixtures/glide-ink-islands.webp`, SHA-256 `73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42` (unchanged; composition was not the blocker).
- `live-smoke-play.json` — first successful live run snapshot: `connection: ready`, `hasImage/hasPrompt/generating: true`, 13 chunks in ≈7 s.
- `live-timeline.json` + `live-00-straight.png` … `live-05-settled.png` + `live-play-0.webm` — second live run: held ArrowRight 2 s, released, held ArrowLeft 2 s.
- `live-smoke-staging-failed.json`, `live-staging-failed.png` — the upstream 429 capacity refusal (recorded, not hidden).

## Observed latency / model behavior

- Make playable → first video frame: **9.8 s** and **11.2 s** (upload, image/prompt accepted, `start`, first `requestVideoFrameCallback`).
- Chunk cadence: 24 pixel frames per chunk, ≈0.55 s per chunk (13 chunks / 7 s; 21 chunks / 8.8 s).
- Input → deterministic overlay: **8 ms** (single sample; one RAF).
- Command → next `chunk_complete`: **1.0–2.0 s** (1882, 1003, 2020, 1018, 1843 ms). Chunk `active_action` confirmed each mapped command: `w` → `w+right` → `w` → `w+left` → `w`.
- Visual response: a 2 s held right turn at `rotation_speed_deg 6` swung the world ≈90° (arches from centre to left edge, cliff/bridge came around) → ≈45°/s. The runtime yaw at the previous 1.1 rad/s turned 143° in the same window, so **`GLIDE_CALIBRATION.yawRate` was set to 0.78 rad/s** to match; pilot and all tests still pass.
- Discrete `set_look_*` is sufficient: `set_camera_pose` branch NOT taken (only the empty-payload release is sent).
- Stream stays in the seed's monochrome ink-wash identity while evolving (arches, moon, cliffs recur).

## Decision: PASS — proceed to Gate 2

Live model responds to the mapped controls in the right direction within one to two chunks; the deterministic course wins with immediate overlay; seed identity persists in the stream; the recorded run reads as one steerable first-person world with route rings. Recorded calibration: `BASE_REACTOR_TURN_DEG 6` (patched ×2 = 12 ≤ 30), `yawRate 0.78`, `pitchRate 0.8`, `baseSpeed 24`, `boostSpeed 40`, ring radii 10/10/10/13, spacing 90–100 units, course duration 30 s.

Known limitations carried forward:
- Reactor's shared pool intermittently returns **429 "no available capacity"** (2 of 4 attempts). Gate 9 must add a connect-retry action on the input surface and the operator ladder must reach level 4 (fake world) when capacity is gone.
- The world lags the runtime by 1–2 s; the overlay is the collision truth, the stream is appearance only. Ring positions never correspond to specific generated arches.
- A Next dev-overlay "1 Issue" badge appeared during the live run; the live spec now captures console output so it can be identified on the next successful live session.

## Deviations

- `src/world/world.ts` is `.ts` (plan said `.tsx`) so `node --test` can import its pure helpers.
- Fixed a real bug found in review: Reactor returns `expires_at` in epoch **seconds**; the resolver treated it as ms, so every SDK request re-minted a token and later session calls 403'd ("session-scoped … sessions.bind"). Now multiplied by 1000.
- `WorldStatus` gained `framesPerChunk` and `lastChunkAction` (needed for calibration evidence).
- Credentials never printed; `.env.local` untouched and untracked.

# Gate 0 — repository shell

## Works

- Minimal Next.js 16.3.4 app shell: TypeScript strict, App Router, `src/`, no Tailwind, no template assets.
- Exact pinned dependency set installed (14 direct packages, no extras).
- `node --test` smoke test on native type-stripped TypeScript.
- Playwright Chromium E2E smoke with deterministic `webServer` (`pnpm dev --hostname 127.0.0.1`, `reuseExistingServer: false`).
- Execution contract (`AGENTS.md`), source docs, plan archive, `.env.example`, README.
- Git initialized on branch `feat/anything-play`; `.env.local` confirmed ignored (`.gitignore` `.env*`), `.env.example` included via `!.env.example`.

## Verification

- `pnpm install` → exit 0; all pins resolved exactly.
- `pnpm exec playwright install chromium` → exit 0 (Chrome Headless Shell 153.0.8010.12).
- `pnpm check` → exit 0: `eslint .` clean; `tsc --noEmit` clean; `node --test` 1 pass / 0 fail; `next build` succeeded, routes `/` and `/_not-found` static.
- `pnpm test:e2e` → exit 0: 1 passed (chromium); h1 `ANYTHING//PLAY` visible, viewport asserted 1440x900, zero console/page errors.
- Post-review fix check: `pnpm exec eslint playwright.config.ts e2e/smoke.spec.ts && pnpm typecheck && pnpm test:e2e` → exit 0, 1 passed (2.2s).
- `pnpm list --depth 0` → exactly the pinned table: next 16.3.4, react/react-dom 19.2.8, @reactor-models/lingbot-world-2 1.0.1, @reactor-team/js-sdk 3.0.1, zod 4.5.4, sharp 0.35.4; dev: typescript 5.9.3, @playwright/test 1.63.0, @types/node 26.4.1, @types/react 19.2.18, @types/react-dom 19.2.7, eslint 9.39.5, eslint-config-next 16.3.4.
- `git status --short` → all new files untracked; `.env.local` absent from listing.
- `find docs -type f` → exactly 4 files: `anything-play-concept-report.md`, `anything-play-handoff.md`, `anything-play.architecture.draft.json`, `plans/2026-09-12-anything-play-implementation.md`.
- Registry publish dates verified for every pin; all ≥7 days old as of 2026-09-12.

## Evidence

- Command outputs recorded in this file; reproducible via `pnpm check`, `pnpm test:e2e`, `pnpm list --depth 0`, `git status --short`.
- Scaffold provenance: isolated `create-next-app@16.3.4 --empty` run in `/tmp/anythingplay-scaffold`, files transferred into repo; `PLAN.md` and `.env.local` never moved or overwritten.

## Observed latency/model behavior

None. No model, Reactor, Runware, or paid-service calls were made. Real-world generation is not yet proven.

## Next

Gate 1 passed (see top). Next: Gate 2 trusted GameSpec schemas, Gate 3 semantic validation/fallback, Gate 4 Modal compiler qualification.

## Deviations

- Plan text says to archive the plan from `~/.devin/plans/plan-e4b585c3b62e1d75.md`; copied the current root `PLAN.md` instead (lead: current user source wins).
- Scaffold ran in `/tmp/anythingplay-scaffold` because `PLAN.md`/`.env.local` already occupied the repo root; only new scaffold files were transferred.
- `src/app/layout.tsx` uses `{ children: ReactNode }` instead of the scaffold's `LayoutProps<"/">`: the generated `LayoutProps` global only exists after `next typegen`/`next dev`, so `tsc --noEmit` failed on a clean tree (scripts are fixed by spec, so typecheck must pass pre-build).
- `lint` script is `eslint .` per spec (scaffold emitted `eslint`).
- `.env.example` includes `RUNWARE_API_KEY` per current brief (not in the older plan's env list).
- No commits made; git history owned by lead.
