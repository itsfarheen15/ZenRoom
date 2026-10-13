"use client";
import { useApi, useResource } from "@/lib/api";
export function LiveTicker() {
    const { userId } = useApi();
    const { data, error, isLoading } = useResource("/news/tech/");
    const items = data?.items || [];
    return <aside className="ticker" aria-label="Tech news ticker">
    <span className="ticker-label"><span className="status-dot"/> THE SIGNAL {data?.stale ? <span className="ticker-demo">SAVED</span> : null}</span>
    <div className="ticker-window" tabIndex={0} role="region" aria-label="Scroll through tech headlines">
      {items.length ? <div className="ticker-track">{[0, 1].map((copy) => <span className="ticker-copy" key={copy} aria-hidden={copy === 1 ? true : undefined}>{items.map((article) => <span className="ticker-item" key={article.url}>{article.title}<i>✦</i></span>)}</span>)}</div> : <p className="ticker-idle">{!userId ? "A quieter space. Connect your workspace when you’re ready." : isLoading ? "Finding the signal…" : error ? "The news feed is taking a moment. Your workspace is still here." : "No headlines right now. A little room to focus."}</p>}
    </div>
  </aside>;
}
