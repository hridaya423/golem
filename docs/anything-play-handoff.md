# ANYTHING//PLAY build handoff

Status: research and product architecture complete; implementation has not started  
Prepared: 12 September 2026  
Current workspace: `/Users/hridyaagrawal/glass-annotate`  
Implementation destination: a new repository, explicitly chosen by the user

Event constraints supplied by the user:

- one-day software hackathon;
- three-minute live demo;
- no robotics hardware dependency;
- team capacity is not the limiting constraint; assume 10 or more capable builders;
- sponsor credits or access are expected across Reactor, Modal, Runware, VEED, Cognition, and Multic, but exact quotas remain unverified.

## Execution contract for the receiving agent

Read and invoke these skills by name when their trigger applies:

- `receive-handoff`: `/Users/hridyaagrawal/.agents/skills/receive-handoff/SKILL.md`; invoke first.
- `architect`: `/Users/hridyaagrawal/.agents/skills/architect/SKILL.md`; use while fixing the implementation shape.
- `test-driven-development`: `/Users/hridyaagrawal/.agents/skills/test-driven-development/SKILL.md`; use when behavioral code begins.
- `verification-before-completion`: `/Users/hridyaagrawal/.agents/skills/verification-before-completion/SKILL.md`; invoke before claiming any gate or milestone complete.

Read this file from top to bottom. Then read every file named in **Authoritative local context**. Treat the locked decisions as requirements, not suggestions. Do not restart ideation or substitute a more generic AI game generator.

Create a new repository for the implementation. Do not add ANYTHING//PLAY source code to the current Glass monorepo. Copy this handoff and the three authoritative research reports into the new repository's `docs/` directory before implementation. Create `PROGRESS.md` in the new repository and update it after every completed gate with:

- what now works;
- the exact verification command and result;
- what remains next;
- observed latency or model behavior;
- any deviation from this handoff and the evidence that forced it.

Preserve partial work. Never reset or clean a dirty tree. Do not continue past Gate 1 if renderer and mechanics do not feel like one game.

## Mission

Build a working hackathon prototype in which a broad creative input becomes a short, validated, playable game whose live visual world is rendered by a world model.

The product promise is:

> **Any idea becomes a one-minute game with its own world and rules.**

Working title:

> **ANYTHING//PLAY: give it an idea, get back a world with rules.**

The shorter stage line is:

> **Give it anything. Astra writes the rules. A world model makes it playable.**

## Hard truth

The literal promise “anything becomes any imaginable game” is not feasible with current hosted world models. LingBot produces an interactive video stream, not an authoritative map. It does not expose colliders, a navmesh, semantic entities, inventory, or exact world coordinates. Arbitrary model-written mechanics therefore cannot reliably attach to whatever geometry the model invents.

The feasible product accepts broad input but produces constrained output:

- image, including doodles, photographs, and object photos;
- one captured camera frame;
- text, after the image path works;
- a one-minute traversal game;
- one mechanic chosen from a small tested library;
- deterministic code for physics, state, goals, scoring, and winning;
- a Reactor world model for the live visual world.

Video input is deferred. The prototype may extract one representative frame, but it must not claim that a full video's motion or geometry becomes a map.

## Locked decisions

These decisions were made during research and should not be reopened without runtime evidence:

1. Implementation lives in a new repository, not the current Glass repository.
2. The prototype accepts broad creative seeds but generates short traversal microgames, not arbitrary genres.
3. GPT-6 Astra is the preferred creation-time orchestrator. Keep the boundary model-agnostic so another image-capable structured-output model can replace it.
4. Astra does not run in the frame loop. It creates or patches a game before deterministic play resumes.
5. Astra emits a constrained, executable `GameSpec`. The critical path does not execute unrestricted generated JavaScript.
6. A deterministic runtime is the canonical owner of game state, physics, goals, score, failure, and off-screen entities.
7. The world model is a live generative renderer. It is not described as the authoritative map.
8. The runtime uses a compact proxy level derived from the same creative seed.
9. LingBot World 2 with a proxy traversal engine is the first renderer path.
10. Build gliding first because it maps naturally to continuous camera movement.
11. Grappling is the visual stretch goal and enters the build only if the fixed-course coupling test passes.
12. Dash runner is the reliable fallback mechanic.
13. One live input is generated onstage. Two other examples may be prepared outputs from the same pipeline.
14. The user must be able to change one bounded rule and replay the same world with visibly different mechanics.
15. End the experience with a locally generated Game Cartridge artifact inspired by Yume's strong closing keepsake.
16. The decisive model interaction must be real. Prepared seeds and fallback `GameSpec` files are allowed; a prerecorded world-model response cannot be presented as live.

## Success definition

The prototype succeeds when a judge can provide or select an image, watch Astra produce a concise game program, see validation pass, play a short world-model-rendered challenge, change one rule, and immediately experience the changed mechanic.

A successful run visibly proves all of the following:

- the creative seed influences the world's appearance;
- the orchestrator creates a structured game program;
- the program is validated before execution;
- deterministic code owns exact mechanics and state;
- the world model produces the moving visual world;
- the game has a real goal and completion state;
- a rule patch changes play without generating a new product from scratch;
- the ending returns a keepsake containing the original input and completed game.

## Non-goals

The hackathon build does not need:

- arbitrary game genres;
- unrestricted generated code;
- exact collision against geometry invented by a video model;
- multiplayer;
- NPC dialogue;
- combat;
- inventory or crafting;
- persistent accounts;
- a public gallery;
- native iOS or Android applications;
- full video-to-game conversion;
- a custom trained state-conditioned world model;
- more than three mechanic cartridges;
- production billing, moderation, analytics, or sharing infrastructure.

