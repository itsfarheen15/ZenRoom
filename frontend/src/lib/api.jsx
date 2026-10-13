"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import useSWR, { SWRConfig } from "swr";
const API_ROOT = (process.env.NEXT_PUBLIC_DJANGO_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
export class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
}

// Low-level fetch wrapper: includes HttpOnly session cookie, CSRF header, and bounds request duration.
async function send(csrf, path, init = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
        ...init,
        // credentials: "include" sends the HttpOnly zen_session cookie with cross-origin requests.
        credentials: "include",
        // cache: "no-store" ensures fresh state from server and prevents caching sensitive data.
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRFToken": csrf } : {}), ...init.headers },
        signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const message = body?.detail || (body && Object.entries(body).map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(" ") : errors}`).join(" "));
        throw new ApiError(message || (response.status === 403 ? "Security check failed. Refresh and reconnect." : "The request could not be completed."), response.status);
    }
    return body;
}

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
    const [session, setSession] = useState({ user: null, checking: true, message: "", revision: 0 });
    // CSRF token stored strictly in component ref memory; never written to localStorage or sessionStorage.
    const csrf = useRef("");
    const user = useRef(null);
    const pendingRequests = useRef(null);
    const channel = useRef(null);
    const generation = useRef(0);

    const applySession = useCallback((nextUser, message = "") => {
        const changed = user.current?.id !== nextUser?.id;
        if (changed || !nextUser) {
            // Abort all in-flight requests and increment generation when user switches or logs out.
            pendingRequests.current?.abort();
            pendingRequests.current = new AbortController();
            generation.current++;
        }
        user.current = nextUser;
        // Increment revision to force remount of SWRConfig, flushing all in-memory cache on user change.
        setSession(previous => ({ user: nextUser, checking: false, message, revision: previous.revision + (changed || !nextUser ? 1 : 0) }));
    }, []);

    const checkSession = useCallback(async () => {
        const current = generation.current;
        try {
            const data = await send("", "/session/");
            if (current !== generation.current) return;
            csrf.current = data.csrf_token;
            applySession(data.user, !data.user && (user.current || data.expired) ? "Your session expired. Please reconnect your workspace." : "");
        } catch (error) {
            if (current === generation.current) applySession(null, messageFrom(error));
        }
    }, [applySession]);

    useEffect(() => {
        void checkSession();
        // Re-check session on window focus to handle expiry while tab was backgrounded.
        window.addEventListener("focus", checkSession);
        // BroadcastChannel notifies other open tabs immediately when session connects or disconnects.
        if (typeof BroadcastChannel !== "undefined") {
            channel.current = new BroadcastChannel("zen-workspace-session");
            channel.current.onmessage = () => { applySession(null); void checkSession(); };
        }
        return () => { window.removeEventListener("focus", checkSession); channel.current?.close(); };
    }, [checkSession, applySession]);

    const connect = useCallback(async value => {
        // Bootstrap session to retrieve initial CSRF token for the POST exchange.
        const bootstrap = await send("", "/session/");
        const data = await send(bootstrap.csrf_token, "/session/", { method: "POST", body: JSON.stringify({ token: value.trim() }) });
        csrf.current = data.csrf_token;
        applySession(data.user);
        channel.current?.postMessage("changed");
    }, [applySession]);

    const disconnect = useCallback(async () => {
        try {
            const data = await send(csrf.current, "/session/", { method: "DELETE" });
            csrf.current = data.csrf_token;
            applySession(null);
            channel.current?.postMessage("changed");
        } catch (error) {
            setSession(previous => ({ ...previous, message: `Could not disconnect: ${messageFrom(error)}` }));
        }
    }, [applySession]);

    const request = useCallback(async (path, init = {}) => {
        const current = generation.current;
        pendingRequests.current ??= new AbortController();
        try {
            return await send(csrf.current, path, { ...init, signal: init.signal ? AbortSignal.any([init.signal, pendingRequests.current.signal]) : pendingRequests.current.signal });
        } catch (error) {
            if (error.status === 401 && current === generation.current) applySession(null, "Your session expired. Please reconnect your workspace.");
            throw error;
        }
    }, [applySession]);

    return <ApiContext.Provider value={{ userId: session.user?.id, checking: session.checking, sessionMessage: session.message, connect, disconnect, request }}>
      {/* Remounting SWRConfig on key={session.revision} instantiates a fresh Map, discarding prior user's data. */}
      <SWRConfig key={session.revision} value={{ provider: () => new Map(), revalidateOnFocus: true, dedupingInterval: 10000, shouldRetryOnError: false }}>
        {children}
      </SWRConfig>
    </ApiContext.Provider>;
}

export function useApi() {
    const context = useContext(ApiContext);
    if (!context) throw new Error("useApi must be used inside ApiProvider.");
    return context;
}

export function useResource(path, refreshInterval = 300000) {
    const { userId, request } = useApi();
    // Keying with [path, userId] ensures requests are skipped when logged out and partitioned per user.
    return useSWR(userId ? [path, userId] : null, ([url]) => request(url), { refreshInterval });
}

export function messageFrom(error) {
    if (error instanceof TypeError)
        return "Cannot reach Django. Check that the backend is running and try again.";
    if (error instanceof Error && error.name === "TimeoutError")
        return "The request took too long. Please try again.";
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

// Disallow non-HTTP(S) protocols to prevent javascript: or data: URL execution in anchor links.
export function safeHref(url) {
    try {
        const parsed = new URL(url);
        return ["https:", "http:"].includes(parsed.protocol) ? url : undefined;
    }
    catch {
        return undefined;
    }
}

// Formats local calendar date in Asia/Kolkata (IST) to match backend timezone.localdate().
export function todayInIndia() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
}
