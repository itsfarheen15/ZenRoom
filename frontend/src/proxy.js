import { NextResponse } from "next/server";

export function proxy(request) {
    // Use an unpredictable per-response nonce to authorize the page’s scripts.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const development = process.env.NODE_ENV === "development";
    const api = new URL(process.env.NEXT_PUBLIC_DJANGO_API_URL || "http://localhost:8000/api").origin;
    const websocket = new URL(request.url);
    websocket.protocol = websocket.protocol === "https:" ? "wss:" : "ws:";
    const policy = [
        "default-src 'self'",
        // 'strict-dynamic' allows nonced scripts to load trusted children; 'unsafe-eval' permitted solely in dev for HMR.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
        // Framer Motion and weather particle animations dynamically set inline styles and CSS variables.
        "style-src 'self' 'unsafe-inline'",
        // Whitelist only own origin and explicit Django API server (plus HMR websocket in dev).
        `connect-src 'self' ${api}${development ? ` ${websocket.origin}` : ""}`,
        "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'",
        // Defense-in-depth: disallow <base> tag hijacking and iframe embedding (anti-clickjacking).
        "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    ].join("; ");
    const headers = new Headers(request.headers);
    headers.set("Content-Security-Policy", policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    // Ensure responses with fresh nonces are never stored in shared or browser HTTP caches.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
}

export const config = {
    // Run proxy middleware on all dynamic routes, bypassing static assets.
    matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