Do not add these before the complete demo path is reliable.

## Product experience

### Input

The initial product accepts:

- camera capture;
- image upload;
- doodle or sketch as an image;
- optional text describing desired pace or fantasy.

Keep the screen visually spare. The user should see the seed, one optional text field, and a single **Make playable** action.

### Compilation

Keep the input visible while the system works. Present four meaningful phases:

1. **Reading the seed**
2. **Writing the rules**
3. **Testing the game**
4. **Warming the world**

These phases must correspond to real state. Never fake progress. Begin the Reactor connection before input so GPU assignment does not start after the presentation clock begins.

### Play

The world-model stream fills the screen. Ordinary UI stays minimal:

- mechanic-specific control;
- one objective line;
- checkpoint or goal count;
- reset;
- hidden operator controls for fallback and debug.

Render immediate controls and deterministic feedback above the generated video. For a glider, gates and boost feedback may be exact overlays. For grappling, the reticle, rope, anchor indicator, and release feedback must not wait for generated pixels.

### Rule patch

After the first run, accept one bounded change such as:

- halve gravity;
- double boost strength;
- increase rope length;
- add sparks on a successful grapple;
- shorten the time limit.

Astra returns a `GameSpecPatch`, not an entire replacement game. Parse, validate, and apply it. Keep the seed, world identity, and current mechanic.

### Ending: Game Cartridge

Yume's strongest design choice was not drawing-to-world generation. It was a clear arc. The player entered a child's drawing, captured six moments, and left with a Polaroid strip combining the original drawing and the visited world.

ANYTHING//PLAY needs an equivalent ending without copying the Polaroid treatment. Generate a **Game Cartridge** locally when the player finishes:

- original seed thumbnail;
- generated world frame;
- generated game title;
- mechanic;
- score or completion time;
- path trace or collected checkpoints;
- one-line rule that made the game distinctive.

Build the cartridge with browser canvas or HTML capture. Do not add an asynchronous model call after the win. The final frame of the three-minute demo should be this artifact beside the original seed.

## Inspiration and prior art

### Yume: emotional input and an earned ending

Yume won Best Filmmaking, Entertainment, Simulation App at Worlds in Action SF. It turned a child's drawing into an explorable Marble world, gave the player a six-shot Polaroid camera, and ended with a strip containing the original drawing plus six memories.

Lessons to apply:

- the user's input remains the emotional center;
- generation alone is setup;
- a short constraint creates an arc;
- the experience ends with something the user owns;
- loading can be staged as part of the fantasy, but the wait still needs honest progress.

Do not copy Yume's child-focused positioning, Marble pipeline, or six-photo mechanic. Translate the structural lesson into the Game Cartridge.

Source: https://devpost.com/software/yume-d0w8fe

### Playbox: sketch-to-game is already occupied

Playbox accepts a hand-drawn sketch plus text and creates movement, physics, hazards, collectibles, and goals. The claim “draw a game and play it” is not novel.

Differentiation required here: the same seed must become both a validated game program and the live identity of a world-model-rendered game.

Source: https://devpost.com/software/playbox-nk3x29

### Doodle World: generated worlds plus deterministic physics already exist

Doodle World accepts doodles, photos, or text, generates a world, adds deterministic Rapier physics, and combines generative media. A world-model asset pipeline beside normal game logic is not enough.

Differentiation required here: the world model remains active during play, the orchestrator writes a bounded program, and the user patches one rule in the same world.

Source: https://github.com/mongj/doodle-world

### WorldGen: typed agent-authored worlds

WorldGen uses an agent to author a typed Scene DSL, validates it, and compiles it into a deterministic Three.js world. This is strong precedent for using schemas and validators instead of raw generated code.

Differentiation required here: the runtime observation is generated live by a world model rather than rendered entirely from authored meshes and assets.

Source: https://github.com/mihirt2/world-gen

### GPT-6 Astra and Void Explorer: give the agent a laboratory

OpenAI's game-development case study used Astra to build a large procedural Three.js game. The project exposed named test scenes, state and performance counters, a `window` debug interface, screenshots, and browser tests so Astra could inspect real state instead of relying on verbal feedback.

Apply the same idea from the beginning:

- expose a small read-only debug API;
- keep repeatable seed fixtures;
- add a deterministic fake renderer;
- make every mechanic start from a named test state;
- let browser tests read state and capture the visible result.

Source: https://developers.openai.com/blog/how-to-build-games-with-astra

### Programmable World Model: direct research validation

Alaya Lab published Programmable World Model on 9 September 2026. Its architecture closely matches the core thesis here:

- a coding agent writes explicit entity state and world rules;
- a state executor advances canonical state;
- a deterministic compiler projects 3D oriented bounding boxes into conditioning maps;
- a video model renders observations;
- off-screen state and nonvisual facts remain explicit.

The paper reports 94% Count Accuracy and 98% State Accuracy on its CombatStateBench. Treat those as the authors' reported benchmark results, not evidence for this prototype.

The public repository currently contains the project page and paper materials. It lists inference code and pretrained weights on the release roadmap. Do not plan on importing their implementation.

Sources:

- https://alaya-lab.github.io/pwm/
- https://arxiv.org/abs/2609.10540
- https://github.com/AlayaLab/PWM

### American Revolution: assign each medium a job

