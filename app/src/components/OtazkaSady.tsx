"use client"

/**
 * Jedna otázka zlatej sady: znenie, možnosť upraviť ho, položenie otázky
 * systému a posúdenie odpovede.
 *
 * Pasca sa hodnotiteľovi hovorí VOPRED. Znie to ako napovedanie, ale nie je:
 * pri pasci sa neposudzuje, či je odpoveď vecne správna, ale či sa systém
 * správne zdržal. Bez toho upozornenia by hodnotiteľ označil odmietnutie
 * ako chybu — a metrika „správne neviem" by vyšla presne naopak.
 */

import { useState } from "react"
import Link from "next/link"
import Hladanie from "./Hladanie"

const POPIS_PASCE: Record<string, string> = {
  out_of_domain: "Otázka je mimo nahraných dokumentov. Systém má odmietnuť, nie odpovedať.",
  ambiguous_conflict: "Predpisy si tu odporujú. Systém nemá rozhodnúť autoritatívne — má na rozpor upozorniť a ponúknuť eskaláciu, lebo výklad patrí človeku.",
  access_control: "Pýta sa verejný používateľ na interný obsah. Systém ho nesmie prezradiť.",
  historical_version: "Otázka mieri na staršie znenie. Systém má citovať verziu platnú v danom čase, nie dnešnú.",
}

const POPIS_SPRAVANIA: Record<string, string> = {
  answer: "má odpovedať vecne",
  refuse: "má odmietnuť",
  escalate: "má ponúknuť eskaláciu",
}

