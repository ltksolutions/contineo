import Icon from "./Icon";

/**
 * Riadenie a potvrdzovanie predpisov.
 *
 * Do 5. 10. 2026 web predstavoval Contineo len ako vyhľadávanie. Polovica
 * produktu — postup znenia (ADR-014), potvrdzovanie s dôkazom (ADR-005,
 * ADR-011), ochrana údajov (ADR-012) a vzdelávanie (ADR-018) — na ňom
 * chýbala, hoci v SFZ beží naostro.
 *
 * Píše sa len to, čo je nasadené. Čo sa len pripravuje, patrí do Verzií
 * alebo do Pripravujeme, nie sem.
 */

export default function Governance({ dict }) {
  const g = dict.governance;
  if (!g) return null;

  return (
    <section id="potvrdzovanie" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{g.eyebrow}</span>
          <h2>{g.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{g.subtitle}</p>
        </div>

        {/* Postup znenia — štyri kroky v poradí, v akom ich vidí správca na karte dokumentu */}
        <h3 className="center" style={{ fontSize: 17, marginBottom: 18 }}>{g.stepsTitle}</h3>
        <ol className="grid grid--4" style={{ listStyle: "none", margin: "0 0 44px", padding: 0 }}>
          {g.steps.map((s, i) => (
            <li className="card" key={i} style={{ borderTop: "3px solid var(--accent)" }}>
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 style={{ fontSize: 16.5, margin: "6px 0 8px" }}>{s.title}</h4>
              <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="grid grid--3" style={{ marginBottom: 32 }}>
          {g.items.map((it, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={it.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{it.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{it.text}</p>
            </div>
          ))}
        </div>

        <p className="muted center maxw-720 mx-auto" style={{ fontSize: 14.5, margin: "0 auto" }}>
          <span style={{ color: "var(--teal-700)", verticalAlign: "-3px", marginRight: 6 }}>
            <Icon name="check" size={16} />
          </span>
          {g.note}
        </p>
      </div>
    </section>
  );
}