The winning Reactor project American Revolution used splats for frozen memory, a live world model for chaos, and deterministic 3D for precise consequences. Its “degrade, never break” ladder preserved the story across live and fallback modes.

Apply the same discipline:

- deterministic code for exact rules;
- world model for open-ended visual observation;
- overlays for instant feedback;
- cached valid specs for fallback;
- prepared seed only when fresh input fails.

Source: https://devpost.com/software/american-revolution

## Event and judge context

Worlds London is a one-day hackathon with Real-Time Interactive, Narrative, World Models Overall, Mobile, and Non-Entertainment categories. The event page does not publish detailed weights or prizes.

Target category: **World Models Overall**. Real-Time Interactive is the secondary fit if multiple category entry is allowed.

Likely judge interests based on public work:

- **Davide Locatelli, Reactor:** meaningful use of model controls, sessions, and runtime rather than a prompt wrapper.
- **Seva Konjahhin, Wayve:** closed-loop action and observation, explicit evaluation, and honest simulation limits.
- **Chengxi Taylor, General Reasoning:** agents, environments, feedback, memory, and useful long-horizon behavior.
- **Jake Dickson, Multic:** accessible creation, branching decisions, shared media, and a clear story arc.

This concept can touch all four without sponsor stuffing: Astra writes the environment program, Reactor renders the world, deterministic code keeps it playable, and the creator leaves with a game artifact.

Official event: https://worlds.london/

## System architecture

### Creation path

```text
CreativeSeed
  -> Astra structured generation
  -> parse GameSpec
  -> validate GameSpec
  -> optional single repair
  -> fallback if still invalid
  -> initialize runtime
  -> initialize LingBot world
  -> ready
```

### Frame path

```text
PlayerInput
  -> deterministic mechanic step
  -> canonical GameState
  -> immediate overlay commands
  -> camera/world commands to LingBot
  -> generated video observation
  -> composite video + overlays
```

### Patch path

```text
Patch request
  -> Astra GameSpecPatch
  -> parse patch
  -> validate patch against current GameSpec
  -> apply at a safe boundary
  -> reset mechanic state if required
  -> replay same world with changed rule
```

### State ownership

| State | Owner | Reason |
|---|---|---|
| Input bytes and preview | Input adapter | Preserve original evidence |
| Creative interpretation | Astra response | Creation-time proposal |
| World prompt | Validated `GameSpec` | One authoritative prompt |
| Proxy geometry | Validated `GameSpec` | Code needs inspectable space |
| Player physics | Runtime | Must be exact and deterministic |
| Score and goals | Runtime | Must be verifiable |
| World appearance | Reactor model | Generated observation |
| HUD and immediate effects | Overlay renderer | Must respond without model latency |
| Result cartridge | Completion state | Stable final artifact |

## Proposed data contracts

These are design sketches. Keep them small and use a runtime schema at the external boundary.

```ts
type CreativeSeed =
  | {
      kind: "image"
      id: string
      mimeType: "image/png" | "image/jpeg" | "image/webp"
      bytes: Uint8Array
      direction?: string
    }
  | {
      kind: "text"
      id: string
      text: string
    }

type MechanicKind = "glide" | "dash" | "grapple"

type Vec3 = readonly [x: number, y: number, z: number]

type ProxyEntity = {
  id: string
  kind: "start" | "goal" | "checkpoint" | "anchor" | "hazard" | "landmark"
  position: Vec3
  radius: number
  label: string
}

type WorldSpec = {
  referenceImageId: string
  prompt: string
  perspective: "first_person" | "third_person"
  landmarks: readonly string[]
}

type GlideSpec = {
  kind: "glide"
  lift: number
  drag: number
  turnRate: number
  boost: number
}

type DashSpec = {
  kind: "dash"
  speed: number
  laneWidth: number
  dashImpulse: number
}

type GrappleSpec = {
  kind: "grapple"
  gravity: number
  ropeLength: number
  releaseImpulse: number
  airControl: number
}

type MechanicSpec = GlideSpec | DashSpec | GrappleSpec

type GameRules = {
  durationSeconds: number
  requiredCheckpointIds: readonly string[]
  goalEntityId: string
  respawnBelowY: number
}

type GameSpec = {
  version: 1
  title: string
  tagline: string
  world: WorldSpec
  mechanic: MechanicSpec
  entities: readonly ProxyEntity[]
  rules: GameRules
  cartridgeLine: string
}

type GameSpecPatch = {
  mechanic?: Partial<MechanicSpec>
  cartridgeLine?: string
}
```

Do not use `Partial<MechanicSpec>` literally at the network boundary because it loses the discriminated-union guarantee. Define one patch schema per mechanic in implementation.

Parse Astra output into a trusted `ValidatedGameSpec`. Internal runtime functions should never accept raw model JSON.

## GameSpec invariants

The parser and validator must enforce:

- `version` is exactly `1`;
- one start entity exists;
- one goal entity exists;
- all IDs are unique;
- every required checkpoint exists;
- mechanic and entity requirements agree;
- grapple has at least one anchor;
- radii and positions are finite;
- physics values remain within empirically tested bounds;
- duration fits the supported microgame window;
- prompt length stays within the selected model's documented budget;
- entity count stays below the tested rendering and validation budget;
- the proxy level admits at least one route from start to goal;
- patch fields belong to the current mechanic;
- a patch cannot change world identity or replace the mechanic during the stage demo.

Do not invent final numeric bounds before Gate 1. Record values from the fixed working course, then allow a narrow range around them.

## Runtime design

Keep one direct use-case path:

