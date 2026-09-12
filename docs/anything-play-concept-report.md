# ANYTHING//PLAY concept report

Research date: 12 September 2026

## Executive verdict

The broad idea is good. The literal promise is not feasible.

> **Feasible:** give the system a doodle, photograph, video, object, or sentence and receive a short playable game that preserves the input's identity.

> **Not feasible:** give it anything and reliably receive any imaginable game, with arbitrary generated mechanics perfectly grounded in a hosted video world model.

The strongest version accepts broad input but produces a narrow output: a polished one-minute microgame selected from a few mechanics that work with real-time world-model controls. GPT-6 Astra acts as the pre-play game designer and compiler. A deterministic runtime owns physics, state, scoring, and winning. A Reactor world model renders the playable visual world.

The clean pitch is:

> **Give it anything. Astra writes the rules. A world model makes it playable.**

A stronger, more honest version is:

> **Any idea becomes a one-minute game with its own world and rules.**

This can compete for World Models Overall if the model is visibly rendering the live game rather than generating a backdrop or intro clip. It has more upside than Dreamwalk, but substantially more integration risk.

## What “anything” should mean

The system can accept several forms of creative seed:

| Input | What the system extracts | Suitable use |
|---|---|---|
| Doodle | composition, landmarks, symbols, style | level shape and art direction |
| Photograph | place, subjects, materials, mood | environment and character theme |
| Short video | motion, setting, performer, style | action premise and visual reference |
| Text | world, fantasy, objective | generate a first frame, then a world |
| Object photo | silhouette, material, implied action | character, vehicle, tool, or world motif |
| Audio description | transcribed premise and tone | hands-free text input |

“Anything” should describe the input surface, not unlimited output capability. The system still needs to turn every seed into a known, testable game shape.

## Recommended product definition

ANYTHING//PLAY is an imagination-to-microgame compiler. A user provides one seed and optionally one sentence about how it should feel. The orchestrator decides what the seed represents, selects a mechanic, creates a goal, writes a bounded game specification, and validates it. The world model then renders the world while a deterministic engine runs the game underneath.

A photograph of King's Cross might become a rooftop gliding challenge. A doodle of floating circles might become a grappling course. A video of a dog chasing a ball might become a short pursuit game. A picture of a coffee cup could become a tiny vehicle circling a ceramic canyon.

The games share one production constraint: they are short traversal challenges, not arbitrary genres.

## The central architecture decision

Do not ask one model to own the whole product.

```text
arbitrary creative seed
          |
          v
   seed normalizer
          |
          v
 GPT-6 Astra orchestrator
    /                \
   v                  v
WorldSpec           GameSpec
visual identity     state, rules, goal
   |                  |
   v                  v
world model      validator + runtime
    \                /
     v              v
       playable microgame
```

The responsibilities are deliberately separate:

- Astra understands the input and writes the game program.
- The validator decides whether that program is legal and playable.
- The runtime owns exact game state.
- The world model produces the changing visual observation.
- A small immediate layer draws anything that must respond without video-model delay.

This is close to the architecture described by Alaya Lab's Programmable World Model, published on 9 September 2026. That work separates explicit state and executable rules from generative rendering. Its public repository currently lists inference code and pretrained weights on the release roadmap rather than providing them, so it is useful evidence for the architecture, not an implementation we can drop into the hackathon.

## GPT-6 Astra's role

Astra should run during game creation and controlled revisions. It should not run every frame.

The API supports image input, structured outputs, function calling, code execution tools, and streaming Responses. It does not support OpenAI's Live or Realtime endpoints. That is fine because the game loop should not depend on a slow reasoning model.

Astra receives:

- the normalized creative seed;
- a list of supported mechanics;
- the limits of the selected world-model adapter;
- the `GameSpec` schema;
- the validation errors from any rejected attempt.

It returns:

- a concise world prompt;
- a proxy level description;
- one mechanic and bounded parameters;
- entities and landmarks;
- a start state;
- a goal and failure condition;
- visual and audio direction;
- optional narrative copy.

