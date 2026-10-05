import Icon from "./Icon";

/**
 * GDPR v produkte a vlastná bezpečnostná kontrola.
 *
 * Píše sa len to, čo je overené v kóde (`docs/BEZPECNOSTNA_KONTROLA_2026-09.md`,
 * časť „Čo je spravené dobre") a čo beží (ADR-012, ADR-017, ADR-022, ADR-026).
 * Veta na konci je povinná: je to vlastná kontrola, nie audit — kto by si
 * z nadpisu odniesol certifikáciu, bol by zavedený.
 */
export default function Compliance({ dict }) {
  const c = dict.compliance;
  if (!c) return null;

  return (
    <section id="gdpr" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{c.subtitle}</p>
        </div>

        <div className="card maxw-720 mx-auto" style={{ marginBottom: 44 }}>
          <h3 style={{ fontSize: 18, marginBottom: 14 }}>{c.gdprTitle}</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 11 }}>
            {c.gdpr.map((x, i) => (
              <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 15 }}>
                <span style={{ color: "var(--teal-700)", marginTop: 3, flexShrink: 0 }}>
                  <Icon name="check" size={16} />
                </span>
                <span className="muted">{x}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="center maxw-720 mx-auto" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>{c.reviewTitle}</h3>
          <p className="muted" style={{ fontSize: 15 }}>{c.reviewIntro}</p>
        </div>
        <div className="grid grid--3">
          {c.review.map((r, i) => (
            <div className="card" key={i}>
              <h4 style={{ fontSize: 16.5, marginBottom: 8 }}>{r.title}</h4>
              <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>{r.text}</p>
            </div>
          ))}
        </div>
        <p className="muted center maxw-720 mx-auto" style={{ fontSize: 13.5, marginTop: 22, fontStyle: "italic" }}>
          {c.reviewNote}
        </p>
      </div>
    </section>
  );
}
