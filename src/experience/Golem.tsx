"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createGlideState,
  GLIDE_CALIBRATION,
  IDLE_INPUT,
  stepGlide,
  type GlideCourse,
  type GlideInput,
  type GlideState,
} from "../game/glide";
import { courseOf, type ValidatedGameSpec } from "../game/spec";
import { drawHoops, sampleHoopPalette, type HoopPalette } from "../game/hoops";
import { createAbilityState, releaseAbilities, stepAbilities, type AbilityInput, type AbilityState } from "../game/abilities";
import { drawAbilities } from "../game/ability-overlay";
import { compileGame } from "../compiler/client";
import { requestPatch } from "../compiler/patch";
import { clampCodePoints, DIRECTION_MAX_CODE_POINTS } from "../compiler/request";
import { fallbackCandidate } from "../game/fallback";
import { validateGameSpecCandidate } from "../game/validate";
import {
  cartridgeFilename,
  deriveCartridge,
  renderCartridge,
  type CartridgeData,
} from "../game/cartridge";
import { loadFixtureImage, prepareImage, releasePreparedImage, sha256Hex } from "../seed/image";
import { listenOnce } from "./speech";
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
import {
  fallbackLevelOf,
  installDebug,
  isFixtureSeed,
  type DebugSnapshot,
} from "../testing/debug";
import { OperatorPanel, ProofOverlay } from "./OperatorPanel";
import { initialPhase, reducer, type Phase, type SpecSource, type StagingStepName } from "./state";
import {
  CameraCapture,
  formatRemaining,
  PressButton,
  SeedWell,
  StagingSteps,
  StatusPill,
  Wordmark,
} from "./stages";

const MAX_FRAME_GAP = 0.1;
const MAX_FRAME_STEPS = 6;

type Hud = {
  elapsed: number;
  checkpoints: number;
  boost: boolean;
  status: GlideState["status"];
  speed: number;
  paused: boolean;
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

const ABILITY_KEYS: Record<string, keyof AbilityInput> = {
  ShiftLeft: "dash", ShiftRight: "dash", KeyE: "grapple", KeyF: "fire",
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

function speechFailureMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "error";
  switch (name) {
    case "unsupported":
      return "Speech recognition is not available in this browser — type your rule instead.";
    case "denied":
      return "Microphone access was declined. Type instead, or retry.";
    case "no-match":
      return "Didn't catch that — try again or type it.";
    case "aborted":
      return "Listening stopped.";
    default:
      return "Speech recognition failed — type instead or retry.";
  }
}

type PatchInfo = {
  transcript: string;
  factor: number;
  source: string;
  originalTurnRate: number;
  patchedTurnRate: number;
};

const LONG_TITLE = "Ink Islands Glide Over an Endless Archipelago of Pale Silver Moons Beyond".slice(
  0,
  64,
);

function drawRoute(
  ctx: CanvasRenderingContext2D,
  state: GlideState,
  course: GlideCourse,
  palette: HoopPalette | null,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  drawHoops(ctx, state, course, palette ?? undefined);
  const unit = height / (ctx.canvas.clientHeight || height);
  const x = width / 2, y = height / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 9 * unit, y); ctx.lineTo(x - 3 * unit, y);
  ctx.moveTo(x + 3 * unit, y); ctx.lineTo(x + 9 * unit, y);
  ctx.moveTo(x, y - 9 * unit); ctx.lineTo(x, y - 3 * unit);
  ctx.moveTo(x, y + 3 * unit); ctx.lineTo(x, y + 9 * unit);
  ctx.strokeStyle = "#070909";
  ctx.lineWidth = 3 * unit;
  ctx.stroke();
  ctx.strokeStyle = "#f4f7f5";
  ctx.lineWidth = unit;
  ctx.stroke();
  ctx.restore();
}

