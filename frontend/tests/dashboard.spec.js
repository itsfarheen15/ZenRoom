import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function mockDjango(page, failedFeed = false) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const date = ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
    let tasks = [
        { id: 1, title: "Make a little room for good ideas", description: "", status: "pending", scheduled_date: date },
        { id: 2, title: "Review the API contracts", description: "", status: "completed", scheduled_date: date },
        { id: 3, title: "Explore a new side project", description: "", status: "in_progress", scheduled_date: "2099-10-12" },
        { id: 4, title: "Give the README some love", description: "", status: "pending", scheduled_date: "2020-10-10" },
    ];
    let links = [
        { id: 1, title: "GitHub", url: "https://github.com", position: 0 },
        { id: 2, title: "MDN Web Docs", url: "https://developer.mozilla.org", position: 1 },
        { id: 3, title: "Stack Overflow", url: "https://stackoverflow.com", position: 2 },
        { id: 4, title: "Dev.to", url: "https://dev.to", position: 3 },
    ];
    const articles = [
        { title: "The web is better when we build a little less.", source: "Test editorial", description: "A quieter approach to shipping: smaller bundles, clearer interfaces, and tools that get out of the way.", url: "https://example.com/web", published_at: "2026-10-12T07:00:00Z" },
        { title: "There’s a certain joy in tools that just work locally.", source: "Test developer digest", description: "", url: "https://example.com/tools", published_at: "2026-10-12T07:00:00Z" },
        { title: "Good accessibility is good attention to detail.", source: "Test design journal", description: "", url: "https://example.com/accessibility", published_at: "2026-10-12T07:00:00Z" },
        { title: "A fresh perspective on the everyday developer workflow.", source: "Test community", description: "", url: "https://example.com/workflow", published_at: "2026-10-12T07:00:00Z" },
        { title: "Why small open-source contributions matter.", source: "Test open source", description: "", url: "https://example.com/oss", published_at: "2026-10-12T07:00:00Z" },
    ];
    const repos = ["sample/quiet-tools", "sample/side-project", "sample/daily-notes", "sample/room-for-ideas", "sample/flow-state"].map((name, index) => ({ id: index + 1, name, description: ["Thoughtful little tools for a better developer day.", "A small beginning for your next big idea.", "Keep a little space for what you learn.", "Simple building blocks for the open web.", "Less friction between thinking and building."][index], url: `https://github.com/${name}`, language: index % 2 ? "Python" : "TypeScript", stars: 2100 - index * 231 }));
    let signedIn = false;
    await page.route("http://localhost:8000/api/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        const headers = { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "authorization,content-type,x-csrftoken", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
        const fulfill = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
        if (method === "OPTIONS")
            return route.fulfill({ status: 204, headers });
        if (path === "/api/session/") {
            if (method === "POST") signedIn = true;
            if (method === "DELETE") signedIn = false;
            return fulfill({ user: signedIn ? { id: 1, username: "test" } : null, csrf_token: "mock-csrf" });
        }
        if (!signedIn) return fulfill({ detail: "Session expired." }, 401);
        if (path.includes("/tasks/")) {
            if (method === "POST") {
                const task = { ...request.postDataJSON(), id: Date.now(), description: "", status: "pending" };
                tasks.push(task);
                return fulfill(task, 201);
            }
            const id = Number(path.split("/").filter(Boolean).at(-1));
            if (method === "PATCH") {
                tasks = tasks.map((task) => task.id === id ? { ...task, ...request.postDataJSON() } : task);
                return fulfill(tasks.find((task) => task.id === id));
            }
            if (method === "DELETE") {
                tasks = tasks.filter((task) => task.id !== id);
                return route.fulfill({ status: 204, headers });
            }
            return fulfill({ count: tasks.length, next: null, previous: null, results: tasks });
        }
        if (path.includes("/links/")) {
            if (method === "POST") {
                const link = { ...request.postDataJSON(), id: Date.now() };
                links.push(link);
                return fulfill(link, 201);
            }
            const id = Number(path.split("/").filter(Boolean).at(-1));
            if (method === "PATCH") {
                links = links.map((link) => link.id === id ? { ...link, ...request.postDataJSON() } : link);
                return fulfill(links.find((link) => link.id === id));
            }
            if (method === "DELETE") {
                links = links.filter((link) => link.id !== id);
                return route.fulfill({ status: 204, headers });
            }
            return fulfill({ count: links.length, next: null, previous: null, results: links });
        }
        if (path.includes("summarize")) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return fulfill({ bullet_points: ["Start with the smallest useful experience.", "Keep performance and accessibility in the design.", "Leave room for the work to take center stage."], cached: false });
        }
        if (failedFeed)
            return fulfill({ detail: "The background worker has not populated this feed yet." }, 503);
        return fulfill({ items: path.includes("github") ? repos : articles, stale: false, fetched_at: new Date().toISOString() });
    });
}
async function connect(page) {
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await page.getByLabel("Access token").fill("test-token");
    await page.getByRole("dialog").getByRole("button", { name: "Connect workspace" }).click();
    await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "sample/quiet-tools" })).toBeVisible();
}
test("live workspace: tasks, link CRUD, article summary, keyboard close and disconnect", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await mockDjango(page);
    await page.goto("/");
    await connect(page);
    await page.getByLabel("New task", { exact: true }).fill("Ship the zen room");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const checkbox = page.getByRole("checkbox", { name: /Ship the zen room/ });
    await expect(checkbox).toBeVisible();
    // Completion waits for Django to confirm the write.
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await page.getByRole("button", { name: "Delete Ship the zen room" }).click();
    await expect(checkbox).toHaveCount(0);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Django Docs");
    await page.getByLabel("URL", { exact: true }).fill("https://docs.djangoproject.com");
    await page.getByRole("button", { name: "Save link" }).click();
    await expect(page.getByRole("heading", { name: "Django Docs" })).toBeVisible();
    await page.getByRole("button", { name: "Edit Django Docs" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Django Reference");
    await page.getByRole("button", { name: "Save link" }).click();
    await expect(page.getByRole("heading", { name: "Django Reference" })).toBeVisible();
    await page.getByRole("button", { name: "Edit Django Reference" }).click();
    await page.getByRole("button", { name: "Delete link" }).click();
    await expect(page.getByRole("heading", { name: "Django Reference" })).toHaveCount(0);
    const headline = page.getByRole("button", { name: /The web is better/ });
    await headline.click();
    await expect(page.getByRole("dialog").getByRole("listitem")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(headline).toBeFocused();
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.getByText("Connect your workspace to bring this widget to life.").first()).toBeVisible();
    expect(errors).toEqual([]);
});
test("desktop layout, clock, paused animation, and accessible content", async ({ page }) => {
    await mockDjango(page);
    await page.goto("/");
    await connect(page);
    await expect(page.locator(".dashboard-grid > .widget")).toHaveCount(5);
    await expect(page.locator(".react-resizable-handle")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset layout" })).toHaveCount(0);
    const seconds = await page.locator(".clock-seconds").textContent();
    await expect(page.locator(".clock-seconds")).not.toHaveText(seconds || "--");
    await page.getByRole("button", { name: "Ambient motion" }).click();
    await expect(page.locator(".wave-one")).toHaveCSS("animation-play-state", "paused");
    await expect(page.locator(".ticker-track")).toHaveCSS("animation-play-state", "paused");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true });
});
test("mobile and reduced-motion layouts", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockDjango(page);
    await page.goto("/");
    await connect(page);
    await expect(page.locator(".wave-one")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".ticker-track")).toHaveCSS("animation-name", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true });
    expect(errors).toEqual([]);
});
test("feed errors stay explicit and retries are available", async ({ page }) => {
    await mockDjango(page, true);
    await page.goto("/");
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await page.getByLabel("Access token").fill("test-token");
    await page.getByRole("dialog").getByRole("button", { name: "Connect workspace" }).click();
    await expect(page.getByText("The background worker has not populated this feed yet.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" }).first()).toBeVisible();
    await expect(page.getByText("Make a little room for good ideas")).toBeVisible();
});

