"use client"

/**
 * Dve polia na súbor pri nahrávaní znenia (ADR-011):
 *
 *   · **PDF — povinné.** To, čo uvidia schvaľovatelia a zamestnanci, vrátane
 *     príloh, formulárov a obrázkov (D94).
 *   · **Upraviteľný zdroj — odporúčaný.** `.docx`, `.xlsx`, `.md`… Z neho
 *     vznikne čistejší text na vyhľadávanie a je to **predloha pre ďalšie
 *     znenie** — správca si ho stiahne, upraví a nahrá ako novelu (D95).
 *
 * **Bez JavaScriptu** sú to obyčajné `<input type="file">` a formulár ich
 * odošle serverovej akcii celé — do 4 MB, viac Vercel v jednej požiadavke
 * nepustí.
 *
 * **S JavaScriptom** sa formulár pred odoslaním zastaví: súbory odídu po
 * kúskoch na `/api/library/upload` (do 25 MB, D98), ich identifikátory sa
 * zapíšu do skrytých polí, polia so súbormi stratia `name` (aby sa bajty
 * neposielali druhýkrát) a formulár sa odošle znova.
 *
 * **Identifikátory sú v stave Reactu, nie v DOM.** Prvá verzia ich zapisovala
 * do `<input type="hidden" defaultValue="">` priamo — a skryté pole má hodnotu
 * totožnú s predvolenou, takže ju React pri každom prekreslení (každé percento)
 * vrátil na prázdnu. Druhé odoslanie tak našlo prázdne pole a nahrávalo znova,
 * dookola (23. 9. 2026, 246 požiadaviek za pár minút na produkcii). Odoslanie
 * sa preto spúšťa až po tom, čo React stav s identifikátormi vykreslil.
 *
 * **Priebeh je okno v strede obrazovky**, nie riadok pod formulárom: kto
 * odoslal formulár zo spodku stránky, riadok hore neuvidí a nevie, že sa
 * niečo deje (Ján, 23. 9.). Okno prekryje stránku aj počas prevodu na
 * serveri (`useFormStatus`), aby sa formulár neodoslal druhýkrát.
 */

import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { uploadInChunks } from "@/lib/chunkedUpload"

/** Doplní `{kľúč}` v šablóne. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, k: string) => (k in values ? String(values[k]) : all))
}

interface Labels {
  pdfTitle: string
  pdfNote: string
  sourceTitle: string
  sourceNote: string
  /** „najviac 25 MB" */
  maxSize: string
  /** „bez JavaScriptu najviac 4 MB" */
  noScriptLimit: string
  /** Šablóna — `{name}`, `{percent}`. Zo servera nesmie prísť funkcia. */
  uploading: string
  failed: string
  /** Šablóna — `{name}`, `{mb}`, `{maxMb}`. */
  tooLarge: string
  /** Nadpis okna priebehu. */
  progressTitle: string
  /** Veta v okne počas prevodu na serveri. */
  converting: string
  /** „Zmeniť" pri vybranom súbore. */
  change: string
}

interface Uploaded {
  pdf: string
  source: string
}

