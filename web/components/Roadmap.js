import Icon from "./Icon";

const ICONS = ["globe", "layers", "refresh"];

export default function Roadmap({ dict }) {
  const r = dict.roadmap;
  return (
    <section id="roadmap" className="section">
      <div className="container">
        <div className="glass" style={{ padding: "clamp(36px, 5vw, 64px)" }}>
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
            <span className="eyebrow">{r.eyebrow}</span>
            <h2>{r.title}</h2>
            <p className="lead" style={{ marginTop: 16 }}>{r.subtitle}</p>
          </div>

          <div className="grid grid--3">
            {r.items.map((it, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: 24,
                }}
              >
                <div className="card__icon" style={{ marginBottom: 14 }}>
                  <Icon name={ICONS[i] || "rocket"} size={22} />
                </div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{it.title}</h3>
                <p className="muted" style={{ fontSize: 15 }}>{it.text}</p>
              </div>
            ))}
          </div>

          <div className="center" style={{ marginTop: 30 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: 999,
              }}
            >
              <Icon name="rocket" size={15} /> {r.tag}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
