"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
export function Modal({ open, onClose, title, children }) {
    const dialog = useRef(null);
    const titleId = useId();
    const reducedMotion = useReducedMotion();
    useEffect(() => {
        // Native showModal() activates browser top-layer rendering and accessibility focus trap.
        if (open && !dialog.current?.open)
            dialog.current?.showModal();
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        // Lock background scrolling while modal is open; restore on cleanup.
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [open]);
    // onCancel intercepts Escape key to prevent instant removal, allowing Framer Motion exit animation to play.
    return (<dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget)
        onClose(); }}>
      {/* onExitComplete closes the native <dialog> once Framer Motion transition completes. */}
      <AnimatePresence onExitComplete={() => dialog.current?.close()}>
        {open ? <motion.div className="modal-panel" initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          <div className="modal-heading"><p className="eyebrow" id={titleId}>{title}</p><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>
          {children}
        </motion.div> : null}
      </AnimatePresence>
    </dialog>);
}
