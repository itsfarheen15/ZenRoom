import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("weather is opt-in, follows conditions, pauses, supports themes and clears on logout", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 19.076, longitude: 72.877 });
    let connected = true;
    let code = 61;
    let calls = 0;
    let failure = false;
    await page.route("http://localhost:8000/api/**", route => {
        const req = route.request();
        const headers = { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrftoken", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS" };
        const send = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (req.url().includes("/session/")) {
            if (req.method() === "DELETE") connected = false;
            return send({ user: connected ? { id: 1 } : null, csrf_token: "test-csrf" });
        }
        if (req.url().includes("/weather/")) {
            calls++;
            expect(req.postDataJSON()).toEqual({ latitude: 19.08, longitude: 72.88 });
            expect(req.headers()["x-csrftoken"]).toBe("test-csrf");
            if (failure) return send({ detail: "Weather is temporarily unavailable." }, 503);
            return send({ current: { temperature_2m: 28.2, apparent_temperature: 30, relative_humidity_2m: 65, weather_code: code, is_day: 1, wind_speed_10m: 12, precipitation: .4 }, observed_at: new Date().toISOString(), stale: false });
        }
        return send({ items: [], results: [], fetched_at: new Date().toISOString() });
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Use my location" })).toBeVisible();
    expect(calls).toBe(0);
    const clockBounds = await page.locator('.clock-widget').boundingBox();
    const weatherBounds = await page.locator('.weather-widget').boundingBox();
    expect(weatherBounds.x).toBeGreaterThanOrEqual(clockBounds.x + clockBounds.width);
    expect(Math.min(weatherBounds.y + weatherBounds.height, clockBounds.y + clockBounds.height)).toBeGreaterThan(Math.max(weatherBounds.y, clockBounds.y));
    await expect(page.locator(".welcome .time-weather .weather-widget")).toBeVisible();
    await expect(page.locator(".dashboard-grid .weather-widget")).toHaveCount(0);
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByText("Rain & drizzle")).toBeVisible();
    await page.locator(".weather-more summary").click();
    await expect(page.locator(".weather-window")).toHaveAttribute("data-weather", "rain");
    await page.getByRole("button", { name: "Ambient motion", exact: true }).click();
    await expect(page.locator(".weather-particle").first()).toHaveCSS("animation-play-state", "paused");
    for (const [nextCode, scene] of [[0, "sun"], [3, "cloud"], [45, "fog"], [73, "snow"], [95, "storm"]]) {
        code = nextCode;
        await page.getByRole("button", { name: "Refresh weather" }).click();
        await expect(page.locator(".weather-window")).toHaveAttribute("data-weather", scene);
    }
    for (const theme of ["dark", "light", "comfort"]) {
        await page.getByLabel("Color theme").selectOption(theme);
        await expect(page.locator(".weather-actions button").first()).toHaveCSS("color", { dark: "rgb(232, 238, 233)", light: "rgb(24, 45, 41)", comfort: "rgb(62, 48, 34)" }[theme]);
        await expect(page.locator(".weather-credit a").first()).toHaveCSS("color", { dark: "rgb(148, 163, 163)", light: "rgb(61, 82, 76)", comfort: "rgb(89, 67, 46)" }[theme]);
        const audit = await new AxeBuilder({ page }).include(".weather-widget").withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(audit.violations).toEqual([]);
    }
    await page.locator(".weather-more summary").click();
    await page.screenshot({ path: "test-results/weather-desktop.png", fullPage: true });
    for (const width of [900, 768, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator(".weather-more summary").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".weather-particle").first()).toHaveCSS("animation-name", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    failure = true;
    await page.getByRole("button", { name: "Refresh weather" }).click();
    await expect(page.getByText("Last saved conditions · Update delayed")).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("19.08");
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.locator(".weather-window")).toHaveCount(0);
});

test("denied location is actionable and never calls weather", async ({ page }) => {
    await page.addInitScript(() => {
        navigator.geolocation.getCurrentPosition = (success, failure) => failure({ code: 1 });
    });
    await page.route("http://localhost:8000/api/**", route => route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify(route.request().url().includes("session") ? { user: { id: 1 }, csrf_token: "test" } : { items: [], results: [] }) }));
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByText(/Location access was denied/)).toBeVisible();
    await expect(page.locator(".weather-window")).toHaveCount(0);
});
