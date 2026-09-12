import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { collectErrors, driveToWin, readSnapshot } from "./helpers";

const FIXTURE_ID = "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42";

test("full flow: play, patch by speech, replay, cartridge", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);

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
          this.onresult?.({
            resultIndex: 0,
            results: [[{ transcript: "double the turn rate" }]],
          });
          this.onend?.();
        }, 300);
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  });

  await page.goto("/?world=fake&compiler=off");
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start run" }).click();

  const first = await driveToWin(page);
  expect(first.run?.status).toBe("won");
  expect(first.run?.completed).toEqual(["cp1", "cp2", "cp3", "goal"]);
  expect(first.spec?.source).toBe("fallback");
  expect(first.spec?.referenceImageId).toBe(FIXTURE_ID);
  await expect(page.getByText("Course complete")).toBeVisible();

  await page.getByRole("button", { name: "Speak a new rule" }).click();
  await expect(page.getByText("TURN RATE ×2", { exact: true })).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => (await readSnapshot(page))?.phase, { timeout: 15_000 })
    .toBe("playing");
  const patchSnap = await readSnapshot(page);
  expect(patchSnap?.patch?.factor).toBe(2);
  expect(patchSnap?.patch?.sessionIdBefore).toBe(patchSnap?.patch?.sessionIdAfter);
  expect(patchSnap?.patch?.patchedTurnRate).toBe(2);
  expect(patchSnap?.patch?.reactorDegAfter).toBe(12);
  expect(patchSnap?.patch?.reactorDegBefore).toBe(6);

  const second = await driveToWin(page);
  expect(second.run?.status).toBe("won");
  await expect
    .poll(async () => (await readSnapshot(page))?.phase, { timeout: 15_000 })
    .toBe("result");

  await expect(page.getByRole("heading", { name: "Ink Islands Glide" })).toBeVisible();
  await expect(page.getByText(/GLIDE ·/)).toBeVisible();
  await expect(page.getByText("TURN RATE ×2", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download cartridge" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^anything-play-.*\.png$/);
  const file = readFileSync((await download.path())!);
  expect([...file.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(file.length).toBeGreaterThan(50_000);

  await page.screenshot({ path: "docs/evidence/gate-7/result.png" });
  expect(errors).toEqual([]);
});
