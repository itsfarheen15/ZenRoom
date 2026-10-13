"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, GitFork, Star } from "lucide-react";
import { safeHref, useResource } from "@/lib/api";
import { FeedTime, ResourceState } from "@/components/resource-state";
import { WidgetHeading } from "@/components/widget-heading";
export function GitHubTrending() {
    const { data, error, isLoading, mutate } = useResource("/github-trending/");
    const reducedMotion = useReducedMotion();
    return <section className="widget repos-widget" aria-labelledby="repos-title">
    <WidgetHeading id="repos-title" icon={<GitFork size={17}/>} title="On the radar" subtitle="GitHub · Worldwide" badge="RISING REPOS"/>
    {data?.items.length ? <ol className="repo-list">{data.items.map((repo, index) => <li key={repo.id}><motion.a href={safeHref(repo.url)} target="_blank" rel="noopener noreferrer" className="repo-link" whileHover={reducedMotion ? undefined : { scale: 1.02 }}>
      <span className="row-index">0{index + 1}</span><div className="repo-content"><h3>{repo.name}</h3><p>{repo.description}</p><div className="repo-details"><span className="repo-language"><i />{repo.language}</span><span><Star size={11}/> {new Intl.NumberFormat("en", { notation: "compact" }).format(repo.stars)}</span></div></div><ArrowUpRight size={14} className="external-arrow" aria-label="Opens in a new tab"/>
    </motion.a></li>)}</ol> : <ResourceState loading={isLoading} error={error} empty="No rising repositories just yet." onRetry={() => void mutate()}/>}
    <p className="widget-footnote">Most-starred repos created in the last 7 days.</p>
    {data ? <FeedTime stale={data.stale} fetchedAt={data.fetched_at}/> : null}
  </section>;
}
