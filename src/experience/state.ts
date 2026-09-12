import type { CartridgeData } from "../game/cartridge.ts";
import type { ValidatedGameSpec, ValidationCheck } from "../game/spec.ts";
import type { PreparedImage } from "../seed/image.ts";

export type SpecSource = "live" | "repaired" | "fallback";
export type PatchSource = "live" | "offline";
export type RunKind = "original" | "patched";

export type StagingStepName = "reading" | "rules" | "testing" | "warming";
export type StagingStep = {
  name: StagingStepName;
  status: "pending" | "active" | "passed" | "fallback" | "failed";
  detail?: string;
};

export type PatchMode = "idle" | "listening" | "compiling" | "applied" | "error";

type RunContext = {
  seed: PreparedImage;
  spec: ValidatedGameSpec;
  originalSpec: ValidatedGameSpec;
  run: RunKind;
  source: SpecSource;
  label: string;
  checks: ValidationCheck[];
};

export type Phase =
  | { name: "input"; seed: PreparedImage | null; error?: string }
  | {
      name: "staging";
      seed: PreparedImage;
      direction: string;
      spec: ValidatedGameSpec | null;
      source: SpecSource | null;
      label: string | null;
      checks: ValidationCheck[];
      steps: readonly StagingStep[];
    }
  | { name: "ready"; seed: PreparedImage; spec: ValidatedGameSpec; source: SpecSource; label: string; checks: ValidationCheck[] }
  | ({ name: "playing" } & RunContext)
  | ({ name: "finished"; outcome: "won" | "failed"; elapsed: number; checkpoints: number } & RunContext)
  | ({
      name: "patch";
      mode: PatchMode;
      transcript: string;
      error?: string;
      elapsed: number;
      patchedSpec: ValidatedGameSpec | null;
      patchedSource: PatchSource | null;
    } & RunContext)
  | {
      name: "result";
      seed: PreparedImage;
      spec: ValidatedGameSpec;
      originalSpec: ValidatedGameSpec;
      cartridge: CartridgeData;
      pngUrl: string | null;
      error?: string;
    }
  | { name: "error"; seed: PreparedImage | null; spec?: ValidatedGameSpec; message: string };

export type Action =
  | { type: "SEED_LOADED"; seed: PreparedImage }
  | { type: "SEED_FAILED"; message: string }
  | { type: "SEED_REPLACED"; seed: PreparedImage }
  | { type: "SEED_REJECTED"; message: string }
  | { type: "MAKE_PLAYABLE"; direction: string }
  | { type: "STAGE_STEP"; name: StagingStepName; status: StagingStep["status"]; detail?: string }
  | {
      type: "COMPILED";
      spec: ValidatedGameSpec;
      source: SpecSource;
      label: string;
      checks: ValidationCheck[];
    }
  | { type: "STAGED" }
  | { type: "START_PLAY" }
  | { type: "RUN_ENDED"; outcome: "won" | "failed"; elapsed: number; checkpoints: number }
  | { type: "SPEAK" }
  | { type: "TYPE" }
  | { type: "PATCH_TRANSCRIPT"; transcript: string }
  | { type: "PATCH_FAILED"; message: string }
  | { type: "PATCH_APPLIED"; spec: ValidatedGameSpec; source: PatchSource }
  | { type: "START_REPLAY" }
  | { type: "CARTRIDGE_READY"; cartridge: CartridgeData; pngUrl: string }
  | { type: "CARTRIDGE_FAILED"; cartridge: CartridgeData; message: string }
  | { type: "CARTRIDGE_RENDERED"; pngUrl: string }
  | { type: "RETRY" }
  | { type: "RESET" }
  | { type: "FAIL"; message: string };

const STAGING_STEPS: readonly StagingStep[] = [
  { name: "reading", status: "passed" },
  { name: "rules", status: "active" },
  { name: "testing", status: "pending" },
  { name: "warming", status: "pending" },
];

export const initialPhase: Phase = { name: "input", seed: null };

function toReady(phase: Extract<Phase, { name: "staging" }>): Phase {
  if (!phase.spec || !phase.source || phase.label === null) return phase;
  return {
    name: "ready",
    seed: phase.seed,
    spec: phase.spec,
    source: phase.source,
    label: phase.label,
    checks: phase.checks,
  };
}

function runContext(phase: RunContext): RunContext {
  return {
    seed: phase.seed,
    spec: phase.spec,
    originalSpec: phase.originalSpec,
    run: phase.run,
    source: phase.source,
    label: phase.label,
    checks: phase.checks,
  };
}

