"use client"

/**
 * StromSPoradim — presúvanie položiek myšou v rámci jednej úrovne (D60).
 *
 * Slúži **oddeleniam v nastavení organizácie aj priečinkom v knižnici**. Sú
 * to dva rôzne stromy s rovnakým správaním; dva komponenty by znamenali, že
 * sa jeden z nich raz začne správať inak a nikto nebude vedieť, ktorý je
 * ten správny.
 *
 * **Ťahanie je nadstavba, nie jediná cesta.** Pri každej položke zostávajú
 * šípky hore/dole — obyčajné formuláre, ktoré fungujú bez JavaScriptu,
 * ovládajú sa klávesnicou a na telefóne sa trafia ľahšie než ťahanie prstom.
 * Organizačnú schému niekto usporadúva raz za rok a nemá pri tom bojovať
 * s presnosťou pustenia.
 *
 * **Ťahať sa dá len medzi súrodencami.** Pretiahnuť oddelenie inému rodičovi
 * by bola zmena štruktúry maskovaná ako preusporiadanie — a práve to je
 * pohyb, ktorý sa myšou spraví omylom. Na zmenu nadriadeného je samostatný
 * výber, kde je vidieť, čo sa deje.
 *
 * **Poradie sa neukladá po každom pustení.** Zmena sa ukáže hneď, zapíše sa
 * až tlačidlom: ťahanie po zozname je hľadanie správneho miesta, nie sedem
 * rozhodnutí — a sedem zápisov v audite by z histórie spravilo šum.
 *
 * Obsah riadka (premenovanie, presun, zrušenie) sa sem posiela **hotový zo
 * serverovej stránky**. Tento komponent teda nevie nič o tom, čo sa dá
 * s oddelením robiť — rieši len poradie.
 */

import { useState } from "react"
import type { ReactNode } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export interface TreeItem {
  id: string
  name: string
  parentId: string | null
  level: number
  label?: string
  /** Vykreslené priamo zo serverovej stránky — formuláre úprav. */
  content?: ReactNode
}

const FORM_ID = "department-order"

export default function TreeWithOrder({
  items: items,
  hidden: hidden,
  action: action,
  language,
}: {
  items: TreeItem[]
  /**
   * Polia, ktoré sa majú poslať spolu s poradím — záložka v nastavení
   * organizácie, filtre v knižnici. Bez nich by človeka po uložení hodilo
   * na iný pohľad než ten, v ktorom preusporadúval.
   */
  hidden?: Record<string, string>
  action: (fd: FormData) => void | Promise<void>
  /** Jazyk prostredia. */
  language?: UiLanguage
}) {
  const t = dictionary(language).tree
  const [order, setOrder] = useState<TreeItem[]>(items)
  const [dragged, setDragged] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const z = order.find(p => p.id === fromId)
    const na = order.find(p => p.id === toId)
    // Cudzí rodič = zmena štruktúry. Tá sa myšou nerobí.
    if (!z || !na || (z.parentId ?? null) !== (na.parentId ?? null)) return

    const without = order.filter(p => p.id !== fromId)
    const at = without.findIndex(p => p.id === toId)
    setOrder([...without.slice(0, at), z, ...without.slice(at)])
    setChanged(true)
  }

  return (
    <>
      {/* Formulár je prázdny a stojí mimo zoznamu: formuláre sa nesmú vnárať
          a v riadkoch sú vlastné (premenovať, presunúť, zrušiť). Tlačidlo sa
          naň odkazuje cez `form`. */}
      <form id={FORM_ID} action={action}>
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="order" value={order.map(p => p.id).join(",")} />
      </form>

      <ul className="strom strom--ciary">
        {order.map(p => (
          <li
            key={p.id}
            className={`strom-polozka${dragged === p.id ? " sa-taha" : ""}`}
            style={{ "--uroven": p.level } as React.CSSProperties}
            draggable
            onDragStart={() => setDragged(p.id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              if (dragged) move(dragged, p.id)
              setDragged(null)
            }}
          >
            {p.content}
          </li>
        ))}
      </ul>

      {changed && (
        <div className="strom-ulozit">
          <button className="tlacidlo" type="submit" form={FORM_ID}>{t.saveOrder}</button>
          <button
            className="tlacidlo tlacidlo--tiche"
            type="button"
            onClick={() => { setOrder(items); setChanged(false) }}
          >
            {t.cancel}
          </button>
          <span className="tichy" style={{ fontSize: 13 }}>
            {t.hint}
          </span>
        </div>
      )}
    </>
  )
}
