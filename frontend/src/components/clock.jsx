"use client";
import { useEffect, useState } from "react";

/**
 * Minimalist digital clock widget.
 *
 * Hydration mismatch mitigation:
 * Initializes `now` to `null` so the initial SSR markup matches the client
 * hydration tree regardless of server/client timezone differences. The first
 * real tick runs immediately post-hydration via `setTimeout(tick, 0)`, followed
 * by a 1-second interval.
 */
export function Clock() {
    const [now, setNow] = useState(null);

    useEffect(() => {
        const tick = () => setNow(new Date());
        // Immediate client tick to populate time without hydration mismatch.
        const initial = window.setTimeout(tick, 0);
        const interval = window.setInterval(tick, 1000);
        // Clean up both timers to avoid leaks on route changes or unmounts.
        return () => {
            window.clearTimeout(initial);
            window.clearInterval(interval);
        };
    }, []);

    // Pad digits to ensure consistent 2-digit tabular width during time increments.
    const hours = now ? String(now.getHours()).padStart(2, "0") : "--";
    const minutes = now ? String(now.getMinutes()).padStart(2, "0") : "--";
    const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "--";

    return (
        <div className="clock-widget">
            <p className="clock-date">
                {now
                    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now)
                    : "A moment to settle in"}
            </p>
            <time className="clock" dateTime={now?.toISOString()} aria-label={now ? now.toLocaleTimeString() : "Loading local time"}>
                {hours}<span className="clock-colon">:</span>{minutes}<span className="clock-seconds">{seconds}</span>
            </time>
            <p className="clock-location">
                <span className="status-dot" /> LOCAL TIME <span>/</span> RIGHT HERE, RIGHT NOW
            </p>
        </div>
    );
}