Astra may repair a rejected specification, but retries must be capped. If it still fails, the runtime uses a built-in safe specification based on the same seed.

## Do not execute arbitrary generated code

Raw model-written JavaScript is the least bulletproof part of the proposal. Syntax errors are the mild failure. Infinite loops, network access, DOM mutation, nondeterminism, and rules that cannot be completed are worse.

Use an executable, declarative `GameSpec` instead:

```json
{
  "mechanic": "grapple",
  "worldPrompt": "An ink-drawn archipelago of floating paper islands",
  "player": {
    "gravity": 7,
    "ropeLength": 18,
    "airControl": 0.35
  },
  "entities": [
    { "id": "tower-a", "kind": "anchor", "position": [4, 7, 12] },
    { "id": "moon-gate", "kind": "goal", "position": [20, 12, 34] }
  ],
  "rules": [
    { "when": "reach:moon-gate", "do": "win" },
    { "when": "player.y<-10", "do": "respawn" }
  ]
}
```

The runtime interprets these rules. This still counts as the orchestrator writing an executable game program, but the program has no authority outside the game.

A later version may allow Astra to generate a pure mechanic function in a sandbox. That should not be required for the hackathon proof.

## The deterministic runtime

The runtime is the canonical source of truth for:

- player position and velocity;
- collisions against a lightweight proxy level;
- grapple or glider state;
- goals, checkpoints, and hazards;
- health, score, and elapsed time;
- off-screen entities;
- win and failure conditions.

This state cannot live only in LingBot. A video world model may produce plausible movement while forgetting an object, moving a landmark, or inventing geometry. The deterministic state remains inspectable and testable even when the renderer drifts.

The runtime should expose a debug view during judging. One button reveals the proxy geometry, anchor points, active mechanic, player state, and goal trigger underneath the generated image. That is how the team proves that the mechanic is code rather than a prompt asking the model to imitate gameplay.

## What the world model does

The world model supplies the part a traditional generated-game system cannot: an open-ended, visually coherent world that continues rendering as the player moves.

It should not be described as providing the authoritative map. LingBot World 2 emits video and accepts camera movement, looking, and prompt controls. It does not expose collision geometry, semantic entities, or a navmesh.

The product therefore needs two representations of one idea:

1. A compact proxy level used by game code.
2. A visual world generated from the same seed and world prompt.

The challenge is keeping those representations close enough that a player believes they are one place.

## Three renderer architectures

### A. LingBot with a proxy traversal engine

The seed image and Astra's world prompt initialize LingBot World 2. A hidden proxy level runs the mechanic. The runtime converts player velocity and camera movement into LingBot movement or `set_camera_pose` commands. A low-latency overlay draws the rope, reticle, gates, score, and hit feedback.

**Best for:** gliding, flying, driving, chasing, or a short grappling path.

**Strength:** the world model is genuinely generating the live environment.

**Weakness:** exact visual surfaces may not align with proxy collision geometry.

This is the recommended path for the hackathon.

### B. Deterministic blockout followed by X2 or SANA

Astra generates a simple Three.js game with real geometry. Its video output is passed through Reactor X2 or SANA, which transforms the blockout into the seed's visual world while preserving motion.

**Best for:** mechanics requiring exact geometry.

**Strength:** code and collisions agree because the normal engine owns the rendered source.

**Weakness:** a second video-model pass adds latency. It may feel like neural styling rather than a world model creating the world.

Use this only if the live transform is responsive enough for the selected mechanic.

### C. A true state-conditioned programmable world model

The engine would compile entity state and proxy geometry into spatial conditioning maps, then a custom video model would render those controls. This most closely follows the Programmable World Model paper.

**Strength:** explicit state and generated pixels are tightly coupled.

**Weakness:** hosted LingBot does not expose this conditioning interface. Building it requires a custom model, training or adapting a control layer, and a more complex inference stack. The published PWM implementation and weights are not currently available.

