import Icon from "./Icon";

/**
 * Verzie a legislatívny chaos.
 *
 * Najsilnejšia bolesť, ktorú Contineo rieši, a doteraz na webe nebola:
 * nie „nemám kde hľadať“, ale „nájdem päť znení a neviem, ktoré platí“.
 *
 * Blok je zámerne rozdelený na to, čo funguje DNES, a to, čo pripravujeme.
 * Detekcia rozporu internej normy so zákonom je zatiaľ zámer — sľúbiť ju
 * ako hotovú by sa pri prvej ukážke prevalilo.
 */

export default function Versions({ dict }) {
  const v = dict.versions;
  if (!v) return null;

  return (
    <section id="verzie" className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{v.eyebrow}</span>
          <h2>{v.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{v.subtitle}</p>
        </div>

        {/* Konkrétny príklad — bez neho je to len abstraktná sťažnosť */}
        <div
          className="card maxw-720 mx-auto"
          style={{ borderLeft: "3px solid var(--accent)", marginBottom: 44 }}
        >
          <p style={{ fontSize: 15, margin: 0, lineHeight: 1.65 }}>
            <strong>{v.exampleTitle}</strong>{" "}
            <span className="muted">{v.exampleText}</span>
          </p>
        </div>

        <div className="grid grid--3" style={{ marginBottom: 44 }}>
          {v.problems.map((p, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={p.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{p.text}</p>
            </div>
          ))}
        </div>

        {/* Čo funguje dnes vs. čo pripravujeme — oddelené zámerne */}
        <div className="grid grid--2" style={{ alignItems: "start", gap: 24 }}>
          <div className="card">
            <h3 style={{ fontSize: 17, marginBottom: 6 }}>{v.nowTitle}</h3>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{v.nowIntro}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 11 }}>
              {v.now.map((x, i) => (
                <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5 }}>
                  <span style={{ color: "var(--teal-700)", marginTop: 2, flexShrink: 0 }}>
                    <Icon name="check" size={16} />
                  </span>
                  <span className="muted">{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ borderStyle: "dashed" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17, margin: 0 }}>{v.nextTitle}</h3>
              <span
                style={{
                  fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em",
                  textTransform: "uppercase", color: "var(--muted)",
                  border: "1px solid var(--line)", borderRadius: 999, padding: "3px 9px",
                }}
              >
                {v.nextTag}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{v.nextIntro}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 11 }}>
              {v.next.map((x, i) => (
                <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5 }}>
                  <span className="muted" style={{ marginTop: 2, flexShrink: 0 }}>
                    <Icon name="sparkles" size={16} />
                  </span>
                  <span className="muted">{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
