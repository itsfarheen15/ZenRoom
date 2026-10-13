"use client";

import { useSyncExternalStore } from "react";

const THEMES = ["dark", "light", "comfort"];
const KEY = "zen-room-theme";
// In-memory fallback if localStorage is blocked (e.g. private browsing mode).
let transientTheme = "dark";

function readTheme() {
    try {
        const value = localStorage.getItem(KEY);
        return THEMES.includes(value) ? value : "dark";
    } catch { return transientTheme; }
}

function subscribe(callback) {
    // Synchronize across browser windows (storage event) and within the current window (zen-theme event).
    window.addEventListener("storage", callback);
    window.addEventListener("zen-theme", callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("zen-theme", callback);
    };
}

export function useTheme() {
    // useSyncExternalStore avoids tearing; server snapshot defaults to 'dark' to prevent hydration mismatch.
    const theme = useSyncExternalStore(subscribe, readTheme, () => "dark");
    const setTheme = (value) => {
        if (!THEMES.includes(value)) return;
        transientTheme = value;
        try { localStorage.setItem(KEY, value); } catch { /* Gracefully handle blocked storage. */ }
        window.dispatchEvent(new Event("zen-theme"));
    };
    return [theme, setTheme];
}
