import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { driveToWin } from "./helpers";

// Visual QA capture for PLAN.md Task 9.2 step 6. Opt-in: QA_SHOTS=1 pnpm playwright test e2e/qa-screenshots.spec.ts
test.skip(process.env.QA_SHOTS !== "1", "set QA_SHOTS=1 to capture visual QA screenshots");

const OUT = "docs/evidence/gate-9/qa";
const VIEWPORTS = [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [320, 720],
] as const;
const BASE = "/?world=fake&compiler=off&operator=1";

type Surface = "input" | "staging-or-ready" | "play" | "finished-original" | "patch-listening" | "result";
const SURFACES: Surface[] = ["input", "staging-or-ready", "play", "finished-original", "patch-listening", "result"];

/** Speech fake: `hold` keeps the Listening surface forever; otherwise it returns the 2× patch transcript. */
function installFakeSpeech(page: Page, hold: boolean) {
  return page.addInitScript((hold) => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        if (hold) return;
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [[{ transcript: "double the turn rate" }]] });
          this.onend?.();
        }, 300);
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  }, hold);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

/** Walks the fake-world arc, calling `capture` at each surface up to and including `until`. */
async function walk(
  page: Page,
  until: Surface,
  capture: (surface: Surface) => Promise<void>,
  url = BASE,
) {
  const reach = SURFACES.indexOf(until);
  const at = async (surface: Surface) => {
    await capture(surface);
    return SURFACES.indexOf(surface) >= reach;
  };
  await page.goto(url);
  const make = page.getByRole("button", { name: "Make playable" });
  await expect(make).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(300);
  if (await at("input")) return;
  await make.click();
  await page.waitForTimeout(300);
  if (await at("staging-or-ready")) return;
  const start = page.getByRole("button", { name: "Start run" });
  await expect(start).toBeVisible({ timeout: 15_000 });
  await start.click();
  await page.waitForTimeout(1000);
  if (await at("play")) return;
  expect((await driveToWin(page)).run?.status).toBe("won");
  await expect(page.getByText("Course complete.")).toBeVisible();
  if (await at("finished-original")) return;
  await page.getByRole("button", { name: "Speak a new rule" }).click();
  await expect(page.getByRole("heading", { name: "Listening" })).toBeVisible();
  await page.waitForTimeout(300);
  if (await at("patch-listening")) return;
  await expect(page.getByText("TURN RATE ×2", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => document.querySelector(".hud") !== null), { timeout: 15_000 }).toBe(true);
  expect((await driveToWin(page)).run?.status).toBe("won");
  await expect(page.getByRole("link", { name: "Download cartridge" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await at("result");
}

test("visual QA screenshots", async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });

  for (const [width, height] of VIEWPORTS) {
    const vp = `${width}x${height}`;
    await page.setViewportSize({ width, height });
    await installFakeSpeech(page, true);
    await walk(page, "patch-listening", async (surface) => {
      if (surface !== "result") await shot(page, `${surface}-${vp}`);
    });
    await installFakeSpeech(page, false);
    await walk(page, "result", async (surface) => {
      if (surface === "result") await shot(page, `${surface}-${vp}`);
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await installFakeSpeech(page, false);

  // 200% zoom: input and result.
  const zoom2 = () => page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await walk(page, "result", async (surface) => {
    if (surface === "input" || surface === "result") {
      await zoom2();
      await page.waitForTimeout(300);
      await shot(page, `${surface}-zoom2`);
      await page.evaluate(() => { document.documentElement.style.zoom = ""; });
    }
  });

  // 64-char title on the result surface.
  await walk(page, "result", async (surface) => {
    if (surface === "result") await shot(page, "result-long-title");
  }, `${BASE}&title=long`);

  // Reduced motion: input and listening.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installFakeSpeech(page, true);
  await walk(page, "patch-listening", async (surface) => {
    if (surface === "input" || surface === "patch-listening") await shot(page, `${surface}-reduced`);
  });
  await page.emulateMedia({ reducedMotion: null });

  // Keyboard focus ring on the input surface.
  await walk(page, "input", async () => {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await shot(page, "input-focus-1440x900");
  });
});
