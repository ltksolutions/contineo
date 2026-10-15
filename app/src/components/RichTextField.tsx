"use client"

/**
 * RichTextField — editor správy Kuriéra „čo vidíš, to dostaneš"
 * (KURIER-editor, 15. 10. 2026; ADR-033 D208).
 *
 * **Ukladá sa ďalej Markdown.** Editor (Tiptap / ProseMirror) píše do
 * skrytého `<textarea name=…>` ten istý ľahký Markdown, aký dovtedy písal
 * človek ručne (`docToMarkdown`), a server ani zobrazenie sa nemenia.
 * Povolené je len to, čo pozná `formatText.ts`: odsek, nadpis, odrážky,
 * číslovanie, tučné a **vnútorný** odkaz. Text vložený z Wordu alebo webu sa
 * oreže na tieto tvary — schéma editora iné neprijme.
 *
 * **Bez JavaScriptu ostáva obyčajné pole** s nápovedou o Markdowne — editor
 * sa doň namontuje až v prehliadači (`immediatelyRender: false`).
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import Bold from "@tiptap/extension-bold"
import Heading from "@tiptap/extension-heading"
import HardBreak from "@tiptap/extension-hard-break"
import Link from "@tiptap/extension-link"
import { BulletList, OrderedList, ListItem, ListKeymap } from "@tiptap/extension-list"
import { Placeholder, UndoRedo } from "@tiptap/extensions"
import Icon from "@/components/Icon"
import { markdownToDoc, docToMarkdown, isInternalHref, type RichNode } from "@/lib/richText"
import { isExternalHref, hostOf } from "@/lib/courierLinks"

export interface RichTextLabels {
  toolbar: string
  bold: string
  heading: string
  bullets: string
  numbered: string
  link: string
  linkSearch: string
  linkNone: string
  linkClose: string
  /** S `{host}` — funkcia by sa zo servera do klienta nepreniesla. */
  linkExternal: string
  markdownHint: string
}

interface Found { title: string; href: string }

