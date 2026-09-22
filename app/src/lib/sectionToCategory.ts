/**
 * sectionToCategory.ts — zaradenie (`sectionKey`) na druh (`category`), O21 krok 2.
 *
 * **Nie sú to dve mená tej istej veci.** `sectionKey` hovoril, *kam dokument
 * patrí* (Stanovy, Poriadky, Zápisnice), `category` hovorí, *čo to je*
 * (norma, smernica, zákon). Zlučujú sa preto, že zaradenie od D80 netvorí
 * identitu dokumentu a ostalo ako druhá škatuľka na to isté — ale mapovanie
 * treba vyrobiť, nie prepísať kľúč za kľúč.
 *
 * Pravidlo, podľa ktorého je poskladané: **poriadok je norma.** Súťažný,
 * disciplinárny, registračný aj revízny poriadok sú záväzné predpisy zväzu;
 * líšia sa predmetom, nie druhom. Zápisnica, zmluva a tlačivo normy nie sú
 * a druh pre ne v číselníku pribudol — bez nich by import zo zaradenia
 * musel klamať.
 *
 * Čistá funkcia bez databázy zámerne: to isté mapovanie používa migračný
 * skript aj kód, a dve kópie by sa raz rozišli.
 */

/** Čo z čoho vzniká. Kľúč je stará hodnota `sectionKey`, hodnota nový druh. */
export const SECTION_TO_CATEGORY: Record<string, string> = {
  // Predpisy zväzu — všetko sú to záväzné normy.
  stanovy: "norma",
  poriadky: "norma",
  sutazny_poriadok: "norma",
  disciplinarny_poriadok: "norma",
  registracny_prestupovy_poriadok: "norma",
  revizny_poriadok: "norma",
  rokovaci_poriadok_konferencie: "norma",
  volebny_poriadok: "norma",
  poriadok_komory_sporov: "norma",
  organizacny_navstevny_poriadok: "norma",
  statuty_kodexy: "norma",

  zakony: "zakon",
  smernice: "smernica",

  // Rozpis súťaží a manuály sú návody, nie predpisy.
  rozpis_sutazi: "manual",
  rozpisy_manualy: "manual",

  // Druhy, ktoré v `category` doteraz neboli — dopĺňajú sa spolu s týmto.
  zapisnice: "zapisnica",
  zmluvy: "zmluva",
  tlaciva_formulare: "tlacivo",
}

/**
 * Druh pre dokument, ktorý ho nemá.
 *
 * `undefined` znamená „neviem" — a to je platná odpoveď: dokument s neznámym
 * zaradením dostane druh od človeka, nie od skriptu. Migrácia takéto
 * dokumenty vypíše menovite a nechá tak.
 */
export function categoryFromSection(sectionKey: string | undefined | null): string | undefined {
  const key = (sectionKey ?? "").trim().toLowerCase()
  return key ? SECTION_TO_CATEGORY[key] : undefined
}
