"use client"

/**
 * Zobrazenie odpovede: text, citácie, zdroje a technická pätička.
 *
 * Návrhové rozhodnutie: citácie sú NAD zoznamom zdrojov a sú výraznejšie.
 * Zdroj hovorí len „toto sme prehľadali", citácia hovorí „o toto sa opiera
 * táto veta" — a práve to hodnotiteľ potrebuje, aby vedel posúdiť, či si
 * model niečo nedomyslel.
 */

import type { Citacia, Vysledok } from "@/lib/sseKlient"
import { naBloky, ocistiCitaciu, zlucCitacie } from "@/lib/formatText"
import type { Usek } from "@/lib/formatText"

/** Stav odpovede počas streamovania — kým nepríde `done`, máme len text. */
export interface StavOdpovede {
  otazka: string
  text: string
  citacie: Citacia[]
  hotovo: Vysledok | null
  bezi: boolean
}

/**
 * Vykreslenie textu modelu.
 *
 * Nikde tu nie je `dangerouslySetInnerHTML` — text prechádza cez
 * `naBloky()` a stáva sa obyčajnými React uzlami. Výstup modelu nad cudzími
 * dokumentmi sa nesmie dostať do DOM ako HTML.
 */
function Useky({ useky }: { useky: Usek[] }) {
  return (
    <>
      {useky.map((u, i) =>
        u.druh === "tucne"
          ? <strong key={i}>{u.text}</strong>
          : <span key={i}>{u.text}</span>
      )}
    </>
  )
}

function TextOdpovede({ text }: { text: string }) {
  const bloky = naBloky(text)
  return (
    <>
      {bloky.map((b, i) =>
        b.druh === "nadpis" ? (
          <div
            key={i}
            style={{
              // Úrovne sa líšia len jemne — odpoveď má mať jeden hlas,
              // nie hierarchiu ako dokumentácia.
              fontSize: b.uroven <= 2 ? 16.5 : 15.5,
              fontWeight: 700,
              margin: i === 0 ? "0 0 8px" : "18px 0 8px",
            }}
          >
            <Useky useky={b.useky} />
          </div>
        ) : b.druh === "odsek" ? (
          <p key={i} style={{ margin: "0 0 12px" }}>
            <Useky useky={b.useky} />
          </p>
        ) : b.cislovany ? (
          <ol key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.polozky.map((p, j) => <li key={j}><Useky useky={p} /></li>)}
          </ol>
        ) : (
          <ul key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.polozky.map((p, j) => <li key={j}><Useky useky={p} /></li>)}
          </ul>
        )
      )}
    </>
  )
}

function Riadok({ popis, hodnota }: { popis: string; hodnota: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <span className="tichy">{popis}</span>
      <span style={{ fontWeight: 600 }}>{hodnota}</span>
    </span>
  )
}

