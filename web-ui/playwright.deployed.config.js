import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/deployed-results.json" }]
  ],
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
