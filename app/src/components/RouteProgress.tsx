"use client"

/**
 * Prúžok priebehu pri prechode medzi stránkami (O20).
 *
 * **Načo, keď sú kostry.** Kostra sa objaví až vtedy, keď server začne
 * odpovedať; medzi kliknutím a tou chvíľou je krátke ticho, v ktorom človek
 * nevie, či klik vôbec zabral — a klikne druhý raz. Prúžok toto ticho vyplní.
 * Kostra hovorí *čo* príde, prúžok *že* sa už ide.
 *
 * **Prečo poslucháč na `document`, a nie `next/link`.** Odkazy sú po celej
 * aplikácii, v desiatkach komponentov; obaliť ich všetky by znamenalo prepísať
 * každý z nich a nikdy si nebyť istý, že sa na jeden nezabudlo. Jeden
 * poslucháč v bubline zachytí aj tie, ktoré pribudnú.
 *
 * **Prečo sa nikdy nedopočíta do konca.** Koľko z načítania je hotové, nikto
 * nevie — server buď odpovie, alebo nie. Prúžok preto spomaľuje a zastaví sa
 * pred koncom; dokončí ho až skutočná zmena adresy. Pruh, ktorý dobehne na
 * 100 % a potom stojí, je klamstvo o stave, aké si tento systém inde
 * nedovoľuje.
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Poistka. Ak sa prechod nikdy nedokončí — server neodpovie, človek prechod
 * preruší, cieľ je stiahnutie súboru namiesto stránky — prúžok sám zhasne.
 * Svietiaci prúžok nad stránkou, ktorá už dávno stojí, je horší než žiadny.
 */
const MAX_MS = 20_000

export default function RouteProgress() {
  const pathname = usePathname()
  const [busy, setBusy] = useState(false)

  /*
   * Zmena adresy znamená, že cieľ je na obrazovke. Toto je jediné miesto, kde
   * sa prúžok vypína „úspechom“ — všetko ostatné je poistka.
   *
   * `requestAnimationFrame`, nie holé `setBusy(false)`: nastaviť stav priamo
   * v efekte spustí ďalšie kolo vykreslenia hneď po prvom a lint to (správne)
   * odmieta. O snímku neskôr je to pre oko to isté a pre React to je obyčajná
   * zmena stavu, nie reťaz.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBusy(false))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => setBusy(false), MAX_MS)
    return () => clearTimeout(t)
  }, [busy])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Klik, ktorý už niekto spracoval, a klik s modifikátorom (nová karta,
      // nové okno, stiahnutie) stránku v tomto okne nemenia.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a")
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      if (!anchor.getAttribute("href")) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      // Cudzia doména odchádza z aplikácie a `mailto:`/`tel:` ju neopúšťajú
      // vôbec — ani jedno nie je prechod medzi stránkami.
      if (url.origin !== window.location.origin) return
      // Odkaz na to isté miesto (alebo len na kotvu) nič nenačítava.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      setBusy(true)
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  if (!busy) return null

  // `aria-hidden`: o čakaní hovorí kostra stránky cez `role="status"`. Druhý
  // hlas o tom istom by čítačku obrazovky len zdvojil.
  return <div className="route-progress" aria-hidden="true" />
}
