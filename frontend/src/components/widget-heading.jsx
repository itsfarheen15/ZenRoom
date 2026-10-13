export function WidgetHeading({ id, icon, title, subtitle, badge }) {
    return (<header className="widget-heading">
      <span className="widget-icon" aria-hidden="true">{icon}</span>
      <div><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
      {badge ? <span className="micro-badge">{badge}</span> : null}
    </header>);
}