```ts
const seed = await readCreativeSeed(input)
const candidate = await createGameSpec(seed)
const spec = validateOrFallback(candidate, seed)
const session = await startGame(spec)
await session.play()
```

The runtime uses a fixed timestep so mechanics remain deterministic across display frame rates. Keep generated video arrival separate from physics time.

Suggested mechanic contract:

```ts
type PlayerInput = {
  moveX: number
  moveY: number
  primary: boolean
  aimX: number
  aimY: number
}

type CameraCommand = {
  translation: Vec3
  rotation: Vec3
}

type OverlayCommand =
  | { kind: "reticle"; x: number; y: number }
  | { kind: "rope"; from: Vec3; to: Vec3 }
  | { kind: "checkpoint"; id: string; active: boolean }
  | { kind: "burst"; position: Vec3 }

type StepResult = {
  state: GameState
  camera: CameraCommand
  overlays: readonly OverlayCommand[]
}
```

A mechanic implements initialization and one deterministic step. Do not create a plugin framework before the second real mechanic exists.

## Renderer path A: LingBot World 2

Use this path first.

Documented capabilities:

- model name: `reactor/lingbot-world-2`;
- typed package: `@reactor-models/lingbot-world-2`;
- required reference image;
- hot-swappable text prompt;
- longitudinal and lateral movement;
- horizontal and vertical look;
- per-frame `set_camera_pose` control;
- 1664×960 output at a documented 48 fps;
- deterministic seed for the next run;
- commands apply at chunk boundaries;
- no inbound media tracks;
- no exposed map, navmesh, collider, or semantic entity state.

Read the exact schema before implementing `set_camera_pose`; do not guess payload fields:

https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema.md

Auth requirement:

- keep `REACTOR_API_KEY` server-side;
- exchange it for a short-lived JWT through `POST https://api.reactor.inc/tokens`;
- never ship the raw Reactor key in the browser bundle.

Default documented account limits are five concurrent sessions and ten new sessions per minute. Verify the actual event account limits in the Reactor dashboard.

## Renderer path B: X2 or SANA

This is a fallback exploration path, not the first build.

A deterministic Three.js blockout can provide exact geometry and mechanics. Its video track can then be transformed by X2 or SANA into the seed's visual identity.

Trade-off:

- geometry and code agree;
- the live world-model transform adds latency;
- the result may read as neural styling instead of a generated world;
- X2 access is described as private preview and must be confirmed;
- SANA outputs chunks and may be too delayed for twitch control.

Do not build both renderer paths during the event. Switch only if Gate 1 proves that LingBot cannot support the selected mechanic and a live transform spike already works better.

## Astra integration

Preferred model ID: `gpt-6-astra` through the OpenAI Responses API.

Documented relevant features:

- text and image input;
- structured outputs;
- function calling;
- streaming responses;
- code interpreter and hosted tools;
- no Live API support;
- no Realtime API support.

Use standard or fast processing only after measuring generation time and checking account access. Do not hard-code a model-specific response shape outside the integration module.

The system prompt must state:

- available mechanics and their real capabilities;
- current validated parameter ranges;
- maximum entity and prompt budgets;
- requirement for exactly one start and goal;
- positive instructions for visible, stage-readable mechanics;
- requirement to preserve the seed's identity;
- requirement to return only the structured schema.

Astra should receive validator errors for one repair attempt. More retries create dead time and reduce predictability.

If Astra access is unavailable, substitute another image-capable model with structured outputs. Keep the product language model-agnostic in code; the stage pitch may name the actual model used.

Astra source:

https://developers.openai.com/api/docs/models/gpt-6-astra

## Input normalization

### Image path

This is the first and required path.

- accept PNG, JPEG, or WebP;
- normalize orientation;
- resize to a model-appropriate landscape frame while preserving the original for the cartridge;
- reject undecodable input before calling paid APIs;
- compute a stable input ID for logs and fixtures;
- include optional user direction as separate text, never paint it into the image.

### Camera capture

Camera capture should produce the same image path. Do not maintain separate creation logic.

### Doodle

A doodle is an image. Astra may infer landmarks and style, but the prototype should not require a fixed color grammar. For the live stage doodle, use a prepared drawing style that has already produced a strong seed.

### Text

Text input requires a first frame before LingBot can start. Generate it through Runware or another available image model, then feed the resulting image into the same image path.

Keep text input behind the image path. Do not block Gate 1 on Runware.

### Video

Deferred. If shown at all, extract and disclose one representative frame. Do not claim full video understanding or map reconstruction.

## Mechanic cartridges

### Glide, required baseline

Player fantasy: steer through an impossible world with momentum and lift.

Why first:

- continuous camera motion matches LingBot's strongest control surface;
- large gates tolerate visual drift;
- no exact wall collision is required;
- boost and wind changes are visually legible rule patches;
- a deterministic overlay can show gates and immediate input.

Gate completion:

- a fixed image initializes LingBot;
- the runtime maintains a deterministic glider state;
- control input changes camera motion visibly;
- three gates can be crossed in order;
- the game reaches a verifiable win;
- the final world still reflects the seed.

### Dash, required fallback

Player fantasy: move through a generated route and dodge large hazards.

Use this if glide camera control works but free flight is difficult to stage. Keep collisions forgiving and lane-like.

### Grapple, gated showcase

Player fantasy: attach to impossible landmarks and swing through a generated world.

Only build after Glide passes. The visible rope and anchor markers are deterministic overlays. Proxy anchor volumes must be generous. If the rope repeatedly attaches to empty visual space, remove grappling from the demo rather than explaining the mismatch.

