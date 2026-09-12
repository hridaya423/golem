import type { GlideInput, GlideState } from "../game/glide";
import type { WorldStatus } from "../world/world";
import type { AbilityState } from "../game/abilities";
import type { HoopPalette } from "../game/hoops";

export type DebugSnapshot = {
  phase: string;
  mode: "fake" | "live";
  fallbackLevel: 1 | 2 | 3 | 4;
  seedId: string | null;
  worldPromptHash: string | null;
  input: GlideInput;
  paused: boolean;
  hoopPalette: HoopPalette | null;
  abilities: AbilityState | null;
  patch: null | {
    transcript: string;
    factor: number;
    source: string;
    originalTurnRate: number;
    patchedTurnRate: number;
    reactorDegBefore: number;
    reactorDegAfter: number;
    sessionIdBefore?: string;
    sessionIdAfter?: string;
    worldPromptHash: string | null;
  };
  spec: null | {
    title: string;
    referenceImageId: string;
    seed: number;
    turnRate: number;
    source: string;
    checks: string | null;
    hash: string | null;
    route: string[];
  };
  run: null | {
    status: GlideState["status"];
    elapsed: number;
    activeGate: number;
    completed: string[];
    position: readonly number[];
    yaw: number;
    pitch: number;
    speed: number;
    respawns: number;
  };
  world: WorldStatus;
  metrics: {
    inputToOverlayMs: number[];
    commandToChunkMs: number | null;
    firstFrameMs: number | null;
    compileMs: number | null;
  };
};

/** Single source for the reliability ladder, shared by the snapshot and the operator panel. */
export function fallbackLevelOf(input: {
  mode: "fake" | "live";
  source: string | null;
  seedIsFixture: boolean;
}): 1 | 2 | 3 | 4 {
  if (input.mode === "fake") return 4;
  if (input.source === "live" || input.source === "repaired") return 1;
  return input.seedIsFixture ? 3 : 2;
}

export const FALLBACK_LEVEL_LABELS: Record<number, string> = {
  1: "1 — live world + live rules",
  2: "2 — live world + prepared rules on a fresh seed",
  3: "3 — live world + prepared rules on the prepared seed",
  4: "4 — fake world, not live generation",
};

export function isFixtureSeed(image: { originalName: string } | null | undefined): boolean {
  return image?.originalName === "glide-ink-islands.webp";
}

declare global {
  interface Window {
    __GOLEM__?: { snapshot: () => DebugSnapshot };
  }
}

export function installDebug(getSnapshot: () => DebugSnapshot): () => void {
  window.__GOLEM__ = {
    snapshot: () => structuredClone(getSnapshot()),
  };
  return () => {
    delete window.__GOLEM__;
  };
}
