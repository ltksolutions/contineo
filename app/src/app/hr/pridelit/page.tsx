/**
 * Prideliť normu — formulár.
 *
 * Serverový formulár bez klientskeho stavu: funguje aj bez jediného riadku
 * JavaScriptu a po chybe sa vráti aj s tým, čo už bolo vypísané.
 *
 * **Dôvod je povinný.** Nie je to byrokracia — je to celý zmysel rozsahu B.
 * Systém nevie odlíšiť opravu preklepu od novej povinnosti (D30) a nemá sa
 * o to pokúšať; rozhodne to človek a tu to aj napíše. O rok je to jediné
 * miesto, kde sa dá zistiť, prečo sto ľudí muselo niečo potvrdiť znova.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext, pridelitelneDokumenty, publikaVOrganizacii } from "@/lib/hr"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import { pridelit } from "../akcie"

export const dynamic = "force-dynamic"

export default async function Pridelit({
  searchParams,
}: {
  searchParams: Promise<{
    chyba?: string
    dokument?: string
    publikum?: string
    hodnota?: string
    dovod?: string
  }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const q = await searchParams
  const [dokumenty, publika] = await Promise.all([
    pridelitelneDokumenty(ctx.person.companyCode),
    publikaVOrganizacii(ctx.person.companyCode),
  ])
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 640, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/hr" style={{ fontSize: 14 }}>← Späť na prehľad</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Prideliť normu</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        Prideľuje sa <strong>konkrétne znenie</strong>, nie dokument. Keď
        pribudne novšie, staré pridelenie samo neplatí za nové — to je zámer.
      </p>

      {q.chyba && (
        <p
          className="karta"
          style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}
        >
          {q.chyba}
        </p>
      )}

      {dokumenty.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          Žiadny dokument nemá platné znenie, takže prideliť sa nedá nič.
          Znenie bez dátumu platnosti sa nedá ani potvrdiť (D6).
        </p>
      ) : (
        <form action={pridelit} className="karta" style={{ padding: 20, display: "grid", gap: 18 }}>
          <label className="pole">
            <span className="pole-popis">Dokument</span>
            <select name="dokument" defaultValue={q.dokument ?? ""} required className="pole-vstup">
              <option value="" disabled>— vyber —</option>
              {dokumenty.map(d => (
                <option key={d.documentId} value={d.documentId}>
                  {d.title} — verzia {d.versionLabel}, platná od{" "}
                  {formatDate(d.effectiveFrom, jazyk)}
                </option>
              ))}
            </select>
          </label>

          <label className="pole">
            <span className="pole-popis">Komu</span>
            <select name="publikum" defaultValue={q.publikum ?? "group"} required className="pole-vstup">
              <option value="group">skupine</option>
              <option value="track">všetkým na trase</option>
              <option value="person">jednej osobe (adresa)</option>
              <option value="all">všetkým v organizácii</option>
            </select>
          </label>

          <label className="pole">
            <span className="pole-popis">
              Skupina, trasa alebo adresa
            </span>
            <input
              name="hodnota"
              defaultValue={q.hodnota ?? ""}
              list="publika"
              className="pole-vstup"
              placeholder="napr. rozhodcovia"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <datalist id="publika">
              {publika.skupiny.map(s => (
                <option key={`s-${s.hodnota}`} value={s.hodnota}>skupina · {s.osob} osôb</option>
              ))}
              {publika.trasy.map(t => (
                <option key={`t-${t.hodnota}`} value={t.hodnota}>trasa · {t.osob} osôb</option>
              ))}
            </datalist>
            <span className="tichy pole-napoveda">
              Pri &bdquo;všetkým v organizácii&ldquo; sa nevypĺňa. Ponuka ukazuje len to,
              čo v organizácii naozaj existuje — prideliť prázdnej skupine je
              tichý spôsob, ako neprideliť nikomu.
            </span>
          </label>

          <label className="pole">
            <span className="pole-popis">Dôvod</span>
            <textarea
              name="dovod"
              defaultValue={q.dovod ?? ""}
              required
              rows={3}
              className="pole-vstup"
              placeholder="napr. novela čl. 12 — mení sa lehota na podanie odvolania"
            />
            <span className="tichy pole-napoveda">
              Povinný. Je to jediné miesto, kde bude o rok napísané, prečo sa
              norma potvrdzovala znova.
            </span>
          </label>

          <div>
            <button className="tlacidlo" type="submit">Prideliť</button>
          </div>
        </form>
      )}
    </div>
  )
}
