import type { Page } from "@playwright/test";
import { FIXTURE_COURSE, routeOf } from "../src/game/glide";

export type Snapshot = {
  phase: string;
  mode: string;
  fallbackLevel: number;
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
  spec: null | { title: string; referenceImageId: string; seed: number; source: string };
  run: null | {
    status: string;
    elapsed: number;
    activeGate: number;
    completed: string[];
    position: readonly number[];
    yaw: number;
    pitch: number;
    speed: number;
    respawns: number;
  };
  world: { kind: string };
};

export const readSnapshot = (page: Page): Promise<Snapshot | null> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __ANYTHING_PLAY__?: { snapshot: () => Snapshot } }
      ).__ANYTHING_PLAY__?.snapshot() ?? null,
  );

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

/** Drives the fixture course via real keyboard input until the run ends; returns the final snapshot. */
export async function driveToWin(page: Page, timeoutMs = 60_000): Promise<Snapshot> {
  const route = routeOf(FIXTURE_COURSE);
  const held = new Set<string>();
  const setKey = async (key: string, want: boolean) => {
    if (want && !held.has(key)) {
      held.add(key);
      await page.keyboard.down(key);
    } else if (!want && held.has(key)) {
      held.delete(key);
      await page.keyboard.up(key);
    }
  };
  const deadline = Date.now() + timeoutMs;
  let final: Snapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await readSnapshot(page);
    if (!snapshot?.run) {
      await page.waitForTimeout(100);
      continue;
    }
    if (snapshot.run.status !== "running") {
      final = snapshot;
      break;
    }
    const gate = route[snapshot.run.activeGate];
    if (!gate) {
      final = snapshot;
      break;
    }
    const [px, py, pz] = snapshot.run.position;
    const [gx, gy, gz] = gate.position;
    const yawErr = Math.atan2(
      Math.sin(Math.atan2(gx - px, gz - pz) - snapshot.run.yaw),
      Math.cos(Math.atan2(gx - px, gz - pz) - snapshot.run.yaw),
    );
    const pitchErr = Math.atan2(gy - py, Math.hypot(gx - px, gz - pz)) - snapshot.run.pitch;
    await setKey("ArrowRight", yawErr > 0.05);
    await setKey("ArrowLeft", yawErr < -0.05);
    await setKey("ArrowUp", pitchErr > 0.05);
    await setKey("ArrowDown", pitchErr < -0.05);
    await page.waitForTimeout(50);
  }
  for (const key of held) await page.keyboard.up(key);
  if (!final) final = await readSnapshot(page);
  if (!final) throw new Error("No debug snapshot available");
  return final;
}
