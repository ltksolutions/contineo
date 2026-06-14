import Link from "next/link";
import Logo from "./Logo";
import ComplianceBadges from "./ComplianceBadges";

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
              <li><a href={`/${lang}#features`} className="muted footlink">{f.links.features}</a></li>
              <li><a href={`/${lang}#how`} className="muted footlink">{f.links.how}</a></li>
              <li><a href={`/${lang}#demo`} className="muted footlink">{f.links.demo}</a></li>
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
              <li>
                <Link href={`/${lang === "sk" ? "en" : "sk"}`} className="muted footlink">
                  {lang === "sk" ? "English" : "Slovensky"}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "18px 24px 8px" }}>
        <ComplianceBadges dict={dict} lang={lang} />
      </div>

      <div className="container" style={{ padding: "16px 24px", borderTop: "1px solid var(--line)" }}>
        <p className="muted" style={{ fontSize: 13 }}>
          © {year} Contineo · contineo.app · {f.rights}
        </p>
      </div>

      <style>{`
        .footlink { font-size: 14px; transition: color .15s ease; }
        .footlink:hover { color: var(--ink); }
      `}</style>
    </footer>
  );
}
