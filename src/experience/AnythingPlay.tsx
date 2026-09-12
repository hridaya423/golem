"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createGlideState,
  GLIDE_CALIBRATION,
  IDLE_INPUT,
  projectPoint,
  routeOf,
  stepGlide,
  type GlideCourse,
  type GlideInput,
  type GlideState,
} from "../game/glide";
import { courseOf, type ValidatedGameSpec } from "../game/spec";
import { compileGame } from "../compiler/client";
import { clampCodePoints, DIRECTION_MAX_CODE_POINTS } from "../compiler/request";
import { fallbackSpec } from "../game/fallback";
import { loadFixtureImage } from "../seed/image";
import { composeWorldPrompt } from "../world/prompts";
import {
  controlsFromInput,
  reactorTurnDeg,
  sameControls,
  useWorldStatus,
  IDLE_CONTROLS,
  type WorldDriver,
} from "../world/world";
import { FakeWorld } from "../world/fake";
import { LingbotWorld, LiveWorldProvider } from "../world/lingbot";
import { installDebug, type DebugSnapshot } from "../testing/debug";
import { initialPhase, reducer, type Phase, type SpecSource, type StagingStepName } from "./state";
import { formatRemaining, PressButton, SeedWell, StagingSteps, StatusPill, Wordmark } from "./stages";

const MAX_FRAME_GAP = 0.1;
const MAX_FRAME_STEPS = 6;

type Hud = {
  elapsed: number;
  checkpoints: number;
  boost: boolean;
  status: GlideState["status"];
};

const KEY_TO_CONTROL: Record<string, "left" | "right" | "up" | "down" | "boost"> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  Space: "boost",
};

