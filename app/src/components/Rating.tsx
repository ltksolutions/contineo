"use client"

/**
 * Panel pod odpoveďou — v dvoch režimoch.
 *
 * **Bežný človek** povie len „sedí / nesedí" a pri „nesedí" napíše, čo bolo
 * zle. **Hodnotiteľ** (rola `evaluator`) vidí celé štyri polia: správnosť,
 * halucináciu, overené znenie a správne §.
 *
 * Prečo to rozdelenie (rozhodnutie Jána Letka 2026-09-15): do dnešného dňa
 * videl celý panel každý prihlásený a zapisoval priamo do záznamu, takže
 * posudok kolegu z matriky a posudok legislatívca boli v databáze
 * nerozoznateľné. „Očakávaná odpoveď" a „správne predpisy" sú expertné polia
 * — vyplnené od oka robia hodnotiteľovi viac práce, než keď zostanú prázdne.
 *
 * **Žiadne tlačidlo Uložiť** v režime hodnotiteľa: posudok sa ukladá hneď po
 * kliknutí, textové polia po opustení. Stav uloženia je vidieť, aby človek
 * nemusel dôverovať. Režim čitateľa tlačidlo má — je to jeden krátky text
 * a odoslanie musí byť jeho rozhodnutie, nie vedľajší účinok kliknutia inam.
 */

import { useEffect, useRef, useState } from "react"
import type { Verdict } from "@/lib/ratings"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import ReportInaccuracy from "@/components/ReportInaccuracy"

type SaveState = "idle" | "saving" | "saved" | "failed"

export interface RatingFields {
  correct: Verdict
  hallucination: Verdict
  verifiedAnswer: string
  correctSources: string
  note: string
}

const EMPTY: RatingFields = {
  correct: null, hallucination: null,
  verifiedAnswer: "", correctSources: "", note: "",
}

/** Význam voľby: farba a fajka sa ukážu len na zvolenom segmente. */
type Tone = "ok" | "bad"

/**
 * Áno/Nie v riadku — `.seg` s dvoma natívnymi rádiami (EVAL-posudok Q1,
 * 8. 10. 2026). Výnimka z ZAKLAD-vyber-a-prepinace („segmented sa do
 * formulára nedáva"), schválená Jánom: posudok sú dve kliknutia opakované
 * desiatky ráz a od `.view-switch` ho odlíši farba po voľbe. Rádiá dávajú
 * šípky na klávesnici a „1 z 2" v čítačke, čo dve tlačidlá nedávali.
 */