Do not choose this for a one-day hackathon.

## Mechanic families

The mechanic library is what makes broad input feasible. Astra selects and configures a tested cartridge rather than inventing an engine from nothing.

### 1. Glide

The player flies through gates toward a goal. Parameters include lift, drag, turn speed, boost, wind, and gate placement.

**Reliability:** highest. Continuous camera movement maps naturally to LingBot.

### 2. Chase

The player follows or escapes a visible subject while passing checkpoints. Parameters include speed, pursuit distance, time limit, and route events.

**Reliability:** high if the target is partly deterministic or overlaid.

### 3. Grapple

The player attaches to explicit anchors and swings through the world. Parameters include gravity, rope length, release impulse, and air control.

**Reliability:** medium to low. It has the best visual payoff but demands stronger alignment between proxy anchors and generated landmarks.

### 4. Dash runner

The player moves forward automatically, dodges large hazards, and chooses lanes or directions.

**Reliability:** high. Less novel, but a good fallback.

### Mechanics to reject initially

- precision platforming;
- melee combat;
- destructible buildings;
- object-stacking physics puzzles;
- complex inventories;
- several autonomous enemies;
- arbitrary multiplayer rules.

The more a mechanic relies on exact world geometry, the less suitable it is for an implicitly represented video world.

## The validator

The validator is the difference between a game generator and a demo that sometimes emits code.

It should check:

1. The specification matches the schema.
2. The mechanic is supported.
3. Every referenced entity exists.
4. Physics values stay within tested bounds.
5. The game has exactly one start and at least one reachable goal.
6. Respawn cannot enter an immediate failure loop.
7. A headless bot or simple search can complete the proxy level.
8. The expected session length fits the demo.
9. Rendering and entity counts stay below a fixed budget.

A failed game returns compact, structured errors to Astra. After a small retry limit, load a known mechanic with parameters inferred from the seed.

## Feasibility matrix

| Capability | Feasibility | Condition |
|---|---|---|
| Accept doodles, photos, text, and object images | High | Normalize them into one `CreativeSeed` |
| Accept arbitrary video | Medium | Use selected frames and a short description, not the entire video as a map |
| Astra creates a valid structured `GameSpec` | High | Strict schema, bounded mechanic list, validation |
| Astra writes unrestricted runtime code | Low | Too fragile and unsafe for the critical path |
| Generate a simple proxy level from an image | Medium to high | Limit geometry to boxes, paths, anchors, and goals |
| LingBot preserves the input's aesthetic | Medium | Strong seed image and prompt; style may drift |
| LingBot behaves like an exact map | Low | No exposed geometry or entity state |
| Gliding or driving through a generated world | Medium to high | Camera-centric mechanic |
| Precise grappling against generated buildings | Low to medium | Proxy anchors and immediate overlay required |
| Any input becomes one of three microgames | Medium to high | Recommended product promise |
| Any input becomes any game genre | Low | Reject this claim |
| Reliable game generation in a three-minute demo | Medium | One live generation, prepared fallback seeds, capped retries |

## Prior art and differentiation

### Playbox

Playbox already turns sketches and text into games with movement, physics, hazards, collectibles, and goals. “Sketch to game” is not a new claim.

### Doodle World

Doodle World combines doodles or photos, generated 3D worlds, deterministic Rapier physics, and generative media. It demonstrates that adding a world-model asset pipeline to a doodle game is not enough differentiation.

### WorldGen

WorldGen uses agents to author a typed Scene DSL, validates it, and compiles it into a Three.js world. That is close to the orchestrator and deterministic-engine layer proposed here.

### GPT-6 Astra game creation

OpenAI has already documented Astra building a large procedural Three.js game with tests, state instrumentation, and browser inspection. “Astra writes a game” is also not a new claim.

### Programmable World Model

Alaya Lab has now published almost the exact research thesis: a coding agent writes explicit state and rules, a deterministic compiler creates controls, and a video model renders the observation.

### What remains distinctive

