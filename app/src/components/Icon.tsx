/**
 * Icon.tsx — ikony kreslené vlastnou rukou, na jednej mriežke.
 *
 * ## Prečo vlastné a nie set
 *
 * Rozhodnutie Jána Letka z 2026-09-14 (`docs/O6_rozhodovaci_harok.md`, bod 1):
 * *„za tých pár ikon to nestojí, aspoň budeme originálnejší."* Žiadna nová
 * závislosť. `docs/design/README.md` hovorí „nekresliť nové SVG od ruky" —
 * je to teda **vedomá odchýlka, nie nedopatrenie**, a tento komentár je
 * miesto, kde je to napísané.
 *
 * ## Pravidlo, ktoré drží set pohromade
 *
 * Nie „strokeWidth 1,6", ale **vykreslený ťah ≈ 1,5 px**. Je to rozdiel:
 * hrúbka ťahu v SVG sa škáluje pomerom `size / viewBox`, takže tá istá
 * hodnota `strokeWidth` je pri 13 px tenšia než pri 17 px. Práve tak vznikol
 * rozpor, ktorý hárok O6 pomenoval ako „ručne kreslené ikony sa rozchádzajú
 * vo váhe ťahu a v optickej veľkosti" — lupa v hľadaní bola kreslená inak než
 * všetko ostatné.
 *
 * `iconProps(size)` preto hrúbku **dopočíta**. Kto pridá ikonu, nemusí na to
 * myslieť; stačí, aby ju nekreslil ručne inak.
 *
 * Mriežka je vždy `0 0 18 18`, aj keď sa ikona vykresľuje menšia. Jeden
 * súradnicový systém znamená, že sa tvary dajú porovnať vedľa seba a že
 * optická veľkosť sedí — kruh s polomerom 6,6 je rovnako veľký v každej.
 */

import type { SVGProps } from "react"

/** Vykreslená hrúbka ťahu v pixeloch. Jedno číslo pre celý systém. */
export const STROKE_PX = 1.5

/** Základná mriežka. Meniť ju znamená prekresliť všetko. */
export const VIEW_BOX = 18

/**
 * Spoločné atribúty ikony. `strokeWidth` sa dopočíta tak, aby ťah vyšiel
 * rovnako hrubý pri každej veľkosti.
 */