function Question({
  id, name, label, value, options, failed, failedHint, onPick,
}: {
  id: string
  name: string
  label: string
  value: Verdict
  options: [{ value: 0 | 1; label: string; tone: Tone }, { value: 0 | 1; label: string; tone: Tone }]
  failed: boolean
  failedHint: string
  onPick: (value: 0 | 1) => void
}) {
  return (
    <div className="rating-q" role="radiogroup" aria-labelledby={id}>
      <span className="rq-label" id={id}>{label}</span>
      <div className="seg">
        {options.map(o => (
          <label key={o.value} className={`seg-opt${value === o.value ? ` is-${o.tone}` : ""}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value}
                   onChange={() => onPick(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {failed && (
        <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{failedHint}</span></div>
      )}
    </div>
  )
}

/**
 * Režim čitateľa: „Sedí / Nesedí" a pri „Nesedí" popis.
 *
 * „Sedí" sa uloží hneď a tým to preňho končí — potvrdzovať správnu odpoveď
 * dvoma krokmi by znamenalo, že to nikto nespraví. Pri „Nesedí" sa posudok
 * uloží tiež hneď, ale formulár zostáva otvorený: veta, čo je zle, je to
 * jediné, z čoho sa dá niečo opraviť.
 */
function ReaderPanel({
  recordId, language,
}: {
  recordId: string
  language?: UiLanguage
}) {
  const t = dictionary(language).rating
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [done, setDone] = useState(false)

  async function say(value: 0 | 1) {
    setVerdict(value)
    if (value === 1) setDone(true)
    try {
      await fetch("/api/rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, readerVerdict: value }),
      })
    } catch {
      // Ticho: povedať „nepodarilo sa uložiť, že odpoveď sedí" je pre
      // čitateľa šum. Keď nesedí, na zlyhanie upozorní formulár nižšie.
    }
  }

  if (done) {
    return <p className="quiet reader-thanks">{t.readerThanks}</p>
  }

  // Tiché tlačidlá, nie voľba vo formulári: je to jednorazová akcia a plné
  // tlačidlo na obrazovke patrí otázke (EVAL-posudok Q2, 8. 10. 2026).
  return (
    <div className="reader">
      <div className="reader-row">
        <span className="reader-q">{t.readerQuestion}</span>
        <button type="button" className="button button--quiet button--sm"
                aria-pressed={verdict === 1} onClick={() => say(1)}>{t.fits}</button>
        <button type="button" className={`button button--quiet button--sm${verdict === 0 ? " is-bad" : ""}`}
                aria-pressed={verdict === 0} onClick={() => say(0)}>{t.doesNotFit}</button>
      </div>
      {verdict === 0 && (
        <ReportInaccuracy recordId={recordId} language={language} onSent={() => setDone(true)} />
      )}
    </div>
  )
}

export default function Rating({
  recordId,
  canEvaluate: canEvaluate,
  as = "card",
  language,
}: {
  /** Id záznamu z `/api/rating`. Kým je null, panel čaká. */
  recordId: string | null
  /**
   * Má prihlásený človek rolu `evaluator`? Ide **zo servera** — klient si to
   * neodvodzuje a ani keby si to podstrčil, API posudok bez roly odmietne.
   */
  canEvaluate?: boolean
  /**
   * Pod odpoveďou samostatná karta, vo fronte `/evaluation` sekcia karty
   * položky — karta v karte by tam bola rám v ráme (EVAL-posudok, 8. 10. 2026).
   */
  as?: "card" | "section"
  language?: UiLanguage
}) {
  const t = dictionary(language).rating
  const [fields, setFields] = useState<RatingFields>(EMPTY)
  const [status, setStatus] = useState<SaveState>("idle")
  // Ktorá zmena neprešla — hláška sa ukáže pri nej, nie len slovom v rohu,
  // ktoré sa ľahko prehliadne (EVAL-posudok Q3).
  const [failedField, setFailedField] = useState<keyof RatingFields | null>(null)

  // Nová odpoveď = čisté hodnotenie. Bez toho by sa posudok z predchádzajúcej
  // otázky opticky preniesol na ďalšiu a hodnotiteľ by ho potvrdil omylom.
  useEffect(() => {
    // Vynulovanie pri zmene záznamu je práve to zosúladenie, na ktoré efekt je:
    // rozpísaný text jednej otázky sa nesmie opticky preniesť na ďalšiu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(EMPTY)
    setStatus("idle")
    setFailedField(null)
  }, [recordId])

  const lastSent = useRef<string>("")

  async function save(change: Partial<RatingFields>) {
    if (!recordId) return
    const next = { ...fields, ...change }
    setFields(next)

    // Nepošleme to isté dvakrát — textové polia strácajú fokus aj bez zmeny.
    // Po zlyhaní sa to isté poslať smie: práve to hláška radí.
    const fingerprint = JSON.stringify({ recordId, ...change })
    if (fingerprint === lastSent.current && status !== "failed") return
    lastSent.current = fingerprint

    const field = Object.keys(change)[0] as keyof RatingFields
    setStatus("saving")
    try {
      const r = await fetch("/api/rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, ...change }),
      })
      setStatus(r.ok ? "saved" : "failed")
      setFailedField(r.ok ? null : field)
    } catch {
      setStatus("failed")
      setFailedField(field)
    }
  }

  if (!recordId) return null

  if (!canEvaluate) return <ReaderPanel recordId={recordId} language={language} />

  const failedNote = (field: keyof RatingFields) => failedField === field && (
    <div className="lnote lnote--bad"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{t.saveFailedFieldHint}</span></div>
  )

  const body = (
    <>
      <div className="rating-head">
        <h3>{t.heading}</h3>
        <span
          className={`rating-status${status === "saved" ? " is-ok" : status === "failed" ? " is-bad" : ""}`}
          aria-live="polite"
        >
          {status === "saving" ? t.saving
            : status === "saved" ? <><span aria-hidden="true">✓</span> {t.saved}</>
            : status === "failed" ? t.saveFailed : ""}
        </span>
      </div>

      <Question
        id={`rq-correct-${recordId}`} name={`correct-${recordId}`}
        label={t.correctQuestion} value={fields.correct}
        options={[{ value: 1, label: t.yes, tone: "ok" }, { value: 0, label: t.no, tone: "bad" }]}
        failed={failedField === "correct"} failedHint={t.saveFailedHint}
        onPick={v => save({ correct: v })}
      />
      <Question
        id={`rq-hallucination-${recordId}`} name={`hallucination-${recordId}`}
        label={t.hallucinationQuestion} value={fields.hallucination}
        options={[{ value: 1, label: t.yesInvented, tone: "bad" }, { value: 0, label: t.noGrounded, tone: "ok" }]}
        failed={failedField === "hallucination"} failedHint={t.saveFailedHint}
        onPick={v => save({ hallucination: v })}
      />

      {/* Podklad pre kuráciu. Zbalené, lebo pri väčšine odpovedí stačia dve
          kliknutia; `key` zavrie doplnenie pri novej odpovedi. */}
      <details className="rating-more" key={recordId}>
        <summary>{t.showDetail}</summary>
        <div className="rating-more-body">
          <label className="field">
            <span className="field-label">{t.expectedAnswer}</span>
            <textarea
              className="field-input"
              value={fields.verifiedAnswer}
              onChange={e => setFields(p => ({ ...p, verifiedAnswer: e.target.value }))}
              onBlur={e => save({ verifiedAnswer: e.target.value })}
              rows={3}
              maxLength={4000}
            />
          </label>
          {failedNote("verifiedAnswer")}

          <label className="field">
            <span className="field-label">{t.sources}</span>
            <input
              className="field-input"
              value={fields.correctSources}
              onChange={e => setFields(p => ({ ...p, correctSources: e.target.value }))}
              onBlur={e => save({ correctSources: e.target.value })}
              maxLength={500}
            />
          </label>
          {failedNote("correctSources")}

          <label className="field">
            <span className="field-label">{t.note}</span>
            <textarea
              className="field-input"
              value={fields.note}
              onChange={e => setFields(p => ({ ...p, note: e.target.value }))}
              onBlur={e => save({ note: e.target.value })}
              rows={2}
              maxLength={2000}
            />
          </label>
          {failedNote("note")}
        </div>
      </details>
    </>
  )

  return as === "section"
    ? <section className="rating">{body}</section>
    : <div className="card rating">{body}</div>
}
