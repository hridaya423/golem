import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import type { DebugSnapshot } from "../src/testing/debug";

const snapshot = (page: Page) => page.evaluate(() => window.__GOLEM__!.snapshot());

async function aimAtTarget(page: Page) {
  const held = new Set<string>();
  try {
    for (let step = 0; step < 80; step++) {
      const state = await snapshot(page);
      const target = state.abilities!.targets[0].position;
      const player = state.run!;
      const dx = target[0] - player.position[0], dy = target[1] - player.position[1], dz = target[2] - player.position[2];
      const yaw = Math.atan2(dx, dz) - player.yaw;
      const pitch = Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch;
      const wanted = new Set([
        ...(yaw > 0.025 ? ["ArrowRight"] : yaw < -0.025 ? ["ArrowLeft"] : []),
        ...(pitch > 0.02 ? ["ArrowUp"] : pitch < -0.02 ? ["ArrowDown"] : []),
      ]);
      for (const key of held) if (!wanted.has(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
      if (!wanted.size) return;
      await page.waitForTimeout(25);
    }
    throw new Error("Could not aim at the generated target");
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}

test("Adventure kit wires pulse hits, grapple, dash and blur release into the actual flight", async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/compile", () => { throw new Error("Offline ability check must not call compiler"); });
  await page.goto("/?world=fake&compiler=off");
  await page.getByRole("checkbox", { name: "Adventure kit" }).check();
  await page.getByRole("button", { name: "Make playable" }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await expect.poll(async () => (await snapshot(page)).abilities?.targets.length).toBe(3);
  await aimAtTarget(page);
  await page.keyboard.down("KeyF");
  await expect.poll(async () => (await snapshot(page)).abilities?.score).toBe(100);
  await page.keyboard.up("KeyF");
  await expect.poll(async () => (await snapshot(page)).abilities?.grappleReachable, { timeout: 10_000 }).toBe(true);
  await page.keyboard.down("KeyE");
  await expect.poll(async () => (await snapshot(page)).abilities?.grappleStatus).toBe("attached");
  mkdirSync("docs/evidence/flight-upgrade", { recursive: true });
  await page.screenshot({ path: "docs/evidence/flight-upgrade/grapple.png" });
  await page.keyboard.up("KeyE");
  await expect.poll(async () => (await snapshot(page)).abilities?.grappleAnchor).toBeNull();
  const before = (await snapshot(page)).run!.speed;
  await page.keyboard.down("ShiftLeft");
  await expect.poll(async () => (await snapshot(page)).abilities!.dashCooldown).toBeGreaterThan(0);
  await page.waitForTimeout(120);
  expect((await snapshot(page)).run!.speed).toBeGreaterThan(before);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "Resume flight" })).toBeVisible();
  const paused = await snapshot(page);
  expect(paused.paused).toBe(true);
  expect(paused.abilities).toMatchObject({ dashRemaining: 0, grappleAnchor: null, shotTrace: null });
  const elapsed = paused.run!.elapsed;
  await page.waitForTimeout(150);
  expect((await snapshot(page)).run!.elapsed).toBe(elapsed);
  await page.keyboard.up("ShiftLeft");
  await page.getByRole("button", { name: "Resume flight" }).click();
  await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test("fresh image drives hoop colors and keeps generic fallback scenery", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const image = await sharp({ create: { width: 900, height: 500, channels: 3, background: "#d43d20" } }).png().toBuffer();
  await page.goto("/?world=fake&compiler=off");
  await page.getByLabel("Choose image file").setInputFiles({ name: "red-art.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("img", { name: "Seed image: red-art.png", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("heading", { name: "Your World, In Motion" })).toBeVisible();
  const state: DebugSnapshot = await snapshot(page);
  expect(state.hoopPalette!.midtone[0]).toBeGreaterThan(state.hoopPalette!.midtone[1]);
  expect(state.hoopPalette!.midtone[1]).toBeGreaterThan(state.hoopPalette!.midtone[2]);
  await page.getByRole("button", { name: "Start run" }).click();
  await expect.poll(async () => (await snapshot(page)).run?.elapsed ?? 0).toBeGreaterThan(0.1);
  mkdirSync("docs/evidence/flight-upgrade", { recursive: true });
  await page.screenshot({ path: "docs/evidence/flight-upgrade/image-colors.png" });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "docs/evidence/flight-upgrade/image-colors-mobile.png" });
  expect(errors).toEqual([]);
});
