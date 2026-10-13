import { test, expect } from "@playwright/test";

test("CSP uses fresh nonces, blocks injected scripts and keeps hydration working", async ({ page }) => {
    await page.route("http://localhost:8000/api/session/", route => route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://localhost:3000", "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ user: null, csrf_token: "test" }) }));
    await page.route("http://localhost:3000/", async route => {
        const response = await route.fetch();
        const html = (await response.text()).replace("</head>", '<script id="injection-probe">window.injectedScriptRan = true</script></head>');
        await route.fulfill({ response, body: html });
    });
    const response = await page.goto("/");
    const policy = response.headers()["content-security-policy"];
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    const nonce = policy.match(/'nonce-([^']+)'/)[1];
    const scripts = await page.locator("script:not([src])").evaluateAll(nodes => nodes.filter(node => node.textContent.trim() && node.id !== "injection-probe").map(node => node.nonce));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every(value => value === nonce)).toBe(true);
    expect(await page.evaluate(() => window.injectedScriptRan)).toBeUndefined();
    await page.unroute("http://localhost:3000/");
    const second = await page.reload();
    expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
    await expect(page.getByRole("button", { name: "Connect workspace", exact: true })).toBeEnabled();
    await page.getByLabel("Color theme").selectOption("comfort");
    await expect(page.locator(".zen-room")).toHaveAttribute("data-theme", "comfort");
});
