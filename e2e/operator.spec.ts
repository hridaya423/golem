import { expect, test } from "@playwright/test";
import { collectErrors, readSnapshot } from "./helpers";
import { FIXTURE_COURSE, routeOf } from "../src/game/glide";

test("operator panel is query-gated and drives the fallback ladder", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/?world=fake&compiler=off");
  await expect(page.getByRole("button", { name: "Make playable" })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator(".operator")).toHaveCount(0);

  await page.goto("/?world=fake&operator=1");
  await expect(page.getByRole("button", { name: "Make playable" })).toBeEnabled({ timeout: 15_000 });
  const panel = page.locator(".operator");
  await expect(panel).toBeVisible();
  await panel.locator("summary").click();
  await page.getByLabel("Use cached rules (skip compiler)").check();
  await page.getByRole("button", { name: "Make playable" }).click();
  await expect(page.getByRole("button", { name: "Start run" })).toBeVisible({ timeout: 15_000 });
  const ready = await readSnapshot(page);
  expect(ready?.spec?.source).toBe("fallback");
  expect(ready?.fallbackLevel).toBe(4);
  await expect(page.getByText("Prepared game (compiler unavailable)")).toBeVisible();

  await page.getByRole("button", { name: "Show proof (2 s)" }).click();
  const proof = page.locator(".proof");
  await expect(proof).toBeVisible();
  await expect(proof).toContainText("LEVEL 4");
  const firstGate = routeOf(FIXTURE_COURSE)[0];
  await expect(proof).toContainText(`ROUTE ${firstGate.id}@${firstGate.position.join(",")}`);
  await expect(proof).toBeHidden({ timeout: 4000 });

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect.poll(async () => (await readSnapshot(page))?.phase).toBe("input");
  expect((await readSnapshot(page))?.seedId).toMatch(/^[0-9a-f]{64}$/);
  expect(errors).toEqual([]);
});

test("live mode without a key names the setup and preserves the seed without a fake fallback", async ({ page }) => {
  const tokenFailure = Promise.withResolvers<void>();
  await page.route("**/api/reactor/token", async (route) => {
    await tokenFailure.promise;
    await route.fulfill({ status: 503, json: { error: "REACTOR_API_KEY is not configured on the server (.env.local)" } });
  });
  await page.goto("/?operator=1&compiler=off&world=live");
  await expect.poll(async () => (await readSnapshot(page))?.seedId).toMatch(/^[0-9a-f]{64}$/);
  const before = await readSnapshot(page);
  expect(before?.mode).toBe("live");
  tokenFailure.resolve();

  await expect(page.getByRole("status").filter({ hasText: "REACTOR_API_KEY" })).toBeVisible({ timeout: 20_000 });
  await page.locator(".operator summary").click();
  await expect(page.getByText("FAKE WORLD — not live generation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /fake world/i, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make playable" })).toBeEnabled();
  const after = await readSnapshot(page);
  expect(after?.mode).toBe("live");
  expect(after?.world.kind).toBe("live");
  expect(after?.phase).toBe("input");
  expect(after?.fallbackLevel).toBe(3);
  expect(after?.seedId).toBe(before?.seedId);
});