## Validator design

Validation runs in layers:

1. Runtime schema parsing
2. Cross-reference checks
3. Parameter bounds
4. Mechanic-specific invariants
5. Graph reachability through proxy entities
6. Short deterministic headless simulation
7. Fallback selection

Required negative fixture:

- missing goal;
- nonexistent checkpoint reference;
- NaN or out-of-range physics;
- grapple mechanic with no anchors;
- unreachable proxy goal.

Required positive fixture:

- a small glider course that completes deterministically under a known input sequence.

The validator returns structured issues such as:

```ts
type ValidationIssue = {
  path: string
  code: "schema" | "missing_reference" | "out_of_bounds" | "unreachable"
  message: string
}
```

Feed only these issues back to Astra. Never send stack traces, secrets, or internal application state.

## Reliability ladder

Build an explicit operator-selectable fallback ladder:

1. Fresh seed + live Astra + live Reactor
2. Fresh seed + cached valid mechanic template + live Reactor
3. Prepared seed + cached valid `GameSpec` + live Reactor
4. Prepared seed + deterministic proxy renderer

Level 4 no longer proves the world-model core. Use it only to finish explaining the product after a network failure, and state that the live renderer is unavailable. Never imply that it is a live world-model run.

Persist successful `GameSpec` fixtures and corresponding seed images during development. A cached spec is legitimate fallback data when the world-model interaction remains live.

## Instrumentation laboratory

Expose a read-only browser interface in development:

```ts
window.__ANYTHING_PLAY__ = {
  phase,
  gameSpec,
  gameState,
  rendererState,
  lastCameraCommand,
  metrics,
  reset,
  loadFixture
}
```

Do not expose secrets or mutation hooks in production. The exact interface may change, but tests need stable access to:

- creation phase;
- parsed and validated spec;
- active mechanic;
- player position and velocity;
- checkpoint state;
- win state;
- Reactor connection state;
- input-to-overlay latency;
- command-to-visible-world response observations;
- fallback level.

Named fixtures:

- `glide-ink-islands`
- `glide-kings-cross`
- `dash-coffee-canyon`
- `invalid-missing-goal`
- `invalid-grapple-no-anchor`

## UI direction

The interface should feel like an object becoming playable, not an AI dashboard.

### Creation screen

- large seed preview;
- one optional direction field;
- one action;
- no model selectors;
- no advanced settings.

### Compilation screen

Keep the seed visible. Reveal one concise generated decision:

```text
WORLD   Ink towers above a storm
GAME    Glide through three rings
RULE    Boost doubles after a perfect gate
GOAL    Reach the moon gate
```

Show real validation results. Avoid terminal output and generated code walls.

### Game screen

- world-model stream full bleed;
- objective in one line;
- mechanic control and immediate feedback;
- minimal checkpoint indicator;
- no chat panel;
- no persistent sidebars.

### Result screen

Use the Game Cartridge as the ending. The seed and generated world should be readable at projector distance.

## Demo script

### 0:00 to 0:12

Show the input before explaining the architecture.

> “Games normally begin with an engine and an empty scene. We begin with anything.”

Receive a doodle, photo, or camera frame.

### 0:12 to 0:30

Press **Make playable**. Keep the input visible as Astra emits the four-line game decision.

> “Astra reads the idea and writes a bounded game program: the world, mechanic, goal, and rules.”

### 0:30 to 0:45

Show the validator passing:

- schema valid;
- route reachable;
- simulation completed.

> “The game is tested before we let it run.”

### 0:45 to 1:05

The world-model stream appears.

> “Code owns the rules. Reactor generates the world we play inside.”

### 1:05 to 1:45

Complete a three-gate glide or the proven grappling route. Keep the player's input visible.

### 1:45 to 2:03

Ask a judge to choose one bounded patch. The safest prepared choice is:

> “Half gravity, double boost.”

### 2:03 to 2:23

Validate and apply the patch. Replay one section. The new arc or boost must be visibly different.

### 2:23 to 2:38

Toggle the proxy state view.

> “The video can dream. The code still remembers where everything is.”

### 2:38 to 2:55

Finish and reveal the Game Cartridge with seed, world, mechanic, score, and rule.

### 2:55 to 3:00

> “ANYTHING//PLAY. Give it an idea, get back a world with rules.”

## Build gates

Execute gates in order. Stop after a failed gate and apply its named fallback. Do not work ahead on UI polish.

### Gate 0: new repository and evidence

Actions:

1. Create a new repository for ANYTHING//PLAY.
2. Copy this handoff and the three research reports into `docs/`.
3. Create `PROGRESS.md`.
4. Add a minimal README with the one-line promise and current status.
5. Scaffold the smallest app that can host a client UI and server-only API routes.

Completion criterion:

- the new repository starts locally;
- one command runs the development server;
- secrets are read only server-side;
- copied docs open at their expected paths;
- `PROGRESS.md` records Gate 0 complete with verification output.

### Gate 1: renderer and mechanics coupling

Actions:

1. Connect to `reactor/lingbot-world-2` with a server-minted browser token.
2. Load the fixed `glide-ink-islands` reference image and prompt.
3. Render the live `main_video` track.
4. Implement a deterministic fixed-step glider state.
5. Convert glider movement into documented LingBot movement or camera commands.
6. Draw three immediate gates and complete them in order.
7. Record perceived input-to-overlay response and world response.

Completion criterion:

