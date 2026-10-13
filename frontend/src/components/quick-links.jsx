"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { messageFrom, safeHref, useApi } from "@/lib/api";
import { Modal } from "@/components/modal";
import { ResourceState } from "@/components/resource-state";
import { WidgetHeading } from "@/components/widget-heading";
export function QuickLinks() {
    const { userId, request } = useApi();
    const [editing, setEditing] = useState(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();

    // Fetches all paginated bookmark pages to assemble the full user bookmark list.
    const { data, error: loadError, isLoading, mutate } = useSWR(userId ? ["links", userId] : null, async () => {
        const links = [];
        let page = 1;
        while (true) {
            const result = await request(`/links/?page=${page}`);
            links.push(...result.results);
            if (!result.next)
                return links;
            page += 1;
        }
    });

    const link = editing && editing !== "new" ? editing : null;

    async function save(event) {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
            const updated = await request(link ? `/links/${link.id}/` : "/links/", {
                method: link ? "PATCH" : "POST", body: JSON.stringify({ title: String(fields.get("title")).trim(), url: String(fields.get("url")).trim(), position: Number(fields.get("position")) }),
            });
            // After server success, update and sort by (position, title) in SWR cache without full refetch.
            await mutate((previous) => [...(previous || []).filter((item) => item.id !== updated.id), updated].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)), { revalidate: false });
            setEditing(null);
        }
        catch (error) {
            setError(messageFrom(error));
        }
        finally {
            setPending(false);
        }
    }

    async function remove() {
        if (!link)
            return;
        setPending(true);
        setError("");
        try {
            await request(`/links/${link.id}/`, { method: "DELETE" });
            // After server success, remove link from in-memory SWR cache.
            await mutate((previous) => previous?.filter((item) => item.id !== link.id), { revalidate: false });
            setEditing(null);
        }
        catch (error) {
            setError(messageFrom(error));
        }
        finally {
            setPending(false);
        }
    }

    return <section className="widget links-widget" aria-labelledby="links-title">
    <div className="links-heading"><WidgetHeading id="links-title" icon={<Link2 size={17}/>} title="Your launchpad" subtitle="Familiar places. One click away."/>{userId ? <button className="text-button" onClick={() => { setError(""); setEditing("new"); }}><Plus size={14}/> Add link</button> : null}</div>
    {data?.length ? <div className="quick-links">{data.map((item) => <motion.div key={item.id} className="quick-link-card" whileHover={reducedMotion ? undefined : { scale: 1.02 }}>
      <a className="quick-link" href={safeHref(item.url)} target="_blank" rel="noopener noreferrer"><span className="link-initial">{item.title.charAt(0).toUpperCase()}</span><div><h3>{item.title}</h3><p>{safeHref(item.url) ? new URL(item.url).hostname : "Invalid link"}</p></div><ArrowUpRight size={13} className="external-arrow" aria-label="Opens in a new tab"/></a>
      <button className="link-edit icon-button" aria-label={`Edit ${item.title}`} onClick={() => { setError(""); setEditing(item); }}><Pencil size={12}/></button>
    </motion.div>)}</div> : <ResourceState loading={isLoading} error={loadError} empty="Keep your favorite corners of the web here." onRetry={() => void mutate()}/>}
    <Modal open={editing !== null} onClose={() => { if (!pending)
        setEditing(null); }} title={link ? "EDIT QUICK LINK" : "A NEW SHORTCUT"}>
      <h2 className="modal-title">{link ? "A familiar place." : "Keep it close."}</h2>
      {editing !== null ? <form className="connect-form" onSubmit={save} key={link?.id || "new"}>
        <label htmlFor="link-title">Name</label><input id="link-title" name="title" defaultValue={link?.title || ""} required maxLength={100} disabled={pending} placeholder="e.g. GitHub"/>
        <label htmlFor="link-url">URL</label><input id="link-url" name="url" type="url" defaultValue={link?.url || ""} required maxLength={2048} disabled={pending} placeholder="https://github.com"/>
        <label htmlFor="link-position">Position</label><input id="link-position" name="position" type="number" min={0} max={2147483647} step={1} defaultValue={link?.position || 0} required disabled={pending}/>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-actions"><button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save link"}</button>{link ? <button type="button" className="danger-button" disabled={pending} onClick={() => void remove()}><Trash2 size={14}/> Delete link</button> : null}</div>
      </form> : null}
    </Modal>
  </section>;
}
