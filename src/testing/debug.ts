import type { GlideState } from "../game/glide";
import type { WorldStatus } from "../world/world";

export type DebugSnapshot = {
  phase: string;
  mode: "fake" | "live";
  fallbackLevel: 1 | 4;
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
