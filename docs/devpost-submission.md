# Devpost submission — Golem

Copy each block into the matching Devpost field. Everything below is grounded in `PROGRESS.md` and `docs/evidence/`; nothing claims more than was measured.

---

## Project name (≤60 chars)

```
Golem
```

## Elevator pitch

```
Give it an image. Write a word on it. Watch it move. One photo becomes a validated glide game rendered live by a world model; speak one rule and the same world plays differently.
```

Shorter alternative:

```
Give it an image. Get a world with rules — and change them with your voice.
```

---

## About the project (Markdown)

```markdown
## Give it an image. Get a world with rules.

Hand Golem a photo, a doodle, or a webcam frame. A multimodal model reads it and writes a short first-person glide game: a title, a world, three rings and a goal. A deterministic runtime plays that game while a world model renders it live, in the style of your image. When you win, you say one sentence out loud ("double the turn rate") and the same world replays under the new rule. You leave with a downloadable Game Cartridge: your image on the left, the generated world on the right, the path you flew in between.

## Inspiration

World models can now render a coherent place from one image and let you steer through it. A place is not a game, though. A game needs exact state: where you are, which gate is next, how much time is left, whether you won. LingBot World 2 gives you a video track and camera commands. It has no colliders, no map, no idea what a checkpoint is.

We wanted one image to become two things at once: an explicit, validated game program, and the live visual identity of a video-model world. And we wanted the beat most AI game generators skip: change one rule, and the world you were just in plays differently without being regenerated.

## How it works

```text
image or camera frame
  → normalized to 1664×960 WebP, SHA-256 seed id
  → in parallel: upload to LingBot World 2  +  POST to game compiler
  → Kimi K3 (Modal Shared Endpoint) returns a strict-JSON GameSpec
  → schema → references → bounds → route order → headless pilot → prompt budget
  → at most ONE repair call, then a known-valid fallback
  → live world starts; deterministic 60 Hz Glide loop starts
  → rings, HUD, timer, win drawn from deterministic state over the video
  → win → speak a rule → bounded turn-rate patch, validated, applied transactionally
  → same Reactor session replays under the new rule
  → 1600×1000 Game Cartridge rendered locally, downloadable as PNG
