/**
 * ogTexty.js — čisté textové pomôcky pre obrázok na sociálne siete.
 *
 * Oddeľené od `og.js` z jediného dôvodu: `og.js` obsahuje JSX a `next/og`,
 * takže sa dá spustiť len v Nexte. Tieto dve funkcie pritom **nič z toho
 * nepotrebujú** — dostanú reťazec, vrátia reťazec — a takto sa dajú otestovať
 * bez obalu (`tests/og.test.mjs`).
 */

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
export function skrat(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  const orez = text.slice(0, max);
  const medzera = orez.lastIndexOf(" ");
  const zaklad = medzera > max * 0.6 ? orez.slice(0, medzera) : orez;
  return zaklad.replace(/[\s,;:.—–-]+$/, "") + "…";
}