test("themes persist, remain readable, and keep the workspace connected", async ({ page }) => {
    test.setTimeout(90000);
    await mockDjango(page);
    await page.goto("/");
    await connect(page);
    for (const theme of ["light", "comfort", "dark"]) {
        await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
        await expect(page.locator(".zen-room")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
        expect(await page.locator(".repo-content p").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
        await expect(page.locator(".ambient-toggle")).toHaveCSS("background-color", { light: "rgb(232, 239, 234)", comfort: "rgb(234, 221, 197)", dark: "rgb(16, 26, 29)" }[theme]);
        const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({ path: `test-results/theme-${theme}.png`, fullPage: true });
        await page.getByRole("button", { name: /The web is better/ }).click();
        await expect(page.locator(".modal[open] .modal-panel")).toHaveCSS("opacity", "1");
        await expect(page.getByRole("dialog").getByRole("listitem")).toHaveCount(3);
        for (const point of await page.getByRole("dialog").getByRole("listitem").all()) {
            await expect(point).toHaveCSS("opacity", "1");
        }
        const dialogA11y = await new AxeBuilder({ page }).include(".modal").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(dialogA11y.violations).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page.getByRole("combobox", { name: "Color theme" }).selectOption("comfort");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Color theme" })).toHaveValue("comfort");
    await expect(page.locator(".zen-room")).toHaveAttribute("data-theme", "comfort");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "comfort", "dark"]) {
        await page.getByRole("combobox", { name: "Color theme" }).selectOption(theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});

test("session refresh, logout reload, expiry, and no stored credentials", async ({ page }) => {
    await mockDjango(page);
    await page.goto("/");
    await connect(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
    await expect(page.getByText("Make a little room for good ideas")).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("test-token");
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.getByText("Make a little room for good ideas")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Connect workspace", exact: true })).toBeVisible();
    await connect(page);
    await page.route("http://localhost:8000/api/tasks/**", route => route.request().method() === "OPTIONS" ? route.fallback() : route.fulfill({ status: 401, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ detail: "Session expired." }) }));
    await page.getByRole("checkbox", { name: /Make a little room/ }).click();
    await expect(page.locator(".session-message")).toContainText("Your session expired");
    await expect(page.getByText("Make a little room for good ideas")).toHaveCount(0);
});

test("galaxy stars animate, avoid cursor distortion, pause and respect reduced motion", async ({ page }) => {
    await mockDjango(page);
    // Freeze simulation time to check that pointer events cannot warp the scene directly.
    await page.addInitScript(() => {
        const nativeRAF = window.requestAnimationFrame.bind(window);
        window.tunnelTime = 100;
        window.requestAnimationFrame = callback => nativeRAF(() => callback(window.tunnelTime));
        const originalStroke = CanvasRenderingContext2D.prototype.stroke;
        CanvasRenderingContext2D.prototype.stroke = function (...args) {
            if (this.canvas.classList.contains("light-tunnel")) {
                window.tunnelStrokes = (window.tunnelStrokes || 0) + 1;
            }
            return originalStroke.apply(this, args);
        };
    });
    await page.goto("/");
    const canvas = page.locator(".light-tunnel");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveCSS("pointer-events", "none");
    const picture = () => canvas.evaluate(el => el.toDataURL());
    const first = await picture();
    await page.evaluate(() => { window.tunnelTime = 200; });
    await expect.poll(picture).not.toBe(first);
    const beforeHidden = await page.evaluate(() => window.tunnelStrokes);
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
        window.tunnelTime = 300;
    });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.tunnelStrokes)).toBe(beforeHidden);
    await page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByRole("button", { name: "Ambient motion", exact: true }).click();
    const stopped = await picture();
    await page.mouse.move(600, 400);
    await page.waitForTimeout(120);
    expect(await picture()).toBe(stopped);
    await page.getByRole("button", { name: "Motion paused", exact: true }).click();
    const settled = await picture();
    await page.mouse.move(1200, 800);
    await page.waitForTimeout(100);
    expect(await picture()).toBe(settled);
    await page.evaluate(() => { window.tunnelTime = 500; });
    await expect.poll(picture).not.toBe(settled);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Motion reduced", exact: true })).toBeDisabled();
    const reduced = await picture();
    const strokes = await page.evaluate(() => window.tunnelStrokes);
    await page.mouse.move(900, 600);
    await page.waitForTimeout(150);
    expect(await picture()).toBe(reduced);
    expect(await page.evaluate(() => window.tunnelStrokes)).toBe(strokes);
    await page.getByRole("combobox", { name: "Color theme" }).selectOption("light");
    await expect(canvas).toHaveCount(0);
    await page.getByRole("combobox", { name: "Color theme" }).selectOption("dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate(el => el.width > 0 && el.width <= 390 * 1.5)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