- the live model responds to player control;
- the fixed glider course reaches a deterministic win;
- the generated world remains visibly tied to the seed for the complete run;
- controls and model response feel like one experience in a recorded playthrough;
- a focused automated test proves the same input sequence reaches the same deterministic game state;
- `PROGRESS.md` includes the video path, observed latency, and decision to proceed or pivot.

Failure response:

- try the dash mechanic if free camera control is unstable;
- do not add Astra;
- investigate renderer path B only if a live X2 or SANA transform spike already exists and performs better.

### Gate 2: manual GameSpec

Actions:

1. Define the runtime schema.
2. Parse a hand-authored valid glider spec.
3. Construct the game from the trusted value.
4. Add an invalid fixture.

Completion criterion:

- the valid spec creates the same Gate 1 game;
- the invalid spec is rejected before runtime initialization;
- internal runtime code receives only trusted parsed data;
- tests cover both paths.

### Gate 3: validator and fallback

Actions:

1. Add cross-reference checks.
2. Add mechanic-specific bounds derived from Gate 1 evidence.
3. Add proxy reachability.
4. Add one deterministic completion simulation.
5. Add a known valid fallback spec.

Completion criterion:

- every required invalid fixture fails with a structured issue;
- the positive fixture passes;
- failed generation always resolves to a playable fallback;
- no retry loop is unbounded.

### Gate 4: Astra generation

Actions:

1. Add image input to the server-only Astra integration.
2. Request structured `GameSpec` output.
3. Parse and validate it.
4. Feed one failed candidate's issues back for one repair attempt.
5. Exercise three different seed fixtures.

Completion criterion:

- all three fixture runs end in a playable valid spec or the explicit fallback;
- no human edits generated JSON;
- raw model output is retained in development evidence but not trusted by runtime;
- API keys remain server-side;
- generation timings are recorded.

### Gate 5: live input

Actions:

1. Add image upload.
2. Add camera capture through the same image path.
3. Preserve the original bytes for the result cartridge.

Completion criterion:

- a fresh camera frame reaches the complete creation path;
- invalid images fail before model calls;
- the cartridge uses the original input rather than a recompressed generated substitute.

### Gate 6: bounded rule patch

Actions:

1. Define mechanic-specific patch schemas.
2. Ask Astra for one patch.
3. Validate it against current spec and known ranges.
4. Apply it at a safe runtime boundary.
5. Replay a named test segment.

Completion criterion:

- the same seed and world remain active;
- the patch changes one mechanic visibly;
- an invalid patch is rejected without corrupting active state;
- a browser test proves the configured parameter changed.

### Gate 7: Game Cartridge

Actions:

1. Capture a generated world frame.
2. Compose it with original seed, title, mechanic, score, path, and cartridge line.
3. Render the result locally without a final model call.

Completion criterion:

- every successful run reaches a clear result screen;
- the cartridge is readable at presentation scale;
- a deterministic fixture produces the expected fields.

### Gate 8: grapple stretch

Enter only after all previous gates pass.

Completion criterion:

- visible anchors remain close enough to proxy anchors throughout one short course;
- the immediate rope and reticle feel responsive;
- the game reaches a deterministic win repeatedly;
- no explanation is needed to excuse visible mismatch.

If it fails, ship Glide.

### Gate 9: demo hardening

Completion criterion:

- the complete live demo stays within three minutes across repeated runs;
- the first meaningful world-model output appears early enough to hold attention;
- one-key reset works;
- fallback level is visible to the operator;
- no secret appears on screen;
- fresh, cached-spec, and prepared-seed paths have each been rehearsed;
- the final frame is the Game Cartridge, not a terminal or architecture slide.

## Recommended repository shape

Prefer one Next.js TypeScript repository so browser UI and server-only token/model routes share one deployment. Keep the initial structure direct:

```text
anything-play/
  docs/
    HANDOFF.md
    anything-play-concept-report.md
    dreamwalk-concept-report.md
    worlds-london-winning-concepts.md
  public/
    fixtures/
  src/
    app/
      api/
        astra/
        reactor-token/
      page.tsx
    creation/
      create-game.ts
      creative-seed.ts
      game-spec.ts
      validate-game-spec.ts
    runtime/
      game-runtime.ts
      glide.ts
      dash.ts
      grapple.ts
      overlay.ts
    reactor/
      lingbot.ts
    result/
      game-cartridge.ts
    testing/
      debug-interface.ts
  tests/
  PROGRESS.md
  README.md
```

Do not create a generic renderer interface until a second renderer path actually exists. Keep `lingbot.ts` concrete. Do not split creation into pass-through controller, service, and repository layers.

Expected dependencies after checking current stable versions:

- Next.js, React, TypeScript;
- `@reactor-team/js-sdk`;
- `@reactor-models/lingbot-world-2`;
- OpenAI's official SDK;
- one runtime schema validator such as Zod;
- Three.js only if its vectors, camera projection, or debug proxy materially simplify Gate 1;
- Vitest for deterministic runtime and validator tests;
- Playwright for the complete creation and play path.

Do not add a physics engine before custom glider math proves insufficient. Do not add state management, component libraries, animation libraries, databases, or queues during the initial gates.

## Verification strategy

### Unit tests

- `CreativeSeed` parsing rejects invalid input.
- `GameSpec` parsing produces a trusted value.
- duplicate or missing entity IDs fail.
- mechanic parameter bounds fail correctly.
- fixed-step mechanics produce repeatable state.
- checkpoint ordering and win conditions are deterministic.
- patch schemas reject unrelated fields.
- fallback selection is deterministic.

### Integration tests

