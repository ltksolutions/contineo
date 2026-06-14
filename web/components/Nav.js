"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function Nav({ dict, lang }) {
  const other = lang === "sk" ? "en" : "sk";
  const pathname = usePathname() || `/${lang}`;
  const otherHref = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--glass-bg)",
        backdropFilter: "saturate(180%) blur(16px)",
        WebkitBackdropFilter: "saturate(180%) blur(16px)",
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
          <a href={`/${lang}#features`} className="muted nav-link">{dict.nav.features}</a>
          <a href={`/${lang}#how`} className="muted nav-link">{dict.nav.how}</a>
          <a href={`/${lang}#demo`} className="muted nav-link">{dict.nav.demo}</a>
          <a href={`/${lang}#modes`} className="muted nav-link">{dict.nav.modes}</a>
          <a href={`/${lang}#roadmap`} className="muted nav-link">{dict.nav.roadmap}</a>
          <Link href={`/${lang}/technologia`} className="muted nav-link">{dict.tech.navLabel}</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          <Link
            href={otherHref}
            className="muted"
            style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            {other}
          </Link>
          <a href={`/${lang}#cta`} className="btn btn--primary" style={{ padding: "9px 16px", fontSize: 14 }}>
            {dict.nav.cta}
          </a>
        </div>
      </div>

      <style>{`
        .nav-link { font-size: 15px; transition: color .15s ease; }
        .nav-link:hover { color: var(--ink); }
        @media (max-width: 860px) { .nav-links { display: none !important; } }
      `}</style>
    </header>
  );
}
