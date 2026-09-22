"use client";

import { useSyncExternalStore } from "react";

/**
 * Prepínač témy.
 *
 * ## Téma nie je stav tohto komponentu
 *
 * Skutočná téma žije v atribúte `data-theme` na `<html>` a nastavuje ju
 * vložený skript v `app/layout.js` **ešte pred prvým vykreslením** — inak by
 * stránka blikla svetlou, kým sa React rozbehne. Komponent je teda iba
 * pohľad na hodnotu, ktorú vlastní niekto iný.
 *
 * Preto `useSyncExternalStore` a nie `useState`. Predtým tu bol `useState`
 * plnený z `useEffect`, čo znamenalo dva zdroje pravdy — atribút a stav —
 * a jedno vykreslenie navyše pri každom načítaní. Pravidlo
 * `react-hooks/set-state-in-effect` (nové v `eslint-config-next@16`) na to
 * upozorňovalo právom.
 *
 * ## Prečo to nebliká
 *
 * `getServerSnapshot` vracia `"light"` a hydratácia sa deje presne s touto
 * hodnotou, takže sa server a klient zhodnú. Až po nej React prečíta
 * skutočný atribút a ikonu prípadne prekreslí. Farby stránky to nerieši —
 * tie drží CSS podľa `data-theme`, ktorý je správny od prvého pixelu.
 * Blikne nanajvýš ikona v tlačidle, nie stránka, a presne tak sa to
 * správalo aj predtým.
 */

const LIGHT = "light";
const DARK = "dark";

/**
 * Musí byť na úrovni modulu.
 *
 * `useSyncExternalStore` sa odhlási a prihlási vždy, keď sa zmení referencia
 * na túto funkciu. Definovaná vnútri komponentu by to robila pri každom
 * vykreslení — pozorovateľ by sa neustále rušil a zakladal nanovo.
 */
function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") || LIGHT;
}

/**
 * Na serveri žiadny `document` nie je a téma sa tam ani zistiť nedá —
 * je uložená v prehliadači. `"light"` je tá istá voľba, akú robí vložený
 * skript, keď `localStorage` nič nevie a systém tmavú tému nežiada.
 */
function getServerSnapshot() {
  return LIGHT;
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === DARK;

  function toggle() {
    const next = isDark ? LIGHT : DARK;
    // Zapíše sa len atribút; nové vykreslenie si vyžiada pozorovateľ vyššie.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("contineo-theme", next);
    } catch (e) {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Svetlá téma" : "Tmavá téma"}
      title={isDark ? "Svetlá téma" : "Tmavá téma"}
      style={{
        width: 36,
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: "var(--glass-bg)",
        backdropFilter: "blur(8px)",
        color: "var(--ink)",
        cursor: "pointer",
      }}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
