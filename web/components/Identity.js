import Icon from "./Icon";

export default function Identity({ dict }) {
  const id = dict.identity;
  return (
    <section id="identity" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{id.eyebrow}</span>
          <h2>{id.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{id.subtitle}</p>
        </div>

        <div className="grid grid--4">
          {id.points.map((p, i) => (
            <div className="card" key={i} style={{ background: "var(--bg)" }}>
              <div className="card__icon">
                <Icon name={p.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{p.text}</p>
            </div>
          ))}
        </div>

        <div className="center" style={{ marginTop: 40 }}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>{id.providersLabel}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {id.providers.map((name, i) => (
              <span
                key={i}
                style={{
                  fontSize: 15,
                  background: "var(--teal-50)",
                  color: "var(--teal-700)",
                  border: "1px solid var(--teal-100)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontWeight: 500,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
