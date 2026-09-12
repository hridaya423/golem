import type { GlideState } from "../game/glide";
import type { WorldStatus } from "../world/world";

export type DebugSnapshot = {
  phase: string;
  mode: "fake" | "live";
  fallbackLevel: 1 | 3 | 4;
  seedId: string | null;
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
  };
};

declare global {
  interface Window {
    __ANYTHING_PLAY__?: { snapshot: () => DebugSnapshot };
  }
}

export function installDebug(getSnapshot: () => DebugSnapshot): () => void {
  window.__ANYTHING_PLAY__ = {
    snapshot: () => structuredClone(getSnapshot()),
  };
  return () => {
    delete window.__ANYTHING_PLAY__;
  };
}
