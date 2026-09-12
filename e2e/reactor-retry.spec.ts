import { expect, test, type Page } from "@playwright/test";

type Failure = { status: number; body: object; retryAfter?: number };
const quota = (seconds: number): Failure => ({
  status: 429,
  retryAfter: seconds,
  body: {
    current: 10,
    error: "quota_exceeded",
    limit: 10,
    message: 'quota exceeded: sessions_per_minute for model "reactor/lingbot-world-2"',
    quota_type: "sessions_per_minute",
    retry_after_seconds: seconds,
  },
});

async function interceptConnection(page: Page, failures: Failure[], hold?: Promise<void>) {
  const starts: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/reactor/token") {
      return route.fulfill({ json: { jwt: "offline-retry-test", expires_at: Math.floor(Date.now() / 1000) + 3600 } });
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
    if (url.pathname === "/sessions" && route.request().method() === "POST") {
      starts.push(url.pathname);
      const failure = failures[Math.min(starts.length - 1, failures.length - 1)];
      await hold;
      return route.fulfill({
        status: failure.status,
        headers: { "Access-Control-Allow-Origin": "*", ...(failure.retryAfter === undefined ? {} : { "Retry-After": String(failure.retryAfter) }) },
        json: failure.body,
      });
    }
    return route.fulfill({ status: 403, json: { error: "External services blocked by test" } });
  });
  await page.clock.install();
  await page.goto("/?operator=1&world=live&compiler=off");
  return starts;
}

test("one startup request, quota cooldown respected, exponential retry then auth stop", async ({ page }) => {
  const starts = await interceptConnection(page, [quota(30), quota(2), { status: 401, body: { error: "unauthorized" } }]);
  const status = page.getByRole("status").filter({ hasText: /rate limit/i });
  await expect(status).toBeVisible();
  await expect(status).not.toContainText("pool is full");
  expect(starts).toHaveLength(1);
  await page.clock.runFor(28_000);
  expect(starts).toHaveLength(1);
  await page.clock.runFor(3000);
  await expect.poll(() => starts.length).toBe(2);
  await expect(status).toContainText("2/5");
  await page.clock.runFor(14_000);
  expect(starts).toHaveLength(2);
  await page.clock.runFor(3000);
  await expect.poll(() => starts.length).toBe(3);
  await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();
  await page.clock.runFor(120_000);
  expect(starts).toHaveLength(3);
});

test("capacity is distinct from quota and disconnect cancels a scheduled retry", async ({ page }) => {
  const starts = await interceptConnection(page, [{ status: 429, body: { error: "no available capacity: no available servers to handle the request" } }]);
  await expect(page.getByRole("status").filter({ hasText: /capacity|GPU/i })).toBeVisible();
  expect(starts).toHaveLength(1);
  await page.locator(".operator summary").click();
  await page.getByRole("button", { name: "Disconnect world" }).click();
  await page.clock.runFor(120_000);
  expect(starts).toHaveLength(1);
});

test("manual reconnect cannot bypass cooldown or duplicate a queued retry", async ({ page }) => {
  const starts = await interceptConnection(page, [quota(30), { status: 401, body: { error: "unauthorized" } }]);
  await expect(page.getByRole("status").filter({ hasText: /rate limit/i })).toBeVisible();
  await page.locator(".operator summary").click();
  await page.getByRole("button", { name: "Disconnect world" }).click();
  const retry = page.getByRole("button", { name: "Retry connection" });
  await expect(retry).toBeVisible();
  await retry.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await page.clock.runFor(28_000);
  expect(starts).toHaveLength(1);
  await page.clock.runFor(3000);
  await expect.poll(() => starts.length).toBe(2);
  await expect(retry).toBeVisible();
  await page.clock.runFor(120_000);
  expect(starts).toHaveLength(2);
});

test("disconnect during an in-flight start prevents follow-up attempts", async ({ page }) => {
  const response = Promise.withResolvers<void>();
  try {
    const starts = await interceptConnection(page, [quota(2)], response.promise);
    await expect.poll(() => starts.length).toBe(1);
    await page.locator(".operator summary").click();
    await page.getByRole("button", { name: "Disconnect world" }).click();
    response.resolve();
    await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();
    await page.clock.runFor(120_000);
    expect(starts).toHaveLength(1);
  } finally {
    response.resolve();
  }
});
