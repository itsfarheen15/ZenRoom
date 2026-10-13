"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Globe2, Newspaper, Sparkles } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { messageFrom, safeHref, useApi, useResource } from "@/lib/api";
import { Modal } from "@/components/modal";
import { FeedTime, ResourceState } from "@/components/resource-state";
import { WidgetHeading } from "@/components/widget-heading";
function SummaryBody({ article }) {
    const { userId, request } = useApi();
    const reducedMotion = useReducedMotion();
    // Cache key includes userId for multi-tenant isolation.
    // revalidateOnFocus and shouldRetryOnError disabled to avoid expending LLM quotas on window switches.
    const { data, error, isLoading, mutate } = useSWR(["summary", article.url, userId], () => request("/summarize/", { method: "POST", body: JSON.stringify({ article_url: article.url }) }), { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false });
    return <>
    <p className="article-source">{article.source}</p>
    <h2 className="modal-title">{article.title}</h2>
    <div className="summary-label"><Sparkles size={14}/> THE THREE-POINT BRIEF</div>
    {isLoading ? <div className="loading-lines summary-loading" role="status"><span>Reading between the lines…</span><i /><i /><i /></div> : null}
    {error ? <div role="alert" className="summary-error"><p>{messageFrom(error)}</p><button className="text-button" onClick={() => void mutate()}>Try again</button></div> : null}
    {data ? <ul className="summary-points">{data.bullet_points.map((point, index) => <motion.li key={index} initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : index * 0.09, duration: reducedMotion ? 0 : 0.22 }}><span>0{index + 1}</span><p>{point}</p></motion.li>)}</ul> : null}
    {/* safeHref sanitizes protocol; rel="noopener noreferrer" prevents reverse-tabnabbing attacks. */}
    <a className="primary-button source-link" href={safeHref(article.url)} target="_blank" rel="noopener noreferrer">Read the full article <ArrowUpRight size={15}/><span className="sr-only"> (opens in a new tab)</span></a>
    <p className="modal-note">AI-generated summaries can miss context. The original article is the source of truth.</p>
  </>;
}
function PublicationTime({ value }) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? <time className="publication-time" dateTime={date.toISOString()}>{date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time> : <span className="publication-time">Publication time unavailable</span>;
}
export function NewsDigest() {
    const { data, error, isLoading, mutate } = useResource("/news/tech/");
    const [selected, setSelected] = useState(null);
    return <section className="widget digest-widget" aria-labelledby="digest-title">
    <WidgetHeading id="digest-title" icon={<Newspaper size={17}/>} title="The daily digest" subtitle="A little signal in the noise" badge="TECHNOLOGY"/>
    {data?.items.length ? <div className="digest-articles">{data.items.map((article, index) => <button className={`article-button ${index === 0 ? "featured-article" : ""}`} key={article.url} onClick={() => setSelected(article)}>
      {index === 0 ? <div className="article-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><span>IDEAS WORTH<br />YOUR ATTENTION.</span><span className="art-cross">+</span></div> : null}
      <div className="article-text"><span className="article-source">{article.source}</span><PublicationTime value={article.published_at}/><h3>{article.title}</h3>{index === 0 ? <p>{article.description}</p> : null}<span className="article-meta"><Sparkles size={11}/> {index === 0 ? "Open a three-point brief" : "AI brief"}<ArrowUpRight size={13}/></span></div>
    </button>)}</div> : <ResourceState loading={isLoading} error={error} empty="No tech headlines just yet." onRetry={() => void mutate()}/>}
    {/* Disclose provider search limitations truthfully when fallback scan was used. */}
    {data?.coverage ? <p className="widget-footnote">{data.ranking}. {data.coverage}</p> : null}
    {data ? <FeedTime stale={data.stale} fetchedAt={data.fetched_at}/> : null}
    {/* key={selected.url} unmounts and resets summary state when switching articles. */}
    <Modal open={!!selected} onClose={() => setSelected(null)} title="A MOMENT OF CLARITY">{selected ? <SummaryBody key={selected.url} article={selected}/> : null}</Modal>
  </section>;
}
export function WorldNews() {
    const [region, setRegion] = useState("india");
    const { data, error, isLoading, mutate } = useResource(`/news/${region}/`);
    return <section className="widget world-widget" aria-labelledby="world-title">
    <WidgetHeading id="world-title" icon={<Globe2 size={17}/>} title="Beyond the screen" subtitle="A window to the world"/>
    <div className="segmented-control" role="group" aria-label="News region">
      <button aria-pressed={region === "india"} onClick={() => setRegion("india")}>India</button><button aria-pressed={region === "global"} onClick={() => setRegion("global")}>Worldwide</button>
    </div>
    {data?.items.length ? <ol className="world-list">{data.items.map((article, index) => <li key={article.url}><span className="row-index">0{index + 1}</span><a href={safeHref(article.url)} target="_blank" rel="noopener noreferrer"><span className="article-source">{article.source}</span><PublicationTime value={article.published_at}/><h3>{article.title}</h3><span className="sr-only"> (opens in a new tab)</span></a><ArrowUpRight size={13} className="external-arrow" aria-hidden="true"/></li>)}</ol> : <ResourceState loading={isLoading} error={error} empty={region === "india" ? "No recent India-related stories found in the searched coverage." : "No headlines for this region yet."} onRetry={() => void mutate()}/>}
    {data?.coverage ? <p className="widget-footnote">{data.ranking}. {data.coverage}</p> : null}
    {data ? <FeedTime stale={data.stale} fetchedAt={data.fetched_at}/> : null}
  </section>;
}
