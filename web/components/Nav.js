"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales } from "@/lib/dictionaries";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";

export default function Nav({ dict, lang }) {
  const pathname = usePathname() || `/${lang}`;

  // Prepinac jazykov. Bol binarny (sk <-> en); s cestinou uz treba zoznam.
  // Cesta sa zachova — kto je na /sk/pre-koho, skoci na /cs/pre-koho.
  const jazyky = locales.map((l) => ({
    kod: l,
    href: pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${l}`),
    aktivny: l === lang,
  }));
  const [open, setOpen] = useState(false);

  /**
   * V hornej liste su LEN samostatne stranky.
   *
   * Kotvy na domovskej stranke tam boli aj s rozbalovacou polozkou
   * „Produkt", ale to bol klamlivy medzikrok: rozbalovacie menu naznacuje
   * presun inam, pritom len posunie o kus nizsie. Kto je na domovskej,
   * scrolluje; kto je inde, klikne na „Prehlad" alebo na logo.
   */

  // Samostatne stranky. Bezpecnost a prevadzka sa oddelili od domovskej,
  // lebo sa na ne odkazuje v ponukach a maju vlastnu hlbku (ADR-002).
  const strany = [
    { href: `/${lang}`, label: dict.nav.overview },
    { href: `/${lang}/pre-koho`, label: dict.usecases.navLabel },
    { href: `/${lang}/bezpecnost`, label: dict.residency.navLabel },
    { href: `/${lang}/prevadzka`, label: dict.nav.runtime },
    { href: `/${lang}/technologia`, label: dict.tech.navLabel },
  ];

  // Do mobilneho menu sa zmesti vsetko.
  const mobileLinks = [
    { href: `/${lang}#demo`, label: dict.nav.demo },
    { href: `/${lang}#modes`, label: dict.nav.modes },
    { href: `/${lang}#verzie`, label: dict.nav.versions },
    { href: `/${lang}#features`, label: dict.nav.features },
    { href: `/${lang}#audience`, label: dict.nav.audience },
    { href: `/${lang}#how`, label: dict.nav.how },
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
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, height: 66 }}
      >
        <Link href={`/${lang}`} aria-label="Contineo" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {strany.map((l) => (
            <Link key={l.href} href={l.href} className="muted nav-link">{l.label}</Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle />
          <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {jazyky.map((j) => (
              <Link
                key={j.kod}
                href={j.href}
                aria-current={j.aktivny ? "true" : undefined}
                className={j.aktivny ? "lang-item lang-item--on" : "muted lang-item"}
              >
                {j.kod}
              </Link>
            ))}
          </div>
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
            {mobileLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "11px 0", fontSize: 16, borderBottom: "1px solid var(--line)" }}>
                {l.label}
              </a>
            ))}
            {strany.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ padding: "11px 0", fontSize: 16, borderBottom: "1px solid var(--line)" }}>
                {l.label}
              </Link>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {jazyky.map((j) => (
                  <Link
                    key={j.kod}
                    href={j.href}
                    onClick={() => setOpen(false)}
                    aria-current={j.aktivny ? "true" : undefined}
                    className={j.aktivny ? "lang-item lang-item--on" : "muted lang-item"}
                  >
                    {j.kod}
                  </Link>
                ))}
              </div>
              <a href={`/${lang}#cta`} onClick={() => setOpen(false)} className="btn btn--primary" style={{ flex: 1, justifyContent: "center", maxWidth: 200 }}>
                {dict.nav.cta}
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .nav-link {
          font-size: 15px;
          white-space: nowrap;
          padding: 8px 11px;
          border-radius: 8px;
          transition: color .15s ease, background-color .15s ease;
        }
        .nav-link:hover { color: var(--ink); background: var(--surface-2); }
        .lang-item {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 5px 8px;
          border-radius: 7px;
          transition: color .15s ease, background-color .15s ease;
        }
        .lang-item:hover { color: var(--ink); background: var(--surface-2); }
        .lang-item--on { color: var(--ink); background: var(--surface-2); }
        .nav-burger { display: none; }
        .nav-mobile { display: none; }
        @media (max-width: 1000px) {
          .nav-links { display: none !important; }
          .nav-desktop { display: none !important; }
          .nav-burger { display: inline-flex !important; }
          .nav-mobile { display: block; }
        }
      `}</style>
    </header>
  );
}
