import Icon from "./Icon";

export default function CTA({ dict }) {
  const c = dict.cta;
  return (
    <section id="cta" className="section">
      <div className="container">
        <div
          className="glass"
          style={{ padding: "60px 32px", textAlign: "center" }}
        >
          <h2>{c.title}</h2>
          <p className="lead" style={{ marginTop: 14 }}>{c.subtitle}</p>
          <a href={`mailto:${c.email}`} className="btn btn--primary" style={{ marginTop: 26 }}>
            <Icon name="arrow" size={18} /> {c.button}
          </a>
          <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>{c.email}</p>
        </div>
      </div>
    </section>
  );
}
