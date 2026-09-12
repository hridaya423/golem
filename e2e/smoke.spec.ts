import { test, expect } from "@playwright/test";

test("empty app renders without console or page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "ANYTHING//PLAY", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
