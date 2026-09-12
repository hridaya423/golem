---
agent: devin-local
session: befitting-aspen
created: 2026-09-12T12:06:34Z
---
# ANYTHING//PLAY Hackathon Prototype Megaplan

Build a local-first, validated image-to-Glide game compiler whose deterministic runtime steers a live LingBot World 2 stream, accepts a spoken turn-rate patch, and ends on a downloadable Game Cartridge.

## Summary

Build the complete ANYTHING//PLAY hackathon path in the empty repository at `/Users/hridyaagrawal/anythingplay`: a prepared image or camera frame is normalized, compiled by a verified multimodal structured-output model into a bounded three-gate Glide `GameSpec`, semantically validated and headlessly completed, rendered as a live LingBot World 2 world while deterministic code owns gameplay, patched from speech without replacing the world, replayed, and closed with a locally rendered/downloadable Game Cartridge.

The committed scope is Gates 0–7 and 9. Glide is the only required mechanic if Gate 1 passes. Dash exists only as the named Gate 1 contingency. Grapple remains a post-core stretch and cannot consume core build time. The architecture is deliberately direct: a client-side functional game core, a concrete Reactor adapter, three small server-only routes (token, game compile, patch compile), and one real seam for the deterministic fake world used by tests.

> **For the implementing agent:** invoke `receive-handoff`, `executing-plans`, `test-driven-development`, `architect`, `ponytail`, `design-engineering`, `browser-ui-qa`, and `verification-before-completion` when their phases begin. Execute in gate order. Work in batches of roughly three tasks and report verification output between batches. Never continue past a failed Gate 1.

For every planned commit, stage only that task’s verified files and use:

```bash
git commit -m "$(cat <<'EOF'
<task commit message from this plan>

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

If a hook changes files, inspect the diff, rerun the affected check, stage the hook changes, and retry. Never bypass hooks or push unless explicitly asked.

## Objective and acceptance contract

The build is accepted only when all of the following are true together:

1. `/Users/hridyaagrawal/anythingplay` is an initialized standalone repository; no Glass source is changed.
2. The local production build runs in Chrome on macOS with one command and with all long-lived credentials confined to server-side environment variables.
3. Opening the app auto-connects and prewarms one session-scoped `reactor/lingbot-world-2` session before the user starts compilation.
4. Upload and camera-frame inputs share one image path. The stage path uses a prepared uploaded fixture. Text-only seed generation is absent.
5. A preferred Kimi K3 Modal Shared Endpoint—or another empirically verified OpenAI-compatible multimodal strict-schema endpoint—authors bounded gate positions and a Glide spec. User-facing copy stays model-neutral; the operator panel names the actual model.
6. Raw model output is parsed as untrusted data. Exactly one semantic repair attempt is permitted; then a known valid Glide fallback is selected.
7. A fixed-step deterministic runtime owns player pose, checkpoint order, timer, path, failure, and win. The same scripted input produces the same final state.
8. The live LingBot stream fills the game view. Runtime overlays provide exact gates, objective, checkpoint count, boost feedback, and debug proof. Reactor commands visibly follow the same controls.
9. After the original run wins, the judge speaks a rule request. Chrome speech recognition auto-submits its final transcript. A strict patch may only multiply Glide turn rate by a bounded factor; the rehearsed request doubles it.
10. The patch preserves the seed, world prompt, mechanic kind, and Reactor session. It updates deterministic turn behavior and LingBot `set_rotation_speed_deg`, then automatically starts a patched replay.
11. The patched replay completes and feeds a 1600×1000 local Game Cartridge containing the original seed, a generated world frame, title, mechanic, patched time/path, and the accepted turn-rate rule. The cartridge is shown and downloadable as PNG; no final model call or persistence exists.
12. `?operator=1` reveals model/session state, metrics, fixtures, debug proxy, reset, and fallback selection. None of those controls appear in the ordinary product surface, and no secret is exposed through either surface.
13. Offline deterministic checks, fake-world browser tests, a real-Reactor smoke run, three compiler fixtures, and three timed full rehearsals all have fresh recorded evidence in `PROGRESS.md`.
14. Every rehearsed complete run fits inside three minutes. Course duration and camera mapping are empirical Gate 1 calibration outputs, not guessed requirements.

## Explicit non-goals

- No arbitrary genres, raw generated JavaScript, combat, inventory, NPCs, multiplayer, accounts, database, gallery, cartridge history, public sharing, native app, video-to-game conversion, or text-to-image seed path.
- No state-management library, component library, animation library, physics engine, Three.js, queue, worker service, analytics, production billing UI, or second live renderer unless a measured gate proves the native approach insufficient.
- No Dash implementation when Glide passes. No Grapple implementation before every committed gate passes.
- No public deployment requirement. Optimize for a reliable local Chrome/macOS demo.
- No claim that LingBot provides collision geometry, a map, semantic entities, exact physics, rewind, or spatial truth.
- No use of discarded-concept reports in design or implementation.

## Ground truth and corrections to the handoff

- `/Users/hridyaagrawal/anythingplay` exists but is empty and is not a Git repository. Gate 0 must initialize everything.
- Source authority is limited to:
  - `/Users/hridyaagrawal/glass-annotate/docs/anything-play-handoff.md`
  - `/Users/hridyaagrawal/glass-annotate/docs/anything-play-concept-report.md`
  - `/Users/hridyaagrawal/glass-annotate/docs/anything-play.architecture.json`, copied only as an explicitly named draft.
- The architecture JSON is not validated and must not be represented as delivered architecture. Rebuild an evidence-backed diagram only after Gate 9.
- LingBot World 2 exposes only outbound `main_video`. Prompt/image/seed/movement/look/camera control are commands; it exposes no collider, navmesh, map, or semantic entity state.
- Reactor connection state is `disconnected → connecting → waiting → ready`; model state is separate. Commands are asynchronous and model events/acknowledgements—not the fact that a command was sent—are the state source of truth.
- Longitudinal/lateral/look inputs persist until explicitly returned to idle. Every key press therefore needs release, blur, visibility-change, win, error, and unmount cleanup.
- `set_camera_pose` is `[rx, ry, rz, tx, ty, tz]` per latent frame, not an absolute pose. Translation magnitude is max-norm normalized per chunk; rotation is not. Current chunks contain three latent frames. This makes camera-pose translation a poor direct representation of “double boost.”
- `set_rotation_speed_deg` is a real `0–30` scalar and therefore makes “double turn rate” the reliable stage patch: one bounded value reaches both runtime and generated camera behavior.
- The official Reactor example is Next.js and contains a correct token resolver, event-driven state, layered prompt composition, and chunk-paced camera patterns. Reuse those patterns, not its 3,000-line demo controller or UI dependency stack.
- The supplied Modal URL is a dashboard creation page, not an inference URL. Kimi K3 is natively multimodal and supports strict JSON schema, but a Shared Endpoint hostname and proxy token must be created and capability-tested before Gate 4.
- No relevant credentials are currently loaded in the shell. Secret setup is a prerequisite, not evidence that access works.

## Architecture decision

### Candidate A — selected: client game core + thin server credential/model shell

- Next.js hosts one client experience and three server-only routes.
- Browser owns media input, Reactor WebRTC, fixed-step gameplay, overlay drawing, semantic validation, replay, and cartridge rendering.
- Server routes mint a scoped Reactor token and make OpenAI-compatible compiler calls with server-only credentials.
- Shared pure TypeScript modules own `GameSpec`, validation, fallback, simulation, and patch application.
- A small `WorldDriver` seam has exactly two concrete adapters: live LingBot and the deterministic fake required by browser tests.

Why this wins: WebRTC and input already live in the browser; exact gameplay remains synchronous and inspectable; server code exists only where secrets require it; the fake adapter is a real second implementation rather than speculative architecture; the happy path reads linearly.

### Candidate B — rejected: server orchestration + SSE progress + browser player

A server endpoint would normalize the image, call the compiler, run repair/validation, stream phase events, and return a trusted session payload. This makes progress reporting easier but adds multipart retention, streaming protocol state, cancellation, duplicate validation ownership, and more recovery transitions. It does not improve gameplay or LingBot coupling. Reject until a measured browser limitation requires it.

### Candidate C — rejected: generated code / general physics or renderer framework

Model-generated JavaScript, a general cartridge plugin system, Rapier/Three.js, or multiple renderer adapters would enlarge the critical path without solving the observed world/proxy alignment problem. The declarative Glide spec and native math are sufficient.

## System shape

```text
Browser seed input
  -> decode, orient, center-crop, resize to 1664×960 WebP
  -> SHA-256 seed id; retain original Blob separately
  -> in parallel:
       A. upload normalized Blob to prewarmed LingBot session
       B. POST normalized Blob + direction to server compiler route
  -> parse unknown model candidate
  -> schema + cross-reference + bounds + route + pilot validation
  -> at most one repair call with prior candidate + structured issues
  -> known valid fallback if still invalid
  -> compose bounded LingBot prompt from model-authored world identity
     plus runtime-owned camera/movement contract
  -> start live world; wait for accepted state and first frame
  -> start deterministic fixed-step Glide loop
  -> draw exact gates/HUD over main_video
  -> win original run
  -> native speech recognition final transcript
  -> POST transcript + current spec to patch route
  -> parse/validate bounded turn-rate patch
  -> apply only at post-win safe boundary
  -> update runtime multiplier + Reactor rotation speed
  -> reset deterministic run while retaining live Reactor session/world identity
  -> win patched replay
  -> capture live world frame + compose/download Game Cartridge
