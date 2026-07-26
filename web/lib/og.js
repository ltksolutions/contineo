import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDictionary } from "./dictionaries";

/**
 * Obrázky pre zdieľanie (Open Graph / Twitter).
 *
 * Generujú sa pri builde zo slovníka, nie ručne v grafickom editore —
 * takže sa nemôžu rozísť s textom stránky. Zmena nadpisu v `dictionaries.js`
 * sa premietne aj do obrázka.
 *
 * Každá stránka má vlastný obrázok v každom jazyku: 5 stránok × 3 jazyky.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

/**
 * Satori (ktoré ImageResponse používa) nevie WOFF2 ani systémové fonty.
 * Načítavame preto dve podmnožiny Inter:
 *
 *   latin      — základná abeceda
 *   latin-ext  — diakritika: ľ, š, č, ť, ž, ě, ř, ů …
 *
 * Bez tej druhej by sa slovenské a české znaky vykreslili ako prázdne
 * obdĺžniky — a to práve v obrázku, ktorý ide na sociálne siete.
 */
async function nacitajFonty() {
  const zaklad = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
  const [r, rExt, b, bExt] = await Promise.all([
    readFile(path.join(zaklad, "inter-latin-400-normal.woff")),
    readFile(path.join(zaklad, "inter-latin-ext-400-normal.woff")),
    readFile(path.join(zaklad, "inter-latin-700-normal.woff")),
    readFile(path.join(zaklad, "inter-latin-ext-700-normal.woff")),
  ]);
  return [
    { name: "Inter", data: r, weight: 400, style: "normal" },
    { name: "InterExt", data: rExt, weight: 400, style: "normal" },
    { name: "Inter", data: b, weight: 700, style: "normal" },
    { name: "InterExt", data: bExt, weight: 700, style: "normal" },
  ];
}

/** Popisky jazyka v pravom dolnom rohu — aby bolo na prvý pohľad jasné, ktorá mutácia. */
const JAZYK = { sk: "Slovensky", cs: "Česky", en: "English" };

/**
 * Texty pre jednotlivé stránky. Berú sa zo slovníka, takže sú vždy
 * zhodné s tým, čo je na stránke.
 */
export function textyStranky(dict, stranka) {
  switch (stranka) {
    case "pre-koho":
      return { eyebrow: dict.usecases.eyebrow, title: dict.usecases.title, sub: dict.usecases.subtitle };
    case "bezpecnost":
      return { eyebrow: dict.residency.eyebrow, title: dict.residency.title, sub: dict.residency.subtitle };
    case "prevadzka":
      return { eyebrow: dict.runtime.eyebrow, title: dict.runtime.title, sub: dict.runtime.subtitle };
    case "technologia":
      return { eyebrow: dict.tech.eyebrow, title: dict.tech.title, sub: dict.tech.subtitle };
    default:
      return { eyebrow: dict.hero.badge, title: dict.hero.title, sub: dict.hero.claim };
  }
}

/**
 * Skráti text, aby sa zmestil na plátno — ale VŽDY na hranici slova.
 *
 * Prvá verzia rezala na presnom počte znakov a v češtine z toho vyšlo
 * „kdo by změny sle…“. V obrázku, ktorý ide na LinkedIn, to vyzerá ako
 * chyba, nie ako skrátenie.
 */
function skrat(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  const orez = text.slice(0, max);
  const medzera = orez.lastIndexOf(" ");
  const zaklad = medzera > max * 0.6 ? orez.slice(0, medzera) : orez;
  return zaklad.replace(/[\s,;:.—–-]+$/, "") + "…";
}

export async function ogObrazok(lang, stranka) {
  const dict = getDictionary(lang);
  const t = textyStranky(dict, stranka);
  const fonts = await nacitajFonty();

  // Tmavé pozadie zámerne: v kanáloch ako Slack či LinkedIn sa náhľady
  // zobrazujú medzi svetlým obsahom, takže tmavý obrázok vystúpi.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0d1016 0%, #161b22 55%, #232a35 100%)",
          color: "#eef1f5",
          fontFamily: "Inter, InterExt",
          padding: "64px 72px",
        }}
      >
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <circle cx="18" cy="18" r="13" stroke="#eef1f5" strokeWidth="4" />
            <circle cx="13" cy="18" r="2.3" fill="#eef1f5" />
            <circle cx="23" cy="18" r="2.3" fill="#eef1f5" />
            <path d="M28 27 L41 41 L29 38 Z" fill="#eef1f5" />
          </svg>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Contineo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 21, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#9aa4b2",
            }}
          >
            {skrat(t.eyebrow, 54)}
          </div>
          <div
            style={{
              fontSize: t.title.length > 46 ? 55 : 68,
              fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.025em",
              maxWidth: 1010,
            }}
          >
            {skrat(t.title, 92)}
          </div>
          <div style={{ fontSize: 27, lineHeight: 1.45, color: "#c7ced8", maxWidth: 950 }}>
            {skrat(t.sub, 150)}
          </div>
        </div>

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.14)", paddingTop: 24, fontSize: 21,
          }}
        >
          <div style={{ color: "#9aa4b2" }}>contineo.app</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#9aa4b2" }}>
            <span>{JAZYK[lang] ?? lang}</span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
            <span>LTK Solutions</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
