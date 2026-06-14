import Icon from "./Icon";
import OverlayDemo from "./OverlayDemo";

function ModeCard({ tag, icon, title, text, points, featured }) {
  return (
    <div
      className="card"
      style={featured ? { border: "2px solid var(--accent)" } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="card__icon" style={{ margin: 0, width: 40, height: 40 }}>
          <Icon name={icon} size={20} />
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--muted)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          {tag}
        </span>
      </div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ marginBottom: 14 }}>{text}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
        {points.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5 }}>
            <span style={{ color: "var(--ink)", marginTop: 2, flexShrink: 0 }}>
              <Icon name="check" size={16} />
            </span>
            <span className="muted">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Modes({ dict, kb }) {
  const m = dict.modes;
  return (
    <section id="modes" className="section" style={{ background: "var(--surface-2)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{m.eyebrow}</span>
          <h2>{m.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{m.subtitle}</p>
        </div>

        <div className="grid grid--2" style={{ marginBottom: 40 }}>
          <ModeCard
            tag={m.intranet.tag}
            icon="lock"
            title={m.intranet.title}
            text={m.intranet.text}
            points={m.intranet.points}
          />
          <ModeCard
            tag={m.embed.tag}
            icon="code"
            title={m.embed.title}
            text={m.embed.text}
            points={m.embed.points}
            featured
          />
        </div>

        <p className="center muted" style={{ marginBottom: 18, fontSize: 14 }}>
          <Icon name="search" size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {m.embed.demoHint}
        </p>

        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <OverlayDemo site={m.site} kb={kb} />
        </div>
      </div>
    </section>
  );
}
