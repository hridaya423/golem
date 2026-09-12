import { expect, test } from "@playwright/test";
import { collectErrors, driveToWin } from "./helpers";

async function winOriginalRun(page: import("@playwright/test").Page) {
  await page.goto("/?world=fake&compiler=off");
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start run" }).click();
  const final = await driveToWin(page);
  expect(final.run?.status).toBe("won");
  await expect(page.getByText("Course complete")).toBeVisible();
}

test("unsupported speech falls back to a typed rule", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });
  await winOriginalRun(page);
  await page.getByRole("button", { name: "Speak a new rule" }).click();
  await expect(page.locator(".error-text")).toContainText("not available");
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByRole("textbox", { name: "New rule" }).fill("make it slower");
  await page.getByRole("button", { name: "Apply rule" }).click();
  await expect(page.getByText("TURN RATE ×0.5", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  expect(errors).toEqual([]);
});

test("denied microphone shows the error state with retry", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    class DeniedRecognition {
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }, 100);
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = DeniedRecognition;
  });
  await winOriginalRun(page);
  await page.getByRole("button", { name: "Speak a new rule" }).click();
  await expect(page.locator(".error-text")).toContainText("declined");
  await expect(page.getByRole("button", { name: "Retry speech" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Type instead" })).toBeVisible();
  expect(errors).toEqual([]);
});
