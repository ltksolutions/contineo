export default function Manifesto({ dict }) {
  const m = dict.manifesto;
  if (!m) return null;
  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="maxw-720 mx-auto center">
          <span className="eyebrow">{m.eyebrow}</span>
          <p
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              lineHeight: 1.45,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              fontWeight: 500,
            }}
          >
            {m.text}
          </p>
        </div>
      </div>
    </section>
  );
}
