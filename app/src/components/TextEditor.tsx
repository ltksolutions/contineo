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
import Editor from "@toast-ui/editor"
import "@toast-ui/editor/dist/toastui-editor.css"

export default function TextEditor({
  meno: name,
  pociatocny: initial,
}: {
  meno: string
  pociatocny: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const editor = useRef<Editor | null>(null)
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!wrap.current || editor.current) return

    const e = new Editor({
      el: wrap.current,
      initialValue: initial,
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      height: "70vh",
      usageStatistics: false,
      hideModeSwitch: false,
      language: "en-US",
      toolbarItems: [
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

    return () => {
      e.destroy()
      editor.current = null
    }
    // Zámerne prázdne pole závislostí: editor sa vytvára raz. Pri zmene
    // `pociatocny` by sa inak prepísal text, ktorý medzitým niekto napísal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="editor-obal">
      <input type="hidden" name={name} value={value} />

      {/* Kým sa editor nenačíta (alebo keď JavaScript nebeží), zostáva
          obyčajné textové pole s tým istým názvom. Prázdna obrazovka
          s nefunkčným tlačidlom by bola horšia než jednoduchý editor. */}
      {!ready && (
        <noscript>
          <textarea
            className="pole-vstup editor-text"
            name={name}
            defaultValue={initial}
            spellCheck={false}
            aria-label="Text dokumentu v Markdowne"
          />
        </noscript>
      )}

      <div ref={wrap} className="editor-tui" />
    </div>
  )
}
