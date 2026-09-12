# PROGRESS

Gate 0 — complete. Gate 1 — **PASS** (decision recorded below). Gate 2 is next.

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
