"use client"

/**
 * Zobrazenie odpovede: text, citácie, zdroje a technická pätička.
 *
 * Návrhové rozhodnutie: citácie sú NAD zoznamom zdrojov a sú výraznejšie.
 * Zdroj hovorí len „toto sme prehľadali", citácia hovorí „o toto sa opiera
 * táto veta" — a práve to hodnotiteľ potrebuje, aby vedel posúdiť, či si
 * model niečo nedomyslel.
 */

import Link from "next/link"
import type { Citation, AskResult, AnswerPhase, ComparisonInfo } from "@/lib/sseClient"
import type { QueryTime } from "@/lib/queryTime"
import FormattedText from "@/components/FormattedText"
import { cleanCitation, mergeCitations } from "@/lib/formatText"
import { formatUsd, formatEur, toEur } from "@/lib/pricing"
import { answerKicker, scopeFromSources, type KickerScope } from "@/lib/answerKicker"
import { dictionary, formatDate, formatNumber, type UiLanguage } from "@/lib/i18n"
import { isAutoVersionLabel } from "@/lib/versionLabel"
import { SkeletonText } from "./Skeleton"

/** Stav odpovede počas streamovania — kým nepríde `done`, máme len text. */
export interface AnswerState {
  question: string
  text: string
  citations: Citation[]
  done: AskResult | null
  running: boolean
  /**
   * Fáza zo servera — čo sa robí, kým odpoveď ešte nezačala. `undefined`
   * znamená, že server zatiaľ nič nepovedal; vtedy sa ukáže len kostra.
   */
  phase?: AnswerPhase
  /** Ku ktorému dňu sa odpovedá (krok 6) — z `meta`, teda ešte pred textom. */
  time?: QueryTime
  /** Porovnanie znení (krok 7) — z `meta`. */
  comparison?: ComparisonInfo
}

/**
 * Vykreslenie textu modelu.
 *
 * Rozklad aj vykreslenie sú v `FormattedText` — ten istý komponent zobrazuje
 * aj znenie predpisu (detail dokumentu, schvaľovanie). Nikde v ňom nie je
 * `dangerouslySetInnerHTML`: výstup modelu nad cudzími dokumentmi sa nesmie
 * dostať do DOM ako HTML.
 */

function Line({ label: label, value: value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <span className="quiet">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </span>
  )
}

/**
 * Karta odpovede (ASK-odpoved-dva-stlpce): hlavička, text so značkami `[n]`
 * a upozornenie na useknutú odpoveď. Citácie, zdroje a technické údaje sú
 * v `AnswerAside` — vpravo od karty (≥ 1180 px) alebo pod ňou.
 */
