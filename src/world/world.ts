"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GlideInput } from "../game/glide";
import type { PreparedImage } from "../seed/image";

export type WorldControls = {
  longitudinal: "idle" | "forward" | "back";
  lateral: "idle" | "strafe_left" | "strafe_right";
  lookHorizontal: "idle" | "left" | "right";
  lookVertical: "idle" | "up" | "down";
};

export const IDLE_CONTROLS: WorldControls = {
  longitudinal: "idle",
  lateral: "idle",
  lookHorizontal: "idle",
  lookVertical: "idle",
};

export type WorldStatus = {
  kind: "fake" | "live";
  connection: "disconnected" | "connecting" | "waiting" | "ready";
  sessionId?: string;
  hasImage: boolean;
  hasPrompt: boolean;
  generating: boolean;
  chunk: number;
  firstFrameAt?: number;
  lastCommandAt?: number;
  lastChunkAt?: number;
  /** Pixel frames the model reported for the last completed chunk (live only). */
  framesPerChunk?: number;
  /** Composite action string Reactor used for the last chunk, e.g. "w+right". */
  lastChunkAction?: string;
  error?: string;
  retryAt?: number;
  retryAttempt?: number;
};

export type StageInput = { image: PreparedImage; prompt: string; seed: number };

export interface WorldDriver {
  readonly kind: "fake" | "live";
  getStatus(): WorldStatus;
  subscribe(listener: () => void): () => void;
  stage(input: StageInput): Promise<void>;
  setControls(controls: WorldControls): void;
  setTurnRate(deg: number): void;
  stopControls(): void;
  reset(): Promise<void>;
  /** Re-attempt the world connection after a refused/dropped session (no-op for the fake world). */
  reconnect(): Promise<void>;
  /** Drop the session/connection (no-op for the fake world). */
  disconnect(): Promise<void>;
  captureFrame(): Promise<Blob | null>;
}

export function createStatusStore(initial: WorldStatus) {
  let status = initial;
  const listeners = new Set<() => void>();
  return {
    get(): WorldStatus {
      return status;
    },
    set(partial: Partial<WorldStatus>): void {
      status = { ...status, ...partial };
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type StatusStore = ReturnType<typeof createStatusStore>;

const DISCONNECTED: WorldStatus = {
  kind: "live",
  connection: "disconnected",
  hasImage: false,
  hasPrompt: false,
  generating: false,
  chunk: 0,
};

export function useWorldStatus(driver: WorldDriver | null): WorldStatus {
  const subscribe = useCallback(
    (listener: () => void) => (driver ? driver.subscribe(listener) : () => {}),
    [driver],
  );
  const getSnapshot = useCallback(
    () => (driver ? driver.getStatus() : DISCONNECTED),
    [driver],
  );
  const getServerSnapshot = useCallback(() => DISCONNECTED, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function controlsFromInput(input: GlideInput): WorldControls {
  return {
    longitudinal: "forward",
    lateral: "idle",
    lookHorizontal: input.turn > 0 ? "right" : input.turn < 0 ? "left" : "idle",
    lookVertical: input.pitch > 0 ? "up" : input.pitch < 0 ? "down" : "idle",
  };
}

export function sameControls(a: WorldControls, b: WorldControls): boolean {
  return (
    a.longitudinal === b.longitudinal &&
    a.lateral === b.lateral &&
    a.lookHorizontal === b.lookHorizontal &&
    a.lookVertical === b.lookVertical
  );
}

export const BASE_REACTOR_TURN_DEG = 6;

export function reactorTurnDeg(turnRate: number): number {
  return Math.min(30, Math.max(0, BASE_REACTOR_TURN_DEG * turnRate));
}

export function waitForStatus(
  store: StatusStore,
  predicate: (status: WorldStatus) => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate(store.get())) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(label));
    }, timeoutMs);
    const unsubscribe = store.subscribe(() => {
      if (predicate(store.get())) {
        clearTimeout(timer);
        unsubscribe();
        resolve();
      }
    });
  });
}
