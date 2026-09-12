import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { FALLBACK_CANDIDATE } from "../src/game/fallback";
import { collectErrors, driveToWin, readSnapshot } from "./helpers";

const FIXTURE_ID = "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42";

const validCandidate = (title: string) => ({ ...structuredClone(FALLBACK_CANDIDATE), title });
const brokenCandidate = () => {
  const c = structuredClone(FALLBACK_CANDIDATE);
  c.rules = { ...c.rules, goalEntityId: "cp3" };
  return c;
};
const compileBody = (candidate: unknown) => ({ ok: true, candidate, elapsedMs: 5, label: "intercepted" });

/** Intercepts /api/compile with a scripted sequence of candidates and records the requests. */
async function interceptCompile(page: Page, candidates: unknown[]) {
  const requests: { hasRepair: boolean }[] = [];
  await page.route("**/api/compile", async (route) => {
    const body = route.request().postData() ?? "";
    requests.push({ hasRepair: body.includes('name="repair"') });
    const candidate = candidates[Math.min(requests.length - 1, candidates.length - 1)];
    await route.fulfill({ json: compileBody(candidate) });
  });
  return requests;
}

function installFakeSpeech(page: Page) {
  return page.addInitScript(() => {
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
}

test("compiler branches: repaired and fallback are truthful", async ({ page }) => {
  const errors = collectErrors(page);
  const requests = await interceptCompile(page, [brokenCandidate(), validCandidate("Repaired Game")]);
  await page.goto("/?world=fake");
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  expect(requests).toHaveLength(2);
  expect(requests[1].hasRepair).toBe(true);
  expect((await readSnapshot(page))?.spec?.source).toBe("repaired");
  await expect(page.getByRole("heading", { name: "Repaired Game" })).toBeVisible();
  await expect(page.getByText("Repaired rules · intercepted")).toBeVisible();

  await page.unroute("**/api/compile");
  const again = await interceptCompile(page, [brokenCandidate(), brokenCandidate()]);
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  expect(again).toHaveLength(2);
  expect((await readSnapshot(page))?.spec?.source).toBe("fallback");
  await expect(page.getByRole("heading", { name: "Ink Islands Glide" })).toBeVisible();
  await expect(page.getByText("Prepared game (compiler unavailable)")).toBeVisible();
  expect(errors).toEqual([]);
});

test("complete arc: live rules, play, speech patch, same-world replay, cartridge, reset", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(request.url()));
  await installFakeSpeech(page);
  const requests = await interceptCompile(page, [validCandidate("Intercepted Live Game")]);
  await page.route("**/api/patch", (route) =>
    route.fulfill({
      json: {
        ok: true,
        candidate: { version: 1, mechanic: "glide", operation: "multiply_turn_rate", factor: 2, cartridgeLine: "Twice the bite through the arches." },
        elapsedMs: 5,
        label: "intercepted",
      },
    }),
  );

  await page.goto("/?world=fake");
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  expect(requests).toHaveLength(1);
  const ready = await readSnapshot(page);
  expect(ready?.spec?.source).toBe("live");
  expect(ready?.spec?.referenceImageId).toBe(FIXTURE_ID);
  expect(ready?.fallbackLevel).toBe(4);
  await expect(page.getByRole("heading", { name: "Intercepted Live Game" })).toBeVisible();
  const promptHashBefore = ready?.worldPromptHash;
  expect(promptHashBefore).toMatch(/^[0-9a-f]{64}$/);

  await page.getByRole("button", { name: "Start run" }).click();
  // Held input must release on window blur.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(300);
  expect((await readSnapshot(page))?.input.turn).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await readSnapshot(page))?.input).toEqual({ turn: 0, pitch: 0, boost: false });
  await page.keyboard.up("ArrowRight");

  const first = await driveToWin(page);
  expect(first.run?.status).toBe("won");
  expect(first.run?.completed).toEqual(["cp1", "cp2", "cp3", "goal"]);
  await expect(page.getByText("Course complete.")).toBeVisible();

  await page.getByRole("button", { name: "Speak a new rule" }).click();
  await expect(page.getByText("TURN RATE ×2", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await readSnapshot(page))?.phase, { timeout: 15_000 }).toBe("playing");
  const patched = await readSnapshot(page);
  expect(patched?.patch).toMatchObject({ factor: 2, source: "live", originalTurnRate: 1, patchedTurnRate: 2, reactorDegBefore: 6, reactorDegAfter: 12 });
  expect(patched?.patch?.sessionIdBefore).toBe(patched?.patch?.sessionIdAfter);
  expect(patched?.worldPromptHash).toBe(promptHashBefore);
  expect(patched?.spec?.referenceImageId).toBe(FIXTURE_ID);

  const second = await driveToWin(page);
  expect(second.run?.status).toBe("won");
  await expect.poll(async () => (await readSnapshot(page))?.phase, { timeout: 15_000 }).toBe("result");
  await expect(page.getByRole("heading", { name: "Intercepted Live Game" })).toBeVisible();
  await expect(page.getByText(/GLIDE ·/)).toBeVisible();
  await expect(page.getByText("Twice the bite through the arches.")).toBeVisible();
  await expect(page.getByRole("img", { name: /Game cartridge for Intercepted Live Game/ })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download cartridge" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("golem-intercepted-live-game.png");
  const file = readFileSync((await download.path())!);
  expect([...file.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(file.length).toBeGreaterThan(50_000);
  await page.screenshot({ path: "docs/evidence/gate-7/result.png" });

  await page.getByRole("button", { name: "Make another" }).click();
  await expect.poll(async () => (await readSnapshot(page))?.phase).toBe("input");
  expect((await readSnapshot(page))?.seedId).toBe(FIXTURE_ID);
  await expect(page.getByRole("button", { name: "Make playable" })).toBeVisible();

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
