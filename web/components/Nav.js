import Link from "next/link";

function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: "var(--teal-600)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        C
      </span>
      <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>Contineo</span>
    </span>
  );
}

export default function Nav({ dict, lang }) {
  const other = lang === "sk" ? "en" : "sk";
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(180%) blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 66 }}
      >
        <Link href={`/${lang}`} aria-label="Contineo">
          <Logo />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 26 }} className="nav-links">
          <a href="#features" className="muted nav-link">{dict.nav.features}</a>
          <a href="#how" className="muted nav-link">{dict.nav.how}</a>
          <a href="#demo" className="muted nav-link">{dict.nav.demo}</a>
          <a href="#audience" className="muted nav-link">{dict.nav.audience}</a>
          <a href="#roadmap" className="muted nav-link">{dict.nav.roadmap}</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href={`/${other}`}
            className="muted"
            style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            {other}
          </Link>
          <a href="#cta" className="btn btn--primary" style={{ padding: "9px 16px", fontSize: 14 }}>
            {dict.nav.cta}
          </a>
        </div>
      </div>

      <style>{`
        .nav-link { font-size: 15px; transition: color .15s ease; }
        .nav-link:hover { color: var(--ink); }
        @media (max-width: 820px) { .nav-links { display: none !important; } }
      `}</style>
    </header>
  );
}
