import { defineConfig, devices } from "@playwright/test";

const PORT = 4317;

/**
 * Chromium: o Playwright usa PLAYWRIGHT_BROWSERS_PATH quando definido
 * (neste ambiente, /opt/pw-browsers, revisão compatível já instalada).
 * Para apontar outro binário: PW_CHROMIUM=/caminho/do/chrome.
 */
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: `npx vite build --logLevel warn && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "capture", testMatch: /capture\.spec\.ts/ },
    { name: "capture-d", testMatch: /parte-d\.spec\.ts/, timeout: 120_000 },
    { name: "overflow", testMatch: /overflow\.spec\.ts/ },
    { name: "bench", testMatch: /bench\.spec\.ts/, timeout: 30 * 60_000 },
    { name: "lab", testMatch: /lab\.spec\.ts/ },
    { name: "capture-c2", testMatch: /parte-c2\.spec\.ts/, timeout: 120_000 },
    { name: "determinism", testMatch: /determinism\.spec\.ts/, timeout: 20 * 60_000 },
  ],
});