export function AnswerBody({
  state: state,
  organisation,
  language,
  scope,
}: {
  state: AnswerState
  /** Skratka organizácie — „Odpoveď z dokumentov SFZ". Bez nej všeobecná veta. */
  organisation?: string
  language?: UiLanguage
  /**
   * Kde sa hľadalo (pilulky na `/ask`). Bez neho sa zdroje odvodia z obsahu
   * odpovede — uložená odpoveď výber piluliek nepozná.
   */
  scope?: KickerScope
}) {
  const t = dictionary(language).answer
  const tAsk = dictionary(language).ask
  const { text, citations: citations, done: done, running: running, phase } = state
  if (!text && !running && !done) return null

  const error = done?.error

  // Ku ktorému dňu sa odpovedá (krok 6). Z `meta` prichádza pred prvým
  // slovom, preto sa číta zo stavu, a až potom z `done`.
  const time = state.time ?? done?.time
  const timeDate = time ? formatDate(new Date(`${time.asOf}T00:00:00Z`), language) : null
  const comparison = state.comparison ?? done?.comparison
  const dateOf = (iso: string | null) => (iso ? formatDate(new Date(iso), language) : null)
  // Automatické označenie znenia už nesie dátum účinnosti a je v jazyku
  // dokumentu — vedľa účinnosti v jazyku prostredia sa neukazuje.
  const ownLabel = (label: string, iso: string | null) => (isAutoVersionLabel(label, iso) ? "" : label)
  const timeLabel = !time || !timeDate
    ? null
    : time.kind === "asOf"
      ? t.timeAsOf(timeDate)
      : time.kind === "compare"
        // Porovnanie: ktoré dve znenia, alebo prečo sa porovnať nedalo.
        ? comparison?.ok
          ? t.timeCompare(
              t.compareSide(ownLabel(comparison.from.label, comparison.from.effectiveFrom), dateOf(comparison.from.effectiveFrom)),
              t.compareSide(ownLabel(comparison.to.label, comparison.to.effectiveFrom), dateOf(comparison.to.effectiveFrom)),
            )
          : t.timeCompareUnavailable[comparison?.reason ?? "no-document"](timeDate)
        : t.timeToday(timeDate)

  /*
    Tretí stav (ASK, úloha 1): vyhľadávanie nenašlo nič, čo by otázku krylo.
    Server vtedy model nevolá a pošle prázdny zoznam zdrojov bez textu.
    Tvarom ako karta odpovede, ale bez odpovede — a s cestou do knižnice,
    lebo nie všetko je v predpisoch.
  */
  // Chyba bez textu: karta by nemala čo ukázať — hlášku nesie `Search`.
  if (error && !text) return null

  if (done && !error && !text && done.sources.length === 0) {
    return (
      <div className="card answer--none">
        <div className="answer-head">
          <span className="answer-mark" aria-hidden="true" />
          <span className="answer-kicker">{tAsk.none.kicker}</span>
        </div>
        <p className="answer-none-text">
          {/* K dňu otázky nie je žiadne platné znenie — to je iná správa než
              „nič sa nenašlo" a iná rada (iný dátum, nie iná otázka). */}
          {done.noVersions && time?.kind === "asOf" && timeDate ? tAsk.none.noVersion(timeDate) : tAsk.none.text}{" "}
          <Link href={`/library?search=${encodeURIComponent(state.question)}`}>{tAsk.none.link}</Link>
        </p>
      </div>
    )
  }
  const truncated = done?.stopReason === "max_tokens"

  return (
      <div className="card">
        {/* Hlavička hovorí to, čo sa inak dá len tušiť: odpoveď je zostavená
            z dokumentov organizácie, nie z toho, čo model vie odinakiaľ.
            Pri chybe sa neukáže — nad hláškou „nepodarilo sa" by to bolo
            tvrdenie o niečom, čo neexistuje. */}
        {!error && (
          <div className="answer-head">
            <span className="answer-mark" aria-hidden="true" />
            <span className="answer-kicker">{answerKicker(scope ?? scopeFromSources(done?.sources ?? []), organisation, language)}</span>
            {timeLabel && (
              <span className={time?.kind === "today" ? "answer-time" : "answer-time answer-time--other"}>
                {timeLabel}
              </span>
            )}
          </div>
        )}

        {/* Chybu hlási hláška nad hero kartou (`Search`), nie táto karta;
            čo sa stihlo napísať, zostáva čitateľné. */}
        {(
          <div className={running ? "answer caret" : "answer"}>
            {/*
              Kým nepríde prvé slovo, tu bývalo `null` — prázdna karta na tri
              až päť sekúnd (klasifikácia, prepis dotazu, vyhľadanie, rerank).
              Odteraz je tu kostra odseku a nad ňou veta o tom, čo sa práve
              robí. Veta ide zo servera, takže netvrdí nič, čo sa nedeje;
              keď ju server nepošle, zostane len kostra.
            */}
            {text ? (
              // Značky `[n]` na koncoch viet — len pri citáciách s polohou
              // zo streamu (Q1); uložená odpoveď ich nemá.
              <FormattedText text={text} citations={citations} />
            ) : running ? (
              <div role="status" aria-live="polite">
                {phase && (
                  <div className="quiet answer-phase">{tAsk.phases[phase]}</div>
                )}
                <div aria-hidden="true">
                  <SkeletonText lines={4} />
                </div>
              </div>
            ) : (
              "—"
            )}
          </div>
        )}

        {/* Useknutá odpoveď sa NESMIE tváriť ako hotová. Záver býva práve to
            zhrnutie, ktoré si čitateľ odnesie — a keď chýba, nemá ako vedieť,
            že mu chýba. */}
        {truncated && (
          <div
            style={{
              display: "flex", gap: 9, alignItems: "flex-start",
              marginTop: 14, padding: "10px 13px",
              background: "var(--warn-bg)", color: "var(--warn-fg)",
              border: "1px solid var(--line)", borderRadius: 9,
              fontSize: "var(--fs-small)", lineHeight: 1.55,
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 700 }}>▲</span>
            <span>
              <strong>{t.incompleteHeading}</strong>{" "}
              {t.incompleteNote}
            </span>
          </div>
        )}
      </div>
  )
}


