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
 */

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navItems, isActive } from "@/lib/appNav"
import type { NavLayout, NavFlags } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function AppNav({
  layout: layout,
  flags: flags,
  language,
}: {
  layout: NavLayout
  flags: NavFlags
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const items = navItems(flags)
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

  return (
    <nav ref={bar} className={`app-nav app-nav--${layout}`} aria-label={t.sections}>
      {items.map(o => {
        const active = isActive(pathname, o.href)
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`app-nav-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t[o.key]}
          </Link>
        )
      })}
    </nav>
  )
}
