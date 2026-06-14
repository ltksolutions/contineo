import Icon from "./Icon";

const ICONS = ["globe", "layers", "refresh"];

export default function Roadmap({ dict }) {
  const r = dict.roadmap;
  return (
    <section id="roadmap" className="section">
      <div className="container">
        <div
          style={{
            background: "var(--teal-600)",
            borderRadius: "var(--radius-lg)",
            padding: "clamp(36px, 5vw, 64px)",
            color: "#fff",
          }}
        >
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--teal-50)",
                marginBottom: 14,
              }}
            >
              {r.eyebrow}
            </span>
            <h2 style={{ color: "#fff" }}>{r.title}</h2>
            <p style={{ marginTop: 16, fontSize: 18, color: "var(--teal-50)" }}>{r.subtitle}</p>
          </div>

          <div className="grid grid--3">
            {r.items.map((it, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "var(--radius)",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    background: "rgba(255,255,255,0.14)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <Icon name={ICONS[i] || "rocket"} size={22} />
                </div>
                <h3 style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>{it.title}</h3>
                <p style={{ color: "var(--teal-50)", fontSize: 15 }}>{it.text}</p>
              </div>
            ))}
          </div>

          <div className="center" style={{ marginTop: 30 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
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