export default function UploadFiles({
  labels,
  pdfAccept,
  sourceAccept,
  maxBytes,
  highlight = false,
}: {
  labels: Labels
  pdfAccept: string
  sourceAccept: string
  maxBytes: number
  /** Po chybe servera: súbor treba vybrať znova, zóny sa zvýraznia. */
  highlight?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [uploaded, setUploaded] = useState<Uploaded | null>(null)
  /** `uploading` — kúsky idú na server; `submitting` — čaká sa na serverovú akciu. */
  const [phase, setPhase] = useState<"idle" | "uploading" | "submitting">("idle")
  const [status, setStatus] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Nahraté identifikátory aj pre poslucháča `submit`, ktorý stav nevidí. */
  const uploadedRef = useRef<Uploaded | null>(null)
  /** Tlačidlo, ktorým človek formulár odoslal — pošle sa ním aj druhýkrát. */
  const submitter = useRef<HTMLElement | null | undefined>(undefined)
  const form = useFormStatus()
  /** Vybrané súbory — na riadok s názvom a veľkosťou (NAHRAVANIE-pdf-a-udaje-o-zneni, bod 2). */
  const [chosen, setChosen] = useState<{ pdf: File | null; source: File | null }>({ pdf: null, source: null })
  const pick = (kind: "pdf" | "source") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setChosen(prev => ({ ...prev, [kind]: file }))
  }

  // Prvé odoslanie: zastaviť, nahrať po kúskoch, zapísať identifikátory do stavu.
  useEffect(() => {
    const el = root.current?.closest("form")
    if (!el) return

    const onSubmit = async (e: SubmitEvent) => {
      // Súbory sú už nahraté — nech formulár ide serverovej akcii.
      if (uploadedRef.current) return

      const pdf = el.querySelector<HTMLInputElement>('input[data-upload="pdf"]')?.files?.[0]
      const source = el.querySelector<HTMLInputElement>('input[data-upload="source"]')?.files?.[0]
      if (!pdf) return // povinnosť ohlási prehliadač (`required`) alebo server

      e.preventDefault()
      setError(null)
      setPhase("uploading")
      try {
        const queue = [pdf, ...(source ? [source] : [])]
        for (const file of queue) {
          if (file.size > maxBytes) {
            throw new Error(fill(labels.tooLarge, {
              name: file.name, mb: Math.ceil(file.size / 1024 / 1024), maxMb: maxBytes / 1024 / 1024,
            }))
          }
        }
        const total = queue.reduce((n, f) => n + f.size, 0)
        let done = 0
        const ids: string[] = []
        setPercent(0)
        for (const file of queue) {
          const r = await uploadInChunks(file, sent => {
            const p = Math.min(100, Math.round(((done + sent) / total) * 100))
            setPercent(p)
            setStatus(fill(labels.uploading, { name: file.name, percent: p }))
          })
          done += file.size
          ids.push(r.fileId)
        }
        const next = { pdf: ids[0], source: ids[1] ?? "" }
        uploadedRef.current = next
        submitter.current = e.submitter
        setPhase("submitting")
        setUploaded(next) // odoslanie spustí efekt nižšie, po vykreslení
      } catch (err) {
        setPhase("idle")
        setStatus(null)
        setPercent(null)
        setError(`${labels.failed} ${err instanceof Error ? err.message : ""}`.trim())
      }
    }

    el.addEventListener("submit", onSubmit)
    return () => el.removeEventListener("submit", onSubmit)
  }, [labels, maxBytes])

  // Druhé odoslanie — **až keď React vykreslil skryté polia s identifikátormi**.
  useEffect(() => {
    if (!uploaded || submitter.current === undefined) return
    const el = root.current?.closest("form")
    const by = submitter.current
    submitter.current = undefined
    el?.requestSubmit(by instanceof HTMLButtonElement ? by : undefined)
  }, [uploaded])

  // Serverová akcia skončila a sme stále tu (chyba) — súbory server upratal,
  // takže identifikátory neplatia. Nabudúce sa nahráva odznova.
  const wasPending = useRef(false)
  useEffect(() => {
    if (form.pending) wasPending.current = true
    else if (wasPending.current) {
      wasPending.current = false
      uploadedRef.current = null
      setUploaded(null)
      setPhase("idle")
      setStatus(null)
      setPercent(null)
    }
  }, [form.pending])

  const uploading = phase === "uploading"
  const busy = phase !== "idle" || form.pending

  return (
    <div ref={root} className="upload-files">
      <input type="hidden" name="pdfFileId" value={uploaded?.pdf ?? ""} readOnly />
      <input type="hidden" name="sourceFileId" value={uploaded?.source ?? ""} readOnly />

      {/*
        Zóna na pretiahnutie je `<label>` okolo `<input type="file">` —
        prehliadač do neho súbor pustí sám, drag & drop funguje aj bez skriptu.
        Po nahratí po kúskoch pole stratí `name`: bajty už sú na serveri.
      */}
      <label className={`upload-drop${highlight && !chosen.pdf ? " is-required" : ""}${chosen.pdf ? " is-set" : ""}`}>
        <span className="upload-drop-title">{labels.pdfTitle}</span>
        <span className="quiet upload-drop-note">
          {labels.pdfNote}
          <br />
          {labels.maxSize} · {labels.noScriptLimit}
        </span>
        <input className="upload-file" type="file" name={uploaded ? undefined : "pdf"}
               data-upload="pdf" required accept={pdfAccept} onChange={pick("pdf")} />
        {chosen.pdf && <ChosenFile file={chosen.pdf} change={labels.change} />}
      </label>

      <label className={`upload-drop upload-drop--optional${chosen.source ? " is-set" : ""}`}>
        <span className="upload-drop-title">{labels.sourceTitle}</span>
        <span className="quiet upload-drop-note">{labels.sourceNote}</span>
        <input className="upload-file" type="file" name={uploaded ? undefined : "source"}
               data-upload="source" accept={sourceAccept} onChange={pick("source")} />
        {chosen.source && <ChosenFile file={chosen.source} change={labels.change} />}
      </label>

      {error && <p className="upload-error" role="alert">{error}</p>}

      {/*
        Okno priebehu v strede obrazovky. `role="dialog"` s `aria-modal` a
        živou oblasťou — čítačka ohlási zmenu fázy. Nedá sa zavrieť: nahrávanie
        ani prevod sa zrušiť nedajú a zavreté okno by len skrylo, že bežia.
      */}
      {busy && (
        <div className="upload-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-overlay-title">
          <div className="upload-overlay-card">
            <h2 id="upload-overlay-title" className="upload-overlay-title">{labels.progressTitle}</h2>
            {uploading ? (
              <span className="upload-progress-bar upload-progress-bar--determinate" aria-hidden="true">
                <span style={{ width: `${percent ?? 0}%` }} />
              </span>
            ) : (
              <span className="upload-progress-bar" aria-hidden="true" />
            )}
            <p className="quiet upload-overlay-note" aria-live="polite">
              {uploading ? status : labels.converting}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Vybraný súbor ako riadok: typ, názov (s elipsou), veľkosť a „Zmeniť".
 * Je vnútri `<label>`, takže klik kamkoľvek — aj na „Zmeniť" — otvorí výber
 * súboru znova. Natívne pole sa pri vybranom súbore len vizuálne skryje
 * (`.upload-drop.is-set .upload-file`); čítačka ho vidí ďalej.
 */
function ChosenFile({ file, change }: { file: File; change: string }) {
  const ext = (file.name.split(".").pop() ?? "").slice(0, 4).toUpperCase()
  const lang = typeof document !== "undefined" ? document.documentElement.lang || "sk" : "sk"
  const mb = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(file.size / 1024 / 1024)
  return (
    <span className="upload-chosen">
      <span className="upload-chosen-ico" aria-hidden="true">{ext}</span>
      <span className="upload-chosen-main">
        <span className="upload-chosen-name" style={{ display: "block" }}>{file.name}</span>
        <span className="upload-chosen-meta">{mb} MB</span>
      </span>
      <span className="upload-chosen-act">{change}</span>
    </span>
  )
}
