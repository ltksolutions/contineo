"use client";

import { useState } from "react";
import Icon from "./Icon";

export default function OverlayDemo({ site, kb }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);

  function answer(text) {
    const s = (text || "").toLowerCase();
    let best = null;
    let score = 0;
    kb.forEach((it) => {
      const m = it.k.filter((w) => s.indexOf(w) >= 0).length;
      if (m > score) {
        score = m;
        best = it;
      }
    });
    setResult(best && score > 0 ? best : "none");
  }

  function openOverlay() {
    setOpen(true);
    setResult(kb[0]);
    setQuery("");
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--line)",
        boxShadow: "var(--card-shadow)",
        minHeight: 440,
        background: "var(--surface)",
      }}
    >
      {/* faux browser top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--line)" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--line)" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--line)" }} />
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{site.name.toLowerCase().replace(/\s/g, "")}.sk</span>
      </div>

      {/* faux site header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{site.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <nav className="fauxnav" style={{ display: "flex", gap: 16 }}>
            {site.nav.map((n, i) => (
              <span key={i} className="muted" style={{ fontSize: 14 }}>{n}</span>
            ))}
          </nav>
          <button
            onClick={openOverlay}
            aria-label="Search"
            style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="search" size={18} />
          </button>
        </div>
      </div>

      {/* faux site body */}
      <div style={{ padding: "30px 22px" }}>
        <h3 style={{ fontSize: 22, marginBottom: 8 }}>{site.headline}</h3>
        <p className="muted" style={{ marginBottom: 22, maxWidth: 460 }}>{site.sub}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          {site.cards.map((c, i) => (
            <div key={i} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "18px 16px" }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{c}</div>
              <div style={{ height: 7, background: "var(--line)", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 7, width: "70%", background: "var(--line)", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>

      {/* overlay */}
      {open && (
        <div
          style={{ position: "absolute", inset: 0, background: "rgba(10,14,20,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "44px 18px" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="glass"
            style={{ width: "100%", maxWidth: 560, padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="search" size={20} style={{ color: "var(--muted)" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && query.trim() && answer(query)}
                placeholder={site.placeholder}
                aria-label={site.placeholder}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, height: 30, color: "var(--ink)" }}
              />
              <button onClick={() => setOpen(false)} aria-label={site.close} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "inline-flex" }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            {result && result !== "none" && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{result.q}</p>
                <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>{result.a}</p>
                <span style={{ fontSize: 12, background: "var(--teal-50)", color: "var(--teal-700)", borderRadius: "var(--radius)", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  <Icon name="file" size={14} /> {result.art ? `${result.src}, ${result.art}` : result.src} · {result.ver}
                </span>
                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.rel.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(r); answer(r); }}
                      style={{ fontSize: 13, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: "var(--radius)", padding: "6px 11px", cursor: "pointer", color: "var(--muted)" }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {result === "none" && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <p style={{ fontSize: 15, marginBottom: 4 }}>—</p>
                <p className="muted" style={{ fontSize: 14 }}>Skúste „prestup termín“, „ISSF heslo“ alebo „dva zápasy za deň“.</p>
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="sparkles" size={13} style={{ color: "var(--muted)" }} />
              <span className="muted" style={{ fontSize: 12 }}>{site.poweredBy}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 560px){ .fauxnav{ display:none !important; } }`}</style>
    </div>
  );
}