export function Golem({
  mode,
  operator,
  compiler,
  seed: seedPolicy,
  longTitle,
}: {
  mode: "fake" | "live";
  operator: boolean;
  compiler: "on" | "off";
  seed: "fixture" | "none";
  longTitle: boolean;
}) {
  const [phase, dispatch] = useReducer(reducer, initialPhase);
  const worldMode = mode;
  const [driver, setDriver] = useState<WorldDriver | null>(null);
  const [direction, setDirection] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [typedRule, setTypedRule] = useState("");
  const [cachedRules, setCachedRules] = useState(false);
  const [proof, setProof] = useState<DebugSnapshot | null>(null);
  const [adventure, setAdventure] = useState(false);
  const [abilityHud, setAbilityHud] = useState<AbilityState | null>(null);
  const [hud, setHud] = useState<Hud>({ elapsed: 0, checkpoints: 0, boost: false, status: "running", speed: 0, paused: false });
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
  const abilitiesRef = useRef<AbilityState | null>(null);
  const controlsSuspendedRef = useRef(false);
  const lastControlsRef = useRef(IDLE_CONTROLS);
  const runRef = useRef<GlideState | null>(null);
  const keyDownAtRef = useRef<number | null>(null);
  const hoopPaletteRef = useRef<HoopPalette | null>(null);
  const stageStartAtRef = useRef<number | null>(null);
  const inputToOverlayRef = useRef<number[]>([]);
  const seedRequestedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const patchedFrameRef = useRef<Blob | null>(null);
  const patchInfoRef = useRef<PatchInfo | null>(null);
  const sessionIdBeforeRef = useRef<string | undefined>(undefined);
  const sessionIdAfterRef = useRef<string | undefined>(undefined);
  const worldPromptHashRef = useRef<string | null>(null);
  const cachedRulesRef = useRef(false);
  const specHashRef = useRef<string | null>(null);
  const compileElapsedRef = useRef<number | null>(null);
  const proofTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acceptSeed = useCallback((source: Blob, name: string) => {
    prepareImage(source, name)
      .then((prepared) => {
        const previous = phaseRef.current.name === "input" ? phaseRef.current.seed : null;
        dispatch({ type: "SEED_REPLACED", seed: prepared });
        if (previous && previous !== prepared) releasePreparedImage(previous);
      })
      .catch((error: unknown) =>
        dispatch({
          type: "SEED_REJECTED",
          message: error instanceof Error ? error.message : "Could not read that image.",
        }),
      );
  }, []);

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

  const currentAbilities = useCallback((): AbilityInput => {
    const keys = heldKeysRef.current;
    const pointers = heldPointerRef.current;
    return {
      dash: keys.has("ShiftLeft") || keys.has("ShiftRight") || pointers.has("dash"),
      grapple: keys.has("KeyE") || pointers.has("grapple"),
      fire: keys.has("KeyF") || pointers.has("fire"),
    };
  }, []);

  const pushControls = useCallback(() => {
    controlsSuspendedRef.current = false;
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
    controlsSuspendedRef.current = true;
    if (abilitiesRef.current) abilitiesRef.current = releaseAbilities(abilitiesRef.current);
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

  const loadFixture = useCallback(() => {
    loadFixtureImage()
      .then((seed) => dispatch({ type: "SEED_REPLACED", seed }))
      .catch((error: unknown) =>
        dispatch({ type: "SEED_REJECTED", message: error instanceof Error ? error.message : String(error) }),
      );
  }, []);

  useEffect(() => {
    if (seedRequestedRef.current || seedPolicy !== "fixture") return;
    seedRequestedRef.current = true;
    loadFixtureImage()
      .then((seed) => dispatch({ type: "SEED_LOADED", seed }))
      .catch((error: unknown) =>
        dispatch({ type: "SEED_FAILED", message: error instanceof Error ? error.message : String(error) }),
      );
  }, [seedPolicy]);

  const stagingRunRef = useRef(0);

  useEffect(() => {
    if (phase.name !== "staging") return;
    if (stagingRunRef.current !== 0) return;
    const runId = ++stagingRunRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    stageStartAtRef.current = performance.now();
    patchInfoRef.current = null;
    sessionIdBeforeRef.current = undefined;
    sessionIdAfterRef.current = undefined;
    worldPromptHashRef.current = null;
    patchedFrameRef.current = null;
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
      const palette = await sampleHoopPalette(phase.seed.normalized);
      if (!stillRunning()) return;
      hoopPaletteRef.current = palette;
      let spec = phase.spec;
      let source: SpecSource | null = phase.source;
      let label: string | null = phase.label;
      let checks = phase.checks;
      if (!spec) {
        if (compiler === "off" || cachedRulesRef.current) {
          const detail = compiler === "off" ? "Compiler disabled" : "Cached rules selected";
          progress("rules", "fallback", detail);
          progress("testing", "fallback", detail);
          const fallback = fallbackCandidate(phase.seed);
          const candidate = longTitle ? { ...fallback, title: LONG_TITLE } : fallback;
          const result = validateGameSpecCandidate(candidate, phase.seed);
          if (!result.ok) throw new Error("Prepared game failed validation");
          spec = result.spec;
          source = "fallback";
          label = compiler === "off" ? "offline" : "cached";
          checks = result.checks;
        } else {
          const startedAt = performance.now();
          const outcome = await compileGame(
            phase.seed,
            phase.direction,
            (p) => progress(p.step, p.status, p.detail),
            controller.signal,
          );
          compileElapsedRef.current = performance.now() - startedAt;
          spec = outcome.spec;
          source = outcome.source;
          label = outcome.label;
          checks = outcome.checks;
        }
        if (!stillRunning()) return;
        dispatch({ type: "COMPILED", spec, source, label, checks });
      }
      const staged = spec;
      specHashRef.current = (await sha256Hex(new TextEncoder().encode(JSON.stringify(staged)))).slice(0, 8);
      progress("warming", "active");
      let target = driverRef.current;
      const deadline = performance.now() + 5000;
      while (!target && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        target = driverRef.current;
      }
      if (!target) throw new Error("World driver unavailable");
      const prompt = composeWorldPrompt(staged.world.basePrompt, staged.world.landmarks);
      worldPromptHashRef.current = await sha256Hex(new TextEncoder().encode(prompt));
      await target.stage({ image: phase.seed, prompt, seed: staged.world.seed });
      if (stillRunning()) dispatch({ type: "STAGED" });
    };
    run().catch((error: unknown) => {
      if (!stillRunning()) return;
      progress("warming", "failed");
      dispatch({ type: "FAIL", message: error instanceof Error ? error.message : String(error) });
    });
  }, [phase, compiler, longTitle]);

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
      const control = KEY_TO_CONTROL[event.code] ?? (adventure ? ABILITY_KEYS[event.code] : undefined);
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
  }, [phase, adventure, pushControls, releaseAll]);

  useEffect(() => {
    if (phase.name !== "playing") return;
    const course = courseOf(phase.spec);
    const world = driverRef.current;
    let state = createGlideState(course);
    runRef.current = state;
    controlsSuspendedRef.current = false;
    abilitiesRef.current = adventure ? createAbilityState(course) : null;
    world?.setTurnRate(reactorTurnDeg(phase.spec.mechanic.turnRate));
    world?.setControls(controlsFromInput(inputRef.current));
    lastControlsRef.current = controlsFromInput(inputRef.current);
    if (phase.run === "patched") {
      patchedFrameRef.current = null;
      sessionIdAfterRef.current = world?.getStatus().sessionId;
    }

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
      accumulator = controlsSuspendedRef.current ? 0 : accumulator + gap;
      let steps = 0;
      while (accumulator >= GLIDE_CALIBRATION.step && steps < MAX_FRAME_STEPS) {
        let input = inputRef.current;
        let speedMultiplier = 1;
        if (abilitiesRef.current) {
          const next = stepAbilities(abilitiesRef.current, currentAbilities(), state, course);
          abilitiesRef.current = next.abilities;
          input = {
            turn: Math.max(-1, Math.min(1, input.turn + next.input.turn)),
            pitch: Math.max(-1, Math.min(1, input.pitch + next.input.pitch)),
            boost: input.boost,
          };
          speedMultiplier = next.speedMultiplier;
          const controls = controlsFromInput({ ...input, turn: Math.abs(input.turn) > 0.05 ? input.turn : 0, pitch: Math.abs(input.pitch) > 0.05 ? input.pitch : 0 });
          if (!sameControls(controls, lastControlsRef.current)) {
            lastControlsRef.current = controls;
            world?.setControls(controls);
          }
        }
        state = stepGlide(state, input, course, speedMultiplier);
        if (state.status !== "running" && abilitiesRef.current) abilitiesRef.current = releaseAbilities(abilitiesRef.current);
        if (state.event === "gate" && phase.run === "patched") {
          void world
            ?.captureFrame()
            .then((blob) => {
              if (blob) patchedFrameRef.current = blob;
            })
            .catch(() => {});
        }
        accumulator -= GLIDE_CALIBRATION.step;
        steps += 1;
        if (state.status !== "running") break;
      }
      if (steps === MAX_FRAME_STEPS) accumulator = 0;
      runRef.current = state;
      if (ctx) {
        drawRoute(ctx, state, course, hoopPaletteRef.current);
        if (abilitiesRef.current) drawAbilities(ctx, abilitiesRef.current, state, hoopPaletteRef.current ?? undefined);
      }
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
          speed: state.speed,
          paused: controlsSuspendedRef.current,
        });
        if (adventure) setAbilityHud(abilitiesRef.current);
      }
      if (state.status !== "running" && !ended) {
        ended = true;
        world?.stopControls();
        if (phase.run === "original" && state.status === "won") {
          sessionIdBeforeRef.current = world?.getStatus().sessionId;
        }
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
  }, [phase, adventure, currentAbilities, releaseAll]);

  const runPatch = useCallback(
    async (transcript: string) => {
      const current = phaseRef.current;
      if (current.name !== "patch") return;
      dispatch({ type: "PATCH_TRANSCRIPT", transcript });
      try {
        const outcome = await requestPatch(transcript, current.spec, compiler);
        if (phaseRef.current.name !== "patch") return;
        patchInfoRef.current = {
          transcript,
          factor: outcome.patch.factor,
          source: outcome.source,
          originalTurnRate: current.originalSpec.mechanic.turnRate,
          patchedTurnRate: outcome.spec.mechanic.turnRate,
        };
        dispatch({ type: "PATCH_APPLIED", spec: outcome.spec, source: outcome.source });
      } catch (error) {
        if (phaseRef.current.name !== "patch") return;
        if (error instanceof Error && error.name === "AbortError") return;
        dispatch({
          type: "PATCH_FAILED",
          message: error instanceof Error ? error.message : "Patch failed",
        });
      }
    },
    [compiler],
  );

  useEffect(() => {
    if (phase.name !== "patch" || phase.mode !== "listening") return;
    let cancelled = false;
    const listener = listenOnce();
    listener.result
      .then((transcript) => {
        if (!cancelled) void runPatch(transcript);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({ type: "PATCH_FAILED", message: speechFailureMessage(error) });
        }
      });
    return () => {
      cancelled = true;
      listener.abort();
    };
  }, [phase, runPatch]);

  useEffect(() => {
    if (phase.name !== "patch" || phase.mode !== "applied") return;
    const timer = setTimeout(() => dispatch({ type: "START_REPLAY" }), 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase.name !== "finished" || phase.run !== "patched" || phase.outcome !== "won") return;
    let cancelled = false;
    const build = async () => {
      const run = runRef.current;
      if (!run) {
        dispatch({ type: "FAIL", message: "No finished run to record" });
        return;
      }
      let cartridge: CartridgeData;
      try {
        cartridge = deriveCartridge({
          spec: phase.spec,
          originalSpec: phase.originalSpec,
          run,
          runKind: "patched",
        });
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "FAIL",
            message: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
      const frame =
        (await driverRef.current?.captureFrame().catch(() => null)) ?? patchedFrameRef.current;
      if (!frame) {
        if (!cancelled) {
          dispatch({
            type: "CARTRIDGE_FAILED",
            cartridge,
            message: "No generated frame was captured",
          });
        }
        return;
      }
      try {
        const png = await renderCartridge(cartridge, phase.seed.original, frame);
        if (!cancelled) {
          dispatch({ type: "CARTRIDGE_READY", cartridge, pngUrl: URL.createObjectURL(png) });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({
            type: "CARTRIDGE_FAILED",
            cartridge,
            message: error instanceof Error ? error.message : "Cartridge render failed",
          });
        }
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const retryCapture = useCallback(async () => {
    const current = phaseRef.current;
    if (current.name !== "result") return;
    try {
      const frame =
        (await driverRef.current?.captureFrame().catch(() => null)) ?? patchedFrameRef.current;
      if (!frame) throw new Error("No generated frame is available yet. Wait for the world, then retry capture.");
      const png = await renderCartridge(current.cartridge, current.seed.original, frame);
      if (phaseRef.current !== current) return;
      dispatch({ type: "CARTRIDGE_RENDERED", pngUrl: URL.createObjectURL(png) });
    } catch (error) {
      if (phaseRef.current !== current) return;
      dispatch({
        type: "CARTRIDGE_FAILED",
        cartridge: current.cartridge,
        message: error instanceof Error ? error.message : "Cartridge render failed. Retry capture.",
      });
    }
  }, []);

  const resetGame = useCallback(() => {
    const current = phaseRef.current;
    if (current.name === "result" && current.pngUrl) URL.revokeObjectURL(current.pngUrl);
    dispatch({ type: "RESET" });
  }, []);

  const getSnapshot = useCallback((): DebugSnapshot => {
    const currentPhase = phaseRef.current;
    const run = runRef.current;
    const world = driverRef.current?.getStatus() ?? {
      kind: worldMode,
      connection: "disconnected" as const,
      hasImage: false,
      hasPrompt: false,
      generating: false,
      chunk: 0,
    };
    const spec = "spec" in currentPhase && currentPhase.spec ? currentPhase.spec : null;
    const source = "source" in currentPhase ? currentPhase.source ?? null : null;
    const checks = "checks" in currentPhase ? currentPhase.checks ?? [] : [];
    const patchInfo = patchInfoRef.current;
    const seed = "seed" in currentPhase ? currentPhase.seed : null;
    return {
      phase: currentPhase.name,
      mode: worldMode,
      fallbackLevel: fallbackLevelOf({ mode: worldMode, source, seedIsFixture: isFixtureSeed(seed) }),
      seedId: seed ? seed.id : null,
      worldPromptHash: worldPromptHashRef.current,
      input: inputRef.current,
      paused: controlsSuspendedRef.current,
      hoopPalette: hoopPaletteRef.current,
      abilities: adventure ? abilitiesRef.current : null,
      patch: patchInfo
        ? {
            transcript: patchInfo.transcript,
            factor: patchInfo.factor,
            source: patchInfo.source,
            originalTurnRate: patchInfo.originalTurnRate,
            patchedTurnRate: patchInfo.patchedTurnRate,
            reactorDegBefore: reactorTurnDeg(patchInfo.originalTurnRate),
            reactorDegAfter: reactorTurnDeg(patchInfo.patchedTurnRate),
            sessionIdBefore: sessionIdBeforeRef.current,
            sessionIdAfter: sessionIdAfterRef.current,
            worldPromptHash: worldPromptHashRef.current,
          }
        : null,
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
            hash: specHashRef.current,
            route: [...spec.rules.requiredCheckpointIds, spec.rules.goalEntityId].map((id) => {
              const e = spec.entities.find((entity) => entity.id === id);
              return e ? `${e.id}@${e.position.join(",")}` : id;
            }),
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
        compileMs: compileElapsedRef.current,
      },
    };
  }, [worldMode, adventure]);

  useEffect(() => {
    if (!operator && worldMode !== "fake") return;
    return installDebug(getSnapshot);
  }, [operator, worldMode, getSnapshot]);

  const [panelSnapshot, setPanelSnapshot] = useState<DebugSnapshot | null>(null);
  useEffect(() => {
    if (!operator) return;
    const tick = () => setPanelSnapshot(getSnapshot());
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [operator, getSnapshot]);

  const showProof = useCallback(() => {
    setProof(getSnapshot());
    if (proofTimerRef.current) clearTimeout(proofTimerRef.current);
    proofTimerRef.current = setTimeout(() => setProof(null), 2000);
  }, [getSnapshot]);

  const playing = phase.name === "playing";
  const finished = phase.name === "finished";
  const playSpec = (playing || finished) && "spec" in phase ? phase.spec : null;
  const playCourse = playSpec ? courseOf(playSpec) : null;
  const sourceLabel = (source: SpecSource, label: string) =>
    source === "fallback" ? "Prepared game (compiler unavailable)" : `${source === "live" ? "Live" : "Repaired"} rules · ${label}`;

  return (
    <div className="experience" data-phase={phase.name}>
      <div className="world-host" aria-hidden="true">
        {worldMode === "fake" ? (
          <FakeWorld onDriver={handleDriver} />
        ) : (
          <LiveWorldProvider>
            <LingbotWorld onDriver={handleDriver} />
          </LiveWorldProvider>
        )}
      </div>

      {(playing || finished) && <canvas ref={overlayRef} className="overlay-canvas" />}

      {worldMode === "fake" && <p className="badge">FAKE WORLD — not live generation</p>}
      {proof && <ProofOverlay snapshot={proof} />}
      {operator && panelSnapshot && (
        <OperatorPanel
          snapshot={panelSnapshot}
          live={worldMode === "live"}
          canLoadSeed={phase.name === "input"}
          cachedRules={cachedRules}
          onCachedRules={(value) => {
            cachedRulesRef.current = value;
            setCachedRules(value);
          }}
          onLoadSeed={loadFixture}
          onProof={showProof}
          onReset={() => {
            resetGame();
            void driverRef.current?.reset();
          }}
          onDisconnect={() => void driverRef.current?.disconnect()}
        />
      )}

      {phase.name === "input" && (
        <main className="stage stage-input">
          <Wordmark />
          <div className="seed-pane">
            {cameraOpen ? (
              <CameraCapture
                onCapture={(blob) => {
                  setCameraOpen(false);
                  acceptSeed(blob, "camera-capture.png");
                }}
                onCancel={() => setCameraOpen(false)}
              />
            ) : (
              <>
                <SeedWell seed={phase.seed} />
                <div className="seed-meta">
                  <span>{phase.seed ? "Source image" : "Choose your starting point"}</span>
                  <span>{phase.seed ? phase.seed.originalName : "PNG, JPEG or WebP · up to 10 MB"}</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  aria-label="Choose image file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) acceptSeed(file, file.name);
                  }}
                />
                <div className="action-row">
                  <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
                    Upload image
                  </button>
                  <button type="button" className="secondary" onClick={() => setCameraOpen(true)}>
                    Use camera
                  </button>
                  {!phase.seed && <button type="button" className="text-button" onClick={loadFixture}>Try an example</button>}
                </div>
              </>
            )}
          </div>
          <div className="create-panel">
            <div className="stage-intro">
              <h2>Your image.<br />Your next world.</h2>
              <p className="muted">Bring a place to life, fly through it, then change the rules. Leave with a cartridge of your run.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="world-direction">Give it a direction <span className="muted">optional</span></label>
              <input
                id="world-direction"
                className="direction"
                aria-label="Direction · optional"
                placeholder="More altitude, wider turns…"
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
              />
            </div>
            <label className="adventure-option">
              <input type="checkbox" aria-label="Adventure kit" checked={adventure} onChange={(event) => setAdventure(event.target.checked)} />
              <span>Adventure kit <small>Add dash, grapple and target combat.</small></span>
            </label>
            <button
              type="button"
              className="primary"
              disabled={!phase.seed || cameraOpen}
              onClick={() => {
                setCameraOpen(false);
                dispatch({
                  type: "MAKE_PLAYABLE",
                  direction: clampCodePoints(direction, DIRECTION_MAX_CODE_POINTS),
                });
              }}
            >
              Make playable
            </button>
            {phase.error && <p role="alert" className="error-text">{phase.error}</p>}
            <div className="flow-strip" aria-label="How it works">
              <span>Image to world</span><span>Fly &amp; remix</span><span>Keep the cartridge</span>
            </div>
          </div>
          {worldMode === "live" && <div className="stage-status"><StatusPill status={worldStatus} onRetry={() => void driver?.reconnect()} /></div>}
        </main>
      )}

      {phase.name === "staging" && (
        <main className="stage stage-building">
          <Wordmark />
          <div className="seed-pane">
            <SeedWell seed={phase.seed} />
            <div className="seed-meta"><span>Building from your image</span><span>{phase.seed.originalName}</span></div>
          </div>
          <div className="build-panel">
            <h2>A world is taking shape.</h2>
            <p className="muted">Writing the rules, checking the route, and connecting your live world.</p>
            <StagingSteps
              steps={phase.steps}
              warmingLabel={worldMode === "fake" ? "Warming the offline world" : "Starting the live world"}
            />
          </div>
          {worldMode === "live" && <div className="stage-status"><StatusPill status={worldStatus} onRetry={() => void driver?.reconnect()} /></div>}
        </main>
      )}

      {phase.name === "ready" && (
        <main className="stage stage-ready">
          <Wordmark />
          <div className="seed-pane">
            <SeedWell seed={phase.seed} />
            <div className="seed-meta"><span>Your starting point</span><span>{phase.seed.originalName}</span></div>
          </div>
          <div className="ready-panel">
            <h2>{phase.spec.title}</h2>
            <p className="muted">{phase.spec.tagline}</p>
            <dl className="decision">
              <div><dt>WORLD</dt><dd>{phase.spec.world.landmarks[0].description}</dd></div>
              <div><dt>GAME</dt><dd>{adventure ? "Glide + Adventure kit" : "Glide"}</dd></div>
              <div><dt>RULE</dt><dd>Pass 3 rings in order within {phase.spec.rules.durationSeconds}s</dd></div>
              <div><dt>GOAL</dt><dd>{goalLabel(phase.spec)}</dd></div>
            </dl>
            <div className="ready-controls">
              <span><kbd>W A S D</kbd> or arrows to steer</span>
              <span><kbd>Space</kbd> to boost</span>
              {adventure && <span><kbd>Shift</kbd> dash · <kbd>E</kbd> grapple · <kbd>F</kbd> pulse</span>}
            </div>
            <p className="pill">{sourceLabel(phase.source, phase.label)}</p>
            <button type="button" className="primary" onClick={() => dispatch({ type: "START_PLAY" })}>
              Start run
            </button>
          </div>
        </main>
      )}

      {playing && playCourse && playSpec && (
        <>
          <div className="hud">
            <p className="objective">
              <small>{phase.name === "playing" && phase.run === "patched" ? "Remixed flight" : "Original flight"}</small>
              Pass 3 rings, then {goalLabel(playSpec)}
            </p>
            <p className="hud-stats">
              <span><small>Gates</small>{hud.checkpoints}/3</span>
              <span><small>Time left</small>{formatRemaining(playCourse.rules.durationSeconds - hud.elapsed)}</span>
              <span aria-label="Flight speed"><small>Speed</small>{Math.round(hud.speed)} m/s</span>
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
              <button type="button" className="secondary" onClick={resetGame}>
                Stop
              </button>
            </div>
          </div>
          {adventure && abilityHud && (
            <>
              <div className="ability-hud">
                <span>{abilityHud.dashRemaining > 0 ? "DASHING" : abilityHud.dashCooldown > 0 ? `DASH ${abilityHud.dashCooldown.toFixed(1)}s` : "DASH READY"}</span>
                <span>GRAPPLE {abilityHud.grappleStatus.replaceAll("-", " ")}</span>
                <span>TARGETS {abilityHud.targets.filter((target) => target.hp === 0).length}/{abilityHud.targets.length} · {abilityHud.score} PTS</span>
              </div>
              <div className="ability-controls">
                <PressButton name="Dash" control="dash" onHold={holdPointer}>Shift · Dash</PressButton>
                <PressButton name="Grapple" control="grapple" onHold={holdPointer}>E · Grapple</PressButton>
                <PressButton name="Fire pulse" control="fire" onHold={holdPointer}>F · Pulse</PressButton>
              </div>
            </>
          )}
          {hud.paused && (
            <div className="flight-paused"><p>Flight paused</p><button type="button" className="primary" onClick={pushControls}>Resume flight</button></div>
          )}
          <p className="hint">A/D turn · W/S pitch · Space boost{adventure ? " · Shift dash · E grapple · F pulse" : ""}</p>
        </>
      )}

      {finished && (
        <main className="stage overlay-panel">
          {phase.outcome === "won" ? (
            <>
              <h2>Course complete.</h2>
              {phase.run === "original" ? (
                <>
                  <p className="muted">Same world. A new rule.</p>
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => dispatch({ type: "SPEAK" })}
                    >
                      Speak a new rule
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => dispatch({ type: "TYPE" })}
                    >
                      Type instead
                    </button>
                    <button type="button" className="secondary" onClick={resetGame}>
                      Make another
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">Cutting the cartridge…</p>
              )}
            </>
          ) : (
            <>
              <h2>Out of time</h2>
              <p className="muted">{phase.checkpoints}/3 rings cleared</p>
              <div className="action-row">
                <button type="button" className="primary" onClick={() => dispatch({ type: "RETRY" })}>
                  Retry same world
                </button>
                <button type="button" className="secondary" onClick={resetGame}>
                  Make another
                </button>
              </div>
            </>
          )}
        </main>
      )}

      {phase.name === "patch" && (
        <main className="stage overlay-panel">
          {phase.mode === "applied" && phase.patchedSpec ? (
            <>
              <p className="applied-rule">
                TURN RATE ×
                {phase.patchedSpec.mechanic.turnRate / phase.originalSpec.mechanic.turnRate}
              </p>
              <p className="muted">{phase.patchedSpec.cartridgeLine}</p>
            </>
          ) : phase.mode === "compiling" ? (
            <>
              <p className="transcript">“{phase.transcript}”</p>
              <p className="muted">Testing the patch</p>
            </>
          ) : phase.mode === "idle" ? (
            <form
              className="patch-form"
              onSubmit={(event) => {
                event.preventDefault();
                const transcript = typedRule.trim();
                if (transcript) void runPatch(transcript);
              }}
            >
              <input
                className="direction"
                aria-label="New rule"
                placeholder="e.g. double the turn rate"
                value={typedRule}
                onChange={(event) => setTypedRule(event.target.value)}
              />
              <button type="submit" className="primary">
                Apply rule
              </button>
            </form>
          ) : phase.mode === "listening" ? (
            <>
              <p className="mic" aria-hidden="true">
                ◉
              </p>
              <h2>Listening</h2>
              <div className="listening-bar" aria-hidden="true" />
              <p className="muted">Say “double the turn rate” or “halve the turn rate”. Your final words apply automatically.</p>
              {phase.transcript && <p className="transcript">“{phase.transcript}”</p>}
              <button type="button" className="text-button" onClick={() => dispatch({ type: "TYPE" })}>
                Type instead
              </button>
            </>
          ) : (
            <>
              <p role="alert" className="error-text">
                {phase.error}
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => dispatch({ type: "SPEAK" })}
                >
                  Retry speech
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => dispatch({ type: "TYPE" })}
                >
                  Type instead
                </button>
              </div>
            </>
          )}
        </main>
      )}

      {phase.name === "result" && (
        <main className="stage overlay-panel stage-result">
          <p className="mono muted">RUN COMPLETE · GAME CARTRIDGE</p>
          <h2>{phase.cartridge.title}</h2>
          <div className="cartridge-row">
            {phase.pngUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="cartridge"
                src={phase.pngUrl}
                alt={`Game cartridge for ${phase.cartridge.title}: ${phase.cartridge.ruleLabel}, finished in ${phase.cartridge.completionSeconds.toFixed(1)}s`}
              />
            ) : (
              <div className="seed-well">
                <p className="muted">No cartridge image yet</p>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cartridge-seed"
              src={phase.seed.previewUrl}
              alt={`Original seed: ${phase.seed.originalName}`}
            />
          </div>
          <p className="mono muted">
            GLIDE · {formatRemaining(phase.cartridge.completionSeconds)} ·{" "}
            <span className="accent">{phase.cartridge.ruleLabel}</span>
          </p>
          <p className="muted">{phase.cartridge.cartridgeLine}</p>
          {phase.error && (
            <p role="alert" className="error-text">
              {phase.error}
            </p>
          )}
          <div className="action-row">
            {phase.pngUrl ? (
              <a
                className="primary download"
                href={phase.pngUrl}
                download={cartridgeFilename(phase.cartridge.title)}
              >
                Download cartridge
              </a>
            ) : (
              <button type="button" className="primary" onClick={() => void retryCapture()}>
                Retry capture
              </button>
            )}
            <button type="button" className="secondary" onClick={resetGame}>
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
          {worldMode === "live" && <StatusPill status={worldStatus} onRetry={() => void driver?.reconnect()} />}
          <div className="action-row">
            <button type="button" className="primary" onClick={() => dispatch({ type: "RETRY" })}>
              Retry staging
            </button>
            <button type="button" className="secondary" onClick={() => dispatch({ type: "RESET" })}>
              Back to seed
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