/**
 * Doslovné citácie, zdroje v kontexte a technické údaje
 * (ASK-odpoved-dva-stlpce). Na ≥ 1180 px vpravo od karty (`sticky`), inak
 * pod ňou. Citácia nesie `id="citation-n"` a `data-cite` — značky v texte
 * na ňu ukazujú a `Search` ich prepája.
 */
export function AnswerAside({
  state,
  canEvaluate,
  language,
}: {
  state: AnswerState
  /** Technické údaje len rolám s hodnotením (Q2). */
  canEvaluate?: boolean
  language?: UiLanguage
}) {
  const t = dictionary(language).answer
  const { citations, done, running } = state
  if (!state.text && !running && !done) return null
  const error = done?.error
  if (error && !state.text) return null
  if (done && !error && !state.text && done.sources.length === 0) return null
  const ownLabel = (label: string, iso: string | null) => (isAutoVersionLabel(label, iso) ? "" : label)

  // Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera.
  // Pri dlhej odpovedi ich vznikne aj devätnásť, z toho polovica rovnakých.
  const unique = mergeCitations(citations)
  // Citácia ↔ zdroj cez `chunkIndex` (poradie úseku v kontexte, od 0) a index
  // zdroja (od 1). Keď sa nezhodujú, znenie a odkaz pri citácii nie sú.
  const sourceOf = (c: Citation) => done?.sources.find(z => z.index === c.chunkIndex + 1)

  return (
    <div className="answer-aside">
      {(unique.length > 0 || running) && (
        <section className="answer-aside-section" aria-labelledby="citations-title">
          <h2 className="answer-aside-title" id="citations-title">
            {t.citations(unique.length)}
            {unique.length < citations.length && (
              <span className="answer-aside-note"> · {t.citationsFrom(citations.length)}</span>
            )}
          </h2>
          <ol className="answer-citations">
            {unique.map((c, i) => {
              const n = i + 1
              const source = sourceOf(c)
              const version = source?.version
              return (
                <li key={n} id={`citation-${n}`} className="answer-citation" data-cite={n} tabIndex={-1}>
                  <span className="answer-citation-n" aria-hidden="true">{n}</span>
                  <div className="answer-citation-body">
                    <q className="answer-citation-text">{cleanCitation(c.citedText)}</q>
                    <div className="answer-citation-meta">
                      {[
                        c.documentTitle,
                        c.articleRef,
                        version && t.sourceVersion(
                          ownLabel(version.label, version.effectiveFrom),
                          version.effectiveFrom ? formatDate(new Date(version.effectiveFrom), language) : null,
                          null,
                        ),
                      ].filter(Boolean).join(" · ") || t.sourceMissing}
                    </div>
                    {/* Do knižnice, teda na znenie v aplikácii — nie na `url`,
                        to je originál mimo nej (`sourceUrl`). Živý zdroj
                        (ADR-029) v knižnici nie je — odkaz by viedol na 404. */}
                    {source?.documentId && !source.live && (
                      <Link className="answer-citation-open" href={`/documents/${encodeURIComponent(source.documentId)}`}>
                        {t.openInLibrary}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          {/* Počas písania — citácie pribúdajú s udalosťami `citation`. */}
          {running && <div className="answer-citations-pending">{t.citationsPending}</div>}
        </section>
      )}

      {/* Zdroje — čo sa dostalo do kontextu, aj keď z toho model necitoval. */}
      {done && done.sources.length > 0 && (
        <details className="answer-aside-section">
          <summary className="answer-aside-title">
            {t.sources(done.sources.length)}
          </summary>
          <div className="answer-sources">
            {done.sources.map(z => {
              const body = (
                <>
                  <span className="answer-source-index">{z.index}.</span>
                  <span className="answer-source-body">
                    <span className="answer-source-title">{z.title}</span>
                    {(z.articleRef || z.heading || z.match) && (
                      <span className="quiet answer-source-meta">
                        {/*
                          Zhoda v slovách, nie číslo: surové skóre nie je medzi
                          režimami hľadania porovnateľné a „0,94" by predstieralo
                          presnosť, ktorú nemá. Stupeň je relatívny voči
                          najlepšiemu zdroju tejto odpovede (`matchLevel()`).
                        */}
                        {[z.articleRef, z.heading, z.match && t.match[z.match]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    {/*
                      Overená odpoveď nie je znenie predpisu — je to text,
                      ktorý niekto napísal nad predpisom. Kurovaná odpoveď je
                      krátka a presná, takže vo vyhľadávaní často vyhrá nad
                      článkom normy; bez tejto vety by ju čitateľ čítal ako
                      normu samu. Preto sa hovorí aj to, z čoho vznikla.
                    */}
                    {/*
                      Znenie, z ktorého zdroj je (krok 5 „znení v indexe").
                      Bez neho čitateľ nevie, či cituje platný text, alebo
                      ten, ktorý o mesiac nahradí novela.
                    */}
                    {z.version && (
                      <span className="quiet answer-source-meta">
                        {t.sourceVersion(
                          ownLabel(z.version.label, z.version.effectiveFrom),
                          z.version.effectiveFrom ? formatDate(new Date(z.version.effectiveFrom), language) : null,
                          z.version.effectiveTo ? formatDate(new Date(z.version.effectiveTo), language) : null,
                        )}
                      </span>
                    )}
                    {z.sourceType === "qa" && (
                      <span className="quiet answer-source-meta">{t.verifiedNote}</span>
                    )}
                    {/* Živý zdroj (ADR-029, D174): obišiel kurátora — čitateľ to má vedieť. */}
                    {z.live && (
                      <span className="quiet answer-source-meta">{t.liveNote(z.live.connectorName, z.live.group ?? null)}</span>
                    )}
                  </span>
                  {z.live && (
                    <span className="tag tag--warn" style={{ fontSize: "var(--fs-micro)", fontWeight: 600 }}>
                      {t.live}
                    </span>
                  )}
                  {z.sourceType === "qa" && (
                    <span className="tag tag--published" style={{ fontSize: "var(--fs-micro)", fontWeight: 600 }}>
                      {t.verified}
                    </span>
                  )}
                  {/* Interný obsah vo verejnej odpovedi je tvrdá brána D9,
                      preto to musí byť vidieť na prvý pohľad. */}
                  {z.accessLevel === "internal" && (
                    <span className="tag tag--warn" style={{ fontSize: "var(--fs-micro)" }}>
                      {t.internal}
                    </span>
                  )}
                </>
              )

              // Odkaz len vtedy, keď zdroj naozaj niekam vedie. Karta, ktorá
              // vyzerá klikateľne a nič nerobí, je horšia než obyčajný riadok.
              // Adresa je originál dokumentu (`sourceUrl`) — býva mimo nášho
              // webu, preto `rel`.
              return z.url ? (
                <a
                  key={z.index}
                  className="answer-source"
                  href={z.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {body}
                </a>
              ) : (
                <div key={z.index} className="answer-source">{body}</div>
              )
            })}
          </div>
          {done.liveFailed && done.liveFailed.length > 0 && (
            <p className="quiet answer-source-meta" style={{ margin: "8px 0 0" }}>{t.liveFailed(done.liveFailed.join(", "))}</p>
          )}
        </details>
      )}

      {/* Technická pätička — bez nej sa nedá porovnávať medzi konfiguráciami. */}
      {/*
        Len rolám s hodnotením (Q2) — tí istí, ktorí vidia celý hodnotiaci
        panel. Ostatným model, tokeny a cena nič nepovedia. Zbalené: pri
        čítaní odpovede nie sú potrebné.
      */}
      {done && !error && canEvaluate && (
        <details className="answer-aside-section">
          <summary className="answer-aside-title">{t.technical}</summary>
        <div
          className="quiet answer-technical"
        >
          {done.model && <Line label={t.techModel} value={done.model} />}
          {done.provider && <Line label={t.adapter} value={done.provider} />}
          {done.ttftMs !== null && (
            <Line label={t.firstToken} value={`${(done.ttftMs / 1000).toFixed(1)} s`} />
          )}
          <Line label={t.techTotal} value={`${(done.totalMs / 1000).toFixed(1)} s`} />

          {/* Tokeny a cena. Cache sa uvádza zvlášť, lebo čítanie z nej stojí
              desatinu ceny vstupu — bez toho rozlíšenia by číslo klamalo. */}
          {done.tokens && (
            <Line
              label={t.techTokens}
              value={
                `${formatNumber(done.tokens.input, language)} → ` +
                `${formatNumber(done.tokens.output, language)}` +
                (done.tokens.cacheRead
                  ? ` · ${t.cacheFrom} ${formatNumber(done.tokens.cacheRead, language)}` : "") +
                (done.tokens.cacheWrite
                  ? ` · ${t.cacheTo} ${formatNumber(done.tokens.cacheWrite, language)}` : "")
              }
            />
          )}
          {done.cost && !done.cost.unknownModel && (
            <span className="tag tag--archived" title={t.costNote(done.cost.pricelistVersion)}>
              ≈ {formatUsd(done.cost.usd)} · {formatEur(toEur(done.cost.usd))}
            </span>
          )}
          {/* Cenník, ktorý prestal platiť, radšej priznáme, než by sme ticho
              počítali starou sadzbou. */}
          {done.cost?.pricelistExpired && (
            <span className="tag tag--warn">
              {t.pricelistStale}
            </span>
          )}
          {/* Rozpad na fázy. Nezaujíma hodnotiteľa, ale bez neho sa nedá
              povedať, prečo je prvý token pomalý. */}
          {done.timings && Object.entries(done.timings).filter(([, ms]) => ms >= 50).map(([f, ms]) => (
            <Line key={f} label={f} value={`${(ms / 1000).toFixed(1)} s`} />
          ))}
          <span className={done.verifiedCitations ? "tag tag--published" : "tag tag--warn"}>
            {done.verifiedCitations ? t.citationsVerified : t.citationsUnverified}
          </span>
        </div>
        </details>
      )}
    </div>
  )
}

/**
 * Karta a pod ňou citácie a zdroje, v jednom stĺpci — tam, kde nie je
 * rozloženie `/ask` (uložená odpoveď, testy vykreslenia).
 */
export default function Answer({
  state,
  organisation,
  canEvaluate,
  language,
}: {
  state: AnswerState
  organisation?: string
  canEvaluate?: boolean
  language?: UiLanguage
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AnswerBody state={state} organisation={organisation} language={language} />
      <AnswerAside state={state} canEvaluate={canEvaluate} language={language} />
    </div>
  )
}
