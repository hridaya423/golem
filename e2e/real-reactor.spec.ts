import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "docs/evidence/gate-1";

test.skip(process.env.REAL_REACTOR !== "1", "live Reactor smoke is opt-in via REAL_REACTOR=1");

test.setTimeout(300_000);
test.use({ video: "on" });

test("live Reactor world: stage fixture, hold a turn, record coupling telemetry", async ({ page }, testInfo) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const snapshot = () => page.evaluate(() => window.__GOLEM__?.snapshot() ?? null).catch(() => null);
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

test("Happy Oyster: one bounded Reactor world and steering probe", async ({ page }) => {
  test.skip(process.env.HAPPY_OYSTER_PROBE !== "1", "requires HAPPY_OYSTER_PROBE=1");
  const out = "docs/evidence/gate-9";
  mkdirSync(out, { recursive: true });
  const prefix = `happy-oyster-${Date.now()}`;
  const sessionStatuses: number[] = [];
  console.log(`Evidence: ${out}/${prefix}.json`);
  page.on("response", (response) => {
    if (response.url() === "https://api.reactor.inc/sessions" && response.request().method() === "POST") sessionStatuses.push(response.status());
  });
  let sessionRequests = 0;
  let report: { status?: string; firstFrame?: boolean; disconnected?: boolean; error?: string | null } | null = null;
  const captured = new Set<string>();
  await page.route("https://api.reactor.inc/sessions", async (route) => {
    if (route.request().method() === "POST" && ++sessionRequests > 1) return route.abort("blockedbyclient");
    return route.continue();
  });
  try {
    await page.goto("/?operator=1&probe=happy-oyster");
    await page.getByRole("button", { name: "Run one paid probe" }).click();
    const deadline = Date.now() + 210_000;
    while (Date.now() < deadline) {
      report = JSON.parse(await page.locator("#happy-probe-report").innerText());
      const status = report?.status ?? "unknown";
      if (!captured.has(status)) {
        captured.add(status);
        console.log(`Happy Oyster: ${status}`);
        if (["first-frame", "forward", "turn-right", "turn-left"].includes(status)) {
          await page.waitForTimeout(status === "first-frame" ? 100 : 1800);
          await page.screenshot({ path: path.join(out, `${prefix}-${status}.png`) });
        }
      }
      if (report?.disconnected && ["passed", "failed"].includes(status)) break;
      await page.waitForTimeout(250);
    }
    expect(report?.status, report?.error ?? "Probe did not complete").toBe("passed");
    expect(report?.firstFrame).toBe(true);
    expect(report?.disconnected).toBe(true);
    expect(sessionRequests).toBe(1);
  } finally {
    writeFileSync(path.join(out, `${prefix}.json`), JSON.stringify({ sessionRequests, sessionStatuses, report }, null, 2));
    await page.screenshot({ path: path.join(out, `${prefix}-final.png`) }).catch(() => {});
    const video = page.video();
    await page.context().close();
    if (video) await video.saveAs(path.join(out, `${prefix}.webm`));
  }
});