export default function Odpoved({ stav }: { stav: StavOdpovede }) {
  const { text, citacie, hotovo, bezi } = stav
  if (!text && !bezi && !hotovo) return null

  const chyba = hotovo?.chyba
  const useknute = hotovo?.dovodUkoncenia === "max_tokens"

  // Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera.
  // Pri dlhej odpovedi ich vznikne aj devätnásť, z toho polovica rovnakých.
  const jedinecne = zlucCitacie(citacie)

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="karta">
        {chyba ? (
          <div style={{ color: "var(--bad-fg)", fontSize: 15 }}>
            <strong>Odpoveď sa nepodarilo získať.</strong>
            <div style={{ marginTop: 6, fontSize: 14 }}>{chyba}</div>
          </div>
        ) : (
          <div className={bezi ? "odpoved kurzor" : "odpoved"}>
            {text ? <TextOdpovede text={text} /> : (bezi ? null : "—")}
          </div>
        )}

        {/* Useknutá odpoveď sa NESMIE tváriť ako hotová. Záver býva práve to
            zhrnutie, ktoré si čitateľ odnesie — a keď chýba, nemá ako vedieť,
            že mu chýba. */}
        {useknute && (
          <div
            style={{
              display: "flex", gap: 9, alignItems: "flex-start",
              marginTop: 14, padding: "10px 13px",
              background: "var(--warn-bg)", color: "var(--warn-fg)",
              border: "1px solid var(--line)", borderRadius: 9,
              fontSize: 13.5, lineHeight: 1.55,
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 700 }}>▲</span>
            <span>
              <strong>Odpoveď je neúplná.</strong>{" "}
              Model dosiahol limit dĺžky a zastavil sa uprostred — chýba jej záver.
              Skúste sa opýtať na užšiu časť problému.
            </span>
          </div>
        )}
      </div>

      {/* Citácie — doslovné úryvky, o ktoré sa odpoveď opiera. */}
      {jedinecne.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em",
                       color: "var(--muted)", marginBottom: 10 }}>
            Doslovné citácie ({jedinecne.length})
            {jedinecne.length < citacie.length && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {" "}— {citacie.length} uvedených, zhodné zlúčené
              </span>
            )}
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {jedinecne.map((c, i) => (
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
                <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>„{ocistiCitaciu(c.citedText)}“</div>
                <div className="tichy" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {[c.documentTitle, c.articleRef].filter(Boolean).join(" · ") || "zdroj neuvedený"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zdroje — čo sa dostalo do kontextu, aj keď z toho model necitoval. */}
      {hotovo && hotovo.zdroje.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, textTransform: "uppercase",
                            letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
            Prehľadané zdroje ({hotovo.zdroje.length})
          </summary>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {hotovo.zdroje.map(z => (
              <div
                key={z.index}
                style={{
                  display: "flex", gap: 10, alignItems: "baseline",
                  fontSize: 14, padding: "7px 12px",
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                <span className="tichy" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {z.index}.
                </span>
                <span style={{ flex: 1 }}>
                  {z.title}
                  {z.articleRef && <span className="tichy"> · {z.articleRef}</span>}
                  {z.heading && <span className="tichy"> — {z.heading}</span>}
                </span>
                {/* Interný obsah vo verejnej odpovedi je tvrdá brána D9,
                    preto to musí byť vidieť na prvý pohľad. */}
                {z.accessLevel === "internal" && (
                  <span
                    className="stitok"
                    style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", fontSize: 11 }}
                  >
                    interné
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Technická pätička — bez nej sa nedá porovnávať medzi konfiguráciami. */}
      {hotovo && !chyba && (
        <div
          className="tichy"
          style={{
            display: "flex", flexWrap: "wrap", gap: 16,
            fontSize: 12.5, paddingTop: 4,
          }}
        >
          {hotovo.model && <Riadok popis="model" hodnota={hotovo.model} />}
          {hotovo.provider && <Riadok popis="adaptér" hodnota={hotovo.provider} />}
          {hotovo.ttftMs !== null && (
            <Riadok popis="prvý token" hodnota={`${(hotovo.ttftMs / 1000).toFixed(1)} s`} />
          )}
          <Riadok popis="celkom" hodnota={`${(hotovo.celkovoMs / 1000).toFixed(1)} s`} />
          {/* Rozpad na fázy. Nezaujíma hodnotiteľa, ale bez neho sa nedá
              povedať, prečo je prvý token pomalý. */}
          {hotovo.casy && Object.entries(hotovo.casy).filter(([, ms]) => ms >= 50).map(([f, ms]) => (
            <Riadok key={f} popis={f} hodnota={`${(ms / 1000).toFixed(1)} s`} />
          ))}
          <span
            className="stitok"
            style={
              hotovo.overeneCitacie
                ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
                : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            }
          >
            {hotovo.overeneCitacie ? "citácie overené modelom" : "citácie neoverené"}
          </span>
        </div>
      )}
    </div>
  )
}
