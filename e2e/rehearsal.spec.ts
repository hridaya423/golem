// Full live rehearsal (Task 9.4): fresh compile + live Reactor -> original win -> spoken patch
// -> patched replay -> cartridge download, with wall-clock marks for every step.
//
// Costs money and a GPU session. Runs only against a server YOU already started with real secrets
// (e.g. `pnpm build && pnpm start`). REAL_REACTOR=1 makes playwright.config.ts reuse that server
// instead of starting a fake-mode one; REHEARSAL=1 un-skips this spec; REHEARSAL_N numbers the evidence.
//
//   REAL_REACTOR=1 REHEARSAL=1 REHEARSAL_N=1 pnpm playwright test e2e/rehearsal.spec.ts
//
// Speech is faked in the browser (real microphone rehearsal is manual); the patch itself hits the real /api/patch.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DebugSnapshot } from "../src/testing/debug";
import { collectErrors } from "./helpers";

const EVIDENCE_DIR = "docs/evidence/gate-9";
const N = process.env.REHEARSAL_N ?? "1";
const evidence = (suffix: string) => path.join(EVIDENCE_DIR, `rehearsal-${N}${suffix}`);

test.skip(process.env.REHEARSAL !== "1" || process.env.REAL_REACTOR !== "1", "live rehearsal is opt-in via REHEARSAL=1 (and REAL_REACTOR=1)");

test.setTimeout(420_000);
test.use({ video: "on" });

const snap = (page: Page): Promise<DebugSnapshot | null> =>
  page.evaluate(() => window.__GOLEM__?.snapshot() ?? null).catch(() => null);

/** Parses `id@x,y,z` route strings from the snapshot into gate positions, in route order. */
const parseRoute = (route: string[]) =>
  route.map((entry) => {
    const [id, xyz = ""] = entry.split("@");
    const position = xyz.split(",").map(Number);
    if (position.length !== 3 || position.some(Number.isNaN)) throw new Error(`unparseable route entry ${entry}`);
    return { id, position: position as [number, number, number] };
  });

/**
 * Steers toward the live-compiled course (read from snapshot.spec.route, not the fixture) with the same
 * 0.05 rad deadband as driveToWin, boosting when roughly aligned. Returns the snapshot once the run ends.
 */
async function driveLive(page: Page, timeoutMs = 120_000): Promise<DebugSnapshot> {
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
  let final: DebugSnapshot | null = null;
  while (Date.now() < deadline) {
    const snapshot = await snap(page);
    if (!snapshot?.run || !snapshot.spec) {
      await page.waitForTimeout(100);
      continue;
    }
    if (snapshot.run.status !== "running") {
      final = snapshot;
      break;
    }
    const gate = parseRoute(snapshot.spec.route)[snapshot.run.activeGate];
    if (!gate) {
      final = snapshot;
      break;
    }
    const [px, py, pz] = snapshot.run.position;
    const [gx, gy, gz] = gate.position;
    const heading = Math.atan2(gx - px, gz - pz) - snapshot.run.yaw;
    const yawErr = Math.atan2(Math.sin(heading), Math.cos(heading));
    const pitchErr = Math.atan2(gy - py, Math.hypot(gx - px, gz - pz)) - snapshot.run.pitch;
    await setKey("ArrowRight", yawErr > 0.05);
    await setKey("ArrowLeft", yawErr < -0.05);
    await setKey("ArrowUp", pitchErr > 0.05);
    await setKey("ArrowDown", pitchErr < -0.05);
    await setKey("Space", Math.abs(yawErr) < 0.2);
    await page.waitForTimeout(50);
  }
  for (const key of held) await page.keyboard.up(key);
  if (!final) final = await snap(page);
  if (!final) throw new Error("No debug snapshot available");
  return final;
}

test(`live rehearsal ${N}: compile, win, spoken patch, replay, cartridge — timed`, async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const consoleErrors = collectErrors(page);
  const marks: Record<string, number> = {};
  const mark = (label: string) => {
    marks[label] = Date.now();
  };
  const snapshots: Partial<Record<"ready" | "originalWin" | "patched" | "result" | "failure", DebugSnapshot | null>> = {};
  let failure: string | undefined;

  await page.addInitScript(() => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [[{ transcript: "double the turn rate" }]] });
          this.onend?.();
        }, 300);
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  });

  try {
    mark("start");
    await page.goto("/?operator=1");
    await page.getByRole("button", { name: "Make playable" }).click();
    mark("makePlayableClicked");
    await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 200_000 });
    mark("ready");
    snapshots.ready = await snap(page);
    expect(snapshots.ready?.mode).toBe("live");
    expect(snapshots.ready?.world.kind).toBe("live");
    expect(snapshots.ready?.world.connection).toBe("ready");
    expect(snapshots.ready?.world.sessionId).toBeTruthy();
    expect(snapshots.ready?.world.firstFrameAt).toBeDefined();
    expect(["live", "repaired"]).toContain(snapshots.ready?.spec?.source);
    await page.screenshot({ path: evidence("-ready.png") });

    await page.getByRole("button", { name: "Start run" }).click();
    mark("startRunClicked");
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidence("-play.png") });
    const first = await driveLive(page);
    mark("originalWin");
    snapshots.originalWin = first;
    expect(first.run?.status).toBe("won");

    await page.getByRole("button", { name: "Speak a new rule" }).click();
    mark("speakClicked");
    await expect(page.getByText("TURN RATE ×2", { exact: true })).toBeVisible({ timeout: 30_000 });
    mark("patchApplied");
    await expect.poll(async () => (await snap(page))?.phase, { timeout: 15_000 }).toBe("playing");
    mark("replayPlaying");
    snapshots.patched = await snap(page);

    const second = await driveLive(page);
    mark("patchedWin");
    expect(second.run?.status).toBe("won");
    await expect.poll(async () => (await snap(page))?.phase, { timeout: 30_000 }).toBe("result");
    await expect(page.getByRole("link", { name: "Download cartridge" })).toBeVisible({ timeout: 15_000 });
    mark("result");
    snapshots.result = await snap(page);
    await page.screenshot({ path: evidence("-result.png") });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download cartridge" }).click();
    const download = await downloadPromise;
    const file = readFileSync((await download.path())!);
    mark("downloadComplete");
    await download.saveAs(evidence("-cartridge.png"));
    expect([...file.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(file.length).toBeGreaterThan(50_000);
    await expect(page.getByRole("button", { name: "Make another" })).toBeVisible();

    expect(marks.downloadComplete - marks.start).toBeLessThan(180_000);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    snapshots.failure = await snap(page);
    throw error;
  } finally {
    const labels = Object.keys(marks);
    const durationsMs = Object.fromEntries(
      labels.slice(1).map((label, i) => [`${labels[i]}→${label}`, marks[label] - marks[labels[i]]]),
    );
    const last = labels[labels.length - 1];
    const totalMs = last ? marks[last] - marks.start : null;
    writeFileSync(
      evidence(".json"),
      JSON.stringify({ marks, durationsMs, totalMs, snapshots, consoleErrors, failure }, null, 2),
    );
    const video = page.video();
    if (video) {
      await page.context().close();
      await video.saveAs(evidence(".webm")).catch(() => {});
    }
  }
});
