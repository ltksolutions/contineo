import Icon from "./Icon";

export default function CTA({ dict }) {
  const c = dict.cta;
  return (
    <section id="cta" className="section">
      <div className="container">
        <div
          style={{
            background: "var(--teal-600)",
            borderRadius: "var(--radius-lg)",
            padding: "60px 32px",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <h2 style={{ color: "#fff" }}>{c.title}</h2>
          <p style={{ marginTop: 14, fontSize: 18, color: "var(--teal-50)" }}>{c.subtitle}</p>
          <a
            href={`mailto:${c.email}`}
            className="btn"
            style={{ marginTop: 26, background: "#fff", color: "var(--teal-700)" }}
          >
            <Icon name="arrow" size={18} /> {c.button}
          </a>
          <p style={{ marginTop: 16, color: "var(--teal-50)", fontSize: 14 }}>{c.email}</p>
        </div>
      </div>
    </section>
  );
}
