export default function HowItWorks({ dict }) {
  const h = dict.how;
  return (
    <section id="how" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 50 }}>
          <span className="eyebrow">{h.eyebrow}</span>
          <h2>{h.title}</h2>
        </div>

        <div className="grid grid--4">
          {h.steps.map((s, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--teal-500)",
                  letterSpacing: "0.05em",
                  marginBottom: 12,
                }}
              >
                {s.n}
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{s.title}</h3>
              <p className="muted" style={{ fontSize: 15 }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
