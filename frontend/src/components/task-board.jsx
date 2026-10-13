"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Check, CheckCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { messageFrom, todayInIndia, useApi } from "@/lib/api";
import { ResourceState } from "@/components/resource-state";
import { WidgetHeading } from "@/components/widget-heading";
export function TaskBoard() {
    const { userId, request } = useApi();
    const [submitting, setSubmitting] = useState(false);
    // Track in-flight item IDs to prevent duplicate rapid clicks during PATCH/DELETE.
    const [busy, setBusy] = useState([]);
    const [error, setError] = useState("");
    const reducedMotion = useReducedMotion();

    // Fetches all paginated task pages to assemble the complete list for client-side column grouping.
    const { data, error: loadError, isLoading, mutate } = useSWR(userId ? ["tasks", userId] : null, async () => {
        const tasks = [];
        let page = 1;
        while (true) {
            const result = await request(`/tasks/?page=${page}`);
            tasks.push(...result.results);
            if (!result.next)
                return tasks;
            page += 1;
        }
    }, { refreshInterval: 60000 });

    const today = todayInIndia();
    // Partition tasks into Today, Upcoming, and Pending columns based on IST calendar boundaries.
    const groups = [
        { name: "Today", items: data?.filter((task) => task.scheduled_date === today) || [] },
        { name: "Upcoming", items: data?.filter((task) => task.scheduled_date > today && task.status !== "completed") || [] },
        { name: "Pending", items: data?.filter((task) => task.scheduled_date < today && task.status !== "completed") || [] },
    ];
    const done = groups[0].items.filter((task) => task.status === "completed").length;

    async function addTask(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const title = String(fields.get("title") || "").trim();
        if (!title) {
            setError("Give your task a short title.");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            const task = await request("/tasks/", { method: "POST", body: JSON.stringify({ title, scheduled_date: fields.get("date") || today }) });
            // After server success, append new task into SWR cache without triggering a full reload.
            await mutate((previous) => [...(previous || []), task], { revalidate: false });
            form.reset();
        }
        catch (error) {
            setError(messageFrom(error));
        }
        finally {
            setSubmitting(false);
        }
    }

    async function changeTask(task, remove = false) {
        setBusy((ids) => [...ids, task.id]);
        setError("");
        try {
            if (remove) {
                await request(`/tasks/${task.id}/`, { method: "DELETE" });
                // After server success, remove item from local SWR cache.
                await mutate((previous) => previous?.filter((item) => item.id !== task.id), { revalidate: false });
            }
            else {
                const updated = await request(`/tasks/${task.id}/`, { method: "PATCH", body: JSON.stringify({ status: task.status === "completed" ? "pending" : "completed" }) });
                // After server success, update toggled item in local SWR cache.
                await mutate((previous) => previous?.map((item) => item.id === task.id ? updated : item), { revalidate: false });
            }
        }
        catch (error) {
            setError(messageFrom(error));
        }
        finally {
            setBusy((ids) => ids.filter((id) => id !== task.id));
        }
    }
    return <section className="widget tasks-widget" aria-labelledby="tasks-title">
    <WidgetHeading id="tasks-title" icon={<CheckCheck size={18}/>} title="One thing at a time" subtitle="Small steps. Meaningful progress." badge="YOUR TASKS"/>
    {data ? <>
      <div className="task-progress"><span>{done} of {groups[0].items.length} done today</span><span>YOU’VE GOT THIS</span></div>
      <div className="progress-track" role="progressbar" aria-label="Today's completed tasks" aria-valuenow={done} aria-valuemin={0} aria-valuemax={Math.max(groups[0].items.length, 1)}><span style={{ width: `${groups[0].items.length ? done / groups[0].items.length * 100 : 0}%` }}/></div>
      <div className="task-columns">{groups.map((group) => <div className="task-column" key={group.name}><h3>{group.name}<span>{group.items.length}</span></h3><ul>{group.items.map((task) => <motion.li className={`task-item ${task.status === "completed" ? "task-done" : ""}`} key={task.id} whileHover={reducedMotion ? undefined : { scale: 1.02 }}>
        <label className="task-label"><input type="checkbox" checked={task.status === "completed"} disabled={busy.includes(task.id)} onChange={() => void changeTask(task)}/><span className="task-checkbox" aria-hidden="true">{task.status === "completed" ? <Check size={12}/> : null}</span><span><span className="task-title">{task.title}</span><span className="task-date">{group.name === "Today" ? task.status === "completed" ? "A little win." : task.status === "in_progress" ? "In progress" : "Today is a good day." : task.scheduled_date}</span></span></label>
        <button className="task-delete icon-button" aria-label={`Delete ${task.title}`} disabled={busy.includes(task.id)} onClick={() => void changeTask(task, true)}><Trash2 size={12}/></button>
      </motion.li>)}</ul>{!group.items.length ? <p className="column-empty">{group.name === "Today" ? "What’s on your mind?" : group.name === "Upcoming" ? "A little room ahead." : "All caught up."}</p> : null}</div>)}</div>
    </> : <ResourceState loading={isLoading} error={loadError} onRetry={() => void mutate()}/>}
    {userId ? <form className="task-form" onSubmit={addTask}><label className="sr-only" htmlFor="task-title">New task</label><input id="task-title" name="title" placeholder="Make room for your next idea…" maxLength={200} required disabled={submitting || !data}/><label className="sr-only" htmlFor="task-date">Scheduled date</label><input id="task-date" name="date" type="date" defaultValue={today} required disabled={submitting || !data}/><button className="add-task-button" disabled={submitting || !data} aria-label="Add task"><Plus size={16}/></button></form> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <p className="widget-footnote">A calm plan for the day · Task dates use India Standard Time</p>
  </section>;
}
