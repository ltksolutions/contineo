/**
 * Detail a úprava osoby (D46).
 *
 * **Adresa sa nedá zmeniť.** Je to kľúč, na ktorý sú naviazané potvrdenia aj
 * prihlasovacie kontá; prepísať ho pod existujúcimi záznamami by znamenalo,
 * že sa audit odkazuje na niekoho, kto tam už nie je. Preklep sa rieši
 * vyradením a pozvaním nanovo — je to nepohodlnejšie a je to správne.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext, loadPersonById, PRIDELITELNE_ROLE } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, UI_LANGUAGES } from "@/lib/i18n"
import { ulozOsobu, prepniStavOsoby } from "../akcie"

export const dynamic = "force-dynamic"

const TYPY = [
  { hodnota: "employee", popis: "zamestnanec" },
  { hodnota: "external", popis: "externý" },
  { hodnota: "referee", popis: "rozhodca" },
  { hodnota: "official", popis: "funkcionár" },
]

const POPIS_ROLY: Record<string, string> = {
  hr: "hr — prideľuje normy a vidí, kto ich nepotvrdil",
  "people-admin": "people-admin — spravuje osoby (táto obrazovka)",
}

export default async function DetailOsoby({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sprava?: string }>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { sprava } = await searchParams
  const o = await loadPersonById(ctx.person.companyCode, id)
  // Neexistuje vs. patrí inej organizácii je zámerne tá istá odpoveď (D32).
  if (!o) notFound()

  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language
  const vyradena = o.status === "inactive"

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/osoby" style={{ fontSize: 14 }}>← Späť na zoznam</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{o.fullName}</h1>
      <p className="tichy" style={{ fontSize: 14.5, margin: "0 0 4px", overflowWrap: "anywhere" }}>
        {o.email}
      </p>
      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
        {o.status === "invited" ? "pozvaná, ešte sa neprihlásila"
          : o.status === "inactive" ? "vyradená — neprihlási sa"
          : `naposledy ${o.lastLoginAt ? formatDate(o.lastLoginAt, jazyk) : "—"}`}
        {o.konta.length > 0 && ` · prihlasuje sa cez ${o.konta.join(", ")}`}
      </p>

      {sprava && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5 }}>
          {sprava}
        </p>
      )}

      <form action={ulozOsobu} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={o.id} />

        <label className="pole">
          <span className="pole-popis">Meno</span>
          <input className="pole-vstup" name="fullName" defaultValue={o.fullName} required />
        </label>

        <label className="pole">
          <span className="pole-popis">Útvar</span>
          <input className="pole-vstup" name="department" defaultValue={o.department ?? ""} />
          <span className="tichy pole-napoveda">
            Prázdne sa uloží ako prázdne — útvar človek naozaj mať nemusí.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Typ osoby</span>
          <select className="pole-vstup" name="personType" defaultValue={o.personType}>
            {TYPY.map(t => <option key={t.hodnota} value={t.hodnota}>{t.popis}</option>)}
          </select>
          <span className="tichy pole-napoveda">
            Evidenčný údaj. O prístupe k obsahu nerozhoduje — ten rieši organizácia
            a úroveň dokumentu.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Jazyk prostredia</span>
          <select className="pole-vstup" name="language" defaultValue={o.language}>
            {UI_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="tichy pole-napoveda">
            V čom sa s človekom rozprávame. Nie jazyk dokumentov, ktoré číta.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Skupiny</span>
          <input
            className="pole-vstup"
            name="groups"
            defaultValue={o.groups.join(", ")}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">
            Oddelené čiarkou. Podľa nich sa prideľujú normy — skupina, ktorú nikto
            nemá, nedostane nič.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Trasy onboardingu</span>
          <input
            className="pole-vstup"
            name="tracks"
            defaultValue={o.tracks.join(", ")}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <fieldset className="hr-skupina" style={{ border: "1px solid var(--line)" }}>
          <legend className="pole-popis">Roly</legend>
          <ul className="hr-volby">
            {PRIDELITELNE_ROLE.map(r => (
              <li key={r}>
                <label className="hr-volba">
                  <input type="checkbox" name="roles" value={r} defaultChecked={o.roles.includes(r)} />
                  <span>{POPIS_ROLY[r] ?? r}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="tichy pole-napoveda" style={{ margin: "6px 0 0" }}>
            Správcu platformy sa odtiaľto prideliť nedá — patrí tenantovi dodávateľa
            a má vlastnú cestu.
          </p>
        </fieldset>

        <div>
          <button className="tlacidlo" type="submit">Uložiť</button>
        </div>
      </form>

      <form action={prepniStavOsoby} className="karta" style={{ padding: 20, marginTop: 16, display: "grid", gap: 12 }}>
        <input type="hidden" name="id" value={o.id} />
        <input type="hidden" name="email" value={o.email} />
        <input type="hidden" name="status" value={vyradena ? "invited" : "inactive"} />

        <h2 style={{ fontSize: 17, margin: 0 }}>{vyradena ? "Vrátiť osobu" : "Vyradiť osobu"}</h2>

        {vyradena ? (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
              Vráti sa ako <strong>pozvaná</strong>, nie aktívna — aktívna znamená
              &bdquo;už sa prihlásila&ldquo; a to sa vrátením nestalo. Prepne ju prvé prihlásenie.
            </p>
            <div><button className="tlacidlo" type="submit">Vrátiť</button></div>
          </>
        ) : (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
              Po vyradení sa neprihlási — okamžite. Záznam ani jej potvrdenia sa
              nemažú; sú to platné doklady o tom, čo si prečítala, a musia prežiť
              jej odchod.
            </p>
            <label className="pole">
              <span className="pole-popis">Napíš adresu na potvrdenie</span>
              <input className="pole-vstup" name="potvrdenie" autoCapitalize="none" autoCorrect="off" />
              <span className="tichy pole-napoveda">
                Zámerne to nie je &bdquo;naozaj?&ldquo; — to sa odklikne skôr, než sa prečíta.
              </span>
            </label>
            <div><button className="tlacidlo tlacidlo--tiche" type="submit">Vyradiť</button></div>
          </>
        )}
      </form>
    </div>
  )
}
