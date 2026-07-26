import Icon from "./Icon";

/**
 * „Pre koho" ako samostatná stránka.
 *
 * Na domovskej to boli tri odseky, ktoré hovorili, KOMU je to určené,
 * ale nie ČO Z TOHO MÁ. Tu má každý segment tri veci:
 *
 *   situácia  — bolesť, v ktorej sa čitateľ spozná
 *   otázky    — čo sa reálne pýtajú (najsilnejší dôkaz zrozumiteľnosti)
 *   prínos    — čo sa zmení
 *
 * Prínosy sú zámerne bez percent a ušetrených hodín. Také čísla nemáme
 * odkiaľ vziať a pri prvej otázke „ako ste to merali" by sa to prevalilo.
 */

export default function UseCases({ dict }) {
  const u = dict.usecases;
  if (!u) return null;

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
            <span className="eyebrow">{u.eyebrow}</span>
            <h2>{u.title}</h2>
            <p className="lead" style={{ marginTop: 16 }}>{u.subtitle}</p>
          </div>

          <div className="card maxw-720 mx-auto" style={{ borderLeft: "3px solid var(--accent)" }}>
            <p style={{ fontSize: 15.5, margin: 0, lineHeight: 1.65 }}>{u.note}</p>
          </div>
        </div>
      </section>

      {u.segments.map((s, i) => (
        <section
          key={i}
          className="section"
          style={{ background: i % 2 ? "var(--surface)" : undefined, paddingTop: 44, paddingBottom: 44 }}
        >
          <div className="container">
            <div className="grid grid--2" style={{ alignItems: "start", gap: 32 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span className="card__icon" style={{ margin: 0, width: 42, height: 42, flexShrink: 0 }}>
                    <Icon name={s.icon} size={21} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: 21 }}>{s.title}</h3>
                </div>

                <p className="muted" style={{ fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>
                  {s.situation}
                </p>

                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 10 }}>
                  {u.benefitLabel}
                </h4>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  {s.benefits.map((b, j) => (
                    <li key={j} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5 }}>
                      <span style={{ color: "var(--teal-700)", marginTop: 2, flexShrink: 0 }}>
                        <Icon name="check" size={16} />
                      </span>
                      <span className="muted">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ukážkové otázky — najzrozumiteľnejší dôkaz toho, čo systém vie */}
              <div className="card">
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 14 }}>
                  {u.questionsLabel}
                </h4>
                <div style={{ display: "grid", gap: 10 }}>
                  {s.questions.map((q, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        background: "var(--bg)", border: "1px solid var(--line)",
                        borderRadius: 10, padding: "11px 13px",
                      }}
                    >
                      <span style={{ color: "var(--teal-700)", marginTop: 1, flexShrink: 0 }}>
                        <Icon name="search" size={15} />
                      </span>
                      <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>„{q}“</span>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 14, marginBottom: 0, fontStyle: "italic" }}>
                  {s.answerNote}
                </p>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="card maxw-720 mx-auto center">
            <h3 style={{ fontSize: 19, marginBottom: 10 }}>{u.commonTitle}</h3>
            <p className="muted" style={{ fontSize: 15, marginBottom: 0, lineHeight: 1.7 }}>{u.commonText}</p>
          </div>
        </div>
      </section>
    </>
  );
}
