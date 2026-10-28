// Video ukážky pomocníka v ISSF (intro, priebeh, záverečné logo).
// Bez automatického spúšťania a s preload="none": 12 MB sa stiahne, až keď ho
// človek pustí. Titulky v jazyku stránky sú zapnuté, ostatné sa dajú prepnúť
// v prehrávači — video je po slovensky na všetkých troch verziách webu.
const BASE = "/media/pomocnik-issf";
const TRACKS = [
  { lang: "sk", label: "Slovenčina" },
  { lang: "cs", label: "Čeština" },
  { lang: "en", label: "English" },
];

export default function VideoDemo({ dict, lang }) {
  const v = dict.video;
  if (!v) return null;
  return (
    <section id="video" className="section">
      <div className="container">
        <div className="center maxw-720 mx-auto" style={{ marginBottom: 40 }}>
          <span className="eyebrow">{v.eyebrow}</span>
          <h2>{v.title}</h2>
          <p className="lead" style={{ marginTop: 16 }}>
            {v.subtitle}
          </p>
        </div>
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--line)",
            boxShadow: "var(--card-shadow)",
            background: "#11151c",
          }}
        >
          <video
            controls
            playsInline
            preload="none"
            poster={`${BASE}/poster-video.jpg`}
            aria-label={v.label}
            style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1600 / 1058" }}
          >
            <source src={`${BASE}/pomocnik-issf-ukazka.mp4`} type="video/mp4" />
            {TRACKS.map((t) => (
              <track
                key={t.lang}
                kind="captions"
                src={`${BASE}/titulky-${t.lang}.vtt`}
                srcLang={t.lang}
                label={t.label}
                default={t.lang === lang}
              />
            ))}
          </video>
        </div>
        <p className="muted center" style={{ fontSize: 14, marginTop: 14 }}>
          {v.note}
        </p>
      </div>
    </section>
  );
}
