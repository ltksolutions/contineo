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
import type { Citation, AskResult, AnswerPhase } from "@/lib/sseClient"
import FormattedText from "@/components/FormattedText"
import { cleanCitation, mergeCitations } from "@/lib/formatText"
import { formatUsd, formatEur, toEur } from "@/lib/pricing"
import { dictionary, type UiLanguage } from "@/lib/i18n"
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

export default function Answer({
  state: state,
  language,
}: {
  state: AnswerState
  language?: UiLanguage
}) {
  const t = dictionary(language).answer
  const tAsk = dictionary(language).ask
  const { text, citations: citations, done: done, running: running, phase } = state
  if (!text && !running && !done) return null

  const error = done?.error

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
          {tAsk.none.text}{" "}
          <Link href={`/library?search=${encodeURIComponent(state.question)}`}>{tAsk.none.link}</Link>
        </p>
      </div>
    )
  }
  const truncated = done?.stopReason === "max_tokens"

  // Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera.
  // Pri dlhej odpovedi ich vznikne aj devätnásť, z toho polovica rovnakých.
  const unique = mergeCitations(citations)

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        {/* Hlavička hovorí to, čo sa inak dá len tušiť: odpoveď je zostavená
            z dokumentov organizácie, nie z toho, čo model vie odinakiaľ.
            Pri chybe sa neukáže — nad hláškou „nepodarilo sa" by to bolo
            tvrdenie o niečom, čo neexistuje. */}
        {!error && (
          <div className="answer-head">
            <span className="answer-mark" aria-hidden="true" />
            <span className="answer-kicker">{t.fromDocuments}</span>
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
              <FormattedText text={text} />
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

      {/* Citácie — doslovné úryvky, o ktoré sa odpoveď opiera. */}
      {unique.length > 0 && (
        <div>
          <h3 style={{ fontSize: "var(--fs-small)", textTransform: "uppercase", letterSpacing: "0.05em",
                       color: "var(--muted)", marginBottom: 10 }}>
            {t.citations(unique.length)}
            {unique.length < citations.length && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {" "}— {citations.length} {t.citationsNote}
              </span>
            )}
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {unique.map((c, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderLeft: "3px solid var(--teal-700)",
                  borderRadius: 10,
                  padding: "11px 14px",
                }}
              >
                <div style={{ fontSize: "var(--fs-body)", lineHeight: 1.6 }}>„{cleanCitation(c.citedText)}“</div>
                <div className="quiet" style={{ fontSize: "var(--fs-micro)", marginTop: 6 }}>
                  {[c.documentTitle, c.articleRef].filter(Boolean).join(" · ") || t.sourceMissing}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zdroje — čo sa dostalo do kontextu, aj keď z toho model necitoval. */}
      {done && done.sources.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "var(--fs-small)", textTransform: "uppercase",
                            letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
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
                    {z.sourceType === "qa" && (
                      <span className="quiet answer-source-meta">{t.verifiedNote}</span>
                    )}
                  </span>
                  {z.sourceType === "qa" && (
                    <span
                      className="tag"
                      style={{ background: "var(--ok-bg)", color: "var(--ok-fg)", fontSize: "var(--fs-micro)", fontWeight: 600 }}
                    >
                      {t.verified}
                    </span>
                  )}
                  {/* Interný obsah vo verejnej odpovedi je tvrdá brána D9,
                      preto to musí byť vidieť na prvý pohľad. */}
                  {z.accessLevel === "internal" && (
                    <span
                      className="tag"
                      style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", fontSize: "var(--fs-micro)" }}
                    >
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
        </details>
      )}

      {/* Technická pätička — bez nej sa nedá porovnávať medzi konfiguráciami. */}
      {done && !error && (
        <div
          className="quiet"
          style={{
            display: "flex", flexWrap: "wrap", gap: 16,
            fontSize: "var(--fs-micro)", paddingTop: 4,
          }}
        >
          {done.model && <Line label="model" value={done.model} />}
          {done.provider && <Line label={t.adapter} value={done.provider} />}
          {done.ttftMs !== null && (
            <Line label={t.firstToken} value={`${(done.ttftMs / 1000).toFixed(1)} s`} />
          )}
          <Line label="celkom" value={`${(done.totalMs / 1000).toFixed(1)} s`} />

          {/* Tokeny a cena. Cache sa uvádza zvlášť, lebo čítanie z nej stojí
              desatinu ceny vstupu — bez toho rozlíšenia by číslo klamalo. */}
          {done.tokens && (
            <Line
              label="tokeny"
              value={
                `${done.tokens.input.toLocaleString("sk")} → ` +
                `${done.tokens.output.toLocaleString("sk")}` +
                (done.tokens.cacheRead
                  ? ` · z cache ${done.tokens.cacheRead.toLocaleString("sk")}` : "") +
                (done.tokens.cacheWrite
                  ? ` · do cache ${done.tokens.cacheWrite.toLocaleString("sk")}` : "")
              }
            />
          )}
          {done.cost && !done.cost.unknownModel && (
            <span
              className="tag"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
              title={t.costNote(done.cost.pricelistVersion)}
            >
              ≈ {formatUsd(done.cost.usd)} · {formatEur(toEur(done.cost.usd))}
            </span>
          )}
          {/* Cenník, ktorý prestal platiť, radšej priznáme, než by sme ticho
              počítali starou sadzbou. */}
          {done.cost?.pricelistExpired && (
            <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
              {t.pricelistStale}
            </span>
          )}
          {/* Rozpad na fázy. Nezaujíma hodnotiteľa, ale bez neho sa nedá
              povedať, prečo je prvý token pomalý. */}
          {done.timings && Object.entries(done.timings).filter(([, ms]) => ms >= 50).map(([f, ms]) => (
            <Line key={f} label={f} value={`${(ms / 1000).toFixed(1)} s`} />
          ))}
          <span
            className="tag"
            style={
              done.verifiedCitations
                ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
                : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            }
          >
            {done.verifiedCitations ? t.citationsVerified : t.citationsUnverified}
          </span>
        </div>
      )}
    </div>
  )
}
