/**
 * Značky používané na dvoch miestach (hlavička bez tenanta, pätička).
 *
 * Jedna definícia, nie dve kópie: kresba v SVG je presne ten druh veci, ktorý
 * sa pri kopírovaní rozíde — jedna sa opraví, druhá zostane stará a nikto si
 * to nevšimne, lebo obe vyzerajú „nejako".
 *
 * Komponenty sú bez hookov, takže sa dajú použiť v serverovom aj klientskom
 * strome.
 */

/**
 * Značka Continea — hlava s bublinou reči.
 *
 * ## Prečo chvostík visí dole, a nie šikmo vpravo
 *
 * Pôvodná kresba mala chvostík na spojnici stredu a pravého dolného rohu
 * (`M28 27 L41 41 L29 38 Z`). Kružnica s ručkou pod 45° je **silueta lupy**
 * — a značka sa používa práve v poliach hľadania, kde to človek ako lupu aj
 * prečíta. Pri 26 px to ešte prejde, lebo oči vnútri sú vidieť; pri
 * **16 px** majú bodky pod 1,6 px, splynú s odleskom skla a zostane lupa.
 *
 * Namerané 2026-09-22 vedľa seba proti skutočnej lupe: **nepomáhalo
 * zhrubnutie ťahu.** Aj s ťahom dopočítaným na konštantných ~2,2 px (pravidlo,
 * ktoré pre ikony zavádza `Icon.tsx`) zostávala silueta lupy, len tučnejšia.
 * Rozhoduje **kam chvostík mieri**, nie aký je hrubý.
 *
 * Chvostík preto visí **zvisle dole** a je širší než dlhší — tak sa kreslí
 * bublina reči, nie ručka nástroja. Kruh dostal hrubší ťah a väčšie bodky,
 * aby oči pri 16 px prehovorili.
 *
 * ## Jedna kresba pre všetky veľkosti
 *
 * Zadanie hovorilo o „variante pre 16 px". Dve rôzne siluety toho istého loga
 * však stávajú **vedľa seba na jednej obrazovke**: hlavička nesie značku pri
 * 26 px a hneď vedľa ňu pole hľadania pri 16 px. To je horšie než ktorákoľvek
 * z tých dvoch kresieb samostatne, takže kresba je jedna a platí všade.
 *
 * `strokeWidth` je **pevný**, nie dopočítaný ako v `Icon.tsx`. Ikona má byť
 * opticky rovnaká v každej veľkosti; značka má s veľkosťou **mohutnieť** —
 * dopočítaný ťah robil pri 40 px chudokrvný krúžok.
 */
export function ContineoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="20" r="15" stroke="currentColor" strokeWidth="6" />
      <circle cx="17.5" cy="20" r="3.4" fill="currentColor" />
      <circle cx="30.5" cy="20" r="3.4" fill="currentColor" />
      <path d="M17 32.5 L24 43 L29 31.5 Z" fill="currentColor" />
    </svg>
  )
}

/** Značka GitHubu. Oficiálny tvar — inak sa odkaz na repozitár nedá poznať. */
export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