```

The model designs the game; code plays it. Kimi K3, on a Modal Shared Endpoint, authors a title, a world prompt with two to four concrete landmarks, five proxy entities (start, three checkpoints, goal) and four Glide multipliers. It cannot invent technical identity: the validator injects the reference image id and RNG seed. Its output is treated as `unknown`, parsed with Zod twice (a strict `json_schema` at the provider, generated from the same Zod definition, then again locally), and only a branded `ValidatedGameSpec` reaches the runtime.

Validation fails closed and still ships a game. Schema, unique ids, resolved references, finite numbers inside the calibrated envelope, checkpoints monotonic in forward *z*, a headless pilot that completes the course inside the time limit, and a composed LingBot prompt under 2,000 characters. A failed candidate gets one repair turn with structured issues attached (at most 16, 160 characters each); if that fails too, a known-valid fallback loads. Nothing unvalidated ever initialises the runtime.

Gameplay is deterministic even though the world is generative. A fixed-step (1/60 s) Glide core owns pose, speed, checkpoint order, timer, respawn and win. Gate crossings use segment–sphere intersection so a fast frame cannot tunnel through a ring; the same 1,800 inputs produce byte-identical state every run. The LingBot stream fills the viewport and the rings, `0/3` counter and timer are drawn over it from runtime state alone. Turn and pitch map to `set_look_horizontal` and `set_look_vertical`, and every latched Reactor control is released on blur, hidden tab, win, error and unmount.

The patch keeps the world. After the original win, Chrome speech recognition auto-submits its final transcript. A second, text-only model call returns a strict patch that can do exactly one thing: multiply Glide turn rate by a bounded factor. The runtime multiplier and Reactor `set_rotation_speed_deg` update together, the seed, world, entities and live session stay put, and the patched replay starts on its own. `Type instead` is always one click away.

The patched win captures a live frame and composes a 1600×1000 cartridge in the browser: original seed, generated world, title, `GLIDE`, completion time, path trace, `TURN RATE ×2`, and the caption the model wrote. No final model call, nothing persisted, essential text mirrored in semantic DOM.

## What we measured

- Compiler, image to GameSpec, on three materially different seeds: 8.5 s / 5.1 s / 6.3 s. All three validated on the first try; no repair needed.
- Spoken patch: 1.8 s / 1.8 s / 1.3 s. "Double the turn rate" gave ×2, "make it turn way slower and smoother" gave ×0.5.
- Make playable to first live frame: 9.8 s and 11.2 s with pool capacity, 50 s once when auto-retry had to wait for a slot.
- Input to overlay: 8 ms. Command to next `chunk_complete`: 1.0–2.0 s, each mapped action confirmed in the chunk's `active_action`.
- A 2 s held turn at `rotation_speed_deg 6` swung the world about 90°, so we recalibrated runtime yaw to 0.78 rad/s to match the stream.
- 20 `node:test` cases and a Playwright fake-world flow run with zero paid calls; an opt-in `REAL_REACTOR=1` spec records live sessions.

## Challenges

The world lags the rules. LingBot responds one to two chunks (1–2 s) after a command. No prompt fixes that, so the architecture absorbs it: the overlay is the collision truth and the stream is appearance only.

Reactor's shared pool intermittently returned HTTP 429 "no available capacity" (2 of 4 attempts on one run). The SDK gives up after three fast retries, so we replaced those with a slow reconnect every 8 s and kept the refusals in the evidence folder.

One bug fit in one line. Reactor returns `expires_at` in epoch seconds; we read it as milliseconds, so every request re-minted a token and later session calls 403'd. Multiply by 1000.

Calibration was empirical. Base speed, yaw rate, ring radii, spacing and course duration were tuned against the real stream and live in one `GLIDE_CALIBRATION` constant.

And we cut scope hard. "Anything becomes any game" is not achievable on a hosted video world model in one day. "Any image becomes a validated glide game with its own world, and you can change its rules" is, so that is what we built. Glide is the only mechanic; no generated JavaScript, no physics engine, no Three.js.

## What we learned

Don't run model-written code on the critical path. A declarative, bounded, twice-parsed spec still counts as the model writing the game program; the program just has no authority outside the game.

Model events are the source of truth for a live session. Sending a command means nothing until the model acknowledges it.

A headless pilot is the best validator we have. If code cannot finish the course, a judge cannot either.

Truthful progress beats fake progress. The four staging rows (Reading the seed / Writing the rules / Testing the game / Warming the world) show real states, including "repaired" and "fallback".

## What's next

Camera-pose translation for boost feedback, a second mechanic (Grapple) once its spatial grounding is trustworthy, and a shareable cartridge gallery.
```

---

## Built with (tags, ≤25)

```


```

Optional extras if the field allows more: `runware` (fixture seeds were generated with it), `json-schema`.

---

## "Try it out" links

- **Code:** push this repo to GitHub first — there is currently no `origin` remote. Then paste the repository URL.
- **Live demo:** none — the plan deliberately targets a local Chrome/macOS demo with server-only credentials. Either leave blank or link the demo video once recorded.

---

## Image gallery (3:2 preferred, ≤5 MB each)

Use, in this order:

1. `docs/evidence/gate-1/live-play.png` — live LingBot world with deterministic rings and HUD (the hero shot).
2. `docs/evidence/gate-1/live-00-straight.png` → `live-02-turning-2s.png` — the world visibly turning under a held input (pick two).
3. `public/fixtures/glide-neon-canyon.webp` and `glide-red-canyon.webp` — two other seeds the same pipeline compiled (convert WebP → PNG/JPG; Devpost does not accept WebP).
4. A fresh cartridge screenshot from a **live** run. Do **not** use `docs/evidence/gate-7/result.png` — it shows the "FAKE WORLD — NOT LIVE GENERATION" badge.

Also worth capturing before submitting: the compilation surface with all four rows passed and the WORLD / GAME / RULE / GOAL decision, and the `TURN RATE ×2` beat.

---

## Video demo link

Record later. Suggested 3-minute beat sheet from the plan: seed in → four truthful stages → play the course → win → speak "double the turn rate" → patched replay → 2-second operator reveal (`?operator=1`) → cartridge beside the original seed.