export default function RichTextField({
  id,
  name,
  required = false,
  rows = 5,
  maxLength,
  defaultValue = "",
  placeholder,
  labels,
}: {
  id?: string
  name: string
  required?: boolean
  rows?: number
  maxLength?: number
  defaultValue?: string
  placeholder?: string
  labels: RichTextLabels
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  /*
   * Markdown do skrytého poľa. Udalosť `input` ho nesie ďalej — počúva ju
   * `TypingSignal` („píše…", D210), ktorý dovtedy počúval na `<textarea>`.
   */
  function sync(e: Editor) {
    const el = area.current
    if (!el) return
    el.value = docToMarkdown(e.getJSON() as RichNode)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document, Paragraph, Text, Bold, HardBreak, UndoRedo,
      Heading.configure({ levels: [2] }),
      BulletList, OrderedList, ListItem, ListKeymap,
      // Vnútorné cesty a od D222 aj `https://` odkazy von (s náhľadom pri
      // odoslaní). Iné adresy (`http:`, `javascript:` …) sa zahodia a ostane
      // z nich text. Napísaná alebo vložená `https://` adresa sa stane odkazom.
      Link.configure({
        openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https",
        isAllowedUri: url => isInternalHref(url) || isExternalHref(url),
        shouldAutoLink: url => isExternalHref(url),
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: markdownToDoc(defaultValue) as never,
    editorProps: {
      attributes: { class: "rte-content", "aria-multiline": "true", role: "textbox", ...(id ? { "aria-labelledby": `${id}-label` } : {}) },
      handleKeyDown: (_view, event) => {
        // ⌘K / Ctrl+K — vložiť odkaz na obsah (rovnako ako v poštových klientoch).
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          setLinkOpen(true)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: e }) => sync(e),
  })

  const ready = Boolean(editor)
  const button = (label: string, active: boolean, run: () => void, mark: ReactNode) => (
    <button type="button" className={`rte-btn${active ? " is-on" : ""}`} aria-pressed={active} title={label} aria-label={label}
            onMouseDown={e => e.preventDefault()} onClick={run}>
      {mark}
    </button>
  )

  return (
    <div className={`rte${ready ? " is-ready" : ""}`}>
      {editor && (
        <div className="rte-toolbar" role="toolbar" aria-label={labels.toolbar}>
          {button(labels.bold, editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <b aria-hidden="true">B</b>)}
          {button(labels.heading, editor.isActive("heading"), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <span aria-hidden="true" className="rte-h">H</span>)}
          {button(labels.bullets, editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <Icon name="bullets" size={18} />)}
          {button(labels.numbered, editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <Icon name="numbered" size={18} />)}
          {button(labels.link, editor.isActive("link") || linkOpen, () => setLinkOpen(o => !o), <Icon name="link" size={18} />)}
        </div>
      )}
      {editor && linkOpen && <LinkPicker editor={editor} labels={labels} onClose={() => setLinkOpen(false)} />}
      {editor && <EditorContent editor={editor} className="rte-editor field-input" style={{ minHeight: `${rows * 1.5 + 1}em` }} />}
      {/* Pole, ktoré odchádza s formulárom. S editorom skryté a bez `required`
          (skrytý povinný prvok prehliadač neodošle ani neoznačí); prázdnu
          správu odmietne server (`validateContent`). */}
      <textarea ref={area} id={id} className="field-input" name={name} required={required && !ready} rows={rows} maxLength={maxLength}
                defaultValue={defaultValue} placeholder={placeholder} hidden={ready} style={{ resize: "vertical", lineHeight: 1.5 }} />
      {!ready && <span className="quiet field-hint rte-md-hint">{labels.markdownHint}</span>}
    </div>
  )
}

/** Hľadanie dokumentu a vloženie odkazu naň do označeného textu (alebo jeho názvu). */
function LinkPicker({ editor, labels, onClose }: { editor: Editor; labels: RichTextLabels; onClose: () => void }) {
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Found[] | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // Pod dvomi znakmi sa nehľadá a starý výsledok sa neukazuje.
  const shown = q.trim().length < 2 ? null : items
  // Napísaná adresa `https://…` — odkaz von (D222), náhľad sa stiahne pri odoslaní.
  const typed = q.trim()
  const outside = isExternalHref(typed) ? { title: hostOf(typed), href: typed } : null

  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    if (q.trim().length < 2 || /^https?:\/\//i.test(q.trim())) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/courier/links?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : { items: [] })
        .then((d: { items: Found[] }) => setItems(d.items))
        .catch(() => {})
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q])

  function insert(f: Found) {
    if (!isInternalHref(f.href) && !isExternalHref(f.href)) return
    const { empty } = editor.state.selection
    const chain = editor.chain().focus()
    if (empty) chain.insertContent({ type: "text", text: f.title, marks: [{ type: "link", attrs: { href: f.href } }] }).insertContent(" ").run()
    else chain.extendMarkRange("link").setLink({ href: f.href }).run()
    onClose()
  }

  return (
    <div className="rte-link" onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); editor.commands.focus() } }}>
      <div className="rte-link-row">
        <input ref={input} className="field-input" type="search" value={q} onChange={e => setQ(e.target.value)}
               placeholder={labels.linkSearch} aria-label={labels.linkSearch} />
        <button type="button" className="button button--quiet button--sm" onClick={() => { onClose(); editor.commands.focus() }}>{labels.linkClose}</button>
      </div>
      {outside && (
        <ul className="rte-link-list">
          <li><button type="button" onClick={() => insert(outside)}>{labels.linkExternal.replace("{host}", outside.title)}</button></li>
        </ul>
      )}
      {!outside && shown && (
        shown.length === 0
          ? <p className="quiet rte-link-none">{labels.linkNone}</p>
          : <ul className="rte-link-list">
              {shown.map(f => (
                <li key={f.href}><button type="button" onClick={() => insert(f)}>{f.title}</button></li>
              ))}
            </ul>
      )}
    </div>
  )
}