export default function OtazkaSady({
  id, znenie, povodne, upravene, vyradena, dovodVyradenia,
  trapType, expectedBehaviour, precedenceRule, searchMode,
  prekryv, cudzie, dalsia,
}: {
  id: string
  znenie: string
  povodne: string
  upravene: string | null
  vyradena: boolean
  dovodVyradenia: string | null
  trapType: string | null
  expectedBehaviour: string
  precedenceRule: string | null
  searchMode: string
  /** Má otázku posúdiť viac ľudí nezávisle? */
  prekryv: boolean
  /** Posudky ostatných. Pri prekryve prázdne, kým neposúdim sám. */
  cudzie: { hodnotitel: string; spravna: 0 | 1 | null }[]
  dalsia: string | null
}) {
  const [text, setText] = useState(znenie)
  const [upravujem, setUpravujem] = useState(false)
  const [vyradenaTeraz, setVyradena] = useState(vyradena)
  const [dovod, setDovod] = useState(dovodVyradenia ?? "")
  const [stav, setStav] = useState<"" | "ukladam" | "ulozene" | "chyba">("")
  const [posudene, setPosudene] = useState(false)

  async function uloz(zmena: Record<string, unknown>) {
    setStav("ukladam")
    try {
      const r = await fetch("/api/sada", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...zmena }),
      })
      setStav(r.ok ? "ulozene" : "chyba")
    } catch {
      setStav("chyba")
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/sada" className="tichy" style={{ fontSize: 13.5, textDecoration: "none" }}>
          ← Späť na zoznam
        </Link>
        <span className="stitok tichy" style={{ fontSize: 11 }}>{id}</span>
        <span className="stitok tichy" style={{ fontSize: 11 }}>{searchMode}</span>
        {precedenceRule && (
          <span className="stitok tichy" style={{ fontSize: 11 }}>{precedenceRule}</span>
        )}
        <span className="tichy" style={{ fontSize: 12, marginLeft: "auto" }}>
          {stav === "ukladam" ? "ukladám…" : stav === "ulozene" ? "uložené" : stav === "chyba" ? "neuložilo sa" : ""}
        </span>
      </div>

      {/* Otázka pre dvoch — hodnotiteľ má vedieť, prečo cudzí posudok nevidí. */}
      {prekryv && cudzie.length === 0 && (
        <div className="karta" style={{ fontSize: 14, lineHeight: 1.6 }}>
          <strong>Túto otázku posudzujú dvaja nezávisle.</strong>{" "}
          <span className="tichy">
            Ak ju už niekto posúdil, jeho záver uvidíte až po tom, ako sa vyjadríte
            sami. Nejde o tajnostkárstvo — keby ste ho videli vopred, merali by sme,
            či ste mu uverili, nie či sa zhodnete.
          </span>
        </div>
      )}

      {/* Po vlastnom posudku sa cudzie odkryjú. Nezhoda je nález, nie chyba. */}
      {cudzie.length > 0 && (
        <div
          className="karta"
          style={{
            fontSize: 14, lineHeight: 1.6,
            borderColor: cudzie.some(c => c.spravna !== null) ? "var(--line)" : "var(--line)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ako to posúdili ostatní</div>
          {cudzie.map((c, i) => (
            <div key={i} className="tichy" style={{ fontSize: 13.5 }}>
              {c.hodnotitel} — {c.spravna === 1 ? "správna" : c.spravna === 0 ? "nesprávna" : "neposúdené"}
            </div>
          ))}
        </div>
      )}

      {/* Čo sa od systému očakáva. Pri pasci je to kľúčové — inak hodnotiteľ
          posúdi správne odmietnutie ako zlyhanie. */}
      {(trapType || expectedBehaviour !== "answer") && (
        <div
          className="karta"
          style={{
            background: "var(--warn-bg)", color: "var(--warn-fg)",
            borderColor: "var(--line)", display: "flex", gap: 10, alignItems: "flex-start",
          }}
        >
          <span aria-hidden="true" style={{ fontWeight: 700 }}>▲</span>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>
            <strong>Toto je zámerná skúška.</strong>{" "}
            {trapType && POPIS_PASCE[trapType]}
            {" "}Systém tu <strong>{POPIS_SPRAVANIA[expectedBehaviour] ?? expectedBehaviour}</strong> —
            posudzujte, či sa zachoval takto, nie či odpovedal vyčerpávajúco.
          </span>
        </div>
      )}

      {vyradenaTeraz ? (
        <div className="karta">
          <div style={{ fontSize: 15, marginBottom: 8 }}>
            <strong>Otázka je vyradená.</strong>
          </div>
          {dovod && <p className="tichy" style={{ fontSize: 14, margin: "0 0 12px" }}>{dovod}</p>}
          <button
            type="button"
            className="tlacidlo tlacidlo--tiche"
            onClick={() => { setVyradena(false); uloz({ vyradena: false }) }}
          >
            Vrátiť do sady
          </button>
        </div>
      ) : (
        <>
          <div className="karta">
            {upravujem ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label className="tichy" style={{ fontSize: 13 }}>
                  Znenie otázky — napíšte ju tak, ako by sa spýtal skutočný človek.
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  style={{
                    width: "100%", background: "var(--bg)", color: "var(--ink)",
                    border: "1px solid var(--line)", borderRadius: 9,
                    padding: "10px 13px", fontSize: 15.5, fontFamily: "inherit",
                    lineHeight: 1.6, resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="tlacidlo"
                    style={{ padding: "7px 14px", fontSize: 14 }}
                    onClick={() => { setUpravujem(false); uloz({ upraveneZnenie: text }) }}
                  >
                    Uložiť znenie
                  </button>
                  <button
                    type="button"
                    className="tlacidlo tlacidlo--tiche"
                    style={{ padding: "7px 14px", fontSize: 14 }}
                    onClick={() => { setText(znenie); setUpravujem(false) }}
                  >
                    Zrušiť
                  </button>
                  {upravene && (
                    <button
                      type="button"
                      className="tlacidlo tlacidlo--tiche"
                      style={{ padding: "7px 14px", fontSize: 14 }}
                      onClick={() => { setText(povodne); setUpravujem(false); uloz({ upraveneZnenie: "" }) }}
                    >
                      Vrátiť pôvodné
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 600 }}>{text}</div>
                  {/* Pôvodné znenie zostáva viditeľné — je to podklad pre
                      regresné merania, nie len história. */}
                  {upravene && (
                    <div className="tichy" style={{ fontSize: 12.5, marginTop: 8 }}>
                      pôvodne: &bdquo;{povodne}&ldquo;
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="tlacidlo tlacidlo--tiche"
                  style={{ padding: "6px 12px", fontSize: 13.5, flexShrink: 0 }}
                  onClick={() => setUpravujem(true)}
                >
                  Upraviť
                </button>
              </div>
            )}
          </div>

          <Hladanie
            key={text}
            otazkaId={id}
            prednastavena={text}
            onPosudene={() => setPosudene(true)}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Ponuka ďalšej otázky sa objaví až po posúdení — dovtedy by
                nabádala preskočiť prácu, kvôli ktorej sme tu. */}
            {posudene && dalsia && (
              <Link href={`/sada/${dalsia}`} className="tlacidlo" style={{ textDecoration: "none" }}>
                Ďalšia otázka →
              </Link>
            )}
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => {
                const d = window.prompt("Prečo otázka nedáva zmysel?") ?? ""
                if (d.trim()) {
                  setVyradena(true)
                  setDovod(d)
                  uloz({ vyradena: true, dovodVyradenia: d })
                }
              }}
            >
              Vyradiť otázku
            </button>
          </div>
        </>
      )}
    </div>
  )
}
