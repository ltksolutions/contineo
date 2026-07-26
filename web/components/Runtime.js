import Icon from "./Icon";

function RuntimeCard({ tag, icon, title, text, points, featured }) {
  return (
    <div className="card" style={featured ? { border: "2px solid var(--accent)" } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="card__icon" style={{ margin: 0, width: 40, height: 40 }}>
          <Icon name={icon} size={20} />
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--muted)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          {tag}
        </span>
      </div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ marginBottom: 14 }}>{text}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
        {points.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14.5 }}>
            <span style={{ color: "var(--ink)", marginTop: 2, flexShrink: 0 }}>
              <Icon name="check" size={16} />
            </span>
            <span className="muted">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Runtime({ dict }) {
  const r = dict.runtime;
  if (!r) return null;

  return (
    <section id="runtime" className="section" style={{ background: "var(--surface-2)" }}>
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{r.eyebrow}</span>
          <h2>{r.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{r.subtitle}</p>
        </div>

        <div className="grid grid--2" style={{ marginBottom: 40 }}>
          <RuntimeCard
            tag={r.cloud.tag}
            icon="globe"
            title={r.cloud.title}
            text={r.cloud.text}
            points={r.cloud.points}
          />
          <RuntimeCard
            tag={r.onprem.tag}
            icon="lock"
            title={r.onprem.title}
            text={r.onprem.text}
            points={r.onprem.points}
            featured
          />
        </div>

        <h3 className="center" style={{ fontSize: 18, marginBottom: 18 }}>{r.adaptersTitle}</h3>

        <div style={{ overflowX: "auto", maxWidth: 1000, margin: "0 auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700 }} />
                <th style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "var(--teal-700)", whiteSpace: "nowrap" }}>
                  {r.cloudLabel}
                </th>
                <th style={{ padding: "11px 14px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "var(--teal-700)", whiteSpace: "nowrap" }}>
                  {r.onpremLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {r.adapters.map((a, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  {/* Pod technickým názvom vysvetlenie v bežnej reči —
                      „Embedding“ a „Rerank“ nikomu mimo odboru nič nepovedia. */}
                  <td style={{ padding: "13px 14px", fontSize: 14, verticalAlign: "top", minWidth: 210 }}>
                    <div style={{ fontWeight: 600, marginBottom: a.co ? 3 : 0 }}>{a.name}</div>
                    {a.co && (
                      <div style={{ fontSize: 13, color: "var(--teal-700)", fontWeight: 600, lineHeight: 1.35 }}>
                        {a.co}
                      </div>
                    )}
                    {a.popis && (
                      <p className="muted" style={{ fontSize: 13, margin: "7px 0 0", lineHeight: 1.55, fontWeight: 400 }}>
                        {a.popis}
                      </p>
                    )}
                  </td>
                  <td className="muted" style={{ padding: "13px 14px", fontSize: 14, verticalAlign: "top" }}>{a.cloud}</td>
                  <td className="muted" style={{ padding: "13px 14px", fontSize: 14, verticalAlign: "top" }}>{a.onprem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="center muted" style={{ marginTop: 18, fontSize: 14 }}>{r.note}</p>
      </div>
    </section>
  );
}
