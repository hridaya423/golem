import { expect, test } from "@playwright/test";
import { FIXTURE_COURSE, routeOf } from "../src/game/glide";

type Snapshot = {
  phase: string;
  mode: string;
  fallbackLevel: number;
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

test("fake world glide flow: stage, play with keyboard, win in order", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });

  await page.goto("/?world=fake&compiler=off");
  await expect(
    page.getByRole("heading", { name: "ANYTHING//PLAY", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start run" }).click();

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
  const readSnapshot = () =>
    page.evaluate(() => window.__ANYTHING_PLAY__?.snapshot() ?? null) as Promise<Snapshot | null>;

  const deadline = Date.now() + 60_000;
  let final: Snapshot | null = null;
  let shotTaken = false;
  while (Date.now() < deadline) {
    const snapshot = await readSnapshot();
    if (!snapshot?.run) {
      await page.waitForTimeout(100);
      continue;
    }
    if (snapshot.run.status !== "running") {
      final = snapshot;
      break;
    }
    if (!shotTaken) {
      shotTaken = true;
      await page.screenshot({ path: "docs/evidence/gate-1/fake-play.png" });
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
    const pitchErr =
      Math.atan2(gy - py, Math.hypot(gx - px, gz - pz)) - snapshot.run.pitch;
    await setKey("ArrowRight", yawErr > 0.05);
    await setKey("ArrowLeft", yawErr < -0.05);
    await setKey("ArrowUp", pitchErr > 0.05);
    await setKey("ArrowDown", pitchErr < -0.05);
    await page.waitForTimeout(50);
  }
  for (const key of held) await page.keyboard.up(key);

  if (!final) final = await readSnapshot();
  expect(final).not.toBeNull();
  expect(final!.run?.status).toBe("won");
  expect(final!.run?.completed).toEqual(["cp1", "cp2", "cp3", "goal"]);
  expect(final!.fallbackLevel).toBe(4);
  expect(final!.world.kind).toBe("fake");
  expect(final!.spec?.source).toBe("fallback");
  expect(final!.spec?.referenceImageId).toBe(
    "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42",
  );
  await expect(page.getByText("Course complete")).toBeVisible();
  expect(errors).toEqual([]);
});
