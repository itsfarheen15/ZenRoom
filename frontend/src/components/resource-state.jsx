"use client";
import { Radio, RefreshCw } from "lucide-react";
import { messageFrom, useApi } from "@/lib/api";
export function ResourceState({ loading, error, empty, onRetry }) {
    const { userId, checking } = useApi();
    if (loading || checking)
        return <div className="loading-lines" role="status"><span className="sr-only">Loading</span><i /><i /><i /></div>;
    if (!userId)
        return <div className="empty-state"><Radio size={23} strokeWidth={1.2}/><p>A little quiet for now.</p><span>Connect your workspace to bring this widget to life.</span></div>;
    if (error)
        return <div className="empty-state error-state" role="alert"><p>Taking a moment.</p><span>{messageFrom(error)}</span><button className="text-button" onClick={onRetry}><RefreshCw size={12}/> Try again</button></div>;
    return <div className="empty-state"><p>{empty || "Nothing here just yet."}</p><span>Room for something good.</span></div>;
}
export function FeedTime({ stale, fetchedAt }) {
    return <p className={`widget-footnote ${stale ? "stale-note" : ""}`}>{stale ? "Last saved feed · Refresh delayed" : "Updated hourly"} <span>· {new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></p>;
}
