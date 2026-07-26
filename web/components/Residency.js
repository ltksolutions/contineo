import Icon from "./Icon";

/**
 * Dátová rezidencia — kam sa dostane text zákazníka pri spracovaní.
 *
 * Vedomé rozhodnutie: tabuľka ukazuje aj to, čo zatiaľ NEVIEME. Stav
 * „overuje sa“ je poctivejší než tvrdenie bez opory a pri tendri sa
 * nevedieť odpovedať na vlastné marketingové tvrdenie vypomstí viac,
 * než keby tam tá tabuľka nebola. Viď docs/ADR-002-datova-rezidencia.md.
 */

const ODTIEN = {
  ok:      { bg: "var(--teal-50, #ecfdf5)", fg: "var(--teal-700)", ikona: "check" },
  mimo:    { bg: "var(--amber-50, #fffbeb)", fg: "var(--amber-700, #b45309)", ikona: "globe" },
  overuje: { bg: "var(--bg)", fg: "var(--muted)", ikona: "help" },
};

function Znacka({ stav, text }) {
  const o = ODTIEN[stav] ?? ODTIEN.overuje;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: o.bg, color: o.fg,
        border: "1px solid var(--line)", borderRadius: 999,
        padding: "3px 10px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <Icon name={o.ikona} size={13} />
      {text}
    </span>
  );
}

const bunkaHlavicka = {
  padding: "9px 12px", textAlign: "left",
  fontSize: 12.5, fontWeight: 700,
};
const bunka = { padding: "10px 12px", fontSize: 13.5, verticalAlign: "top" };
const tabulka = {
  width: "100%", borderCollapse: "collapse",
  background: "var(--bg)", border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
};

export default function Residency({ dict }) {
  const r = dict.residency;
  if (!r) return null;

  return (
    <section id="rezidencia" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{r.eyebrow}</span>
          <h2>{r.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{r.subtitle}</p>
        </div>

        {/* Tri úrovne — to, čo sa v praxi najčastejšie zamieňa */}
        <div className="grid grid--3" style={{ marginBottom: 44 }}>
          {r.levels.map((u, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={u.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{u.title}</h3>
              <p className="muted" style={{ fontSize: 14.5, marginBottom: 12 }}>{u.text}</p>
              <p style={{ fontSize: 13, color: "var(--teal-700)", fontWeight: 600 }}>{u.who}</p>
            </div>
          ))}
        </div>

        <p className="muted maxw-720 mx-auto center" style={{ fontSize: 14.5, marginBottom: 44 }}>
          {r.levelsNote}
        </p>

        {/* Režimy tenanta */}
        <h3 style={{ fontSize: 17, marginBottom: 12 }}>{r.modesTitle}</h3>
        <p className="muted" style={{ fontSize: 14.5, marginBottom: 14 }}>{r.modesIntro}</p>
        <div style={{ overflowX: "auto", marginBottom: 40 }}>
          <table style={tabulka}>
            <thead>
              <tr>
                <th style={bunkaHlavicka}>{r.modesHead.mode}</th>
                <th style={bunkaHlavicka}>{r.modesHead.meaning}</th>
                <th style={{ ...bunkaHlavicka, color: "var(--teal-700)" }}>{r.modesHead.embedding}</th>
                <th style={{ ...bunkaHlavicka, color: "var(--teal-700)" }}>{r.modesHead.rerank}</th>
                <th style={{ ...bunkaHlavicka, color: "var(--teal-700)" }}>{r.modesHead.generation}</th>
              </tr>
            </thead>
            <tbody>
              {r.modes.map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ ...bunka, fontFamily: "var(--font-mono, monospace)", fontSize: 13, color: "var(--teal-700)", whiteSpace: "nowrap" }}>
                    {m.key}
                  </td>
                  <td style={bunka}>{m.meaning}</td>
                  <td className="muted" style={bunka}>{m.embedding}</td>
                  <td className="muted" style={bunka}>{m.rerank}</td>
                  <td className="muted" style={bunka}>{m.generation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kde spracovanie naozaj prebieha — vrátane neznámych */}
        <h3 style={{ fontSize: 17, marginBottom: 12 }}>{r.whereTitle}</h3>
        <p className="muted" style={{ fontSize: 14.5, marginBottom: 14 }}>{r.whereIntro}</p>
        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <table style={tabulka}>
            <thead>
              <tr>
                <th style={bunkaHlavicka}>{r.whereHead.component}</th>
                <th style={bunkaHlavicka}>{r.whereHead.provider}</th>
                <th style={bunkaHlavicka}>{r.whereHead.location}</th>
                <th style={bunkaHlavicka}>{r.whereHead.evidence}</th>
              </tr>
            </thead>
            <tbody>
              {r.where.map((w, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={bunka}>{w.component}</td>
                  <td className="muted" style={{ ...bunka, fontFamily: "var(--font-mono, monospace)", fontSize: 12.5 }}>
                    {w.provider}
                  </td>
                  <td style={bunka}><Znacka stav={w.stav} text={w.location} /></td>
                  <td className="muted" style={{ ...bunka, fontSize: 13 }}>{w.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="card"
          style={{ borderLeft: "3px solid var(--accent)", marginBottom: 28 }}
        >
          <p className="muted" style={{ fontSize: 14.5, margin: 0 }}>
            <strong style={{ color: "var(--ink)" }}>{r.honestyTitle}</strong>{" "}
            {r.honestyText}
          </p>
        </div>

        <p className="muted" style={{ fontSize: 13.5, fontStyle: "italic" }}>{r.legalNote}</p>
      </div>
    </section>
  );
}
