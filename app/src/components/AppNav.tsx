"use client"

/**
 * AppNav — navigácia aplikačného shellu v dvoch variantoch.
 *
 * `sidebar` je bočný panel, `topbar` vodorovné záložky. Nie sú to dva
 * komponenty: rozdiel je v smere a rozostupoch, teda v CSS, a dve kópie by
 * znamenali, že sa jedna z nich raz začne správať inak.
 *
 * Položky sú **skutočné routy podmienené rolami**, nie zoznam z prototypu:
 * odkaz na obrazovku, ktorá ešte neexistuje, vedie na 404 a odkaz na sekciu,
 * do ktorej človek nesmie, mu prezrádza, čo v systéme je.
 *
 * Ikony zatiaľ nie sú. Prototyp má na ich mieste textové znaky (▦ ▤ ⌕) a tie
 * do produkcie nepatria; projekt vlastný ikonový set nemá a kresliť šesť
 * nových od ruky handoff výslovne zakazuje. Bez ikon je navigácia čitateľná,
 * s vymyslenými by bola len ozdobnejšia.
 *
 * Správcovské odkazy (nastavenie organizácie, správa tenantov) tu zámerne
 * nie sú — zostávajú pod avatarom v hlavičke, ktorý sa v shelli neskrýva.
 * Sú to veci otvárané raz za mesiac a v dennej navigácii len zaberajú miesto.
 *
 * Zoznam položiek, `normalizeLayout()` a `isActive()` sú v `lib/appNav.ts`,
 * nie tu: z modulu s `"use client"` sa funkcia na serveri volať nedá a
 * `/library` si variant navigácie určuje práve na serveri.
 *
 * ── Prečo je pás v DOM dvakrát ────────────────────────────────────────────
 *
 * Na úzkej obrazovke je deväť položiek dlhších než výrez a rolovací pás to
 * nepriznáva — posledná položka je odseknutá v polovici slova. Handoff (krok
 * 7) preto žiada **zásuvku**, nie pás.
 *
 * Zásuvka je `<details>`/`<summary>`, aby fungovala bez JavaScriptu. Lenže
 * obsah `<details>` skrýva prehliadač sám a CSS ho **nevie odkryť** späť
 * (je v tieňovom strome; `::details-content` je príliš nové). Preto sú tu
 * oba tvary naraz a prepína ich `@media`: nad prahom je vidieť pás a zásuvka
 * je `display: none`, pod prahom naopak. Čo je `display: none`, nie je ani
 * v strome prístupnosti, takže čítačka vidí vždy len jednu navigáciu.
 *
 * Odkazy sa píšu raz (`list()`), duplikuje sa len ich vykreslenie.
 */

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navItems, isActive } from "@/lib/appNav"
import type { NavLayout, NavFlags, NavCounts, NavItem } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function AppNav({
  layout: layout,
  flags: flags,
  counts: counts,
  language,
}: {
  layout: NavLayout
  flags: NavFlags
  counts?: NavCounts
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const items = navItems(flags, counts)
  const bar = useRef<HTMLElement>(null)

  /*
   * Na úzkej obrazovke je navigácia vodorovný pás a aktívna položka môže byť
   * mimo výrezu — človek potom nevidí, kde je, a pás vyzerá ako by sa začínal
   * inde. Posúva sa **vlastný `scrollLeft` pásu**, nie `scrollIntoView()`:
   * ten hýbe aj stránkou a pri načítaní by ju stiahol pod hlavičku.
   */
  useEffect(() => {
    const node = bar.current
    if (!node) return
    // Nič neprečnieva (široká obrazovka alebo bočný panel) — netreba nič robiť.
    if (node.scrollWidth <= node.clientWidth) return
    const active = node.querySelector<HTMLElement>(".is-active")
    if (!active) return
    node.scrollLeft = active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2
  }, [pathname, layout])

  const link = (o: NavItem) => {
    const active = isActive(pathname, o.href)
    return (
      <Link
        key={o.href}
        href={o.href}
        className={`app-nav-item${active ? " is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {t[o.key]}
        {/*
          Nula sa nekreslí vôbec. Štítok s nulou nie je informácia, je to šum —
          a človek, ktorý nemá čo potvrdzovať, sa to má dozvedieť tým, že tam
          nič nesvieti, nie tým, že si prečíta „0".
        */}
        {typeof o.count === "number" && o.count > 0 && (
          <span className="app-nav-count" aria-label={t.waiting(o.count)}>
            {o.count}
          </span>
        )}
      </Link>
    )
  }

  const bocny = (
    <nav ref={bar} className={`app-nav app-nav--${layout}`} aria-label={t.sections}>
      {items.map(link)}
    </nav>
  )

  if (layout === "sidebar") return bocny

  /*
   * Súčet na prepínači zásuvky. Keď je zásuvka zavretá, jednotlivé štítky
   * vidieť nie je — bez súčtu by človek na telefóne nevedel, že naňho niečo
   * čaká, kým ju neotvorí.
   */
  const spolu = items.reduce((a, o) => a + (o.count ?? 0), 0)

  return (
    <>
      {bocny}
      <div className="app-nav-drawer">
        <details>
          <summary className="app-nav-toggle">
            {t.sections}
            {spolu > 0 && (
              <span className="app-nav-count" aria-label={t.waiting(spolu)}>
                {spolu}
              </span>
            )}
          </summary>
          <nav className="app-nav app-nav--drawer" aria-label={t.sections}>
            {items.map(link)}
          </nav>
        </details>
      </div>
    </>
  )
}
