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
import Italic from "@tiptap/extension-italic"
import Underline from "@tiptap/extension-underline"
import Strike from "@tiptap/extension-strike"
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
  italic: string
  underline: string
  strike: string
  emoji: string
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
  const [emojiOpen, setEmojiOpen] = useState(false)

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
      Document, Paragraph, Text, Bold, Italic, Underline, Strike, HardBreak, UndoRedo,
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
  /*
   * Formátovanie má na tlačidle **slovo**, nie písmeno (Ján 16. 10. 2026:
   * „ikona H a B nech je slovom") — a slovo samo ukazuje, ako formátuje.
   * Skratka je v `title`. Odrážky, číslovanie, odkaz a emotikony ostávajú
   * ikonami s `aria-label`. Pod 640 px namiesto slova písmeno (B, I, U, S, H),
   * aby sa celá lišta zmestila do jedného riadku (Ján 16. 10. 2026) — CSS
   * ukáže jedno z dvoch; `aria-label` nesie slovo vždy.
   */
  const word = (full: ReactNode, glyph: ReactNode) => (
    <>
      <span className="rte-word" aria-hidden="true">{full}</span>
      <span className="rte-glyph" aria-hidden="true">{glyph}</span>
    </>
  )
  const button = (label: string, active: boolean, run: () => void, mark: ReactNode, shortcut = "", isWord = false) => (
    <button type="button" className={`rte-btn${isWord ? " rte-btn--word" : ""}${active ? " is-on" : ""}`} aria-pressed={active}
            title={shortcut ? `${label} (${shortcut})` : label} aria-label={label}
            onMouseDown={e => e.preventDefault()} onClick={run}>
      {mark}
    </button>
  )

  return (
    <div className={`rte${ready ? " is-ready" : ""}`}>
      {editor && (
        <div className="rte-toolbar" role="toolbar" aria-label={labels.toolbar}>
          {button(labels.bold, editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), word(<b>{labels.bold}</b>, <b>B</b>), "⌘B", true)}
          {button(labels.italic, editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), word(<i>{labels.italic}</i>, <i>I</i>), "⌘I", true)}
          {button(labels.underline, editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), word(<u>{labels.underline}</u>, <u>U</u>), "⌘U", true)}
          {button(labels.strike, editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), word(<s>{labels.strike}</s>, <s>S</s>), "⌘⇧S", true)}
          {button(labels.heading, editor.isActive("heading"), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), word(<span className="rte-h">{labels.heading}</span>, <span className="rte-h">H</span>), "", true)}
          {button(labels.bullets, editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <Icon name="bullets" size={18} />)}
          {button(labels.numbered, editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <Icon name="numbered" size={18} />)}
          {button(labels.link, editor.isActive("link") || linkOpen, () => { setEmojiOpen(false); setLinkOpen(o => !o) }, <Icon name="link" size={18} />)}
          {button(labels.emoji, emojiOpen, () => { setLinkOpen(false); setEmojiOpen(o => !o) }, <span aria-hidden="true" className="rte-emoji-icon">😊</span>)}
        </div>
      )}
      {editor && linkOpen && <LinkPicker editor={editor} labels={labels} onClose={() => setLinkOpen(false)} />}
      {editor && emojiOpen && <EmojiPicker editor={editor} label={labels.emoji} onClose={() => setEmojiOpen(false)} />}
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

/*
 * Emotikony — krátky výber najčastejších, bez knižnice (stovky kB za celý
 * katalóg sa pre správu kolegovi neoplatia). Ukladajú sa ako obyčajné znaky
 * Unicode; celý systémový výber ostáva v ponuke systému (⌃⌘Medzera na Macu,
 * Win+. vo Windows).
 */
const EMOJI = [
  "😀", "😃", "😄", "😁", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤔",
  "🙄", "😅", "😂", "🤣", "😢", "😭", "😡", "🤯", "😴", "🤝", "👍", "👎",
  "👏", "🙌", "🙏", "💪", "👀", "👋", "✌️", "👌", "🎉", "🎂", "🎁", "✅",
  "❌", "⚠️", "❗", "❓", "💡", "📌", "📅", "⏰", "🔥", "⭐", "❤️", "⚽",
  "🏆", "🥅", "🟨", "🟥",
]

function EmojiPicker({ editor, label, onClose }: { editor: Editor; label: string; onClose: () => void }) {
  return (
    <div className="rte-emoji" role="group" aria-label={label}
         onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); editor.commands.focus() } }}>
      {EMOJI.map(e => (
        <button key={e} type="button" className="rte-emoji-btn" aria-label={e}
                onMouseDown={ev => ev.preventDefault()}
                onClick={() => { editor.chain().focus().insertContent(e).run(); onClose() }}>
          {e}
        </button>
      ))}
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
