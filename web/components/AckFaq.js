/**
 * Časté otázky k potvrdzovaniu. `<details>` — funguje bez JavaScriptu
 * a klávesnica aj čítačka ho poznajú.
 */
export default function AckFaq({ dict }) {
  const a = dict.ackPage;
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 800 }}>
        <h2 className="center" style={{ marginBottom: 28 }}>{a.faqTitle}</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {a.faq.map((f, i) => (
            <details key={i} className="card" style={{ padding: "16px 20px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16.5, minHeight: 28 }}>{f.q}</summary>
              <p className="muted" style={{ fontSize: 15, margin: "12px 0 0", lineHeight: 1.65 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
