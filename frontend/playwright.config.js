import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    use: { baseURL: "http://localhost:3000", channel: "chrome", viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
    webServer: { command: "npm run dev -- --hostname 127.0.0.1", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 60000 },
});