export function reducer(phase: Phase, action: Action): Phase {
  switch (action.type) {
    case "SEED_LOADED":
      return { name: "input", seed: action.seed };
    case "SEED_FAILED":
      return { name: "input", seed: null, error: action.message };
    case "SEED_REPLACED":
      if (phase.name !== "input") return phase;
      return { name: "input", seed: action.seed };
    case "SEED_REJECTED":
      if (phase.name !== "input") return phase;
      return { ...phase, error: action.message };
    case "MAKE_PLAYABLE":
      if (phase.name === "input" && phase.seed) {
        return {
          name: "staging",
          seed: phase.seed,
          direction: action.direction,
          spec: null,
          source: null,
          label: null,
          checks: [],
          steps: STAGING_STEPS,
        };
      }
      return phase;
    case "STAGE_STEP":
      if (phase.name !== "staging") return phase;
      return {
        ...phase,
        steps: phase.steps.map((step) =>
          step.name === action.name
            ? { ...step, status: action.status, detail: action.detail }
            : step,
        ),
      };
    case "COMPILED":
      if (phase.name !== "staging") return phase;
      return { ...phase, spec: action.spec, source: action.source, label: action.label, checks: action.checks };
    case "STAGED":
      if (phase.name !== "staging") return phase;
      return toReady(phase);
    case "START_PLAY":
      if (phase.name !== "ready") return phase;
      return {
        name: "playing",
        seed: phase.seed,
        spec: phase.spec,
        originalSpec: phase.spec,
        run: "original",
        source: phase.source,
        label: phase.label,
        checks: phase.checks,
      };
    case "RUN_ENDED":
      if (phase.name !== "playing") return phase;
      return {
        name: "finished",
        ...runContext(phase),
        outcome: action.outcome,
        elapsed: action.elapsed,
        checkpoints: action.checkpoints,
      };
    case "SPEAK":
      if (phase.name === "finished" && phase.run === "original" && phase.outcome === "won") {
        return {
          name: "patch",
          ...runContext(phase),
          mode: "listening",
          transcript: "",
          elapsed: phase.elapsed,
          patchedSpec: null,
          patchedSource: null,
        };
      }
      if (phase.name === "patch" && phase.mode !== "listening" && phase.mode !== "compiling") {
        return { ...phase, mode: "listening", error: undefined };
      }
      return phase;
    case "TYPE":
      if (phase.name === "finished" && phase.run === "original" && phase.outcome === "won") {
        return {
          name: "patch",
          ...runContext(phase),
          mode: "idle",
          transcript: "",
          elapsed: phase.elapsed,
          patchedSpec: null,
          patchedSource: null,
        };
      }
      if (phase.name === "patch" && phase.mode !== "compiling") {
        return { ...phase, mode: "idle", error: undefined };
      }
      return phase;
    case "PATCH_TRANSCRIPT":
      if (phase.name !== "patch") return phase;
      return { ...phase, mode: "compiling", transcript: action.transcript, error: undefined };
    case "PATCH_FAILED":
      if (phase.name !== "patch") return phase;
      return { ...phase, mode: "error", error: action.message };
    case "PATCH_APPLIED":
      if (phase.name !== "patch") return phase;
      return {
        ...phase,
        mode: "applied",
        patchedSpec: action.spec,
        patchedSource: action.source,
        error: undefined,
      };
    case "START_REPLAY":
      if (phase.name !== "patch" || !phase.patchedSpec) return phase;
      return {
        name: "playing",
        ...runContext(phase),
        spec: phase.patchedSpec,
        run: "patched",
      };
    case "CARTRIDGE_READY":
      if (phase.name !== "finished" || phase.run !== "patched" || phase.outcome !== "won") return phase;
      return {
        name: "result",
        seed: phase.seed,
        spec: phase.spec,
        originalSpec: phase.originalSpec,
        cartridge: action.cartridge,
        pngUrl: action.pngUrl,
      };
    case "CARTRIDGE_FAILED":
      if (phase.name !== "finished" || phase.run !== "patched" || phase.outcome !== "won") return phase;
      return {
        name: "result",
        seed: phase.seed,
        spec: phase.spec,
        originalSpec: phase.originalSpec,
        cartridge: action.cartridge,
        pngUrl: null,
        error: action.message,
      };
    case "CARTRIDGE_RENDERED":
      if (phase.name !== "result") return phase;
      return { ...phase, pngUrl: action.pngUrl, error: undefined };
    case "RETRY":
      if (phase.name === "finished") {
        return { name: "playing", ...runContext(phase) };
      }
      if (phase.name === "error" && phase.seed) {
        return {
          name: "staging",
          seed: phase.seed,
          direction: "",
          spec: phase.spec ?? null,
          source: null,
          label: null,
          checks: [],
          steps: phase.spec
            ? [
                { name: "reading", status: "passed" },
                { name: "rules", status: "passed" },
                { name: "testing", status: "passed" },
                { name: "warming", status: "active" },
              ]
            : STAGING_STEPS,
        };
      }
      return phase;
    case "RESET":
      return { name: "input", seed: "seed" in phase ? phase.seed : null };
    case "FAIL":
      return {
        name: "error",
        seed: "seed" in phase ? phase.seed : null,
        spec: "spec" in phase && phase.spec ? phase.spec : undefined,
        message: action.message,
      };
    default:
      return phase;
  }
}
