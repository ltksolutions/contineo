/**
 * cennik.test.ts — odhad ceny odpovede.
 *
 * Ceny sú z oficiálneho cenníka Anthropic, overené 2026-07-27. Testy sú tu
 * najmä kvôli dvom veciam, ktoré sa dajú ľahko prehliadnuť:
 *
 *   1. cache read stojí desatinu vstupu — bez rozlíšenia by odhad klamal
 *      až o rád,
 *   2. úvodná cena Sonnet 5 platí len do 31. 8. 2026 a potom stúpa o 50 %.
 */
import {
  cost, ratesForDate, formatUsd, formatEur, toEur, sumCosts,
  PRICELIST, EMPTY_TOKENS,
} from "../src/lib/pricing"

import { t } from "./helper"

/** Porovnanie s toleranciou — počíta sa v plávajúcej čiarke. */
const skoro = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol

const tok = (u: Partial<typeof EMPTY_TOKENS>) => ({ ...EMPTY_TOKENS, ...u })

const PRED = new Date("2026-08-15T12:00:00Z")
const PO = new Date("2026-09-15T12:00:00Z")

// ── základný výpočet ─────────────────────────────────────────────────────────

t("milión vstupných tokenov Sonnet 5 = $2",
  skoro(cost("claude-sonnet-5", tok({ vstup: 1_000_000 }), PRED).usd, 2),
  String(cost("claude-sonnet-5", tok({ vstup: 1_000_000 }), PRED).usd))

t("milión výstupných tokenov Sonnet 5 = $10",
  skoro(cost("claude-sonnet-5", tok({ vystup: 1_000_000 }), PRED).usd, 10))

t("nulové tokeny = nulová cena",
  cost("claude-sonnet-5", EMPTY_TOKENS, PRED).usd === 0)

// Cache je jadro veci: čítanie stojí desatinu, zápis o štvrtinu viac.
t("čítanie z cache stojí desatinu vstupu",
  skoro(cost("claude-sonnet-5", tok({ cacheCitanie: 1_000_000 }), PRED).usd, 0.2))
t("zápis do cache stojí 1,25× vstupu",
  skoro(cost("claude-sonnet-5", tok({ cacheZapis: 1_000_000 }), PRED).usd, 2.5))

t("zložená odpoveď sa spočíta správne",
  skoro(
    cost("claude-sonnet-5", tok({ vstup: 5_000, vystup: 1_200, cacheCitanie: 3_000 }), PRED).usd,
    (5_000 * 2 + 1_200 * 10 + 3_000 * 0.2) / 1_000_000
  ))

// Typická odpoveď na normu — kontrola rádu, aby sa nestalo, že sa niekde
// stratí či pribudne nula.
const typicka = cost("claude-sonnet-5", tok({ vstup: 6_000, vystup: 1_500 }), PRED).usd
t("typická odpoveď stojí rádovo centy",
  typicka > 0.005 && typicka < 0.1, formatUsd(typicka))

// ── zmena cenníka 1. septembra 2026 ──────────────────────────────────────────

t("do 31. 8. platí úvodná cena $2",
  ratesForDate("claude-sonnet-5", PRED).sadzby?.vstup === 2)
t("od 1. 9. platí štandardná cena $3",
  ratesForDate("claude-sonnet-5", PO).sadzby?.vstup === 3)
t("výstup stúpne z $10 na $15",
  ratesForDate("claude-sonnet-5", PO).sadzby?.vystup === 15)

t("tá istá otázka bude po 1. 9. drahšia o 50 %",
  skoro(
    cost("claude-sonnet-5", tok({ vstup: 6_000, vystup: 1_500 }), PO).usd,
    cost("claude-sonnet-5", tok({ vstup: 6_000, vystup: 1_500 }), PRED).usd * 1.5
  ),
  `${formatUsd(cost("claude-sonnet-5", tok({ vstup: 6_000, vystup: 1_500 }), PRED).usd)} → ` +
  `${formatUsd(cost("claude-sonnet-5", tok({ vstup: 6_000, vystup: 1_500 }), PO).usd)}`)

t("prepnutie na novú cenu sa NEoznačí ako expirované",
  cost("claude-sonnet-5", tok({ vstup: 100 }), PO).cennikExpirovany === false)

// Model s vypršanou cenou a bez známej následnej sa musí priznať.
t("vypršaný cenník bez následníka sa označí", (() => {
  const povodny = PRICELIST["test-expiruje"]
  PRICELIST["test-expiruje"] = { vstup: 1, cacheZapis: 1, cacheCitanie: 1, vystup: 1, platiDo: "2026-01-01" }
  const v = cost("test-expiruje", tok({ vstup: 100 }), PO)
  if (povodny) PRICELIST["test-expiruje"] = povodny
  else delete PRICELIST["test-expiruje"]
  return v.cennikExpirovany === true
})())

// ── neznámy model ────────────────────────────────────────────────────────────

const neznamy = cost("nejaky-lokalny-model", tok({ vstup: 10_000, vystup: 5_000 }))
t("neznámy model sa označí", neznamy.neznamyModel === true)
t("neznámy model nevymýšľa cenu", neznamy.usd === 0)

t("Haiku je lacnejší než Sonnet",
  cost("claude-haiku-4-5-20251001", tok({ vstup: 1_000_000 }), PRED).usd <
  cost("claude-sonnet-5", tok({ vstup: 1_000_000 }), PRED).usd)

t("záznam nesie označenie cenníka",
  /^\d{4}-\d{2}-\d{2}$/.test(cost("claude-sonnet-5", EMPTY_TOKENS).verziaCennika))

// ── formátovanie ─────────────────────────────────────────────────────────────
//
// Sumy sú rádovo centy. Dve desatinné miesta by z $0.0234 aj $0.0156
// spravili „$0.02" — rozdiel 50 % by zmizol.

// Rádovo centy: tri desatinné miesta dávajú rozlíšenie na desatinu centa,
// čo na orientáciu stačí. Pod jeden cent sa pridávajú ďalšie.
t("suma v centoch má tri miesta", formatUsd(0.0234) === "$0.023", formatUsd(0.0234))
t("suma pod cent má štyri miesta", formatUsd(0.0034) === "$0.0034", formatUsd(0.0034))
t("veľmi malá suma dostane päť miest", formatUsd(0.00007) === "$0.00007", formatUsd(0.00007))
t("suma nad dolár má dve miesta", formatUsd(12.3456) === "$12.35", formatUsd(12.3456))
t("nula je len nula", formatUsd(0) === "$0")
t("dve blízke sumy sa nezlejú", formatUsd(0.0234) !== formatUsd(0.0156))

t("euro sa prepočíta kurzom", skoro(toEur(1, 0.92), 0.92))
t("euro sa formátuje so značkou", formatEur(0.5).endsWith("€"))

// ── súčty pre štatistiky ─────────────────────────────────────────────────────

const suma = sumCosts([
  tok({ vstup: 100, vystup: 50 }),
  tok({ vstup: 200, vystup: 70, cacheCitanie: 300 }),
])
t("súčet tokenov sedí",
  suma.vstup === 300 && suma.vystup === 120 && suma.cacheCitanie === 300,
  JSON.stringify(suma))
t("prázdny súčet nespadne", sumCosts([]).vstup === 0)

