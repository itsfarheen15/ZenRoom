"use client";
import { MotionConfig } from "framer-motion";
import { AudioLines, LogOut, Pause, Play, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiProvider, messageFrom, useApi } from "@/lib/api";
import { Modal } from "@/components/modal";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useTheme } from "@/lib/use-theme";
import { LightTunnel } from "@/components/light-tunnel";
function Frame({ children }) {
    const [theme, setTheme] = useTheme();
    const [paused, setPaused] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const reducedMotion = usePrefersReducedMotion();
    const { userId, checking, sessionMessage, connect, disconnect } = useApi();
    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const value = String(new FormData(form).get("token") || "");
        setPending(true);
        setError("");
        try {
            await connect(value);
            setConnecting(false);
            form.reset();
        }
        catch (error) {
            setError(messageFrom(error));
        }
        finally {
            setPending(false);
        }
    }
    return (<MotionConfig reducedMotion="user">
      <div className="zen-room" data-paused={paused} data-theme={theme}>
        <div className="ambient" aria-hidden="true">
          <div className="ambient-wave wave-one"/><div className="ambient-wave wave-two"/><div className="ambient-wave wave-three"/>
          {theme === "dark" && <LightTunnel paused={paused} />}
        </div>
        <div className="grid-overlay" aria-hidden="true"/>
        <a href="#workspace" className="skip-link">Skip to workspace</a>
        <div className="room-content">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Developer Zen Room home"><span className="brand-mark"><AudioLines size={23} strokeWidth={1.6}/></span><span>zen<span className="brand-light">room</span><span className="brand-period">.</span></span></Link>
            <span className="topbar-note">YOUR PERSONAL DEVELOPER SPACE</span>
            <div className="header-actions">
              <label className="theme-control"><span className="sr-only">Color theme</span>
                <select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
                  <option value="dark">Dark</option><option value="light">Light</option><option value="comfort">Eye Comfort</option>
                </select>
              </label>
              <button className="ambient-toggle" aria-label={reducedMotion ? "Motion reduced" : paused ? "Motion paused" : "Ambient motion"} disabled={!!reducedMotion} aria-pressed={!paused && !reducedMotion} onClick={() => setPaused(!paused)}>
                {paused || reducedMotion ? <Play size={13}/> : <Pause size={13}/>}<span>{reducedMotion ? "Motion reduced" : paused ? "Motion paused" : "Ambient motion"}</span>
              </button>
              {userId ? <button className="connection-button" onClick={disconnect}><LogOut size={13}/> Disconnect</button> : <button className="connection-button" disabled={checking} onClick={() => setConnecting(true)}><Plug size={13}/> {checking ? "Checking session…" : "Connect workspace"}</button>}
            </div>
          </header>
          {sessionMessage ? <p className="session-message" role="alert">{sessionMessage}</p> : null}
          <main id="workspace" tabIndex={-1}>{children}</main>
          <footer className="room-footer"><span><Sparkles size={13}/> Built for a little more headspace.</span><span><i className={userId ? "connected-dot" : ""}/> {userId ? "WORKSPACE CONNECTED" : "YOUR SPACE IS READY"}</span></footer>
        </div>
        <Modal open={connecting} onClose={() => { if (!pending)
        setConnecting(false); }} title="CONNECT YOUR WORKSPACE">
          <h2 className="modal-title">Make yourself at home.</h2>
          <p className="modal-description">Enter your Django access token to load your tasks, links, and feeds. It is exchanged for a secure browser session that survives refresh. Disconnect ends the session; your token is never saved in browser storage.</p>
          <form onSubmit={submit} className="connect-form">
            <label htmlFor="access-token">Access token</label>
            <input id="access-token" name="token" type="password" required autoComplete="off" spellCheck={false} placeholder="Paste your workspace token" disabled={pending}/>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" disabled={pending}>{pending ? "Connecting…" : "Connect workspace"}</button>
          </form>
        </Modal>
      </div>
    </MotionConfig>);
}
export function DashboardFrame({ children }) {
    return <ApiProvider><Frame>{children}</Frame></ApiProvider>;
}
