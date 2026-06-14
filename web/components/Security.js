import Icon from "./Icon";

export default function Security({ dict }) {
  const s = dict.security;
  return (
    <section id="security" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 44 }}>
          <span className="eyebrow">{s.eyebrow}</span>
          <h2>{s.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>{s.subtitle}</p>
        </div>

        <div className="grid grid--4">
          {s.points.map((p, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={p.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 14.5 }}>{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