```

### Ownership table

| State | Owner | Invariant |
|---|---|---|
| Original seed Blob and preview URL | `AnythingPlay` session | Never replaced by normalized/generated media; object URL is revoked on replacement/unmount |
| Normalized seed Blob/id | `src/seed/image.ts` | Decodable WebP, exactly 1664×960, bounded byte size, SHA-256 id |
| Compiler credentials/provider config | server environment | Never serialized to client or debug state |
| Raw model response | compiler route/client compile operation | Always `unknown`; never reaches runtime directly |
| Trusted spec/patch | `src/game/spec.ts` | Constructed only by successful parse + semantic validation |
| Player/checkpoint/timer/path | `src/game/glide.ts` | Deterministic fixed-step state; independent of display/video frame cadence |
| Reactor session/model/track | live world adapter | Events are authoritative; all persistent control channels are explicitly released |
| Generated appearance | LingBot | Observation only; never read as collision truth |
| Immediate gates/HUD | play canvas | Derived only from deterministic state |
| Experience phase | reducer in `src/experience/state.ts` | Discriminated union prevents phases without required data |
| Metrics/debug snapshot | `src/testing/debug.ts` | Read-only, no credentials/raw image bytes, operator-gated UI |
| Game Cartridge | `src/game/cartridge.ts` | Derived locally from patched completion state; no network call |

## Core contracts

These are implementation targets, not suggestions to create extra layers.

```ts
type PreparedImage = {
  id: string
  mimeType: "image/webp"
  width: 1664
  height: 960
  normalized: Blob
  original: Blob
  originalName: string
  previewUrl: string
}

type Vec3 = readonly [x: number, y: number, z: number]

type ProxyEntity = {
  id: string
  kind: "start" | "checkpoint" | "goal"
  position: Vec3
  radius: number
  label: string
}

type WorldSpec = {
  basePrompt: string
  landmarks: readonly {
    id: string
    description: string
  }[]
  perspective: "first_person"
  seed: number
}

type GlideSpec = {
  kind: "glide"
  lift: number       // multiplier over Gate 1 calibration
  drag: number       // multiplier over Gate 1 calibration
  turnRate: number   // multiplier over Gate 1 calibration
  boost: number      // multiplier over Gate 1 calibration
}

type GameRules = {
  durationSeconds: number
  requiredCheckpointIds: readonly [string, string, string]
  goalEntityId: string
  respawnBehindDistance: number
}

type GameSpec = {
  version: 1
  title: string
  tagline: string
  referenceImageId: string
  world: WorldSpec
  mechanic: GlideSpec
  entities: readonly ProxyEntity[]
  rules: GameRules
  cartridgeLine: string
}

// The model cannot invent technical identity or RNG state. Its explicit Zod
// schema has the same fields as GameSpec except referenceImageId and world.seed;
// validateGameSpecCandidate injects both from the PreparedImage boundary.
type GameSpecCandidate = Omit<GameSpec, "referenceImageId" | "world"> & {
  world: Omit<WorldSpec, "seed">
}

type ValidationIssue = {
  path: string
  code:
    | "schema"
    | "duplicate_id"
    | "missing_reference"
    | "out_of_bounds"
    | "route_order"
    | "unreachable"
  message: string
}

type ValidationResult =
  | { ok: true; spec: ValidatedGameSpec; checks: ValidationCheck[] }
  | { ok: false; issues: readonly ValidationIssue[]; checks: ValidationCheck[] }

type GlideTurnPatch = {
  version: 1
  mechanic: "glide"
  operation: "multiply_turn_rate"
  factor: 0.5 | 2
  cartridgeLine: string
}
```

`ValidatedGameSpec` and `ValidatedGameSpecPatch` are opaque branded types exported only by validation functions. All runtime entry points accept the branded form. No `Partial<MechanicSpec>`, `any`, generic callback bag, or unrestricted rule list crosses the model boundary.

### GameSpec invariants

- Strict object schemas (`additionalProperties: false`) at every nested level.
- The model-facing `GameSpecCandidate` schema omits `referenceImageId` and `world.seed`; the validator injects the prepared image id and a stable non-negative seed derived from it.
- Version exactly `1`; exactly five proxy entities: one start, three checkpoints, and one goal. No hazards, anchors, or speculative entity kinds enter committed scope.
- Every id unique; every rule reference exists and has the expected entity kind.
- Every number finite. Entity count, string length, image size, prompt length, course envelope, and duration are capped.
- Perspective is first-person and mechanic is Glide in committed scope.
- Checkpoint route is monotonic in forward `z`, segments stay inside calibrated horizontal/vertical/spacing envelopes, and goal follows checkpoint 3.
- Start is not inside a failure state; checkpoint/goal radii meet calibrated forgiveness minima.
- Worst-case composed LingBot prompt stays below 2,000 characters; model-authored base stays at or below 600 and uses two to four concrete landmarks.
- A deterministic pilot completes the exact runtime within the rule duration. Validation fails closed if it cannot.
- Numeric mechanic bounds come from Gate 1. Initial fixture values are calibration inputs, not permanent truth. Final constants and the accepted envelope must be recorded in `PROGRESS.md` before Gate 2 closes.
- Patch schema can alter only turn-rate factor and cartridge line. Applying it must stay inside both runtime bounds and Reactor’s `0–30` rotation-speed range.
- A patch cannot alter reference image id, world, entities, rules, mechanic kind, or Reactor session.

### Fixed trust-boundary budgets

These limits are implementation constants; only empirical mechanic/course bounds wait for Gate 1:

| Input | Limit |
|---|---:|
| source upload | 10 MiB; PNG/JPEG/WebP only |
| normalized compiler/Reactor image | 4 MiB, WebP, exactly 1664×960 |
| optional direction | 240 Unicode code points |
| title / tagline / entity label | 64 / 120 / 48 code points |
| world base prompt / landmark description | 600 / 120 code points |
| landmarks | 2–4 |
| proxy entities | exactly 5 |
| serialized prior candidate in repair request | 32 KiB |
| validation issues sent for repair | at most 16 issues, 160 code points per message |
| final composed LingBot prompt | <2,000 characters |
| course duration | calibrated within 20–45 seconds for the three-minute demo |

## Deterministic Glide model

Use native vector math; do not add Three.js or a physics engine.

- Fixed simulation step: `1 / 60` second.
- RAF shell: accumulate elapsed display time, clamp a single frame gap, process bounded fixed steps, and draw once. Simulation never consumes raw variable frame deltas.
- Canonical player state: position, yaw, pitch, speed, elapsed time, active checkpoint index, completed checkpoint ids, respawn position, path samples, run status.
- Each step:
  1. Clamp normalized input axes.
  2. Apply calibrated yaw/pitch rates multiplied by `turnRate`/`lift`.
  3. Clamp pitch to the calibrated safe range.
  4. Move speed toward base or boosted target using an exponential drag response.
  5. Integrate forward direction from yaw/pitch.
  6. Detect gate crossing with segment–sphere intersection so a fast frame cannot tunnel through a ring.
  7. Advance only the next required checkpoint; goal wins only after all three.
  8. Respawn at the last passed checkpoint if the active ring is sufficiently behind or the route envelope is left.
  9. Fail on time expiry; sample path at a fixed interval, not every display frame.
- The headless pilot computes yaw/pitch error toward the active gate and produces the same normalized input type used by a player. It must exercise the actual `stepGlide` boundary, not duplicate physics.
- Initial Gate 1 fixture may start with neutral multipliers (`1`) and forgiving normalized coordinates. Tune base speed, yaw rate, pitch rate, drag, radii, spacing, and course duration against the real stream. Preserve calibration knobs in one `GLIDE_CALIBRATION` constant because model/hardware response is empirical.

## Reactor mapping

Start with the smallest documented control surface:

- Auto-connect `<LingbotWorld2Provider>` on app load with the official module-scoped memoized JWT resolver.
- Scope the JWT to `reactor/lingbot-world-2`; request `expires_after: 3600`, `max_sessions: 3`, and `max_session_duration_seconds: 3600`. Return `Cache-Control: private, no-store`.
- On Make playable, upload the prepared image and set image + deterministic seed while compiler generation runs.
- After a validated spec exists, compose and set the prompt, wait for accepted conditions, then start generation.
- At play start: set longitudinal movement to `forward`.
- Map horizontal input to `set_look_horizontal`, vertical input to `set_look_vertical`, and return each to `idle` on release.
- Set `set_rotation_speed_deg(BASE_REACTOR_TURN_DEG * spec.mechanic.turnRate)`. Gate 1 chooses the base value; the patched factor must remain ≤30.
- Stop movement/look and send an empty camera-pose payload on win, loss, retry, blur, hidden tab, disconnect, and unmount.
- Keep runtime input/state updates immediate even while Reactor commands wait for chunk boundaries.
- Do not implement `set_camera_pose` initially. If Gate 1 proves discrete look insufficient, copy only the provider reference’s proven pattern: accumulate current intent, emit a three-latent `[rx, ry, rz, tx, ty, tz]` profile on `chunk_complete`, and send `[]` once inactive. Record the evidence forcing this branch.

Prompt composition is deterministic. The model authors world identity and landmark descriptions; the app owns tested first-person camera/movement contract sentences. Do not let the model rewrite those control contracts. Compose positive prose only and enforce base/worst-case budgets.

## Compiler choice and contract

Prefer a Modal Shared Endpoint serving `moonshotai/Kimi-K3` if its Gate 4 probe proves all required behavior. Configure, do not abstract:

```dotenv
GAME_COMPILER_BASE_URL=https://inference.us-west.modal.direct/v1
GAME_COMPILER_API_KEY=<combined Modal proxy token>
GAME_COMPILER_MODEL=<shared endpoint hostname from Modal dashboard>
GAME_COMPILER_LABEL=Kimi K3 on Modal
```

Use native server-side `fetch` against OpenAI-compatible Chat Completions. Do not add the OpenAI SDK or an AI framework. The request includes:

- one system message with Glide-only capabilities, current empirical bounds, entity/string budgets, prompt rules, and prompt-injection resistance;
- one user content array with the normalized data-URL image and bounded optional direction;
- strict `json_schema` generated from the same Zod schema (`z.toJSONSchema`);
- low reasoning effort, bounded output tokens, and an abort timeout measured during Gate 4.

Parse only final `message.content`, never reasoning content. Parse JSON and then run Zod again. A repair request includes the bounded previous candidate and locally recomputed structured issues. The client permits no third call.

The compiler qualifies only if three warm Shared Endpoint probes have median latency ≤20 seconds and no call exceeds 30 seconds. The patch path qualifies only if three warm text-only probes have median latency ≤8 seconds and no call exceeds 12 seconds. Use a 30-second game-call abort and 12-second patch-call abort; any timeout falls to the existing repair/fallback path rather than spinning. These are demo-budget gates, not general service SLOs.

If the Modal probe cannot accept image + strict schema, misses those latency thresholds, or is unavailable, point the same three configuration values at any verified OpenAI-compatible multimodal strict-schema endpoint. No user-facing source code or state type changes. The operator panel and evidence must name the actual provider/model; stage copy says “Writing the rules,” not “Astra.”

## Experience state model

Use one reducer with a discriminated union. Async handles/AbortControllers remain in refs, not serializable state.

```text
input
  -> compiling { seed, progress }
  -> ready { validated session }
  -> playing { run: original }
  -> patch { mode: idle | listening | compiling | error }
  -> replaying { patch, run: patched }
  -> result { cartridge }