ANYTHING//PLAY must combine these pieces into one visible consumer interaction:

> **The same arbitrary seed becomes both an explicit, validated game program and the live visual identity of a world-model game.**

The stronger second beat is revision:

> **The user changes one rule, Astra patches the `GameSpec`, validation runs again, and the same world immediately plays differently.**

Without the rule-patching beat, the project risks looking like another AI game generator with a more impressive renderer.

## Recommended hackathon scope

Build one runtime with three mechanic cartridges:

- glide;
- dash runner;
- grapple as the high-risk showcase.

Accept three input forms:

- image, including doodles and photographs;
- text;
- one captured camera frame.

Treat video as a post-hackathon extension. A video can be reduced to one representative frame in the prototype, but the submission should not imply that its full motion becomes a map.

The live demo should generate one game. Two other inputs can be shown as prepared examples produced by the same pipeline.

## Suggested demo

### Input

Ask a judge for a photograph or let them draw a quick scene. Add one optional sentence:

> “Make this fast and vertical.”

### Compilation

Astra returns a concise decision:

```text
WORLD: ink towers above a storm
MECHANIC: grapple
GOAL: touch three anchors and reach the moon gate
RULE PATCH: releasing at maximum tension grants a boost
```

Do not show hundreds of lines of code.

### Validation

Display three fast checks:

- schema valid;
- goal reachable;
- simulation completed.

### Play

The generated world appears. The presenter completes one short path. The rope, target feedback, checkpoint count, and win event come from deterministic code. The environment comes from the world model.

### Rule patch

The judge says:

> “Make gravity half as strong and grapples launch sparks.”

Astra emits a small patch. The validator accepts it. The presenter repeats one swing, now visibly slower and higher.

### Reveal

Toggle the state view for two seconds. Show the proxy anchors and game state beneath the generated world.

Close with:

> **“Anything can inspire a world. Now it can define the rules too.”**

## Three-minute structure

| Time | Beat |
|---|---|
| 0:00–0:15 | Receive or make the input |
| 0:15–0:35 | Astra selects a mechanic and emits `GameSpec` |
| 0:35–0:50 | Validator accepts the game |
| 0:50–1:15 | World model initializes |
| 1:15–1:55 | Play the short challenge |
| 1:55–2:20 | Judge changes one rule |
| 2:20–2:40 | Replay the changed mechanic |
| 2:40–2:50 | Reveal explicit proxy state |
| 2:50–3:00 | Original input and final game side by side |

Generation latency may make this schedule too tight. Prewarm every service, start world generation as soon as the visual prompt exists, and run validation in parallel. If the live seed is weak, use a prepared seed while keeping the mechanic patch live.

## First build gates

### Gate 1: renderer and mechanic coupling

Before calling Astra, hard-code one glider or grappling course and test:

```text
fixed image -> LingBot world -> deterministic mechanic -> camera commands -> playable response
```

If input and visual response do not feel connected, the orchestrator cannot repair the product.

### Gate 2: explicit program

Replace the hard-coded course with one manually authored `GameSpec`. Confirm that the same runtime can load different parameters without code changes.

### Gate 3: validation

Create one deliberately impossible specification. The validator must reject it and return a useful reason. Then confirm that a valid fallback always loads.

### Gate 4: Astra generation

Give Astra three substantially different seeds. All three outputs must parse, validate, and produce a game without human code edits.

### Gate 5: live rule patch

Change one bounded parameter during the demo flow. The patch must preserve the world and change the mechanic visibly.

## Failure modes

### Visual world and proxy map disagree

The rope attaches to empty air or a collision occurs before the visible wall.

Mitigation: use large landmarks, forgiving collision volumes, projected anchor markers, and mechanics that depend mainly on camera motion.

### The world model feels decorative

The game remains playable if the video stream is replaced by a static image.

Mitigation: require continuous world-model observations for movement and make changing camera trajectories the heart of play. Show the world model reacting to the same mechanic patch.

### The orchestrator produces generic games

