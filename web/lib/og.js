import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDictionary } from "./dictionaries";
import { textyStranky, skrat } from "./ogTexty";

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
            <circle cx="24" cy="20" r="15" stroke="#eef1f5" strokeWidth="6" />
            <circle cx="17.5" cy="20" r="3.4" fill="#eef1f5" />
            <circle cx="30.5" cy="20" r="3.4" fill="#eef1f5" />
            <path d="M17 32.5 L24 43 L29 31.5 Z" fill="#eef1f5" />
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
