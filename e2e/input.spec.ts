import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { collectErrors, readSnapshot } from "./helpers";

const FIXTURE_ID = "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42";

test.beforeEach(async ({ page }) => {
  await page.goto("/?world=fake&compiler=off");
  await expect(page.getByAltText("Seed image: glide-ink-islands.webp")).toBeVisible();
});

test("an uploaded PNG becomes the seed and reaches ready", async ({ page }) => {
  const errors = collectErrors(page);
  const png = await sharp({
    create: { width: 900, height: 500, channels: 3, background: { r: 40, g: 90, b: 160 } },
  })
    .png()
    .toBuffer();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "sketch.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Seed image: sketch.png")).toBeVisible();
  const snapshot = await readSnapshot(page);
  expect(snapshot?.seedId).toMatch(/^[0-9a-f]{64}$/);
  expect(snapshot?.seedId).not.toBe(FIXTURE_ID);
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("a non-image file is rejected and keeps the current seed", async ({ page }) => {
  const errors = collectErrors(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.locator(".error-text")).toContainText("PNG, JPEG or WebP");
  const snapshot = await readSnapshot(page);
  expect(snapshot?.seedId).toBe(FIXTURE_ID);
  await expect(page.getByAltText("Seed image: glide-ink-islands.webp")).toBeVisible();
  expect(errors).toEqual([]);
});

test("camera capture becomes the seed", async ({ page }) => {
  const errors = collectErrors(page);
  await page.getByRole("button", { name: "Use camera" }).click();
  const capture = page.getByRole("button", { name: "Capture frame" });
  await expect(capture).toBeEnabled({ timeout: 15_000 });
  await capture.click();
  await expect(page.getByAltText("Seed image: camera-capture.png")).toBeVisible();
  const snapshot = await readSnapshot(page);
  expect(snapshot?.seedId).not.toBe(FIXTURE_ID);
  expect(errors).toEqual([]);
});

test("camera denial explains itself and cancel keeps the seed", async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () =>
          Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
      },
      configurable: true,
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Use camera" }).click();
  await expect(
    page.getByText("Camera access was declined. You can still upload an image."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByAltText("Seed image: glide-ink-islands.webp")).toBeVisible();
  const snapshot = await readSnapshot(page);
  expect(snapshot?.seedId).toBe(FIXTURE_ID);
  expect(errors).toEqual([]);
});
