"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";

export default function Nav({ dict, lang }) {
  const other = lang === "sk" ? "en" : "sk";
  const pathname = usePathname() || `/${lang}`;
  const otherHref = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${lang}#features`, label: dict.nav.features },
    { href: `/${lang}#how`, label: dict.nav.how },
    { href: `/${lang}#demo`, label: dict.nav.demo },
    { href: `/${lang}#modes`, label: dict.nav.modes },
    { href: `/${lang}#identity`, label: dict.nav.identity },
    { href: `/${lang}#security`, label: dict.nav.security },
    { href: `/${lang}#roadmap`, label: dict.nav.roadmap },
  ];

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
        <Link href={`/${lang}`} aria-label="Contineo" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {links.map((l) => (
            <a key={l.href} href={l.href} className="muted nav-link">{l.label}</a>
          ))}
          <Link href={`/${lang}/technologia`} className="muted nav-link">{dict.tech.navLabel}</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle />
          <Link
            href={otherHref}
            className="muted nav-desktop"
            style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            {other}
          </Link>
          <a href={`/${lang}#cta`} className="btn btn--primary nav-desktop" style={{ padding: "9px 16px", fontSize: 14 }}>
            {dict.nav.cta}
          </a>
          <button
            className="nav-burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line)",
              background: "var(--glass-bg)", color: "var(--ink)", cursor: "pointer",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile" style={{ borderTop: "1px solid var(--line)", background: "var(--glass-bg)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="container" style={{ padding: "14px 24px 20px", display: "grid", gap: 4 }}>
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "11px 0", fontSize: 16, borderBottom: "1px solid var(--line)" }}>
                {l.label}
              </a>
            ))}
            <Link href={`/${lang}/technologia`} onClick={() => setOpen(false)} style={{ padding: "11px 0", fontSize: 16, borderBottom: "1px solid var(--line)" }}>
              {dict.tech.navLabel}
            </Link>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12 }}>
              <Link href={otherHref} onClick={() => setOpen(false)} className="muted" style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {lang === "sk" ? "English" : "Slovensky"}
              </Link>
              <a href={`/${lang}#cta`} onClick={() => setOpen(false)} className="btn btn--primary" style={{ flex: 1, justifyContent: "center", maxWidth: 200 }}>
                {dict.nav.cta}
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .nav-link { font-size: 15px; transition: color .15s ease; white-space: nowrap; }
        .nav-link:hover { color: var(--ink); }
        .nav-burger { display: none; }
        .nav-mobile { display: none; }
        @media (max-width: 1040px) {
          .nav-links { display: none !important; }
          .nav-desktop { display: none !important; }
          .nav-burger { display: inline-flex !important; }
          .nav-mobile { display: block; }
        }
      `}</style>
    </header>
  );
}
