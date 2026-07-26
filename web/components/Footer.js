import Link from "next/link";
import Logo from "./Logo";
import ComplianceBadges from "./ComplianceBadges";

/** Jazyk vzdy vypisany vo vlastnom jazyku — tak ho citatel pozna. */
const NAZVY_JAZYKOV = { sk: "Slovensky", cs: "Česky", en: "English" };

export default function Footer({ dict, lang }) {
  const f = dict.footer;
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
      <div
        className="container"
        style={{
          padding: "48px 24px 36px",
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          justifyContent: "space-between",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <div style={{ marginBottom: 12 }}>
            <Logo size={28} />
          </div>
          <p className="muted" style={{ fontSize: 14 }}>{f.tagline}</p>
        </div>

        <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{f.product}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              <li><Link href={`/${lang}`} className="muted footlink">{dict.nav.overview}</Link></li>
              <li><a href={`/${lang}#features`} className="muted footlink">{f.links.features}</a></li>
              <li><a href={`/${lang}#how`} className="muted footlink">{f.links.how}</a></li>
              <li><a href={`/${lang}#demo`} className="muted footlink">{f.links.demo}</a></li>
              <li><Link href={`/${lang}/pre-koho`} className="muted footlink">{dict.usecases.navLabel}</Link></li>
              <li><Link href={`/${lang}/bezpecnost`} className="muted footlink">{dict.residency.navLabel}</Link></li>
              <li><Link href={`/${lang}/prevadzka`} className="muted footlink">{dict.nav.runtime}</Link></li>
              <li><Link href={`/${lang}/technologia`} className="muted footlink">{dict.tech.navLabel}</Link></li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{f.company}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              <li><a href={`/${lang}#cta`} className="muted footlink">{f.links.contact}</a></li>
              <li><a href={`mailto:${dict.cta.email}`} className="muted footlink">{dict.cta.email}</a></li>
              <li><Link href={`/${lang}/ochrana-udajov`} className="muted footlink">{dict.legal.privacy.title}</Link></li>
              <li><Link href={`/${lang}/pristupnost`} className="muted footlink">{dict.legal.accessibility.title}</Link></li>
              {/* Vsetky jazyky okrem aktualneho — s cestinou uz binarny
                  prepinac nestaci. */}
              {Object.entries(NAZVY_JAZYKOV)
                .filter(([kod]) => kod !== lang)
                .map(([kod, nazov]) => (
                  <li key={kod}>
                    <Link href={`/${kod}`} className="muted footlink">{nazov}</Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "18px 24px 8px" }}>
        <ComplianceBadges dict={dict} lang={lang} />
      </div>

      <div
        className="container"
        style={{
          padding: "16px 24px", borderTop: "1px solid var(--line)",
          display: "flex", flexWrap: "wrap", gap: "6px 18px",
          alignItems: "center", justifyContent: "space-between",
        }}
      >
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          © {year} Contineo · contineo.app · {f.rights}
        </p>
        {f.ownerName && (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {f.ownerLabel}{" "}
            <a
              href={f.ownerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="footlink"
              style={{ fontWeight: 600, color: "var(--ink)" }}
            >
              {f.ownerName}
            </a>
          </p>
        )}
      </div>

      <style>{`
        .footlink { font-size: 14px; transition: color .15s ease; }
        .footlink:hover { color: var(--ink); }
      `}</style>
    </footer>
  );
}
