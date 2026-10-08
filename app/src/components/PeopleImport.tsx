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
import { previewImportAction, runImportAction } from "@/app/people/actions"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { RowPlanStatus } from "@/lib/persons"

type Preview = Awaited<ReturnType<typeof previewImportAction>>

/** Poradie v tabuľke: najprv to, čo si žiada pozornosť, „bez zmeny" na koniec. */
const ORDER: RowPlanStatus[] = ["error", "overwrite", "fill", "new", "unchanged"]

/** Modifikátor štítku podľa stavu — farba nesie význam (viď `.tag--*`). */
const TAG: Record<RowPlanStatus, string> = {
  new: "tag--new",
  fill: "tag--fill",
  overwrite: "tag--overwrite",
  unchanged: "tag--unchanged",
  error: "tag--error",
}

/** Hodnota poľa pre človeka: zoznam čiarkou, dátum bez času, prázdno pomlčkou. */
function show(v: unknown, empty: string): string {
  if (v === undefined || v === null) return empty
  if (Array.isArray(v)) return v.length ? v.join(", ") : empty
  if (v instanceof Date) return v.toLocaleDateString("sk-SK")
  if (typeof v === "string") return v.trim() === "" ? empty : v
  return String(v)
}

export default function PeopleImport({ language }: { language?: UiLanguage }) {
  const t = dictionary(language).people.import
  const people = dictionary(language).people
  const router = useRouter()
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)
  // Prepis existujúcich je výslovná voľba, predvolene vypnutá (ADR-019).
  const [overwrite, setOverwrite] = useState(false)
  // Filter tabuľky podľa stavu; `null` = všetko.
  const [filter, setFilter] = useState<RowPlanStatus | null>(null)
  // Hľadanie v mene a adrese — pri 150 riadkoch je „kde som ja" prvá otázka.
  const [query, setQuery] = useState("")

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setPreview(null)
    setResult(null)
    if (!f) { setText(""); setName(""); return }
    setName(f.name)
    setFilter(null)
    setBusy(true)
    try {
      const content = await f.text()
      setText(content)
      setPreview(await previewImportAction(content, overwrite))
    } finally {
      setBusy(false)
    }
  }

  // Prepínač mení plán, nie len text (ADR-019) — náhľad sa musí prepočítať
  // z toho istého súboru, inak by tabuľka ukazovala niečo iné, než sa zapíše.
  async function toggleOverwrite(value: boolean) {
    setOverwrite(value)
    if (!text) return
    setBusy(true)
    try {
      setPreview(await previewImportAction(text, value))
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setBusy(true)
    try {
      const v = await runImportAction(text, overwrite)
      setResult({ text: v.message, ok: v.ok })
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
      {/*
        Prvá otázka pri importe je „čo sa stane s tým, kto už v systéme je" —
        a odpoveď má stáť **pred** nahraním, nie až v náhľade (OSOBY.md,
        úloha 5). Text je opísané správanie `upsertPersons()`, nie sľub, a mení
        sa s prepínačom: doplnenie prázdnych polí je predvolené, prepis sa
        musí zapnúť (ADR-019).
      */}
      <div className="assign-impact">
        <div className="assign-impact-count">{t.existingTitle}</div>
        <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
          {overwrite ? t.overwriteNote : t.existingNote}
        </div>
        {/* Áno/nie ako prepínač (DESIGN_ODCHYLKY P6). */}
        <label className="form-row form-row--bare">
          <input
            type="checkbox"
            role="switch"
            className="toggle"
            checked={overwrite}
            onChange={e => toggleOverwrite(e.target.checked)}
            disabled={busy}
          />
          <span className="form-row-main">{t.overwriteLabel}</span>
        </label>
      </div>

      <label className="field">
        <span className="field-label">{t.file}</span>
        <input
          className="field-input"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={onPick}
          disabled={busy}
        />
        <span className="quiet field-hint">
          {t.fileNoteBefore}<code>email</code>, <code>meno</code>,{" "}
          <code>oddelenie</code>, <code>typ</code>, <code>nástup</code>, <code>trasy</code>,{" "}
          <code>skupiny</code>, <code>jazyk</code>, <code>pohlavie</code>{t.fileNoteAfter}
        </span>
      </label>

      {busy && <p className="quiet">{t.reading}</p>}

      {result && (
        // Výsledok v riadku cez spoločnú triedu — chyba červeno, úspech
        // zelený (DESIGN_ODCHYLKY P2, 8. 10. 2026).
        <div className={`lnote${result.ok ? "" : " lnote--bad"}`} role={result.ok ? "status" : "alert"}>
          <span className="lnote-mark" aria-hidden="true">{result.ok ? "✓" : "!"}</span>
          <span className="lnote-text">{result.text}</span>
        </div>
      )}

      {preview && !preview.ok && (
        // Stav náhľadu je v prehliadači — oznam s návratom na adresu by ho
        // zahodil, preto chyba v riadku, ale cez spoločnú triedu.
        <div className="lnote lnote--warn" role="alert">
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{preview.message}</span>
        </div>
      )}

      {preview?.ok && preview.rows && (() => {
        const rows = preview.rows
        const count = (st: RowPlanStatus) => rows.filter(r => r.status === st).length
        const existingCount = count("fill") + count("overwrite")
        const errorCount = count("error")
        const needle = query.trim().toLowerCase()
        const visible = rows
          .filter(r => !filter || r.status === filter)
          .filter(r => !needle || r.email.toLowerCase().includes(needle) || r.fullName.toLowerCase().includes(needle))
          .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
        const canWrite = errorCount === 0 && (count("new") + existingCount) > 0

        // Kódy číselníkov (typ osoby, jazyk) sa ukazujú tak, ako ich vidí
        // človek na profile osoby — nie ako `employee`.
        const label = (field: string, v: unknown): string => {
          if (typeof v === "string" && field === "personType") return people.types[v as keyof typeof people.types] ?? v
          if (typeof v === "string" && field === "language") return people.languages[v as keyof typeof people.languages] ?? v
          if (typeof v === "string" && field === "gender") return people.genders[v] ?? v
          return show(v, t.emptyValue)
        }

        // Klik na číslo = filter; druhý klik ho zruší. Číslo, ktoré je nula,
        // nie je tlačidlo — nie je čo ukázať.
        const stat = (label: string, n: number, st: RowPlanStatus | null, warn = false) => {
          const active = filter === st && st !== null
          const enabled = n > 0 || st === null
          return (
            <button
              type="button"
              className={`import-stat${active ? " is-active" : ""}`}
              onClick={() => enabled && setFilter(active ? null : st)}
              disabled={!enabled}
              aria-pressed={active}
            >
              <span className="quiet import-stat-label">{label}</span>
              <span className="import-stat-value" style={warn && n > 0 ? { color: "var(--bad-fg)" } : undefined}>{n}</span>
            </button>
          )
        }

        return (
        <section className="card" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.whatHappens(name)}</h2>

          <input
            className="field-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
          />

          <div className="import-stats">
            {stat(t.rows, rows.length, null)}
            {stat(t.willAdd, count("new"), "new")}
            {stat(t.willUpdate(overwrite), existingCount, overwrite ? "overwrite" : "fill")}
            {stat(t.unchanged, count("unchanged"), "unchanged")}
            {stat(t.invalid, errorCount, "error", true)}
          </div>

          {/*
            Jeden riadok = jedna osoba zo súboru; stĺpec „Čo sa zapíše" je pri
            existujúcej osobe rozdiel „dnes → po importe", pri novej zoznam
            polí. Je to ten istý plán, ktorý potom vykoná zápis
            (`planChanges()`), nie odhad. Pod 640 px sa riadok zloží na kartu.
          */}
          {visible.length === 0 ? (
            <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>{t.noRowsForFilter}</p>
          ) : (
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col">{t.colStatus}</th>
                  <th scope="col">{t.colPerson}</th>
                  <th scope="col">{t.colChanges}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={`${r.email}|${r.fullName}`} className={`is-${r.status}`}>
                    <td data-label={t.colStatus}>
                      <span className={`tag ${TAG[r.status]}`}>{t.statuses[r.status]}</span>
                    </td>
                    <td data-label={t.colPerson}>
                      <div className="import-person">
                        {r.fullName && <span className="import-person-name">{r.fullName}</span>}
                        <span className="quiet import-person-email">{r.email || t.emptyValue}</span>
                      </div>
                    </td>
                    <td data-label={t.colChanges}>
                      {r.status === "error" ? (
                        <span style={{ color: "var(--bad-fg)" }}>{t.reasons[r.reason ?? ""] ?? r.reason}</span>
                      ) : r.status === "unchanged" ? (
                        <span className="quiet">{t.nothingToWrite}</span>
                      ) : (
                        <ul className="import-changes">
                          {r.changes.map(c => (
                            <li key={c.field}>
                              <span className="quiet">{t.fields[c.field] ?? c.field}: </span>
                              {r.status !== "new" && (
                                <>
                                  <span className="import-before">{label(c.field, c.before)}</span>
                                  <span className="quiet"> → </span>
                                </>
                              )}
                              <span className="import-after">{label(c.field, c.after)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/*
            Hodnoty, ktoré riadok neodmietli, ale pole nevyplnili (D85, D86).
            Bez tohto výpisu by import prešiel bez jedinej chyby a pracoviská
            by zostali prázdne — a zistilo by sa to až o mesiac.
          */}
          {(preview.unknownWorkplaces?.length ?? 0) > 0 && (
            <div>
              <div className="quiet field-hint">{t.unknownWorkplaces}</div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                {preview.unknownWorkplaces!.join(", ")}
              </p>
            </div>
          )}

          {(preview.unknownTracks?.length ?? 0) > 0 && (
            <div>
              <div className="quiet field-hint">{t.unknownTracks}</div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                {preview.unknownTracks!.join(", ")}
              </p>
            </div>
          )}

          {(preview.badPhones?.length ?? 0) > 0 && (
            <div>
              <div className="quiet field-hint">{t.badPhones}</div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                {preview.badPhones!.join(", ")}
              </p>
            </div>
          )}

          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
            {t.statusNoteBefore}<strong>{t.statusNoteHighlight}</strong>{t.statusNoteAfter}
          </p>

          <div>
            <button className="button" type="button" onClick={submit} disabled={busy || !canWrite}>
              {busy ? t.writing : t.write}
            </button>
          </div>
        </section>
        )
      })()}
    </div>
  )
}