Any async phase -> recoverable error { preserved seed/session, recovery action }
Operator reset -> input without creating a new Reactor session when reset can reuse it
```

Required transition rules:

- Double-submit is ignored while compiling.
- Selecting a new seed aborts outstanding local work and revokes only superseded object URLs.
- Compiler/validation failure preserves seed/direction and moves through repair/fallback, never clears input.
- A world error before play offers retry staging and prepared-spec fallback.
- A gameplay miss/timeout offers same-world retry.
- Original win is required before speech patch.
- Speech `result` auto-submits only a final non-empty transcript. No confirmation step.
- Speech unsupported/denied/no-match/error preserves any transcript and exposes `Retry speech` plus an always-reachable `Type instead` alternative.
- Invalid patch leaves the original trusted spec/session untouched.
- Accepted patch applies only after original win, updates Reactor turn speed, resets deterministic state, and starts replay automatically.
- Patched replay must win before cartridge generation.
- Cartridge capture failure uses the last successful checkpoint/win world frame; if none exists, show a retryable capture error rather than silently substituting the seed.

## UI and interaction specification

**Design read:** an Experience-mode projector demo for judges, with a dark kinetic game-cartridge language—high causality, low chrome, no AI-dashboard furniture.

**Dials:** design variance 6, motion intensity 3, visual density 3.

**Signature:** the original seed remains a persistent visual “label” that compiles into three luminous route rings, then becomes the left face of the final cartridge. The `//` wordmark and notched cartridge geometry repeat sparingly.

**Palette, already contrast-checked against `#070909`:**

- page `#070909`
- raised surface `#111514`
- primary text `#f4f7f5` (18.51:1)
- secondary text `#97a39d` (7.64:1)
- one interactive accent `#c7ff4a` (16.95:1 on page; `#071000` text is 16.46:1 on accent)
- failure `#ff6b7a` (7.26:1)
- warning `#ffc857` (12.98:1)

Use local/system sans and monospace stacks; do not add remote font latency. Use plain CSS semantic tokens, sharp/medium radii with one documented scale, and no gradient mesh, glass-card grid, purple glow, persistent sidebar, model selector, or generated-code wall.

### Input surface

- Visible: wordmark, one large 16:9 seed well, `Upload image`, `Use camera`, optional direction field, one filled `Make playable` button.
- Stage fixture can be loaded before the pitch through operator mode; ordinary UI simply shows it as the selected seed.
- Camera replaces the seed well inline with a live preview, benefit-first permission copy, `Capture frame`, and `Cancel`. It does not open a nested modal.
- Accepted files: PNG/JPEG/WebP, bounded size; decode before enabling Make playable.
- Primary action remains usable while Reactor is still warming: compilation and session wait can overlap.

### Compilation surface

Keep seed visible. Show exactly four truthful rows with pending/active/passed/fallback/failed states:

1. Reading the seed — browser decode/normalize/hash.
2. Writing the rules — compiler request/repair.
3. Testing the game — schema, route, and pilot checks, with concise check results.
4. Warming the world — Reactor connection, image acceptance, prompt acceptance, generation/first frame.

Show only a four-line decision (`WORLD`, `GAME`, `RULE`, `GOAL`). Never fake elapsed progress; completed fast checks may remain visible but are not animated as still running.

### Play surface

- Live stream full bleed; deterministic canvas above it.
- One objective line, `0/3` checkpoint count, calibrated timer, boost state, and controls hint.
- Keyboard: A/D or left/right turn, W/S or up/down pitch, Space boost. Ignore gameplay keys while a text control is focused.
- Provide pointer buttons that reach the same actions; all have names and ≥44px targets.
- Canvas rings are large, forgiving, depth-scaled, and include non-color state cues.
- Operator debug can reveal route, player state, session id, command/chunk timing, and fallback level for the two-second proof beat.

### Patch surface

- First original win freezes a clear completion state and exposes one primary `Speak a new rule` action.
- On click, request microphone permission and run single-result Chrome speech recognition.
- Display listening state and the transcript as it arrives. On final result, auto-submit immediately.
- While compiling, show the transcript and “Testing the patch.”
- On success, briefly show `TURN RATE ×2`, then start replay automatically.
- `Type instead` is always reachable for keyboard/accessibility; `Retry speech` appears on recognition failure. Neither adds a confirmation step to the successful speech path.

### Result surface

- 1600×1000 cartridge composition: original seed on the left, patched generated frame on the right, notched information rail below, compact path trace, title, `GLIDE`, completion time, `TURN RATE ×2`, and model-authored cartridge line.
- Mirror all essential text in semantic DOM outside the canvas/image for accessibility.
- One filled `Download cartridge` action and one secondary `Make another` action.
- Final projector frame is the cartridge beside the original seed—not a terminal or architecture slide.

### Motion

- Native CSS only; transforms/opacity only; no animation library.
- Press response 120–160ms, stage enter ≤220ms with `cubic-bezier(0.23, 1, 0.32, 1)`, exits shorter.
- Keyboard gameplay input has no transition delay.
- Compile statuses may transition color/opacity, never use fake looping progress.
- `prefers-reduced-motion` removes translation/scale while retaining state-changing opacity/color.

## Reachable-state and recovery matrix

