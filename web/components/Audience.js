export default function Audience({ dict }) {
  const a = dict.audience;
  return (
    <section id="audience" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 50 }}>
          <span className="eyebrow">{a.eyebrow}</span>
          <h2>{a.title}</h2>
        </div>

        <div className="grid grid--3">
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
      </div>
    </section>
  );
}
