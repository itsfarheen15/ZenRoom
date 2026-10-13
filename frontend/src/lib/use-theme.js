"use client";

import { useSyncExternalStore } from "react";

const THEMES = ["dark", "light", "comfort"];
const KEY = "zen-room-theme";
let transientTheme = "dark";
function readTheme() {
    try {
        const value = localStorage.getItem(KEY);
        return THEMES.includes(value) ? value : "dark";
    } catch { return transientTheme; }
}
function subscribe(callback) {
    window.addEventListener("storage", callback);
    window.addEventListener("zen-theme", callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener("zen-theme", callback);
    };
}
export function useTheme() {
    const theme = useSyncExternalStore(subscribe, readTheme, () => "dark");
    const setTheme = (value) => {
        if (!THEMES.includes(value)) return;
        transientTheme = value;
        try { localStorage.setItem(KEY, value); } catch { /* Still allow switching when storage is blocked. */ }
        window.dispatchEvent(new Event("zen-theme"));
    };
    return [theme, setTheme];
}
