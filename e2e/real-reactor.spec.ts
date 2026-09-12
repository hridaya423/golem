import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "docs/evidence/gate-1";

test.skip(process.env.REAL_REACTOR !== "1", "live Reactor smoke is opt-in via REAL_REACTOR=1");

test.setTimeout(300_000);
test.use({ video: "on" });

test("live Reactor world: stage fixture, hold a turn, record coupling telemetry", async ({ page }, testInfo) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const snapshot = () => page.evaluate(() => window.__ANYTHING_PLAY__?.snapshot() ?? null).catch(() => null);
  const shot = (label: string) => page.screenshot({ path: path.join(EVIDENCE_DIR, `live-${label}.png`) });
  const timeline: Array<{ label: string; at: number; snapshot: unknown }> = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  const mark = async (label: string) => {
    timeline.push({ label, at: Date.now(), snapshot: await snapshot() });
    await shot(label);
  };

  await page.goto("/?operator=1");
  await page.getByRole("button", { name: "Make playable" }).click();
  try {
    await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 200_000 });
  } catch (error) {
    await mark("staging-failed");
    writeFileSync(path.join(EVIDENCE_DIR, "live-timeline.json"), JSON.stringify({ timeline, consoleErrors }, null, 2));
    throw error;
  }
  await page.getByRole("button", { name: "Start run" }).click();
  await page.waitForTimeout(2500);
  await mark("00-straight");

  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1000);
  await mark("01-turning-1s");
  await page.waitForTimeout(1000);
  await mark("02-turning-2s");
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(1500);
  await mark("03-released");

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(2000);
  await page.keyboard.up("ArrowLeft");
  await mark("04-turned-back");
  await page.waitForTimeout(2000);
  await mark("05-settled");

  writeFileSync(path.join(EVIDENCE_DIR, "live-timeline.json"), JSON.stringify({ timeline, consoleErrors }, null, 2));
  const video = page.video();
  if (video) {
    await page.context().close();
    await video.saveAs(path.join(EVIDENCE_DIR, `live-play-${testInfo.workerIndex}.webm`));
  }
});
