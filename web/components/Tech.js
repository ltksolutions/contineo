import Link from "next/link";
import Icon from "./Icon";

export default function Tech({ dict, lang }) {
  const t = dict.tech;
  return (
    <main>
      <section
        style={{
          background: "linear-gradient(180deg, var(--surface) 0%, #ffffff 100%)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="container" style={{ padding: "72px 24px 56px", textAlign: "center" }}>
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 className="maxw-720 mx-auto">{t.title}</h1>
          <p className="lead maxw-720 mx-auto" style={{ marginTop: 20 }}>
            {t.subtitle}
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn--primary" href="/Contineo_technicky_navrh.pdf" download>
              <Icon name="file" size={18} /> {t.download}
            </a>
            <Link className="btn btn--ghost" href={`/${lang}`}>
              {t.back}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 36 }}>
            <h2>{t.architectureTitle}</h2>
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-lg)",
              padding: "clamp(16px, 3vw, 32px)",
            }}
          >
            <img
              src="/contineo_diagram.png"
              alt={t.architectureTitle}
              style={{ width: "100%", height: "auto", display: "block", borderRadius: "var(--radius)" }}
            />
          </div>
          <p className="muted center" style={{ marginTop: 16, fontSize: 14 }}>
            {t.architectureCaption}
          </p>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
            <h2>{t.pillarsTitle}</h2>
          </div>
          <div className="grid grid--3">
            {t.pillars.map((p, i) => (
              <div className="card" key={i} style={{ background: "var(--bg)" }}>
                <div className="card__icon">
                  <Icon name={p.icon} size={22} />
                </div>
                <h3 style={{ marginBottom: 8 }}>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 32 }}>
            <h2>{t.stackTitle}</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {t.stack.map((s, i) => (
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
                {s}
              </span>
            ))}
          </div>
          <div className="center" style={{ marginTop: 36 }}>
            <a className="btn btn--primary" href="/Contineo_technicky_navrh.pdf" download>
              <Icon name="file" size={18} /> {t.download}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