export function iconProps(size = 17): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: `0 0 ${VIEW_BOX} ${VIEW_BOX}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: Number(((STROKE_PX * VIEW_BOX) / size).toFixed(2)),
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  }
}

/**
 * Kľúče navigácie (`lib/appNav.ts`) a k nim tvar.
 *
 * **Každá dvojica musí byť rozoznateľná na prvý pohľad**, nie po prečítaní
 * popisku. Preto „na potvrdenie" je zaškrtávacie políčko a „na schválenie"
 * pečať s fajkou — nie dvakrát dokument s fajkou, ktorý by sa na 18 px
 * nedal rozlíšiť.
 */
const PATHS: Record<string, React.ReactNode> = {
  // Prehľad — štyri dlaždice.
  overview: (
    <>
      <rect x="2.6" y="2.6" width="5.6" height="5.6" rx="1.2" />
      <rect x="9.8" y="2.6" width="5.6" height="5.6" rx="1.2" />
      <rect x="2.6" y="9.8" width="5.6" height="5.6" rx="1.2" />
      <rect x="9.8" y="9.8" width="5.6" height="5.6" rx="1.2" />
    </>
  ),
  // Voľné otázky — bublina. Otáznik sa do nej na 18 px nezmestí čitateľne.
  ask: (
    <>
      <path d="M15.2 10.4a2 2 0 0 1-2 2H7.4L3.6 15.2v-2.8h-.2a2 2 0 0 1-2-2V4.6a2 2 0 0 1 2-2h9.8a2 2 0 0 1 2 2z" />
    </>
  ),
  // Na potvrdenie — zaškrtávacie políčko.
  toAcknowledge: (
    <>
      <rect x="2.6" y="2.6" width="12.8" height="12.8" rx="2.2" />
      <path d="M5.8 9.2 8 11.4l4.2-4.4" />
    </>
  ),
  // Na schválenie — pečať s fajkou. Kruh, nie štvorec: schválenie je
  // rozhodnutie človeka, nie odškrtnutie položky.
  toApprove: (
    <>
      <circle cx="9" cy="9" r="6.4" />
      <path d="M6 9.1 8.1 11.2 12 7.1" />
    </>
  ),
  // Adresár — jedna osoba.
  directory: (
    <>
      <circle cx="9" cy="6.2" r="2.9" />
      <path d="M3.4 15.4a5.6 5.6 0 0 1 11.2 0" />
    </>
  ),
  // Knižnica — tri knihy na poličke.
  library: (
    <>
      <path d="M3.4 3.2h2.8v11.6H3.4zM7.6 3.2h2.8v11.6H7.6z" />
      <path d="m11.9 4.1 2.6.7-2.8 10.2-2.1-.6" />
    </>
  ),
  // Pridelené normy — doska so spisom.
  assigned: (
    <>
      <path d="M6.6 3.4H4.8a1.4 1.4 0 0 0-1.4 1.4v9.6a1.4 1.4 0 0 0 1.4 1.4h8.4a1.4 1.4 0 0 0 1.4-1.4V4.8a1.4 1.4 0 0 0-1.4-1.4h-1.8" />
      <rect x="6.6" y="1.9" width="4.8" height="2.9" rx="1" />
      <path d="M6.4 9.4h5.2M6.4 12.1h3.4" />
    </>
  ),
  // Reťaz dôkazov — dva články.
  evidence: (
    <>
      <path d="M7.5 10.5a3 3 0 0 1 0-4.2l1.8-1.8a3 3 0 0 1 4.2 4.2l-.9.9" />
      <path d="M10.5 7.5a3 3 0 0 1 0 4.2l-1.8 1.8a3 3 0 0 1-4.2-4.2l.9-.9" />
    </>
  ),
  // Osoby — dvaja ľudia.
  /*
    Hodnotenie — pečiatka: kruh s odškrtnutím vnútri.
    Nie lupa (tú má hľadanie), nie štvorček s háčikom (to je „na potvrdenie") —
    dve položky s tou istou kresbou sú horšie než dve položky bez ikon.
  */
  evaluation: (
    <>
      <circle cx="9" cy="9" r="6.4" />
      <path d="m6.3 9.1 1.9 1.9 3.5-3.9" />
    </>
  ),
  people: (
    <>
      <circle cx="7" cy="6.4" r="2.6" />
      <path d="M2.2 15a4.8 4.8 0 0 1 9.6 0" />
      <path d="M12.4 4.2a2.6 2.6 0 0 1 0 5M13.4 10.8a4.8 4.8 0 0 1 2.4 4.2" />
    </>
  ),
  // Zvonček — upozornenia. Presunutý z `Header.tsx`, kde býval lokálny:
  // ikona v hlavičke a ikona v sete musia vážiť rovnako, a to sa dá len
  // z jedného miesta (NASADENIE, PR 3).
  notifications: (
    <>
      <path d="M9 2.4v1.1" />
      <path d="M9 3.5c-2.1 0-3.5 1.6-3.5 3.6 0 2.9-1.1 3.5-1.1 4.3h9.2c0-.8-1.1-1.4-1.1-4.3 0-2-1.4-3.6-3.5-3.6Z" />
      <path d="M7.4 13.4a1.7 1.7 0 0 0 3.2 0" />
    </>
  ),
  /*
   * Hľadanie v zozname — lupa.
   *
   * **Nie je to položka navigácie**, ale patrí sem, lebo tu má mriežku
   * a dopočítanú hrúbku ťahu. Presne to je rozpor, ktorý hárok O6
   * pomenoval a ktorý je opísaný v záhlaví tohto súboru: lupa v hľadaní
   * bola kreslená ručne, mimo systému, a vo váhe sa rozchádzala.
   *
   * Kde patrí a kde nie, hovorí `docs/design/ZAKLAD.md`, odchýlka B:
   * lupa do knižnice, adresára a osôb (hľadá sa reťazec v zozname),
   * `ask` do hlavičky (pýta sa model). Geometria je z `KNIZNICA.html`.
   */
  search: (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="m12 12 3.6 3.6" />
    </>
  ),
  // Viac — tri bodky. Jediná plná kresba v sete: bodka z ťahu by na 18 px
  // bola krúžok a krúžky tu znamenajú schválenie a posúdenie.
  more: (
    <>
      <circle cx="3.4" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
}

/**
 * Ikona navigácie. Neznámy kľúč nevykreslí **nič** — nová položka bez ikony
 * je menšia chyba než cudzí tvar, ktorý by človek začal považovať za jej
 * význam.
 */
export default function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const shape = PATHS[name]
  if (!shape) return null
  return <svg {...iconProps(size)}>{shape}</svg>
}
