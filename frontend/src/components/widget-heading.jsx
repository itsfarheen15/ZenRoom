/**
 * Shared semantic header component across dashboard widgets.
 *
 * Accessibility invariant:
 * Associates the widget `<section>` with its heading title via `id` (matching
 * the section's `aria-labelledby`), while marking visual icons as `aria-hidden`.
 */
export function WidgetHeading({ id, icon, title, subtitle, badge }) {
    return (
        <header className="widget-heading">
            <span className="widget-icon" aria-hidden="true">{icon}</span>
            <div>
                <h2 id={id}>{title}</h2>
                <p>{subtitle}</p>
            </div>
            {badge ? <span className="micro-badge">{badge}</span> : null}
        </header>
    );
}
