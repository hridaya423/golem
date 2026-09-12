import type { ValidatedGameSpec, ValidationCheck } from "../game/spec.ts";
import type { PreparedImage } from "../seed/image.ts";

export type SpecSource = "live" | "repaired" | "fallback";

export type StagingStepName = "reading" | "rules" | "testing" | "warming";
export type StagingStep = {
  name: StagingStepName;
  status: "pending" | "active" | "passed" | "fallback" | "failed";
  detail?: string;
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
  | { name: "playing"; seed: PreparedImage; spec: ValidatedGameSpec; source: SpecSource; label: string; checks: ValidationCheck[] }
  | {
      name: "finished";
      seed: PreparedImage;
      spec: ValidatedGameSpec;
      source: SpecSource;
      label: string;
      checks: ValidationCheck[];
      outcome: "won" | "failed";
      elapsed: number;
      checkpoints: number;
    }
  | { name: "error"; seed: PreparedImage | null; spec?: ValidatedGameSpec; message: string };

export type Action =
  | { type: "SEED_LOADED"; seed: PreparedImage }
  | { type: "SEED_FAILED"; message: string }
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

export function reducer(phase: Phase, action: Action): Phase {
  switch (action.type) {
    case "SEED_LOADED":
      return { name: "input", seed: action.seed };
    case "SEED_FAILED":
      return { name: "input", seed: null, error: action.message };
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
        source: phase.source,
        label: phase.label,
        checks: phase.checks,
      };
    case "RUN_ENDED":
      if (phase.name !== "playing") return phase;
      return {
        name: "finished",
        seed: phase.seed,
        spec: phase.spec,
        source: phase.source,
        label: phase.label,
        checks: phase.checks,
        outcome: action.outcome,
        elapsed: action.elapsed,
        checkpoints: action.checkpoints,
      };
    case "RETRY":
      if (phase.name === "finished") {
        return {
          name: "playing",
          seed: phase.seed,
          spec: phase.spec,
          source: phase.source,
          label: phase.label,
          checks: phase.checks,
        };
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
