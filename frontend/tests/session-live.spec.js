import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function django(code) {
    return execFileSync("docker", ["compose", "exec", "-T", "backend", "python", "manage.py", "shell", "-c", code], { cwd: "..", encoding: "utf8" });
}

test("real Django session: HttpOnly, refresh, CSRF, logout, expiry and user isolation", async ({ page, context }) => {
    test.skip(process.env.ZEN_LIVE !== "1", "Opt-in local Docker integration; creates and removes two temporary users.");
    test.setTimeout(90000);
    const prefix = `zen-check-${randomUUID().slice(0, 8)}`;
    const code = `import json\nfrom django.contrib.auth import get_user_model\nfrom rest_framework.authtoken.models import Token\nfrom dashboard.models import Task\nusers=[]\nfor suffix in ['a','b']:\n u=get_user_model().objects.create_user(username='${prefix}-'+suffix)\n Task.objects.create(owner=u,title='${prefix}-private-'+suffix)\n users.append(Token.objects.create(user=u).key)\nprint(json.dumps(users))`;
    const tokens = JSON.parse(django(code).trim().split("\n").at(-1));
    async function connect(index) {
        await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
        await page.getByLabel("Access token").fill(tokens[index]);
        await page.getByRole("dialog").getByRole("button", { name: "Connect workspace" }).click();
        await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
    }
    try {
        await page.goto("/");
        await connect(0);
        await expect(page.getByText(`${prefix}-private-a`, { exact: true })).toBeVisible();
        const cookie = (await context.cookies()).find(cookie => cookie.name === "zen_session");
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe("Lax");
        expect(await page.evaluate(() => document.cookie)).not.toContain("zen_session");
        await page.reload();
        await expect(page.getByText(`${prefix}-private-a`, { exact: true })).toBeVisible();
        const csrfStatus = await page.evaluate(async () => (await fetch("http://localhost:8000/api/tasks/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Must not be created" }) })).status);
        expect(csrfStatus).toBe(403);
        await page.getByRole("button", { name: "Disconnect", exact: true }).click();
        await expect(page.getByText(`${prefix}-private-a`, { exact: true })).toHaveCount(0);
        await page.reload();
        await connect(1);
        await expect(page.getByText(`${prefix}-private-b`, { exact: true })).toBeVisible();
        await expect(page.getByText(`${prefix}-private-a`, { exact: true })).toHaveCount(0);
        const secondCookie = (await context.cookies()).find(cookie => cookie.name === "zen_session");
        django(`from django.contrib.sessions.models import Session\nSession.objects.filter(session_key=${JSON.stringify(secondCookie.value)}).delete()`);
        await page.reload();
        await expect(page.locator(".session-message")).toContainText("Your session expired");
        await expect(page.getByText(`${prefix}-private-b`, { exact: true })).toHaveCount(0);
    } finally {
        django(`from django.contrib.auth import get_user_model\nget_user_model().objects.filter(username__in=['${prefix}-a','${prefix}-b']).delete()`);
    }
});
