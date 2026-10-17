"use client"

/**
 * EditorTextu — Markdown pre technického človeka, WYSIWYG pre ostatných (D54).
 *
 * **Prečo nie len Markdown:** správca obsahu vo zväze je legislatívec, nie
 * vývojár. Text normy má rozumne členiť na články a odseky, a hviezdičky
 * a mriežky sú preňho prekážka, nie nástroj — v surovom Markdowne buď nechá
 * členenie tak, ako ho vypľul prevod, alebo ho pokazí.
 *
 * **Prečo nie len WYSIWYG:** uložený tvar zostáva Markdown, lebo z neho žije
 * chunker aj potvrdzovacia obrazovka. Vizuálny režim je pohľad na ten istý
 * text, nie iný formát — a keď sa v ňom niečo pokazí, musí byť kam sa
 * pozrieť. Prepínač je preto rovnocenný, nie „pokročilé nastavenie".
 *
 * **Prečo to nezhodí formulár bez JavaScriptu:** skryté pole `markdown` sa
 * napĺňa z editora pri každej zmene a pri odoslaní. Kým sa editor nenačíta,
 * pole nesie pôvodný text — takže sa odošle to, čo prišlo zo servera, a nie
 * prázdno.
 */

import { useEffect, useRef, useState } from "react"
import type Editor from "@toast-ui/editor"
import "@toast-ui/editor/dist/toastui-editor.css"

/**
 * `compact` — krátky úryvok, nie celý dokument (nové znenie nálezu kontroly
 * súladu, Ján 11. 10. 2026): nižší editor a len inline nástroje — nadpis
 * ani tabuľka v úryvku jedného odseku nemajú čo robiť.
 */
export default function TextEditor({
  name: name,
  initial: initial,
  compact = false,
  label,
  mode = "wysiwyg",
}: {
  name: string
  initial: string
  compact?: boolean
  /** Názov poľa pre čítačky, keď editor nie je v `<label>`. */
  label?: string
  /**
   * V akom režime sa editor otvorí. Platné znenie ide do Markdownu —
   * vizuálny režim pri uložení prepisuje zápis (16. 10. 2026).
   */
  mode?: "markdown" | "wysiwyg"
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const editor = useRef<Editor | null>(null)
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!wrap.current || editor.current) return

    /*
     * Knižnica sa importuje až tu, nie na vrchu súboru. `@toast-ui/editor`
     * siaha na DOM (`Element`) už pri vyhodnotení modulu, takže statický
     * import padal pri SSR tejto vetvy na serveri — v logoch ako
     * `ReferenceError: Element is not defined` pri každom otvorení editora
     * (od 30. 8.). Efekt beží výhradne v prehliadači; hore zostal len
     * `import type`, ktorý sa do behu nedostane.
     */
    let cancelled = false
    void (async () => {
      const { default: ToastEditor } = await import("@toast-ui/editor")
      if (cancelled || !wrap.current || editor.current) return

      const e = new ToastEditor({
        el: wrap.current,
        initialValue: initial,
        initialEditType: mode,
        previewStyle: "vertical",
        height: compact ? "220px" : "70vh",
        usageStatistics: false,
        hideModeSwitch: false,
        language: "en-US",
        toolbarItems: compact
          ? [["bold", "italic"], ["ul", "ol"], ["link"]]
          : [
              ["heading", "bold", "italic"],
              ["ul", "ol"],
              ["table", "link"],
              ["quote", "code"],
            ],
      })

      // Zmena sa prepisuje do skrytého poľa priebežne, nie až pri odoslaní:
      // formulár sa dá odoslať aj klávesnicou a `onSubmit` v Reacte pri
      // serverovej akcii nie je miesto, na ktoré sa dá spoľahnúť.
      e.on("change", () => setValue(e.getMarkdown()))

      editor.current = e
      setReady(true)
    })()

    return () => {
      cancelled = true
      editor.current?.destroy()
      editor.current = null
    }
    // Zámerne prázdne pole závislostí: editor sa vytvára raz. Pri zmene
    // `pociatocny` by sa inak prepísal text, ktorý medzitým niekto napísal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="editor-wrap">
      <input type="hidden" name={name} value={value} />

      {/* Kým sa editor nenačíta (alebo keď JavaScript nebeží), zostáva
          obyčajné textové pole s tým istým názvom. Prázdna obrazovka
          s nefunkčným tlačidlom by bola horšia než jednoduchý editor. */}
      {!ready && (
        <noscript>
          <textarea
            className="field-input editor-text"
            name={name}
            defaultValue={initial}
            spellCheck={false}
            aria-label={label ?? "Text dokumentu v Markdowne"}
          />
        </noscript>
      )}

      <div ref={wrap} className="editor-tui" aria-label={label} />
    </div>
  )
}
