import { defineConfig, devices } from "@playwright/test";

const realReactor = process.env.REAL_REACTOR === "1";
const port = realReactor ? 3000 : 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  webServer: {
    command: realReactor
      ? `pnpm dev --hostname 127.0.0.1 --port ${port}`
      : `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: realReactor,
    env: realReactor ? {} : { GOLEM_TEST_WORLD: "fake" },
  },
});