- fake Astra output to valid game;
- invalid Astra output to one repair attempt;
- failed repair to fallback;
- manual spec to game runtime;
- patch to changed runtime parameter;
- completed game to cartridge.

### Browser tests

Use a fake world renderer for deterministic CI:

- upload fixture;
- observe compile phases;
- enter ready state;
- drive a known input sequence;
- reach win;
- apply patch;
- confirm changed parameter through read-only debug state;
- render result cartridge.

Keep a separate real-Reactor smoke test that is not required for offline CI but must be run before demo readiness is claimed.

### Manual evidence

For every real model spike, save:

- seed input;
- world prompt;
- validated spec;
- short screen recording;
- observed latency notes;
- renderer or drift failure;
- selected fallback decision.

## Security and trust boundaries

- Store `OPENAI_API_KEY`, `REACTOR_API_KEY`, `RUNWARE_API_KEY`, and any Modal credentials outside source control.
- Issue short-lived Reactor browser tokens server-side.
- Treat Astra JSON as untrusted external input.
- Parse once at the boundary.
- Do not execute raw generated JavaScript.
- Cap retries, entity counts, prompt length, world duration, and numeric ranges.
- Do not send secrets, stack traces, internal environment details, or unrelated user files into model prompts.
- Restrict image MIME types and decode before paid API calls.
- Keep development debug state read-only and strip secret-bearing fields.

## Sponsor use

### Reactor

Core runtime. Use LingBot World 2 for live image-anchored generation and camera control. This sponsor must remain indispensable.

### Cognition

Use Devin with GPT-6 Astra or the available model for implementation, verification, and possibly the game-creation orchestrator. The product integration must state the actual runtime used rather than implying Devin is an API if it is not.

### Modal

Optional after the direct Next.js path works. Suitable for a validator worker, image processing, or sandboxed future mechanic code. Do not add a second deployment before it solves a measured bottleneck.

### Runware

Use for text-to-seed image generation, selected image cleanup, prepared fallback seeds, or final media polish. Keep asynchronous generation out of the immediate play loop.

### VEED

Use for submission captions or packaging. Public APIs are asynchronous and do not belong in the core interaction.

### Multic

Deferred. A future version could publish generated Game Cartridges or let players vote on rule patches. The public material does not establish a general external API, so do not block the build on it.

## Questions for sponsors

Ask Reactor:

1. Which hosted model currently gives the most reliable continuous camera control for a generated traversal game?
2. Is the full `set_camera_pose` surface enabled for hackathon accounts?
3. What input-to-visible-chunk latency should be expected from LingBot World 2 under venue conditions?
4. Are recordings enabled?
5. Can they provide a reference app or prompt harness tuned for gliding or flying?
6. Is X2 private preview available as a fallback renderer?

Ask Cognition or OpenAI access staff:

1. Is `gpt-6-astra` API access and credit available to the team?
2. If only Devin access exists, what supported integration can be used at product runtime?
3. Which lower-latency image-capable structured-output model is available as fallback?

Ask organizers:

1. May one project enter World Models Overall and Real-Time Interactive?
2. May prepared seed images and cached valid specs be used if live mechanics and world-model output remain real?
3. Is a live internet connection guaranteed during judging?

## Demo fallback disclosure

Be precise when presenting:

- Prepared input means the image was selected before the pitch.
- Cached spec means Astra created and validation accepted it before the pitch.
- Live world means Reactor generated the displayed play session during the pitch.
- Deterministic proxy means code rendered the backup when the world model was unavailable.

Never call a cached or proxy-rendered path live generation.

## Known risks and kill criteria

### Kill risk 1: renderer and proxy do not align

Signal: gates or anchors repeatedly appear detached from the visual world.

Response: enlarge and simplify overlays, switch Grapple to Glide, or test Dash. Kill the concept if even camera-centric play cannot feel connected.

### Kill risk 2: world-model latency destroys agency

Signal: user input visibly affects overlays but the world follows too late to feel playable.

Response: reduce mechanic speed, use predictive immediate feedback, or test the alternate renderer path. Kill twitch mechanics rather than hiding latency.

### Kill risk 3: world model is decorative

Signal: replacing video with a still image leaves the game essentially unchanged.

Response: make continuous camera/world generation central to route discovery and the mechanic patch. If that cannot be achieved, the project does not satisfy its core claim.

### Kill risk 4: Astra generation is slow or generic

Signal: creation waits dominate the demo, or different seeds produce the same game with renamed assets.

Response: stream concise creation state, start the world as soon as prompt data exists, use three materially different cartridges, and fall back after one repair attempt.

### Kill risk 5: arbitrary input makes the pitch dishonest

Signal: supported inputs are reduced to one carefully authored doodle while copy continues to say anything.

Response: demonstrate one fresh image and show two prepared, substantially different seeds from the same pipeline. Change the pitch to “any image or idea” if that is what the build supports.

## Decisions still open

These are implementation decisions, not invitations to redesign the product:

- final repository name;
- exact React/Next versions after checking current stable releases;
- schema library;
- whether Three.js is needed for the proxy and debug view;
- exact LingBot camera command mapping;
- numeric mechanic bounds derived from Gate 1;
- whether Glide or Grapple becomes the stage mechanic;
- whether text input fits after the image path;
- actual Astra access route;
- whether a Modal deployment solves a measured need;
- final product name and visual identity.

Resolve these with the smallest relevant spike or by asking the user when the choice changes product behavior.

## Authoritative local context

Current repository: `/Users/hridyaagrawal/glass-annotate`

