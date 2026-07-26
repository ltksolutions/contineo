import Link from "next/link";

export default function Audience({ dict, lang }) {
  const a = dict.audience;
  return (
    <section id="audience" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 50 }}>
          <span className="eyebrow">{a.eyebrow}</span>
          <h2>{a.title}</h2>
          {a.subtitle && <p className="lead" style={{ marginTop: 16 }}>{a.subtitle}</p>}
        </div>

        <div className="grid grid--3" style={{ rowGap: 34 }}>
          {a.items.map((it, i) => (
            <div
              key={i}
              style={{
                borderLeft: "3px solid var(--teal-500)",
                paddingLeft: 18,
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{it.title}</h3>
              <p className="muted">{it.text}</p>
            </div>
          ))}
        </div>

        {/* Odkaz na podrobnu stranku — tu je len prehlad, tam su
            ukazkove otazky a konkretny prinos pre kazdy segment. */}
        {lang && (
          <div className="center" style={{ marginTop: 38 }}>
            <Link href={`/${lang}/pre-koho`} className="btn btn--ghost">
              {a.more}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