const CONTROL_KEYS: Record<"left" | "right" | "up" | "down", readonly string[]> = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function goalLabel(spec: ValidatedGameSpec): string {
  return spec.entities.find((e) => e.kind === "goal")?.label ?? "the goal";
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  state: GlideState,
  course: GlideCourse,
  flashUntil: number,
): void {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  const route = routeOf(course);
  for (let i = state.activeGate; i < route.length; i++) {
    const gate = route[i];
    const projected = projectPoint(gate.position, state, w, h);
    if (!projected) continue;
    const radius = gate.radius * projected.scale;
    const active = i === state.activeGate;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    if (active) {
      ctx.strokeStyle = "#c7ff4a";
      ctx.lineWidth = Math.max(2, h / 240);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, h / 480);
      for (let t = 0; t < 8; t++) {
        const angle = (t / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(
          projected.x + Math.cos(angle) * (radius + 6),
          projected.y + Math.sin(angle) * (radius + 6),
        );
        ctx.lineTo(
          projected.x + Math.cos(angle) * (radius + 18),
          projected.y + Math.sin(angle) * (radius + 18),
        );
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "rgba(151, 163, 157, 0.7)";
      ctx.lineWidth = Math.max(1, h / 480);
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (flashUntil > performance.now()) {
    ctx.fillStyle = "rgba(199, 255, 74, 0.12)";
    ctx.fillRect(0, 0, w, h);
  }
}

export function AnythingPlay({
  mode,
  operator,
  compiler,
}: {
  mode: "fake" | "live";
  operator: boolean;
  compiler: "on" | "off";
}) {
  const [phase, dispatch] = useReducer(reducer, initialPhase);
  const [driver, setDriver] = useState<WorldDriver | null>(null);
  const [direction, setDirection] = useState("");
  const [hud, setHud] = useState<Hud>({ elapsed: 0, checkpoints: 0, boost: false, status: "running" });
  const worldStatus = useWorldStatus(driver);

  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });
  const driverRef = useRef<WorldDriver | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const heldKeysRef = useRef(new Set<string>());
  const heldPointerRef = useRef(new Set<string>());
  const inputRef = useRef<GlideInput>(IDLE_INPUT);
  const lastControlsRef = useRef(IDLE_CONTROLS);
  const runRef = useRef<GlideState | null>(null);
  const keyDownAtRef = useRef<number | null>(null);
  const flashUntilRef = useRef(0);
  const stageStartAtRef = useRef<number | null>(null);
  const inputToOverlayRef = useRef<number[]>([]);
  const seedRequestedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleDriver = useCallback((next: WorldDriver) => {
    driverRef.current = next;
    setDriver(next);
  }, []);

  const currentInput = useCallback((): GlideInput => {
    const keys = heldKeysRef.current;
    const pointers = heldPointerRef.current;
    const held = (control: "left" | "right" | "up" | "down") =>
      CONTROL_KEYS[control].some((code) => keys.has(code)) || pointers.has(control);
    return {
      turn: (held("right") ? 1 : 0) - (held("left") ? 1 : 0),
      pitch: (held("up") ? 1 : 0) - (held("down") ? 1 : 0),
      boost: keys.has("Space") || pointers.has("boost"),
    };
  }, []);

  const pushControls = useCallback(() => {
    const input = currentInput();
    inputRef.current = input;
    const controls = controlsFromInput(input);
    if (!sameControls(controls, lastControlsRef.current)) {
      lastControlsRef.current = controls;
      driverRef.current?.setControls(controls);
    }
  }, [currentInput]);

  const releaseAll = useCallback(() => {
    heldKeysRef.current.clear();
    heldPointerRef.current.clear();
    inputRef.current = IDLE_INPUT;
    lastControlsRef.current = IDLE_CONTROLS;
    driverRef.current?.stopControls();
  }, []);

  const holdPointer = useCallback(
    (control: string, held: boolean) => {
      const set = heldPointerRef.current;
      const changed = held ? !set.has(control) : set.has(control);
      if (!changed) return;
      if (held) set.add(control);
      else set.delete(control);
      if (held) keyDownAtRef.current = performance.now();
      pushControls();
    },
    [pushControls],
  );

  useEffect(() => {
    if (seedRequestedRef.current) return;
    seedRequestedRef.current = true;
    loadFixtureImage()
      .then((seed) => dispatch({ type: "SEED_LOADED", seed }))
      .catch((error: unknown) =>
        dispatch({ type: "SEED_FAILED", message: error instanceof Error ? error.message : String(error) }),
      );
  }, []);

  const stagingRunRef = useRef(0);

  useEffect(() => {
    if (phase.name !== "staging") return;
    if (stagingRunRef.current !== 0) return;
    const runId = ++stagingRunRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    stageStartAtRef.current = performance.now();
    const stillRunning = () =>
      stagingRunRef.current === runId && phaseRef.current.name === "staging";
    const progress = (
      step: StagingStepName,
      status: "active" | "passed" | "repairing" | "fallback" | "failed",
      detail?: string,
    ) => {
      if (!stillRunning()) return;
      dispatch({
        type: "STAGE_STEP",
        name: step,
        status: status === "repairing" ? "active" : status,
        detail: status === "repairing" ? "Repairing the rules" : detail,
      });
    };
    const run = async () => {
      let spec = phase.spec;
      let source: SpecSource | null = phase.source;
      let label: string | null = phase.label;
      let checks = phase.checks;
      if (!spec) {
        if (compiler === "off") {
          progress("rules", "fallback", "Compiler disabled");
          progress("testing", "fallback", "Compiler disabled");
          spec = fallbackSpec(phase.seed);
          source = "fallback";
          label = "offline";
        } else {
          const outcome = await compileGame(
            phase.seed,
            phase.direction,
            (p) => progress(p.step, p.status, p.detail),
            controller.signal,
          );
          spec = outcome.spec;
          source = outcome.source;
          label = outcome.label;
          checks = outcome.checks;
        }
        if (!stillRunning()) return;
        dispatch({ type: "COMPILED", spec, source, label, checks });
      }
      progress("warming", "active");
      let target = driverRef.current;
      const deadline = performance.now() + 5000;
      while (!target && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        target = driverRef.current;
      }
      if (!target) throw new Error("World driver unavailable");
      await target.stage({
        image: phase.seed,
        prompt: composeWorldPrompt(spec.world.basePrompt, spec.world.landmarks),
        seed: spec.world.seed,
      });
      if (stillRunning()) dispatch({ type: "STAGED" });
    };
    run().catch((error: unknown) => {
      if (!stillRunning()) return;
      progress("warming", "failed");
      dispatch({ type: "FAIL", message: error instanceof Error ? error.message : String(error) });
    });
  }, [phase, compiler]);

  useEffect(() => {
    if (phase.name === "staging") return;
    stagingRunRef.current = 0;
    abortRef.current?.abort();
    abortRef.current = null;
  }, [phase]);

  useEffect(() => {
    if (phase.name !== "playing") return;
    const down = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const control = KEY_TO_CONTROL[event.code];
      if (!control) return;
      event.preventDefault();
      if (event.repeat) return;
      heldKeysRef.current.add(event.code);
      keyDownAtRef.current = performance.now();
      pushControls();
    };
    const up = (event: KeyboardEvent) => {
      if (heldKeysRef.current.delete(event.code)) pushControls();
    };
    const clear = () => releaseAll();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    };
  }, [phase, pushControls, releaseAll]);

  useEffect(() => {
    if (phase.name !== "playing") return;
    const course = courseOf(phase.spec);
    const world = driverRef.current;
    let state = createGlideState(course);
    runRef.current = state;
    world?.setTurnRate(reactorTurnDeg(phase.spec.mechanic.turnRate));
    world?.setControls(controlsFromInput(inputRef.current));
    lastControlsRef.current = controlsFromInput(inputRef.current);

    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    const resize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    resize();
    const observer = canvas ? new ResizeObserver(resize) : null;
    if (canvas && observer) observer.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastHudAt = 0;
    let ended = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const gap = Math.min((now - last) / 1000, MAX_FRAME_GAP);
      last = now;
      accumulator += gap;
      let steps = 0;
      while (accumulator >= GLIDE_CALIBRATION.step && steps < MAX_FRAME_STEPS) {
        state = stepGlide(state, inputRef.current, course);
        if (state.event) flashUntilRef.current = now + 180;
        accumulator -= GLIDE_CALIBRATION.step;
        steps += 1;
        if (state.status !== "running") break;
      }
      if (steps === MAX_FRAME_STEPS) accumulator = 0;
      runRef.current = state;
      if (ctx) drawRoute(ctx, state, course, flashUntilRef.current);
      const keyDownAt = keyDownAtRef.current;
      if (keyDownAt !== null) {
        inputToOverlayRef.current = [...inputToOverlayRef.current.slice(-19), now - keyDownAt];
        keyDownAtRef.current = null;
      }
      if (now - lastHudAt >= 100 || state.status !== "running") {
        lastHudAt = now;
        setHud({
          elapsed: state.elapsed,
          checkpoints: state.completed.filter((id) =>
            course.rules.requiredCheckpointIds.includes(id),
          ).length,
          boost: inputRef.current.boost,
          status: state.status,
        });
      }
      if (state.status !== "running" && !ended) {
        ended = true;
        world?.stopControls();
        dispatch({
          type: "RUN_ENDED",
          outcome: state.status,
          elapsed: state.elapsed,
          checkpoints: state.completed.filter((id) =>
            course.rules.requiredCheckpointIds.includes(id),
          ).length,
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      releaseAll();
    };
  }, [phase, releaseAll]);

  const getSnapshot = useCallback((): DebugSnapshot => {
    const currentPhase = phaseRef.current;
    const run = runRef.current;
    const world = driverRef.current?.getStatus() ?? {
      kind: mode,
      connection: "disconnected" as const,
      hasImage: false,
      hasPrompt: false,
      generating: false,
      chunk: 0,
    };
    const spec = "spec" in currentPhase && currentPhase.spec ? currentPhase.spec : null;
    const source = "source" in currentPhase ? currentPhase.source : null;
    const checks = "checks" in currentPhase ? currentPhase.checks : [];
    return {
      phase: currentPhase.name,
      mode,
      fallbackLevel: mode === "fake" ? 4 : source === "fallback" ? 3 : 1,
      spec: spec
        ? {
            title: spec.title,
            referenceImageId: spec.referenceImageId,
            seed: spec.world.seed,
            turnRate: spec.mechanic.turnRate,
            source: source ?? "unknown",
            checks:
              checks.length > 0
                ? `${checks.filter((c) => c.ok).length}/${checks.length}`
                : null,
          }
        : null,
      run: run
        ? {
            status: run.status,
            elapsed: run.elapsed,
            activeGate: run.activeGate,
            completed: [...run.completed],
            position: run.position,
            yaw: run.yaw,
            pitch: run.pitch,
            speed: run.speed,
            respawns: run.respawns,
          }
        : null,
      world,
      metrics: {
        inputToOverlayMs: [...inputToOverlayRef.current],
        commandToChunkMs:
          world.lastChunkAt !== undefined && world.lastCommandAt !== undefined
            ? world.lastChunkAt - world.lastCommandAt
            : null,
        firstFrameMs:
          world.firstFrameAt !== undefined && stageStartAtRef.current !== null
            ? world.firstFrameAt - stageStartAtRef.current
            : null,
      },
    };
  }, [mode]);

  useEffect(() => {
    if (!operator && mode !== "fake") return;
    return installDebug(getSnapshot);
  }, [operator, mode, getSnapshot]);

  const playing = phase.name === "playing";
  const finished = phase.name === "finished";
  const playSpec = (playing || finished) && "spec" in phase ? phase.spec : null;
  const playCourse = playSpec ? courseOf(playSpec) : null;
  const sourceLabel = (source: SpecSource, label: string) =>
    source === "fallback" ? "Prepared game (compiler unavailable)" : `${source === "live" ? "Live" : "Repaired"} rules · ${label}`;

  return (
    <div className="experience">
      <div className="world-host" aria-hidden="true">
        {mode === "fake" ? (
          <FakeWorld onDriver={handleDriver} />
        ) : (
          <LiveWorldProvider>
            <LingbotWorld onDriver={handleDriver} />
          </LiveWorldProvider>
        )}
      </div>

      {(playing || finished) && <canvas ref={overlayRef} className="overlay-canvas" />}

      {mode === "fake" && <p className="badge">FAKE WORLD — not live generation</p>}

      {phase.name === "input" && (
        <main className="stage">
          <Wordmark />
          <SeedWell seed={phase.seed} />
          <input
            className="direction"
            aria-label="Direction (optional)"
            placeholder="Optional direction for the compiler…"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={!phase.seed}
            onClick={() =>
              dispatch({
                type: "MAKE_PLAYABLE",
                direction: clampCodePoints(direction, DIRECTION_MAX_CODE_POINTS),
              })
            }
          >
            Make playable
          </button>
          {phase.error && (
            <p role="alert" className="error-text">
              {phase.error}
            </p>
          )}
          {mode === "live" && <StatusPill status={worldStatus} />}
        </main>
      )}

      {phase.name === "staging" && (
        <main className="stage">
          <Wordmark />
          <SeedWell seed={phase.seed} />
          <StagingSteps
            steps={phase.steps}
            warmingLabel={mode === "fake" ? "Warming the offline world" : "Warming the world"}
          />
        </main>
      )}

      {phase.name === "ready" && (
        <main className="stage">
          <Wordmark />
          <SeedWell seed={phase.seed} />
          <h2>{phase.spec.title}</h2>
          <p className="muted">{phase.spec.tagline}</p>
          <dl className="decision">
            <div>
              <dt>WORLD</dt>
              <dd>{phase.spec.world.landmarks[0].description}</dd>
            </div>
            <div>
              <dt>GAME</dt>
              <dd>Glide</dd>
            </div>
            <div>
              <dt>RULE</dt>
              <dd>Pass 3 rings in order within {phase.spec.rules.durationSeconds}s</dd>
            </div>
            <div>
              <dt>GOAL</dt>
              <dd>{goalLabel(phase.spec)}</dd>
            </div>
          </dl>
          <p className="pill">{sourceLabel(phase.source, phase.label)}</p>
          <button type="button" className="primary" onClick={() => dispatch({ type: "START_PLAY" })}>
            Start run
          </button>
        </main>
      )}

      {playing && playCourse && playSpec && (
        <>
          <div className="hud">
            <p className="objective">Pass 3 rings, then {goalLabel(playSpec)}</p>
            <p className="hud-stats">
              <span>{hud.checkpoints}/3</span>
              <span>{formatRemaining(playCourse.rules.durationSeconds - hud.elapsed)}</span>
              {hud.boost && <span className="boost">BOOST</span>}
            </p>
          </div>
          <div className="controls">
            <div className="control-cluster">
              <PressButton name="Turn left" control="left" onHold={holdPointer}>
                ←
              </PressButton>
              <PressButton name="Turn right" control="right" onHold={holdPointer}>
                →
              </PressButton>
            </div>
            <div className="control-cluster">
              <PressButton name="Pitch up" control="up" onHold={holdPointer}>
                ↑
              </PressButton>
              <PressButton name="Pitch down" control="down" onHold={holdPointer}>
                ↓
              </PressButton>
            </div>
            <div className="control-cluster">
              <PressButton name="Boost" control="boost" onHold={holdPointer}>
                BOOST
              </PressButton>
              <button type="button" className="secondary" onClick={() => dispatch({ type: "RESET" })}>
                Stop
              </button>
            </div>
          </div>
          <p className="hint">A/D turn · W/S pitch · Space boost</p>
        </>
      )}

      {finished && (
        <main className="stage overlay-panel">
          {phase.outcome === "won" ? (
            <>
              <h2>Course complete</h2>
              <p className="muted">Finished in {phase.elapsed.toFixed(1)}s</p>
            </>
          ) : (
            <>
              <h2>Out of time</h2>
              <p className="muted">{phase.checkpoints}/3 arches cleared</p>
            </>
          )}
          <div className="action-row">
            <button type="button" className="primary" onClick={() => dispatch({ type: "RETRY" })}>
              Retry same world
            </button>
            <button type="button" className="secondary" onClick={() => dispatch({ type: "RESET" })}>
              Make another
            </button>
          </div>
        </main>
      )}

      {phase.name === "error" && (
        <main className="stage">
          <Wordmark />
          <p role="alert" className="error-text">
            {phase.message}
          </p>
          <div className="action-row">
            <button type="button" className="primary" onClick={() => dispatch({ type: "RETRY" })}>
              Retry staging
            </button>
            <button type="button" className="secondary" onClick={() => dispatch({ type: "RESET" })}>
              Back to seed
            </button>
          </div>
          {mode === "live" && <p className="muted">Play offline (fake world)</p>}
        </main>
      )}
    </div>
  );
}