| Surface | Reachable states | Required recovery |
|---|---|---|
| App bootstrap | configured, missing Reactor key, missing compiler config, browser unsupported | explain exact missing non-secret variable/capability; allow fake/offline path only in operator/test mode |
| Reactor | disconnected, connecting, waiting, ready, staging, generating, paused, command error, quota/credit failure, network loss | auto-connect once; bounded reconnect only for documented recoverable loss; operator retry/fallback; always release controls/session |
| Seed | empty, selected, decoding, invalid type, too large, undecodable, camera requesting, camera denied, captured | preserve prior valid seed until replacement succeeds; retry/select/type instead where relevant |
| Compiler | idle, active, schema-valid candidate, semantic rejection, repairing, fallback, auth/429/timeout/error | one repair only; automatic known-valid fallback; operator sees actual level |
| Validation | passed checks, structured issues, pilot timeout | never initialize runtime from failed value; compact issues only leave the module |
| Play | ready, countdown, playing, checkpoint, respawning, timed out, won, world degraded | immediate local feedback; same-world retry; clear live-vs-fake label in degraded mode |
| Speech/patch | unsupported, permission prompt, listening, no-match, transcript, compiling, invalid, accepted | typed alternative always; retry speech; original spec remains intact on failure |
| Cartridge | capturing, composing, ready, download active, capture failed | reuse last good generated checkpoint frame; retry capture; never make a final model call |
| Operator | hidden, visible via query, forced fallback, reset | no secrets or mutating debug API in `window`; visible controls own all mutation |

## Security and trust boundaries

- `.env.local` is ignored. Commit only `.env.example` with names and safe defaults.
- Use the `upload-secrets` workflow when credentials need to enter Devin Cloud; never paste values into chat, source, logs, screenshots, `PROGRESS.md`, or tests.
- Reactor route mints session-scoped JWTs only for `reactor/lingbot-world-2`, with bounded session count/duration and `private, no-store` response headers.
- Compiler base URL/model are server environment configuration, never request input. Combined Modal proxy token or alternative provider key is server-only.
- Limit normalized input and direction/candidate/issue payload sizes before model calls. Decode image server-side with Sharp; verify MIME, dimensions, and pixels rather than trusting extension/client metadata.
- Treat image content and user direction as data, not higher-priority instructions. System prompt forbids following embedded instructions and restricts output to schema.
- Parse model JSON twice: strict schema at provider request and local Zod parse; then semantic validation. Runtime accepts only branded trusted values.
- Do not send stack traces, environment values, secrets, unrelated files, or internal debug state to repair prompts.
- No arbitrary code execution, dynamic imports, eval, HTML from models, remote image URLs from model output, or database writes.
- Debug snapshot omits raw blobs/data URLs, credentials, complete raw responses, and token/session authorization material. Session id is allowed only in query-gated operator/debug state.
- `git grep -nE '(rk_|wk-|sk-)'` over tracked source must return no secret-like value before every demo-ready claim.

## Dependency policy

Pin exact versions at Gate 0. These versions were published at least seven days before planning and satisfy the verified peer ranges:

| Package | Version | Reason |
|---|---:|---|
| `next` | `16.3.4` | integrated client/server shell |
| `react`, `react-dom` | `19.2.8` | Next peer-compatible UI |
| `@reactor-models/lingbot-world-2` | `1.0.1` | typed model methods/hooks |
| `@reactor-team/js-sdk` | `3.0.1` | pin transitive SDK away from newer unvetted release |
| `zod` | `4.5.4` | runtime schemas and built-in JSON Schema export |
| `sharp` | `0.35.4` | server-side image decode/dimension trust boundary |
| `typescript` | `5.9.3` | Next support and Node type stripping compatibility |
| `@playwright/test` | `1.63.0` | Chrome E2E and recorded real smoke |
| `@types/node` | `26.4.1` | target Node line |
| `@types/react` | `19.2.18` | React types |
| `@types/react-dom` | `19.2.7` | React DOM types |
| `eslint` | `9.39.5` | supported stable lint line |
| `eslint-config-next` | `16.3.4` | exact Next rules |

Use Node’s built-in `node:test`; do not add Vitest/tsx. Target the installed Node `26.7.0` and pnpm `10.33.0`. Keep TypeScript syntax erasable (no enums, parameter properties, or runtime namespaces), use explicit `.ts` extensions in Node-test imports, and enable `allowImportingTsExtensions`, `erasableSyntaxOnly`, and `verbatimModuleSyntax`.

## Implementation steps

### Task 0.1 — Scaffold the empty repository without inheriting template bloat

**Files:** create generated Next files in `/Users/hridyaagrawal/anythingplay`; modify `package.json`, `tsconfig.json`.

1. Reconfirm the directory is empty. Stop if any new user file appears; preserve and re-plan around it.
2. Scaffold without installing or initializing Git:
   ```bash
   pnpm dlx create-next-app@16.3.4 . --ts --eslint --app --src-dir --use-pnpm --no-tailwind --import-alias '@/*' --empty --skip-install --disable-git --no-agents-md --yes
   ```
3. Replace generated dependency ranges with the exact dependency table above before the first install. Add `"type": "module"`, `"packageManager": "pnpm@10.33.0"`, and scripts:
   ```json
   {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
     "lint": "eslint .",
     "typecheck": "tsc --noEmit",
     "test": "node --test",
     "test:e2e": "playwright test",
     "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
   }
   ```
4. Add the TypeScript options required for Node’s native runner while retaining Next’s generated options.
5. Run `pnpm install`, then `pnpm exec playwright install chromium`.
6. Initialize on a non-main implementation branch: `git init -b feat/anything-play`.
7. Run `pnpm check`. Expected: exit 0 on the untouched empty app.
8. Inspect `pnpm list --depth 0`; expected direct dependency set matches the table and contains no Tailwind, UI kit, animation, AI framework, Three.js, physics engine, Vitest, or database package.
9. Commit as `Bootstrap the verified local app shell` using the required Devin commit trailer.

**Completion:** app builds with exact reviewed dependencies; no feature code or inherited Reactor demo UI exists.

### Task 0.2 — Install the execution contract and source evidence

**Files:** create `AGENTS.md`, `README.md`, `PROGRESS.md`, `.env.example`, `docs/plans/2026-09-12-anything-play-implementation.md`; copy `docs/anything-play-handoff.md`, `docs/anything-play-concept-report.md`, `docs/anything-play.architecture.draft.json`.

1. Copy this approved plan from `/Users/hridyaagrawal/.devin/plans/plan-e4b585c3b62e1d75.md` into `docs/plans/2026-09-12-anything-play-implementation.md`.
2. Copy only the three locked ANYTHING//PLAY source artifacts. Rename the architecture JSON with `.draft` in its filename. Copy no alternate-concept or event-research file.
3. Write a concise `AGENTS.md` execution contract with these live rules only:
   - read the plan and handoff before edits;
   - execute Gates in order and stop on failed Gate 1;
   - update `PROGRESS.md` after every gate with command/result/evidence/next/deviation;
   - load the named execution/TDD/verification/UI skills at their trigger;
   - keep real-model checks explicit and secrets server-only;
   - treat the draft architecture JSON as non-authoritative.
4. Keep README to the promise, local prerequisites, `pnpm dev`, current gate, and explicit honest limitation. Do not duplicate package scripts or the full handoff.
5. Seed `PROGRESS.md` with Gate 0 active and sections: `Works`, `Verification`, `Evidence`, `Observed latency/model behavior`, `Next`, `Deviations`.
6. Add environment names only:
   ```dotenv
   REACTOR_API_KEY=
   GAME_COMPILER_BASE_URL=https://inference.us-west.modal.direct/v1
   GAME_COMPILER_API_KEY=
   GAME_COMPILER_MODEL=
   GAME_COMPILER_LABEL=Kimi K3 on Modal
   ```
7. Verify `git status --short docs` lists exactly the two ANYTHING//PLAY reports, the renamed draft, and this plan; after staging the task, verify the same inventory with `git diff --cached --name-only -- docs`.
8. Commit as `Make gate order and evidence durable`.

**Completion:** a killed/restarted agent can resume from disk without this conversation.

### Task 0.3 — Add the test laboratory before product behavior

**Files:** modify `package.json`; create `tests/smoke.test.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`.

1. Add a one-test `node:test` smoke file using only erasable TypeScript; run `pnpm test` and confirm discovery/pass.
2. Configure Playwright with a deterministic Chromium project, `baseURL`, trace-on-first-retry, screenshots-on-failure, and video-on-failure. The initial smoke uses the empty app and requires no secrets; Task 1.2 adds fake-world configuration once that adapter exists.
3. Add a Playwright smoke that opens the empty app and checks no console/page error.
4. Run `pnpm test && pnpm test:e2e` and capture exit 0 in `PROGRESS.md`.
5. Mark Gate 0 complete with the exact command output, current direct dependencies, and Gate 1 as next.
6. Commit as `Give the build a deterministic feedback loop`.

**Completion:** every subsequent behavioral task has a runnable test and browser evidence path.

### Task 1.1 — Write the fixed-step Glide core test-first

**Files:** create `src/game/glide.ts`, `tests/glide.test.ts`.

1. RED: write tests at the `createGlideState` / `stepGlide` / `simulateCourse` boundary for:
   - the same initial state + 1,800-input sequence is deeply equal twice;
   - segment–sphere crossing catches a high-speed gate pass;
   - checkpoint 2 cannot count before checkpoint 1;
   - the known pilot reaches three checkpoints and goal;
   - missing a passed gate respawns at the last checkpoint;
   - time expiry produces failure.
