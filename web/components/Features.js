import Icon from "./Icon";

export default function Features({ dict }) {
  const f = dict.features;
  return (
    <section id="features" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 50 }}>
          <span className="eyebrow">{f.eyebrow}</span>
          <h2>{f.title}</h2>
        </div>

        <div className="grid grid--3">
          {f.items.map((it, i) => (
            <div className="card" key={i}>
              <div className="card__icon">
                <Icon name={it.icon} size={22} />
              </div>
              <h3 style={{ marginBottom: 8 }}>{it.title}</h3>
              <p className="muted">{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
