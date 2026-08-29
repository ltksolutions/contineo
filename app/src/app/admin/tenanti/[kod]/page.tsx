/**
 * Detail organizácie — úprava a stav domén (Fáza 5b, rozsahy B a C).
 *
 * Formuláre sú serverové, bez klientskeho stavu: odošlú sa, akcia presmeruje
 * späť so správou v adrese. Na telefóne to znamená, že stránka funguje aj bez
 * jediného riadku JavaScriptu — a to je pri správcovskej obrazovke, ktorú
 * človek otvorí raz za mesiac, prednosť, nie ústupok.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { allTenants } from "@/lib/tenantAdmin"
import { stavDomeny, pokynCname } from "@/lib/vercel"
import { UI_LANGUAGES } from "@/lib/i18n"
import { ulozTenant, prepniStav, poslatPokyny } from "../../akcie"
import type { StavDomeny } from "@/lib/vercel"

export const dynamic = "force-dynamic"

function Pole({
  meno, popis, hodnota, napoveda, typ = "text",
}: {
  meno: string; popis: string; hodnota?: string; napoveda?: string; typ?: string
}) {
  return (
    <label className="pole">
      <span className="pole-popis">{popis}</span>
      <input className="pole-vstup" type={typ} name={meno} defaultValue={hodnota ?? ""} />
      {napoveda && <span className="tichy pole-napoveda">{napoveda}</span>}
    </label>
  )
}

function RiadokDomeny({ s }: { s: StavDomeny }) {
  if (s.preskocena) {
    return <li className="tichy">{s.host} — netreba nič ({s.preskocena})</li>
  }
  if (!s.vProjekte) {
    return (
      <li>
        <strong>{s.host}</strong> — <span style={{ color: "var(--bad-fg)" }}>nie je vo Verceli</span>
      </li>
    )
  }
  if (!s.nastaveneCez) {
    return (
      <li>
        <strong>{s.host}</strong> — čaká na zákazníka:{" "}
        <code>{pokynCname(s.host, s.cname)}</code>
        {s.konflikty.length > 0 && (
          <div style={{ color: "var(--bad-fg)", fontSize: 13 }}>
            v zóne kolidujú: {s.konflikty.join(", ")}
          </div>
        )}
      </li>
    )
  }
  return (
    <li>
      <strong>{s.host}</strong> — nastavené ({s.nastaveneCez})
      {!s.overena && <span style={{ color: "var(--warn-fg)" }}>, neoverené</span>}
    </li>
  )
}

export default async function DetailTenanta({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<{ sprava?: string }>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { kod } = await params
  const { sprava } = await searchParams
  const tenant = (await allTenants()).find(t => t.companyCode === kod.toUpperCase())
  if (!tenant) notFound()

  // Stav domén sa číta naživo pri každom zobrazení (D27) — uložený by klamal
  // presne vtedy, keď si zákazník DNS prestaví.
  const domeny = await Promise.all(tenant.hostnames.map(stavDomeny))
  const cakajuce = domeny.filter(d => !d.preskocena && !d.nastaveneCez)
  const zapnuty = tenant.status === "active"

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 760 }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin" className="tichy" style={{ fontSize: 14 }}>
          ← Správa tenantov
        </Link>
      </p>

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        {tenant.branding.displayName}
      </h1>
      <p className="tichy" style={{ margin: "0 0 20px" }}>
        {tenant.companyCode}
        {!zapnuty && " · vypnutá"}
      </p>

      {sprava && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: 14.5 }}>
          {sprava}
        </p>
      )}

      <section className="karta" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Domény</h2>
        <ul className="admin-domeny">
          {domeny.map(d => <RiadokDomeny key={d.host} s={d} />)}
        </ul>

        {cakajuce.length > 0 && (
          <form action={poslatPokyny} className="admin-podforma">
            <input type="hidden" name="companyCode" value={tenant.companyCode} />
            <input type="hidden" name="hostnames" value={tenant.hostnames.join(" ")} />
            <Pole
              meno="komu"
              popis="Poslať pokyny na adresu"
              hodnota={tenant.branding.supportEmail}
              typ="email"
              napoveda={`Odošle sa ${cakajuce.length === 1 ? "jeden pokyn" : `${cakajuce.length} pokyny`} a zaznamená sa, komu a kedy.`}
            />
            <button className="tlacidlo" type="submit">Odoslať pokyny</button>
          </form>
        )}
      </section>

      <form action={ulozTenant} className="karta admin-forma">
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <h2 style={{ fontSize: 17, margin: 0 }}>Značka a jazyky</h2>

        <Pole meno="displayName" popis="Názov v hlavičke" hodnota={tenant.branding.displayName} />
        <Pole meno="shortName" popis="Skratka" hodnota={tenant.branding.shortName} />
        <Pole
          meno="logoUrl"
          popis="Logo"
          hodnota={tenant.branding.logoUrl}
          napoveda="Cesta v aplikácii, napr. /tenants/sfz.svg"
        />
        <Pole
          meno="accentColor"
          popis="Farba"
          hodnota={tenant.branding.accentColor}
          napoveda="Napr. #1450DF. Prázdne = predvolená paleta."
        />
        <Pole
          meno="supportEmail"
          popis="Kontakt organizácie"
          hodnota={tenant.branding.supportEmail}
          typ="email"
          napoveda="Sem chodia pokyny k doméne."
        />

        <fieldset className="pole" style={{ border: 0, padding: 0, margin: 0 }}>
          <span className="pole-popis">Jazyky prostredia</span>
          <span className="admin-jazyky">
            {UI_LANGUAGES.map(j => (
              <label key={j} className="stitok" style={{ gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="languages"
                  value={j}
                  defaultChecked={tenant.languages.includes(j)}
                />
                {j}
              </label>
            ))}
          </span>
        </fieldset>

        <label className="pole">
          <span className="pole-popis">Predvolený jazyk</span>
          <select className="pole-vstup" name="defaultLanguage" defaultValue={tenant.defaultLanguage}>
            {UI_LANGUAGES.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <span className="tichy pole-napoveda">Platí pre človeka, ktorý ešte nie je prihlásený.</span>
        </label>

        <label className="pole">
          <span className="pole-popis">Domény</span>
          <textarea
            className="pole-vstup"
            name="hostnames"
            rows={3}
            defaultValue={tenant.hostnames.join("\n")}
          />
          <span className="tichy pole-napoveda">
            Jedna na riadok. Nové sa pridajú aj do Vercelu. Doména patriaca inej
            organizácii sa odmietne — neprepíše.
          </span>
        </label>

        <button className="tlacidlo" type="submit">Uložiť</button>
      </form>

      <form action={prepniStav} className="karta admin-forma" style={{ marginTop: 16 }}>
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <input type="hidden" name="status" value={zapnuty ? "disabled" : "active"} />
        <h2 style={{ fontSize: 17, margin: 0 }}>
          {zapnuty ? "Vypnúť organizáciu" : "Zapnúť organizáciu"}
        </h2>
        {zapnuty ? (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
              Po vypnutí sa nikto z tejto organizácie neprihlási — okamžite.
              Záznamy potvrdení zostávajú, tenant sa nemaže.
            </p>
            <Pole
              meno="potvrdenie"
              popis={`Napíš ${tenant.companyCode} na potvrdenie`}
              napoveda="Zámerne to nie je obyčajné „naozaj?“ — to sa odklikne skôr, než sa prečíta."
            />
            <button className="tlacidlo tlacidlo--tiche" type="submit">Vypnúť</button>
          </>
        ) : (
          <button className="tlacidlo" type="submit">Zapnúť</button>
        )}
      </form>
    </div>
  )
}
