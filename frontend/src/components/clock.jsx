"use client";
import { useEffect, useState } from "react";
export function Clock() {
    const [now, setNow] = useState(null);
    useEffect(() => {
        const tick = () => setNow(new Date());
        const initial = window.setTimeout(tick, 0);
        const interval = window.setInterval(tick, 1000);
        return () => { window.clearTimeout(initial); window.clearInterval(interval); };
    }, []);
    const hours = now ? String(now.getHours()).padStart(2, "0") : "--";
    const minutes = now ? String(now.getMinutes()).padStart(2, "0") : "--";
    const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "--";
    return (<div className="clock-widget">
      <p className="clock-date">{now ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now) : "A moment to settle in"}</p>
      <time className="clock" dateTime={now?.toISOString()} aria-label={now ? now.toLocaleTimeString() : "Loading local time"}>
        {hours}<span className="clock-colon">:</span>{minutes}<span className="clock-seconds">{seconds}</span>
      </time>
      <p className="clock-location"><span className="status-dot"/> LOCAL TIME <span>/</span> RIGHT HERE, RIGHT NOW</p>
    </div>);
}
