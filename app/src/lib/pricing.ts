/**
 * cennik.ts — približná cena jednej odpovede.
 *
 * Slúži na orientáciu a na štatistiky, nie na fakturáciu. Skutočnú sumu
 * povie výpis od dodávateľa; toto je odhad z počtu tokenov, ktoré model
 * sám hlási.
 *
 * Dôležité pri ukladaní: odkladá sa **cena aj tokeny**. Cena je historický
 * fakt — čo to stálo v deň, keď sa otázka položila — a spätne sa nedopočíta,
 * lebo cenníky sa menia. Tokeny sú naopak nemenné, takže sa z nich dá kedykoľvek
 * prepočítať cena podľa nového cenníka. Preto sa ukladá `verziaCennika`:
 * bez nej by sa staré a nové sumy sčítavali, akoby boli porovnateľné.
 *
 * Zdroj cien: https://platform.claude.com/docs/en/about-claude/pricing
 * Overené 2026-07-27.
 */

/** Označenie cenníka, ktoré sa ukladá k záznamu. */
export const PRICELIST_VERSION = "2026-07-27"

/** Ceny za milión tokenov v USD. */
export interface ModelPrice {
  vstup: number
  /** Zápis do cache na 5 minút — 1,25× základnej ceny vstupu. */
  cacheZapis: number
  /** Čítanie z cache — 0,1× ceny vstupu. Preto sa caching oplatí. */
  cacheCitanie: number
  vystup: number
  /**
   * Dokedy cena platí (ISO dátum). Po tomto dni je odhad nespoľahlivý
   * a UI to musí povedať — mlčky počítať starou cenou by bolo horšie
   * než nepočítať vôbec.
   */
  platiDo?: string
  /** Čo príde po `platiDo` — aby sa dal dopredu odhadnúť dopad. */
  potom?: Omit<ModelPrice, "platiDo" | "potom">
}

/**
 * Ceny podľa presného označenia modelu.
 *
 * Pozor na Sonnet 5: do 31. augusta 2026 beží úvodná cena $2/$10, potom
 * nabieha štandardná $3/$15. To je **o 50 % viac** a pri plánovaní rozpočtu
 * na rok to nie je detail.
 */
export const PRICELIST: Record<string, ModelPrice> = {
  "claude-sonnet-5": {
    vstup: 2, cacheZapis: 2.5, cacheCitanie: 0.2, vystup: 10,
    platiDo: "2026-08-31",
    potom: { vstup: 3, cacheZapis: 3.75, cacheCitanie: 0.3, vystup: 15 },
  },
  "claude-opus-5": {
    vstup: 5, cacheZapis: 6.25, cacheCitanie: 0.5, vystup: 25,
  },
  "claude-haiku-4-5-20251001": {
    vstup: 1, cacheZapis: 1.25, cacheCitanie: 0.1, vystup: 5,
  },
  "claude-sonnet-4-5": {
    vstup: 3, cacheZapis: 3.75, cacheCitanie: 0.3, vystup: 15,
  },
}

/** Počty tokenov tak, ako ich hlási Anthropic API. */
export interface TokenCounts {
  vstup: number
  vystup: number
  cacheZapis: number
  cacheCitanie: number
}

export const EMPTY_TOKENS: TokenCounts = {
  vstup: 0, vystup: 0, cacheZapis: 0, cacheCitanie: 0,
}

export interface Cost {
  /** Cena v USD. */
  usd: number
  /** Ktorý cenník sa použil. */
  verziaCennika: string
  /** true = model nie je v cenníku, cena je 0 a nedá sa jej veriť. */
  neznamyModel: boolean
  /** true = použila sa cena, ktorá už neplatí (po `platiDo`). */
  cennikExpirovany: boolean
}

/**
 * Vyberie sadzby platné k danému dňu.
 *
 * Keď úvodná cena vypršala a poznáme následnú, použije sa tá. Keď následnú
 * nepoznáme, vrátime pôvodnú, ale s príznakom — UI potom povie, že odhad
 * je zastaraný, namiesto toho, aby ticho ukazovalo staré číslo.
 */
export function ratesForDate(
  model: string,
  onDate: Date = new Date()
): { sadzby: ModelPrice | null; expirovany: boolean } {
  const c = PRICELIST[model]
  if (!c) return { sadzby: null, expirovany: false }

  if (!c.platiDo) return { sadzby: c, expirovany: false }

  const end = new Date(c.platiDo + "T23:59:59Z")
  if (onDate <= end) return { sadzby: c, expirovany: false }

  return c.potom
    ? { sadzby: c.potom, expirovany: false }
    : { sadzby: c, expirovany: true }
}

/** Vypočíta cenu v USD z počtu tokenov. */
export function cost(model: string, t: TokenCounts, onDate: Date = new Date()): Cost {
  const { sadzby: rates, expirovany: expired } = ratesForDate(model, onDate)

  if (!rates) {
    return { usd: 0, verziaCennika: PRICELIST_VERSION, neznamyModel: true, cennikExpirovany: false }
  }

  const MILLION = 1_000_000
  const usd =
    (t.vstup * rates.vstup +
      t.vystup * rates.vystup +
      t.cacheZapis * rates.cacheZapis +
      t.cacheCitanie * rates.cacheCitanie) / MILLION

  return {
    usd,
    verziaCennika: PRICELIST_VERSION,
    neznamyModel: false,
    cennikExpirovany: expired,
  }
}

/**
 * Formát na zobrazenie. Sumy sú rádovo centy, takže bežné dve desatinné
 * miesta by ukázali „$0.02" pri odpovedi za $0.0234 aj za $0.0156 — teda
 * rozdiel 50 % by zmizol. Preto sa pri malých sumách pridávajú miesta.
 */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0"
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

/**
 * Prepočet na eurá.
 *
 * Fakturuje sa v dolároch, takže euro je len pomôcka. Kurz je v env,
 * lebo sa mení a nechceme ho mať zadrôtovaný v kóde.
 */
export function toEur(usd: number, rate = Number(process.env.KURZ_USD_EUR ?? 0.92)): number {
  return usd * rate
}

export function formatEur(eur: number): string {
  if (eur === 0) return "0 €"
  if (eur < 0.001) return `${eur.toFixed(5)} €`
  if (eur < 0.01) return `${eur.toFixed(4)} €`
  if (eur < 1) return `${eur.toFixed(3)} €`
  return `${eur.toFixed(2)} €`
}

/** Súčet tokenov — na štatistiky za obdobie. */
export function sumCosts(list: TokenCounts[]): TokenCounts {
  return list.reduce(
    (a, t) => ({
      vstup: a.vstup + t.vstup,
      vystup: a.vystup + t.vystup,
      cacheZapis: a.cacheZapis + t.cacheZapis,
      cacheCitanie: a.cacheCitanie + t.cacheCitanie,
    }),
    { ...EMPTY_TOKENS }
  )
}
