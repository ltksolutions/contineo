import Link from "next/link";

export default function LegalArticle({ dict, lang, kind }) {
  const back = lang === "en" ? "Back to home" : "Späť na hlavnú stránku";

  return (
    <main id="main" className="section">
      <div className="container" style={{ maxWidth: 760, margin: "0 auto" }}>
        {kind === "privacy" ? (
          <>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{dict.legal.privacy.title}</h1>
            <p className="muted" style={{ marginTop: 14 }}>{dict.legal.privacy.intro}</p>
            <div style={{ marginTop: 28, display: "grid", gap: 22 }}>
              {dict.legal.privacy.sections.map((s, i) => (
                <div key={i}>
                  <h2 style={{ fontSize: 18, marginBottom: 6 }}>{s.h}</h2>
                  <p className="muted">{s.p}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{dict.legal.accessibility.title}</h1>
            <p className="muted" style={{ marginTop: 14 }}>{dict.legal.accessibility.intro}</p>
            <ul className="muted" style={{ marginTop: 20, paddingLeft: 20, lineHeight: 1.9 }}>
              {dict.legal.accessibility.points.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
            <h2 style={{ fontSize: 18, marginTop: 26, marginBottom: 6 }}>{dict.legal.accessibility.contactH}</h2>
            <p className="muted">{dict.legal.accessibility.contact}</p>
          </>
        )}
        <div style={{ marginTop: 32 }}>
          <Link className="btn btn--ghost" href={`/${lang}`}>{back}</Link>
        </div>
      </div>
    </main>
  );
}
