"use client"

/**
 * Import osôb z CSV — jediná obrazovka v správe, ktorá potrebuje klientsky stav.
 *
 * Zvyšok správcovských formulárov je zámerne serverový a funguje bez
 * JavaScriptu. Tu to nejde: medzi „vyber súbor" a „zapíš" musí byť **náhľad**,
 * a ten znamená, že sa obsah súboru musí niekde podržať. Nechať človeka
 * vybrať ten istý súbor druhýkrát je horšia cena než jeden klientsky
 * komponent — najmä preto, že medzi prvým a druhým výberom by sa dal
 * podstrčiť iný.
 *
 * Bez JavaScriptu zostáva skript `npm run persons:import`, ktorý robí to isté.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { previewImportAction, runImportAction } from "@/app/osoby/actions"
import { dictionary, type UiLanguage } from "@/lib/i18n"

type Preview = Awaited<ReturnType<typeof previewImportAction>>

export default function PeopleImport({ language }: { language?: UiLanguage }) {
  const t = dictionary(language).people.import
  const router = useRouter()
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setPreview(null)
    setResult(null)
    if (!f) { setText(""); setName(""); return }
    setName(f.name)
    setBusy(true)
    try {
      const content = await f.text()
      setText(content)
      setPreview(await previewImportAction(content))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setBusy(true)
    try {
      const v = await runImportAction(text)
      setResult(v.message)
      if (v.ok) {
        setPreview(null)
        setText("")
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <label className="pole">
        <span className="pole-popis">{t.file}</span>
        <input
          className="pole-vstup"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={onPick}
          disabled={busy}
        />
        <span className="tichy pole-napoveda">
          {t.fileNoteBefore}<code>email</code>, <code>meno</code>,{" "}
          <code>oddelenie</code>, <code>typ</code>, <code>nástup</code>, <code>trasy</code>,{" "}
          <code>skupiny</code>, <code>jazyk</code>{t.fileNoteAfter}
        </span>
      </label>

      {busy && <p className="tichy">{t.reading}</p>}

      {result && (
        <p className="karta" style={{ padding: "12px 16px", fontSize: 14.5, margin: 0 }}>
          {result}
        </p>
      )}

      {preview && !preview.ok && (
        <p className="karta" style={{ padding: "12px 16px", fontSize: 14.5, margin: 0, color: "var(--warn-fg)" }}>
          {preview.message}
        </p>
      )}

      {preview?.ok && (
        <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{t.whatHappens(name)}</h2>

          <div className="admin-udaje" style={{ marginTop: 0 }}>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>{t.rows}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{preview.total}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>{t.willAdd}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{preview.created?.length ?? 0}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>{t.willUpdate}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{preview.existing?.length ?? 0}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>{t.invalid}</div>
              <div
                style={{
                  fontSize: 15.5, fontWeight: 600,
                  color: (preview.errors?.length ?? 0) > 0 ? "var(--warn-fg)" : "var(--muted)",
                }}
              >
                {preview.errors?.length ?? 0}
              </div>
            </div>
          </div>

          {(preview.created?.length ?? 0) > 0 && (
            <div>
              <div className="tichy pole-napoveda">{t.added}</div>
              <p style={{ fontSize: 14, margin: "2px 0 0", overflowWrap: "anywhere" }}>
                {preview.created!.slice(0, 25).join(", ")}
                {preview.created!.length > 25 && t.andMore(preview.created!.length - 25)}
              </p>
            </div>
          )}

          {(preview.errors?.length ?? 0) > 0 && (
            <div>
              {/* Chybné riadky sa vypíšu menovite. „5 chybných" sa nedá opraviť. */}
              <div className="tichy pole-napoveda">{t.skippedRows}</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                {preview.errors!.slice(0, 15).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {preview.errors!.length > 15 && (
                <p className="tichy pole-napoveda">{t.andMore(preview.errors!.length - 15)}</p>
              )}
            </div>
          )}

          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            {t.statusNoteBefore}<strong>{t.statusNoteHighlight}</strong>{t.statusNoteAfter}
          </p>

          <div>
            <button className="tlacidlo" type="button" onClick={submit} disabled={busy}>
              {busy ? t.writing : t.write}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
