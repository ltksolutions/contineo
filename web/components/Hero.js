import Icon from "./Icon";

export default function Hero({ dict }) {
  const h = dict.hero;
  return (
    <section
      style={{
        background: "linear-gradient(180deg, var(--surface-2) 0%, var(--bg) 100%)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="container" style={{ padding: "92px 24px 80px", textAlign: "center" }}>
        <span
          className="eyebrow"
          style={{
            background: "var(--teal-50)",
            padding: "6px 14px",
            borderRadius: 999,
            textTransform: "none",
            letterSpacing: 0,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="sparkles" size={15} /> {h.badge}
        </span>

        <h1 className="maxw-720 mx-auto" style={{ marginTop: 8 }}>
          {h.title}
        </h1>

        {h.claim && (
          <p
            className="mx-auto"
            style={{
              marginTop: 16,
              fontSize: "clamp(18px, 2.2vw, 22px)",
              fontWeight: 600,
              color: "var(--teal-600)",
              maxWidth: 720,
            }}
          >
            {h.claim}
          </p>
        )}

        <p className="lead maxw-720 mx-auto" style={{ marginTop: 18 }}>
          {h.subtitle}
        </p>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a href="#demo" className="btn btn--primary">
            {h.ctaPrimary} <Icon name="arrow" size={18} />
          </a>
          <a href="#how" className="btn btn--ghost">
            {h.ctaSecondary}
          </a>
        </div>

        <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>
          <Icon name="code" size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {h.note}
        </p>

        <p className="muted" style={{ marginTop: 40, fontSize: 13, letterSpacing: "0.02em" }}>
          {dict.logos}
        </p>
      </div>
    </section>
  );
}