2. Run `node --test tests/glide.test.ts`. Expected: fail because the boundary does not exist, not from syntax/config.
3. GREEN: implement the minimum native math and one `GLIDE_CALIBRATION` object. No render, Reactor, classes, plugin interface, Three.js, or general mechanic union yet.
4. Run the focused test. Expected: all pass.
5. REFACTOR: keep the happy-path step flat; isolate only segment–sphere and world-to-camera math that hides real formulas. Keep pilot input routed through `stepGlide`.
6. Run `pnpm test && pnpm typecheck`.
7. Commit as `Prove a deterministic three-gate Glide loop`.

**Completion:** deterministic gameplay works headlessly before any model integration.

### Task 1.2 — Create the fake world seam and playable overlay shell

**Files:** create `src/world/world.tsx`, `src/world/fake.tsx`, `src/seed/image.ts`, `src/experience/state.ts`, `src/experience/AnythingPlay.tsx`, `src/experience/stages.tsx`, `src/testing/debug.ts`, `public/fixtures/glide-ink-islands.webp`; modify `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `playwright.config.ts`; create `e2e/glide-flow.spec.ts`.

1. RED: write a Playwright test that loads a fixed fixture in fake mode, starts play, sends a known keyboard sequence, reads the debug snapshot, and expects win/checkpoint order. It should fail at the missing UI.
2. Define the smallest `WorldDriver` interface needed by both real and fake adapters: status snapshot, stage/start, control update, turn-rate update, stop controls, reset, frame capture, and rendered surface. Do not add a registry or general model API.
3. Implement a deterministic fake canvas that visibly responds to the same world control commands and can return a frame Blob. Its purpose is tests/offline explanation, not a second product renderer.
4. Generate or resolve the frozen 1664×960 `glide-ink-islands.webp` fixture outside runtime code (prefer `media-use`/Runware if available): monochrome ink archipelago, clear forward corridor/horizon, exactly three large arch/ring landmarks and one distant moon gate, no text/crowd/precision surfaces. Add no Runware runtime dependency.
5. Define `PreparedImage` and a fixture-only loader in `src/seed/image.ts`: fetch the already-normalized local WebP, hash it, and treat that same Blob as original + normalized for the fixed Gate 1 path. Task 5 extends this module for arbitrary upload/camera input.
6. Implement the phase reducer and the fixed-fixture path. The game loop runs fixed steps in a ref, draws projected gates/HUD to canvas, and publishes low-frequency public state/debug snapshots without 60 Hz React rerenders. Define `DebugSnapshot` from the now-real phase/game/world public types and expose only `window.__ANYTHING_PLAY__.snapshot()` in test or `?operator=1` mode; it has no mutation methods.
7. Switch Playwright’s normal web server to fake-world mode and keep the smoke path secret-free.
8. Add keyboard and pointer controls. Release all input on keyup, blur, hidden tab, phase exit, and unmount. Ignore gameplay keys in editable controls.
9. Implement objective/checkpoint/timer/win/failure/retry states with semantic controls and accessible names.
10. Run the Playwright test. Expected: win with fake world, no console errors, debug state reports fallback level 4 only in fake mode.
11. Run `pnpm check && pnpm test:e2e`.
12. Commit as `Make the deterministic game playable without a network`.

**Completion:** the full mechanic/overlay loop can be driven and inspected before real pixels enter.

### Task 1.3 — Add scoped Reactor auth and auto-prewarm

**Files:** create `src/app/api/reactor/token/route.ts`, `src/world/lingbot.tsx`; modify `src/world/world.tsx`, `src/app/page.tsx`, `.env.example`; create `tests/reactor-contract.test.ts` for pure token-body/prompt/control mapping helpers.

1. RED: test pure helpers for the exact token request scope and for control-release mapping. Assert model is only `reactor/lingbot-world-2`, token expiry/session count/session duration are `3600`/`3`/`3600`, and stopped input emits longitudinal/lateral/look idle plus empty pose.
2. Copy the official Reactor pattern, adapted minimally:
   - server-only `REACTOR_API_KEY` exchange;
   - `authorization_details` session scope;
   - module-scoped client token memo and in-flight request coalescing;
   - `private, no-store`;
   - no raw upstream response body in user errors.
3. Mount the LingBot provider across all experience phases and enable auto-connect on initial load. Do not unmount it during stage changes.
4. Derive world connection/model state from typed status/messages and track first-frame time. Do not optimistically mark image/prompt/generation accepted when methods are called.
5. Implement the live video surface and safe frame capture from the received media track.
6. Add a configured/missing-key state that names setup without exposing any value. Fake E2E remains functional without a key.
7. Run focused tests and `pnpm check` with no secrets. Expected: offline build/tests pass; real route is not called.
8. Commit as `Prewarm one scoped LingBot session safely`.

**Completion:** the live adapter can connect without putting the account key in the browser.

### Task 1.4 — Couple fixed Glide to a live LingBot world

**Files:** create `src/world/prompts.ts`; modify `src/world/lingbot.tsx`, `src/experience/AnythingPlay.tsx`, `src/experience/stages.tsx`, `src/game/glide.ts`, `public/fixtures/glide-ink-islands.webp` only if evidence forces a seed revision; create `e2e/real-reactor.spec.ts`.

1. Reuse the frozen Gate 1 fixture and record its SHA-256. Replace it only if the live model proves that its composition—not control mapping—is the coupling blocker; record old/new hashes and reason.
2. Write fixed positive first-person camera/movement prompt fragments and a pure budget-checked composer. Model-independent control sentences remain app-owned.
3. Stage the fixture: await ready, upload file, set image, set seed, set prompt, wait for conditions, start, and wait for `generation_started` plus first video frame.
4. At play start and each input transition, map canonical controls to documented persistent longitudinal/look methods. Map calibrated turn multiplier through `set_rotation_speed_deg`.
5. Instrument timestamps for input, deterministic state update, overlay draw, command send, chunk completion, and first frame. Do not label chunk completion as proof of semantic visual response.
6. Create an opt-in real Playwright project (`REAL_REACTOR=1`) that starts the fixture, drives the known course, captures video/trace, and reads deterministic end state. It may assert SDK/session/overlay facts; qualitative visual coupling remains a recorded gate review.
7. Run real smoke in Chrome with a server-side key. Save seed, prompt, calibration, metrics JSON, and recording under `docs/evidence/gate-1/`.
8. Tune only `GLIDE_CALIBRATION`, ring size/spacing, prompt fragments, and documented control mapping until the course reads as one game. Record every tested value rather than spreading literals.
9. Compare live video against a frozen-frame fake: motion must materially improve route/agency perception. If not, Gate 1 fails.
10. Decide:
    - **Pass:** record final base rotation speed, runtime rates, radii, course duration, input→overlay distribution, observed command→world lag, and proceed.
    - **Conditional camera-pose branch:** only if discrete look is the measured blocker, implement the official three-latent `chunk_complete` pattern and rerun all evidence.
    - **Fail:** stop all later tasks and enter the Dash contingency below. If Dash also fails, kill the concept rather than add compiler or polish UI.
11. Update `PROGRESS.md` with exact commands/results/evidence and explicit proceed/pivot decision.
12. Commit as `Prove live world and Glide feel like one game` only after the gate passes.

**Gate 1 completion:** live model responds to control; deterministic course wins; seed identity persists; recorded play reads as one experience; focused deterministic test remains green; evidence is on disk.

### Task 2.1 — Define and parse the trusted GameSpec boundary

**Files:** create `src/game/spec.ts`, `tests/spec.test.ts`; replace fixed fixture construction in `src/experience/AnythingPlay.tsx` with a manually authored spec.

1. RED: test a complete manual/cached spec parses to the opaque trusted type while unknown keys, wrong version, non-finite values, duplicate IDs, missing goal, wrong checkpoint tuple length, and cached reference-image mismatch fail with stable structured issues. Separately test that a model candidate has no accepted `referenceImageId` or `world.seed` fields and receives both from `PreparedImage` during validation.
2. Implement explicit strict Zod schemas for the model candidate, full cached spec, trusted construction, world, entities, Glide, rules, and validation issue. Keep structural caps fixed as listed above and empirical mechanic/course bounds centralized from Gate 1.
3. Make each external parser accept `unknown`. Make runtime initialization accept only `ValidatedGameSpec`.
4. Express the Gate 1 fixed course as one hand-authored `GameSpec`; loading it must produce the same game without code-path changes.
5. Run focused tests, then `pnpm check` and fake browser path.
6. Update Gate 2 progress and commit as `Put a trusted GameSpec in front of the runtime`.

**Gate 2 completion:** invalid data cannot initialize runtime; manual data recreates Gate 1 exactly.

### Task 3.1 — Add semantic route validation and deterministic fallback

**Files:** modify `src/game/spec.ts`, `src/game/glide.ts`; create `tests/validation.test.ts`, `src/game/fallback.ts`; add invalid fixture JSON only if it improves browser/debug use.

1. RED: add the required negative cases: missing goal, nonexistent checkpoint reference, NaN/out-of-range parameter, non-monotonic/unreachable route, too-small ring, excessive prompt/entity/string budget. Add the known positive course.
2. Implement validation in ordered layers: Zod parse, ids/references, empirical bounds, Glide invariants, monotonic route envelope, actual pilot simulation.
3. Return compact deterministic issues; never throw validation stack traces across the caller interface.
4. Create one fallback spec factory that injects the current prepared seed id/image identity into a frozen known-valid Glide template. Validate the fallback itself in tests; failure is a programmer invariant and should fail fast.
5. Add a pure `compileValidatedGame(generateCandidate)` orchestration test:
   - valid first candidate: one call;
   - invalid first + valid repair: two calls;
   - invalid repair/error: fallback;
   - never a third call.
6. Run focused tests, mutation-check one representative validator assertion by temporarily invalidating the implementation, restore, and rerun green.
7. Update Gate 3 progress and commit as `Reject impossible games and always retain a safe course`.

**Gate 3 completion:** every required invalid fixture returns a useful issue; positive/pilot passes; failures deterministically select a playable fallback; retry count is bounded.

### Task 4.1 — Prove the compiler endpoint before integrating it

**Files:** create `src/server/compiler.ts`, `src/server/input-image.ts`, `scripts/probe-compiler.ts`, `tests/compiler.test.ts`; modify `.env.example`, `package.json` only if adding a `probe:compiler` script.

1. Human prerequisite: create the Kimi K3 Modal Shared Endpoint and proxy token in the dashboard, or provide another verified OpenAI-compatible multimodal endpoint. This is an external billable action and must not be performed by an agent without explicit approval. Load credentials securely.
2. RED: with injected fake `fetch`, test request body uses image content, strict JSON schema, configured model, low reasoning effort, bounded tokens, timeout, and server-only auth; test malformed provider content, non-2xx, timeout, and missing config become proportional typed failures without response-body/secret leakage.
3. Implement native-fetch `requestStructuredOutput(schema, messages)`; no provider class hierarchy or SDK.
4. Implement server image validation with Sharp: max bytes/pixels, allowed actual format, decodable, exactly normalized dimensions. Return a trusted data URL only inside the server call.
5. Build the probe script to read one local fixture, issue the exact production request, parse it through Zod, and print model label, elapsed milliseconds, and schema result—never token or reasoning content.
6. Run `/v1/models` with the Modal proxy token to confirm endpoint model id, then run three warm image/schema probes and three warm text-only patch probes. Record outputs in `docs/evidence/gate-4/compiler-probe.md`.
7. Select compiler config:
   - keep Kimi K3 only when every strict-schema probe parses, game median/max are ≤20/30 seconds, and patch median/max are ≤8/12 seconds;
   - otherwise use another compatible endpoint through the same config and rerun the complete probe set;
   - do not write a second adapter.
8. Run `pnpm test && pnpm typecheck` and commit as `Verify one multimodal game compiler contract`.

**Completion:** exact production transport is proven before product orchestration depends on it.

### Task 4.2 — Generate, repair, and validate live GameSpecs

**Files:** create `src/app/api/compiler/game/route.ts`, `src/compiler/client.ts`; modify `src/experience/AnythingPlay.tsx`, `src/experience/state.ts`, `src/experience/stages.tsx`, `src/game/spec.ts`; create `tests/compile-flow.test.ts`, update `e2e/glide-flow.spec.ts`.

1. RED: test first candidate/repair/fallback orchestration and Playwright compilation statuses with intercepted route responses.
2. Route accepts bounded multipart fields using the fixed trust-boundary budget table: normalized image, seed id, optional direction, and—only for the repair—prior candidate plus issues. Reparse the candidate, recompute semantic issues server-side, and ignore client-authored issue text; the browser is not a trust boundary.
3. Write the compact system prompt from current Glide bounds and JSON schema. Require exactly three monotonic checkpoints, one start/goal, positive base prompt, two to four landmarks, no raw code, and stage-readable title/rule/goal.
4. Client starts LingBot image upload and compiler request concurrently. It parses candidate locally, renders check results, invokes one repair if needed, then fallback.
5. Compose the accepted world prompt with app-owned control fragments, start LingBot, wait for first frame, then expose `Play <title>`.
6. Implement truthful four-row compilation progress and concise `WORLD/GAME/RULE/GOAL` result. Fast validation may immediately mark passed; never hold a fake spinner.
7. Validate the model-only candidate schema, then inject `referenceImageId` and stable `world.seed` from `PreparedImage`; reject those keys as unknown if the model attempts to supply them.
8. Run offline fake E2E for first-pass, repair, and fallback branches; all must reach ready/play.
9. Run real compiler + fake world once; then real compiler + Reactor once after both isolated sides pass.
10. Update `PROGRESS.md` with attempt count, validation disposition, fallback level, compiler latency, and first-world-frame latency.
11. Commit as `Compile one image into a tested Glide program`.

### Task 4.3 — Qualify three materially different seeds

**Files:** add `public/fixtures/glide-kings-cross.webp`, `public/fixtures/glide-coffee-canyon.webp`; create/update `docs/evidence/gate-4/*`; no runtime integration for Runware.

1. Generate/freeze two additional 1664×960 images with materially different composition and visual identity: recognizable station rooftops and a macro ceramic canyon. Keep a clear navigable horizon and large landmarks.
2. Run each fixture through the exact live compiler without hand-editing JSON.
3. Save normalized input id, model label, prompt, raw candidate in development evidence, validation issues, repair/fallback disposition, trusted spec, and timing. Do not save credentials or unrelated metadata.
4. Require at least two of three to validate on first attempt and all three to resolve to a playable trusted spec within one repair/fallback. If first-attempt quality is weaker, revise the prompt/bounds once and rerun all three; do not special-case seed names in code.
5. Run each trusted spec through headless pilot and fake browser play.
6. Record the actual stage fixture selection and commit as `Qualify three seeds without hand-edited game JSON`.

**Gate 4 completion:** live model generation is real, bounded, timed, and repeatable enough for the demo; fallback use is explicit.

### Task 5.1 — Unify upload and camera into the prepared-image boundary

**Files:** modify `src/seed/image.ts`, `src/experience/stages.tsx`, `src/experience/AnythingPlay.tsx`, `src/server/input-image.ts`; create `tests/input-image.test.ts`, `e2e/input.spec.ts`.

1. RED: browser tests cover PNG/JPEG/WebP selection, invalid type, oversized/undecodable file, camera permission denial, successful capture, preserved original preview, and shared Make playable path.
2. Browser preparation uses native APIs: decode with `createImageBitmap`, respect orientation, center-crop to 1664×960, encode WebP, SHA-256 original bytes, retain original Blob, and revoke URLs correctly. No image library in the browser.
3. Server revalidates normalized bytes with Sharp before paid calls. Client validation is user feedback, not a server trust substitute.
4. Implement inline camera mode with `getUserMedia`, explicit user click, benefit-first permission explanation, Capture/Cancel, stream-track cleanup, and same `prepareImage` function as upload.
5. Preserve current valid seed if a replacement fails. Preserve direction across recoverable errors.
6. Keep the stage demo prepared fixture load in operator mode; do not add a public gallery.
7. Run all input E2E in Chromium with mocked media. Manually verify one real laptop camera capture in Chrome.
8. Update Gate 5 progress and commit as `Make upload and camera one trustworthy seed path`.

**Gate 5 completion:** fresh camera and uploaded files reach the same complete creation path; invalid bytes fail before model calls; cartridge retains original input.

### Task 6.1 — Define and apply the bounded turn-rate patch test-first

**Files:** modify `src/game/spec.ts`, `src/game/glide.ts`; create `tests/patch.test.ts`; create `src/app/api/compiler/patch/route.ts`; modify `src/server/compiler.ts`, `src/compiler/client.ts`.

1. RED: test accepted `multiply_turn_rate` factors, unrelated fields, wrong mechanic, factor outside `0.5 | 2`, resulting out-of-bound Reactor speed, and transactional failure that leaves original spec untouched.
2. Implement strict patch schema and `applyPatch(current, unknown)` returning a new branded trusted spec only after all bounds pass.
3. Patch route treats the browser payload as untrusted: reparse the full current spec, cap the transcript at 240 code points, ask the compiler for only the strict patch schema, and return unknown JSON. It does not need the image.
4. System prompt states current turn multiplier and allowed operation/factors; request cannot alter world/mechanic/entities/rules.
5. On accepted `factor: 2`, update runtime yaw calibration and Reactor rotation speed from the new trusted spec. Assert the latter stays ≤30.
6. Test that same player input yields a larger yaw delta after patch and that mapped Reactor command doubles, while world/reference/entity fields deep-equal before/after.
7. Run focused test, then full check. Commit as `Make one rule patch narrow and transactional`.

### Task 6.2 — Add speech-first auto-apply and same-session replay

**Files:** create `src/experience/speech.ts`; modify `src/experience/state.ts`, `src/experience/AnythingPlay.tsx`, `src/experience/stages.tsx`, `src/world/lingbot.tsx`, `src/testing/debug.ts`; create `e2e/speech-patch.spec.ts`.

1. RED: Playwright injects a fake `SpeechRecognition`/`webkitSpeechRecognition`, emits final “double the turn rate,” and expects automatic patch request, `factor: 2`, patched replay, and unchanged session id. Separate tests cover unsupported, permission-denied, no-match, route rejection, and typed alternative.
2. Implement one native recognizer instance per patch attempt: non-continuous, no interim auto-submit, one alternative, browser language default. Abort/cleanup on phase exit.
3. On final non-empty result, store/display transcript and call patch endpoint immediately—no review/confirm action.
4. On recognition failure, preserve transcript if any and show `Retry speech` plus `Type instead`. Typed submission uses the identical patch path.
5. After accepted patch, call live driver turn-rate update, reset only deterministic run state, preserve Reactor provider/session/world prompt/image, and auto-start patched replay.
6. Before/after debug evidence includes same session id, same reference id, same world prompt hash, original and patched turn multipliers, and mapped rotation speeds.
7. Manually run the real Chrome microphone path using the rehearsed phrase under ambient noise. Record transcript and patch latency.
8. Update Gate 6 progress and commit as `Turn a spoken rule into a live same-world replay`.

**Gate 6 completion:** speech auto-submits, invalid input cannot corrupt active state, and the same live session visibly turns faster on replay.

### Task 7.1 — Build the local Game Cartridge ending

**Files:** create `src/game/cartridge.ts`, `tests/cartridge.test.ts`; modify `src/experience/state.ts`, `src/experience/AnythingPlay.tsx`, `src/experience/stages.tsx`, `src/world/world.tsx`, `src/world/lingbot.tsx`, `src/world/fake.tsx`; create `e2e/cartridge.spec.ts`.

1. RED: pure test asserts cartridge data comes from patched replay, includes seed id/title/mechanic/time/path/turn rule, and rejects original/incomplete run. E2E expects the result surface and a non-empty PNG download.
2. Reset the frame cache when patched replay begins, then capture a generated frame at each patched checkpoint and win; retain only the latest successful patched-run Blob to bound memory. Never fall back to an original-run frame. Real and fake adapters satisfy the same capture interface.
3. Build a pure `CartridgeData` derivation and a browser canvas renderer at fixed 1600×1000. Draw original seed, patched generated frame, deterministic path trace, and text using local fonts.
4. Mirror text in DOM and give the resulting image meaningful alt text. Use Blob URL download with sanitized filename and cleanup.
5. Make cartridge capture/composition a real progress state. No async model call, upload, persistence, or share button.
6. If final frame capture fails, use the last good generated frame. If none exists, show retry capture; do not substitute original seed and claim it is generated.
7. E2E inspect PNG signature/size, expected DOM fields, download filename, and final debug phase. Capture a 1440×900 result screenshot.
8. Update Gate 7 progress and commit as `End the patched game with an owned cartridge`.

**Gate 7 completion:** every successful patched run reaches a readable, downloadable local artifact containing the exact required evidence.

### Task 9.1 — Implement the query-gated operator and reliability ladder

**Files:** create `src/experience/OperatorPanel.tsx`; modify `src/experience/AnythingPlay.tsx`, `src/world/world.tsx`, `src/testing/debug.ts`, `src/app/globals.css`; create/update E2E fallback tests.

1. RED: browser tests assert panel absent normally, present with `?operator=1`, and each fallback level is labeled and produces the expected debug state.
2. Add operator controls for prepared seed, live/cached spec choice, live/fake world, proxy reveal, metrics, reset, and session disconnect. No freeform model settings or secrets.
3. Implement explicit ladder:
   1. fresh seed + live compiler + live Reactor;
   2. fresh seed + known valid/cached Glide spec + live Reactor;
   3. prepared seed + cached valid spec + live Reactor;
   4. prepared seed + deterministic fake world, visibly labeled not live.
4. Automatic path may drop from 1 to 2 after one repair. Levels 3/4 are operator selections. Entering level 4 explicitly disconnects the live session before mounting fake output. Never silently call fake output live.
5. Reset clears gameplay/seed selection as requested while reusing a healthy prewarmed session where model `reset` permits; disconnect is separate and explicit.
6. Show public debug proof for two seconds via operator action: proxy course, canonical state, active spec hash, session/model state, and fallback level.
7. Run fallback E2E and commit as `Make every demo failure explicit and recoverable`.

### Task 9.2 — Finish the visual system and every reachable state

**Files:** modify `src/app/globals.css`, `src/app/layout.tsx`, all experience stage files; no new visual dependency.

1. Apply the locked palette, typography stacks, spacing/radius scale, seed-to-rings signature, full-bleed world layout, and cartridge treatment.
2. Cover every state in the matrix. Keep one filled primary action per surface; keep labels stable during pending states; preserve seed/transcript/direction on error.
3. Ensure every control is semantic, named, focus-visible, keyboard reachable, and ≥44px for pointer controls. Camera/mic asks happen only on their user actions.
4. Keep generated video as the sole visual focal point during play. Remove any model dashboard, card grid, terminal text, duplicate CTA, or decorative status noise introduced during building.
5. Add reduced-motion treatment and gate hover effects behind hover-capable media.
6. Browser QA at 1440×900, 1280×720, 1024×768, and 320px; test 200% zoom, long generated title/tagline, missing frame, fallback label, keyboard-only flow, and reduced motion.
7. Run one fresh bounded visual review, fix its actionable list, then one confirmation pass. Do not reopen unbounded polish.
8. Commit as `Make the compiler-to-cartridge arc stage readable`.

### Task 9.3 — Prove the complete offline path

**Files:** consolidate `e2e/flow.spec.ts` and supporting tests; modify `playwright.config.ts`, `PROGRESS.md`.

1. Full fake-world E2E must:
   - load/upload fixture;
   - show truthful compile phases;
   - exercise first-valid, repair, and fallback compiler branches by route interception;
   - enter ready;
   - drive original win;
   - inject speech final result;
   - verify accepted 2× patch and unchanged world/session identity;
   - drive patched win;
   - render/download cartridge;
   - reset.
2. Assert no uncaught browser exception, failed request outside intentionally mocked failures, accessibility-name omission on critical controls, or stuck input after blur.
3. Run fresh:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm test:e2e
   git grep -nE '(rk_|wk-|sk-)' -- . ':!pnpm-lock.yaml'
   ```
   Expected: first five exit 0; secret scan returns no matches/exit 1 solely for no matches.
4. Record exact counts/exit codes in `PROGRESS.md` and commit as `Prove the whole product without paid services`.

### Task 9.4 — Run real integration evidence and three rehearsals

**Files:** update `docs/evidence/gate-9/`, `PROGRESS.md`; change code only for failures proven by evidence.

1. Load secrets securely and start the production build locally (`pnpm build && pnpm start`). Use Chrome on macOS with camera/microphone permissions rehearsed.
2. Use one `?operator=1` page with the panel collapsed during the public flow; do not open a second app tab because auto-prewarm would allocate another session. Confirm one session, no duplicate session on phase changes, and clean disconnect at finish.
3. Run fresh prepared fixture + live compiler + live Reactor through original win, spoken patch, patched replay, and cartridge download. Record browser video and metrics.
4. Run three end-to-end rehearsals. For each record total time and the durations of normalization, compiler attempt/repair, validation, Reactor ready/image/prompt/first frame, original play, speech/patch, replay, and cartridge.
5. Every run must stay under 180 seconds and end on cartridge. The first meaningful live model output must appear within the rehearsed envelope; no blank indefinite loader is allowed.
6. Rehearse levels 2 and 3 once each and level 4 once with explicit “live renderer unavailable” labeling. Test one-key/visible reset and network interruption recovery.
7. Inspect recordings for seed identity, gate/world cohesion, input causality, visible 2× turn difference, and any claim that overstates live generation. If a qualitative issue appears, state a falsifiable fix, change one variable, and rerun the same evidence.
8. Run the full command suite again after the last code change. Save outputs and final demo metrics in `PROGRESS.md`.
9. Commit as `Harden the live three-minute proof`.

**Gate 9 completion:** three complete live rehearsals fit the pitch, fallbacks are honest, reset works, no secret is visible, and the final frame is the cartridge.

### Task 9.5 — Replace the draft architecture with implementation evidence

**Files:** retain `docs/anything-play.architecture.draft.json`; create validated `docs/anything-play.architecture.json` and rendered/validation artifacts required by the `archify` workflow; update README/PROGRESS only with current facts.

1. Invoke `archify` after code and evidence are final. Read actual module paths and runtime traces; do not copy assumptions from the draft.
2. Keep the showcase diagram simple enough for desktop readability: Seed, Compiler route, Validator/runtime, LingBot session, Overlay, Speech patch, Cartridge. Show canonical ownership and the one same-session patch loop.
3. Validate dark/light desktop output using the skill’s actual current commands/tool contract. Fix label-size/readability failures before citing it as validated.
4. Update README status and limitation from final evidence. Do not add speculative roadmap prose.
5. Run final `pnpm check`, `pnpm test:e2e`, real smoke, and inspect Git diff for secrets/generated junk.
6. Load `verification-before-completion`, verify artifacts rather than prior summaries, update `PROGRESS.md` final state, and commit as `Document the system that actually shipped`.

## Conditional branch: Dash only if Gate 1 Glide fails

Enter this branch only when LingBot movement is responsive but free-flight pitch/yaw or gate projection cannot read as one game after bounded calibration. Do not run Gates 2–7 in parallel.

1. Record the failed Glide evidence and exact failure mechanism.
2. Replace—not layer beside—the runtime with a lane-like forward Dash core using longitudinal forward + lateral commands, large overlay hazards/checkpoints, forgiving collision volumes, and deterministic fixed steps.
3. Write one pilot/win test and repeat the full Gate 1 live recording.
4. If Dash passes, update `GameSpec`/patch terminology before Gate 2. The stage patch becomes “double strafe response,” not the now-false turn-rate claim. Record this contract deviation.
5. If Dash also feels decorative/disconnected, stop the concept. Do not add compiler/UI polish to hide the failed core.

## Conditional branch: Grapple stretch

Grapple is outside committed acceptance. It can begin only after Task 9.4 passes with fresh evidence and the user explicitly chooses to spend remaining capacity.

Entry test: one fixed route with three visually stable landmarks, generous proxy anchors, immediate rope/reticle overlay, deterministic repeated win, and no empty-air attachment requiring verbal excuse. A failed spike stays off the shipped path; request explicit confirmation before deleting its branch/files. Glide remains the shipped stage path.

## Files to Create or Modify

Expected authored files after committed work (generated Next/config/lock files omitted from descriptions but remain tracked):

- `AGENTS.md` — pointer-based execution contract.
- `README.md` — promise, setup, current truth/limitation.
- `PROGRESS.md` — resumable gate ledger and evidence.
- `.env.example` — environment names only.
- `docs/anything-play-handoff.md` — copied authority.
- `docs/anything-play-concept-report.md` — copied rationale.
- `docs/anything-play.architecture.draft.json` — archived unvalidated draft.
- `docs/plans/2026-09-12-anything-play-implementation.md` — this approved plan.
- `docs/evidence/gate-{1,4,9}/...` — bounded real evidence, no credentials.
- `public/fixtures/glide-{ink-islands,kings-cross,coffee-canyon}.webp` — frozen seed fixtures.
- `src/app/page.tsx`, `layout.tsx`, `globals.css` — shell and design tokens.
- `src/app/api/reactor/token/route.ts` — scoped token broker.
- `src/app/api/compiler/game/route.ts` — image-to-candidate route.
- `src/app/api/compiler/patch/route.ts` — transcript-to-patch route.
- `src/server/compiler.ts` — one OpenAI-compatible structured-output request module.
- `src/server/input-image.ts` — server image trust boundary.
- `src/compiler/client.ts` — bounded browser calls to local routes.
- `src/seed/image.ts` — browser preparation and original preservation.
- `src/game/glide.ts` — fixed-step mechanic, projection, pilot.
- `src/game/spec.ts` — schemas, trusted types, validation, patch application.
- `src/game/fallback.ts` — known-valid seed-bound fallback.
- `src/game/cartridge.ts` — result data and local canvas renderer.
- `src/world/world.tsx` — small real/fake seam and context.
- `src/world/lingbot.tsx` — concrete Reactor adapter/lifecycle/video.
- `src/world/fake.tsx` — deterministic browser-test adapter.
- `src/world/prompts.ts` — runtime-owned prompt composition/budgets.
- `src/experience/state.ts` — phase union/reducer.
- `src/experience/AnythingPlay.tsx` — direct use-case orchestration.
- `src/experience/stages.tsx` — input/compile/play/patch/result surfaces.
- `src/experience/speech.ts` — native Chrome recognition wrapper.
- `src/experience/OperatorPanel.tsx` — query-gated controls.
- `src/testing/debug.ts` — sanitized read-only snapshot.
- `scripts/probe-compiler.ts` — exact model capability/latency probe.
- `tests/*.test.ts` — stable pure boundaries only.
- `e2e/*.spec.ts` — full fake path, media/speech paths, opt-in real Reactor.

Do not split files merely to match this inventory. If two adjacent planned files remain tiny and have one caller, co-locate them. Do not merge separate trust/state owners into a mega-file just to reduce file count.

## Verification matrix

| Claim | Proving evidence | Not sufficient |
|---|---|---|
| deterministic game | repeated scripted state deep-equality + pilot win | smooth-looking browser play |
| validator catches impossible games | focused negative fixtures and mutation red/green proof | schema parse alone |
| runtime trusts no model JSON | runtime signatures accept branded spec + invalid browser fixture blocked | strict provider schema alone |
| world model is live | real session state/video recording/new generated run | fake renderer or cached video |
| controls couple to world | command/chunk metrics + recorded visible response + immediate overlay | overlay movement alone |
| patch preserves world | same session id/reference/prompt hash + changed turn command/state | similar-looking seed |
| speech path works | real Chrome mic run + injected E2E branches | typing the phrase only |
| fallback is honest | visible fallback level and operator rehearsal | hidden catch block |
| cartridge is local | network log has no post-win model call + PNG download | screenshot only |
| app is demo ready | three <180s complete rehearsals + fresh full checks | one successful run or prior output |

## Risks, kill criteria, and bounded responses

1. **LingBot/proxy mismatch.** Increase ring size, simplify route, calibrate prompt/control, then test Dash. Kill if camera-centric play still feels disconnected.
2. **World latency destroys agency.** Keep deterministic overlay immediate, slow/calibrate course, use documented chunk-paced input. Kill twitch requirements rather than mask latency.
3. **World feels decorative.** Compare live to frozen-frame playback. Require continuous generated motion to materially establish travel and changed yaw. If not, core claim fails.
4. **Kimi/Modal transport lacks required multimodal schema behavior.** Swap only environment config to another proven OpenAI-compatible model; retain server module. Never build a provider framework.
5. **Compiler is slow/generic.** Use low effort/bounded schema, one repair, parallel Reactor image staging, and fallback. Stage copy must match actual live/fallback disposition.
6. **Speech recognition fails in venue noise.** Chrome/macOS is the target; retain typed alternative and retry, rehearse permission/noise. Do not add a second transcription provider unless real evidence shows native recognition is the remaining blocker.
7. **Auto-prewarm consumes quota/credits.** One provider instance, bounded session duration, explicit disconnect, model reset instead of new session, operator metrics for session count. Never auto-retry into session storms.
8. **Token refresh or reload orphans a session.** Keep one memoized token for a demo shorter than its lifetime. Do not implement `sessions.bind` until a measured long-session/reload case requires it; reload starts a clearly new session.
9. **Canvas cannot capture the current WebRTC frame.** Prove at Gate 1 and cache checkpoint frames. If browser security blocks it, use the SDK’s raw track with an owned video element before adding recording infrastructure.
10. **Same-world replay is misunderstood as exact rewind.** Preserve same live session, image, prompt, and identity; do not claim exact spatial reset or snapshot rewind, which LingBot does not expose.
11. **Arbitrary seed quality weakens demo.** Implement broad image acceptance, but stage with the prepared fixture. Show two additional pipeline outputs as evidence; do not claim every composition is equally strong.
12. **Plan drift under many builders/agents.** Gate order, one `PROGRESS.md`, one accepted calibration/spec source, and evidence-linked deviations are authoritative. Parallel work cannot cross a failed prerequisite.

## Final completion checklist

- [ ] Every committed Gate 0–7 and 9 criterion has fresh evidence in `PROGRESS.md`.
- [ ] Gate 1 contains a recorded explicit pass decision.
- [ ] Glide only is shipped unless the documented Dash pivot occurred.
- [ ] Three compiler fixtures are recorded; no hand-edited generated JSON.
- [ ] Full fake E2E covers happy, repair, and fallback paths.
- [ ] Real Reactor + actual compiler + real Chrome speech completes end to end.
- [ ] Three timed runs are each under 180 seconds.
- [ ] Same session/reference/prompt identity survives patch; turn behavior/command doubles.
- [ ] Final cartridge is readable at 1440×900 and downloads as PNG.
- [ ] Camera/upload errors preserve user work; speech has typed recovery.
- [ ] Query-gated panel exposes no credential/raw blob.
- [ ] `pnpm check` and `pnpm test:e2e` pass from a clean install.
- [ ] Real smoke is rerun after the final relevant code change.
- [ ] Secret scan is clean; `.env.local` is untracked.
- [ ] Draft architecture remains labeled draft; delivered diagram reflects actual code and passes its own validation.
- [ ] Final response states actual model, actual fallback level, observed latency, honest limitation, and any skipped conditional stretch.
