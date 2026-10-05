import Icon from "./Icon";

/**
 * Tri pohľady na to isté potvrdenie: úloha, výkaz, záznam.
 *
 * Sú to **kresby, nie snímky obrazovky**. Skutočná aplikácia beží za
 * prihlásením s údajmi ľudí; ukážka s vymyslenou firmou povie to isté
 * a nikoho neukáže. Preto je pri každej štítok „Ukážka s vymyslenými údajmi".
 */

const ramik = {
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: 16,
  marginBottom: 18,
  minHeight: 236,
};
const stitok = {
  fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
  color: "var(--teal-700)", background: "var(--teal-50)", borderRadius: 999, padding: "3px 9px",
  display: "inline-block",
};

function Task({ t }) {
  return (
    <div style={ramik} aria-hidden="true">
      <span style={stitok}>{t.tag}</span>
      <p style={{ fontSize: 15.5, fontWeight: 600, margin: "10px 0 2px" }}>{t.doc}</p>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{t.version} · {t.due}</p>
      <div
        style={{
          margin: "12px 0", background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 8, padding: "9px 11px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 7,
        }}
      >
        <Icon name="file" size={15} /> <span className="muted">{t.pdf}</span>
      </div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: "0 0 12px" }}>{t.statement}</p>
      <span className="btn btn--primary" style={{ padding: "8px 14px", fontSize: 13.5, pointerEvents: "none" }}>
        <Icon name="check" size={15} /> {t.button}
      </span>
    </div>
  );
}

function Report({ r }) {
  return (
    <div style={ramik} aria-hidden="true">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>{r.title}</p>
      <div style={{ display: "grid", gap: 12 }}>
        {r.rows.map((x, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
              <span>{x.doc}</span>
              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{x.pct} %</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "var(--line)", margin: "5px 0 3px" }}>
              <div style={{ width: `${x.pct}%`, height: 5, borderRadius: 999, background: "var(--accent)" }} />
            </div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{x.detail}</p>
          </div>
        ))}
      </div>
      <span className="btn btn--ghost" style={{ padding: "7px 12px", fontSize: 13, marginTop: 14, pointerEvents: "none" }}>
        {r.remind}
      </span>
    </div>
  );
}

function Record({ r }) {
  return (
    <div style={ramik} aria-hidden="true">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>{r.title}</p>
      <dl style={{ margin: 0, display: "grid", gap: 7 }}>
        {r.fields.map((f, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
            <dt className="muted">{f.k}</dt>
            <dd style={{ margin: 0, textAlign: "right", fontWeight: 500 }}>{f.v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted" style={{ fontSize: 12, margin: "12px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="lock" size={14} /> {r.locked}
      </p>
    </div>
  );
}

export default function AckViews({ dict }) {
  const a = dict.ackPage;
  const kresby = [<Task key="t" t={a.task} />, <Report key="r" r={a.report} />, <Record key="z" r={a.record} />];

  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <h2>{a.viewsTitle}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{a.viewsIntro}</p>
        </div>

        <div className="grid grid--3" style={{ alignItems: "start" }}>
          {a.views.map((v, i) => (
            <div className="card" key={i}>
              {kresby[i]}
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{v.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{v.text}</p>
            </div>
          ))}
        </div>

        <p className="muted center" style={{ fontSize: 13, marginTop: 20 }}>{a.sample}</p>
      </div>
    </section>
  );
}