Every input becomes the same runner with a new theme.

Mitigation: let Astra choose between a few genuinely different movement fantasies, but keep each cartridge deeply tuned. Three strong forms are better than ten weak ones.

### The product takes too long to create a game

Astra reasoning, image preparation, validation retries, and world initialization stack into dead time.

Mitigation: parallelize independent work, cap reasoning effort and retries, generate the world prompt first, and begin world initialization while the rest of the specification validates.

### Generated code becomes the project

The team spends the day building a sandbox and debugging model-written JavaScript.

Mitigation: use declarative `GameSpec` and a prebuilt interpreter.

### “Anything” creates impossible expectations

A judge uploads a spreadsheet and expects a strategy game, or a song and expects a rhythm game.

Mitigation: describe supported inputs clearly and promise that they become creative seeds for a microgame, not literal conversions of every property.

### Grappling fails

The strongest mechanic has the least reliable spatial grounding.

Mitigation: build gliding first. Keep grappling only if the fixed-course test passes.

## Bulletproof version

The most reliable architecture is less magical in the backend and more magical in the interaction:

1. Any supported input becomes a `CreativeSeed`.
2. Astra selects one of three mechanic cartridges.
3. Astra writes parameters, entities, goals, rules, and art direction into `GameSpec`.
4. A validator proves that the proxy game can start and finish.
5. A deterministic runtime executes it.
6. LingBot renders the live world for camera-centric mechanics.
7. Immediate overlays keep input readable.
8. A failed generation falls back to a known valid `GameSpec` built from the same seed.

This can be made dependable enough for a hackathon demo.

Arbitrary mechanics, arbitrary raw code, exact world-model collisions, and arbitrary genres cannot.

## Strategic ranking

### Original unrestricted idea

**High ambition, low credibility.** Judges will immediately ask how code knows where objects exist in a generated video world.

### Constrained ANYTHING//PLAY

**Potential top-two concept.** It has a broad consumer hook, deep technical architecture, clear use of Astra and Reactor, and a visible distinction between explicit rules and generative rendering.

I would not replace DREAM//ACT with it until Gate 1 passes. If the fixed mechanic cannot steer the world model convincingly, the rest is architecture theatre. If Gate 1 works, this may have greater winning upside because the audience can watch their own input become an actual game.

## Names

- **ANYTHING//PLAY**
- **WORLD//CODE**
- **Playmatter**
- **GameSeed**
- **RuleScape**
- **Make It Playable**

The clearest hackathon pitch is:

> **ANYTHING//PLAY: give it an idea, get back a world with rules.**

## Submission copy

### Tagline

Any idea becomes a world with playable rules.

### Short description

ANYTHING//PLAY accepts a doodle, photograph, captured frame, or written idea and compiles it into a short playable world. GPT-6 Astra interprets the seed and writes a structured `GameSpec` containing the world identity, proxy level, movement mechanic, entities, goals, and rules. A deterministic validator rejects impossible games before they run. During play, code owns physics and state while a Reactor world model generates the changing visual world. Players can revise one rule and immediately replay the same world with different mechanics.

### Honest limitation

The prototype generates short traversal games from a small set of tested mechanics. It does not claim arbitrary genre generation or exact collision against geometry invented by a video model.

## Sources

- GPT-6 Astra API model page: https://developers.openai.com/api/docs/models/gpt-6-astra
- OpenAI, Building games with Astra: https://developers.openai.com/blog/how-to-build-games-with-astra
- Reactor LingBot World 2 schema: https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema.md
- Reactor custom model runtime: https://docs.reactor.inc/deploy/overview.md
- Programmable World Model project: https://alaya-lab.github.io/pwm/
- Programmable World Model paper: https://arxiv.org/abs/2609.10540
- Programmable World Model repository: https://github.com/AlayaLab/PWM
- Playbox: https://devpost.com/software/playbox-nk3x29
- Doodle World: https://github.com/mongj/doodle-world
- WorldGen: https://github.com/mihirt2/world-gen
