"use client";
import { Radio, RefreshCw } from "lucide-react";
import { messageFrom, useApi } from "@/lib/api";

/**
 * Standardized widget state container.
 *
 * Handles lifecycle and multi-tenant access states:
 * 1. Loading/Checking: Renders animated shimmer lines with an accessible status role.
 * 2. Unauthenticated: Informs the user that workspace connection is needed (no data leaks).
 * 3. Error: Displays truthful, sanitized error messages with a retry action.
 * 4. Empty: Displays a quiet empty state without fabricated or placeholder data.
 */
export function ResourceState({ loading, error, empty, onRetry }) {
    const { userId, checking } = useApi();

    if (loading || checking)
        return (
            <div className="loading-lines" role="status">
                <span className="sr-only">Loading</span>
                <i /><i /><i />
            </div>
        );

    if (!userId)
        return (
            <div className="empty-state">
                <Radio size={23} strokeWidth={1.2} />
                <p>A little quiet for now.</p>
                <span>Connect your workspace to bring this widget to life.</span>
            </div>
        );

    if (error)
        return (
            <div className="empty-state error-state" role="alert">
                <p>Taking a moment.</p>
                <span>{messageFrom(error)}</span>
                <button className="text-button" onClick={onRetry}>
                    <RefreshCw size={12} /> Try again
                </button>
            </div>
        );

    return (
        <div className="empty-state">
            <p>{empty || "Nothing here just yet."}</p>
            <span>Room for something good.</span>
        </div>
    );
}

/**
 * Feed freshness timestamp and stale indicator.
 *
 * Truthful data invariant:
 * Distinguishes between fresh hourly updates and Redis fallback cache
 * when external providers are delayed or rate-limited.
 */
export function FeedTime({ stale, fetchedAt }) {
    return (
        <p className={`widget-footnote ${stale ? "stale-note" : ""}`}>
            {stale ? "Last saved feed · Refresh delayed" : "Updated hourly"}{" "}
            <span>· {new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </p>
    );
}
