import Icon from "./Icon";

/**
 * Kontrola súladu a koniec FAQ (ADR-032, ADR-034, ADR-036).
 *
 * Od 10. 10. 2026 Contineo kontroluje manuály a smernice proti nadradeným
 * normám a z otázok helpdesku navrhuje doplnenie manuálov; FAQ ako druh
 * dokumentu zaniklo (ADR-034). Web do 24. 10. hovoril „upozornenie na rozpor
 * pripravujeme" — tu je to, čo beží. Odstavec o FAQ je zámerne výrazný:
 * zákazník sa na FAQ pýta ako na samozrejmosť a odpoveď „nemáme" potrebuje dôvod.
 */
export default function ComplianceCheck({ dict }) {
  const c = dict.complianceCheck;
  if (!c) return null;

  return (
    <section id="kontrola-suladu" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{c.subtitle}</p>
        </div>

        <div className="grid grid--3" style={{ marginBottom: 32 }}>
          {c.items.map((it, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={it.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{it.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{it.text}</p>
            </div>
          ))}
        </div>

        <div className="card maxw-720 mx-auto" style={{ borderLeft: "3px solid var(--accent)" }}>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>{c.faqTitle}</h3>
          <p className="muted" style={{ fontSize: 15, margin: 0, lineHeight: 1.65 }}>{c.faqText}</p>
        </div>
      </div>
    </section>
  );
}
