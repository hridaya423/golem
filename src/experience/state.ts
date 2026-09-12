import { FIXTURE_COURSE, type GlideCourse } from "../game/glide";
import type { PreparedImage } from "../seed/image";

export type StagingStepName = "reading" | "warming";
export type StagingStep = {
  name: StagingStepName;
  status: "pending" | "active" | "passed" | "failed";
};

export type Phase =
  | { name: "input"; seed: PreparedImage | null; error?: string }
  | { name: "staging"; seed: PreparedImage; course: GlideCourse; steps: readonly StagingStep[] }
  | { name: "ready"; seed: PreparedImage; course: GlideCourse }
  | { name: "playing"; seed: PreparedImage; course: GlideCourse }
  | {
      name: "finished";
      seed: PreparedImage;
      course: GlideCourse;
      outcome: "won" | "failed";
      elapsed: number;
      checkpoints: number;
    }
  | { name: "error"; seed: PreparedImage | null; course?: GlideCourse; message: string };

export type Action =
  | { type: "SEED_LOADED"; seed: PreparedImage }
  | { type: "SEED_FAILED"; message: string }
  | { type: "MAKE_PLAYABLE" }
  | { type: "STAGE_STEP"; name: StagingStepName; status: StagingStep["status"] }
  | { type: "STAGED" }
  | { type: "START_PLAY" }
  | { type: "RUN_ENDED"; outcome: "won" | "failed"; elapsed: number; checkpoints: number }
  | { type: "RETRY" }
  | { type: "RESET" }
  | { type: "FAIL"; message: string };

const STAGING_STEPS: readonly StagingStep[] = [
  { name: "reading", status: "passed" },
  { name: "warming", status: "active" },
];

export const initialPhase: Phase = { name: "input", seed: null };

export function reducer(phase: Phase, action: Action): Phase {
  switch (action.type) {
    case "SEED_LOADED":
      return { name: "input", seed: action.seed };
    case "SEED_FAILED":
      return { name: "input", seed: null, error: action.message };
    case "MAKE_PLAYABLE":
      if (phase.name === "input" && phase.seed) {
        return { name: "staging", seed: phase.seed, course: FIXTURE_COURSE, steps: STAGING_STEPS };
      }
      return phase;
    case "STAGE_STEP":
      if (phase.name !== "staging") return phase;
      return {
        ...phase,
        steps: phase.steps.map((step) =>
          step.name === action.name ? { ...step, status: action.status } : step,
        ),
      };
    case "STAGED":
      if (phase.name !== "staging") return phase;
      return { name: "ready", seed: phase.seed, course: phase.course };
    case "START_PLAY":
      if (phase.name !== "ready") return phase;
      return { name: "playing", seed: phase.seed, course: phase.course };
    case "RUN_ENDED":
      if (phase.name !== "playing") return phase;
      return {
        name: "finished",
        seed: phase.seed,
        course: phase.course,
        outcome: action.outcome,
        elapsed: action.elapsed,
        checkpoints: action.checkpoints,
      };
    case "RETRY":
      if (phase.name === "finished") {
        return { name: "playing", seed: phase.seed, course: phase.course };
      }
      if (phase.name === "error" && phase.seed && phase.course) {
        return { name: "staging", seed: phase.seed, course: phase.course, steps: STAGING_STEPS };
      }
      return phase;
    case "RESET":
      return { name: "input", seed: "seed" in phase ? phase.seed : null };
    case "FAIL":
      return {
        name: "error",
        seed: "seed" in phase ? phase.seed : null,
        course: "course" in phase ? phase.course : undefined,
        message: action.message,
      };
    default:
      return phase;
  }
}