This repository is Glass, an unrelated voice-to-code hackathon product. The user explicitly selected a new repository for ANYTHING//PLAY. Do not modify Glass source code for this build.

Read and copy these files into the new repository:

1. `docs/anything-play-handoff.md`  
   This file. Source of truth for execution order and locked decisions.

2. `docs/anything-play-concept-report.md`  
   Full feasibility analysis, architecture alternatives, prior art, demo, and source ledger.

3. `docs/worlds-london-winning-concepts.md`  
   Event research, judges, sponsors, model capabilities, previous winners, and original ranked concepts.

4. `docs/dreamwalk-concept-report.md`  
   Earlier image-to-world investigation. Useful for mobile input, LingBot-to-SANA relay analysis, and why image-to-world alone is insufficient.

Useful validated architecture artifacts for discarded alternatives:

- `docs/dream-act.architecture.html`
- `docs/grab-the-movie.architecture.html`
- `docs/nightmare-mode.architecture.html`
- `docs/parallax.architecture.html`
- `docs/worldcheck.architecture.html`
- `docs/dreamwalk.architecture.html`

`docs/anything-play.architecture.json` is a draft, not a delivered artifact. It failed Archify showcase desktop-readability validation because several long node sublabels projected below the minimum size. Do not cite it as validated or ship it. Rebuild a simpler architecture diagram after implementation evidence replaces the current assumptions.

No ANYTHING//PLAY implementation, package, test, or new repository exists yet.

Current Glass Git state at handoff creation:

- branch `main`, aligned with `origin/main` before research artifacts;
- latest commits: `c593f91 Tighten README and submission prose`, `eff40c8 Glass: complete hackathon build`;
- research reports and architecture artifacts are untracked;
- no tracked Glass source file has been changed by this research session.

## Source ledger

### Event

- Worlds London: https://worlds.london/
- Luma listing: https://luma.com/event/evt-imdmeUduDbBbm03

### Astra and agent creation

- GPT-6 Astra model: https://developers.openai.com/api/docs/models/gpt-6-astra
- Using GPT-6 Astra: https://developers.openai.com/api/docs/guides/latest-model
- Building games with Astra: https://developers.openai.com/blog/how-to-build-games-with-astra

### Reactor

- Docs index: https://docs.reactor.inc/llms.txt
- Model catalog: https://docs.reactor.inc/model-api-reference/overview.md
- LingBot World 2 overview: https://docs.reactor.inc/model-api-reference/lingbot-world-2/overview.md
- LingBot World 2 schema: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema.md
- LingBot World 2 prompt guide: https://docs.reactor.inc/model-api-reference/lingbot-world-2/prompt-guide.md
- Reactor sessions: https://docs.reactor.inc/concepts/sessions.md
- Reactor tracks: https://docs.reactor.inc/concepts/tracks.md
- Reactor recordings: https://docs.reactor.inc/concepts/recordings.md
- Reactor limits: https://docs.reactor.inc/resources/rate-limits.md
- Reactor custom runtime: https://docs.reactor.inc/deploy/overview.md
- X2 overview: https://docs.reactor.inc/model-api-reference/x2/overview.md
- SANA overview: https://docs.reactor.inc/model-api-reference/sana-streaming/overview.md
- SANA schema: https://docs.reactor.inc/model-api-reference/sana-streaming/schema.md

### Research and market references

- Programmable World Model: https://alaya-lab.github.io/pwm/
- Programmable World Model paper: https://arxiv.org/abs/2609.10540
- Programmable World Model repository: https://github.com/AlayaLab/PWM
- DeepMind Genie 3: https://deepmind.google/models/genie/
- Project Genie: https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/
- Runway GWM Worlds 2: https://runway.com/research/introducing-gwm-worlds-2
- Microsoft WHAM: https://www.microsoft.com/en-us/research/project/wham/
- Meta V-JEPA 2: https://ai.meta.com/research/vjepa/
- Wayve GAIA-4: https://wayve.ai/thinking/gaia-4/

### Inspiration and competitors

- Yume: https://devpost.com/software/yume-d0w8fe
- Playbox: https://devpost.com/software/playbox-nk3x29
- Doodle World: https://github.com/mongj/doodle-world
- WorldGen: https://github.com/mihirt2/world-gen
- American Revolution: https://devpost.com/software/american-revolution
- Training-Free Interactive World Models: https://devpost.com/software/training-free-interactive-world-models

### Sponsor platforms

- Modal docs: https://modal.com/docs
- Modal text-to-world example: https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/world-models/text_to_world.py
- Runware platform: https://runware.ai/docs/platform/introduction
- VEED API: https://www.veed.io/api
- Multic: https://www.multic.com/
- Multic release notes: https://studio.multic.com/release-notes

## First actions for the receiving agent

1. Invoke `receive-handoff` from `/Users/hridyaagrawal/.agents/skills/receive-handoff/SKILL.md` and read this complete file.
2. Read the three authoritative research reports.
3. Verify current Git state without cleaning it.
4. Create the new repository requested by the user.
5. Copy the handoff and research files into its `docs/` directory.
6. Create `PROGRESS.md` with Gate 0 active.
7. Verify API access without printing secrets.
8. Scaffold the smallest server-plus-client app.
9. Begin Gate 1 with the fixed Glide fixture.
10. Do not integrate Astra until Gate 1 passes.

The next decision is empirical, not conceptual:

> **Can a deterministic Glide mechanic steer a live LingBot world convincingly enough that the player experiences one game?**

Everything else waits for that answer.
