/**
 * Detail organizácie — úprava a stav domén (Fáza 5b, rozsahy B a C).
 *
 * Formuláre sú serverové, bez klientskeho stavu: odošlú sa, akcia presmeruje
 * späť so správou v adrese. Na telefóne to znamená, že stránka funguje aj bez
 * jediného riadku JavaScriptu — a to je pri správcovskej obrazovke, ktorú
 * človek otvorí raz za mesiac, prednosť, nie ústupok.
 */

import { notFound, redirect } from "next/navigation"
import { auditZaznamy } from "@/lib/audit"
import AuditVypis from "@/components/AuditVypis"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { allTenants } from "@/lib/tenantAdmin"
import { stavDomeny, pokynCname } from "@/lib/vercel"
import { UI_LANGUAGES } from "@/lib/i18n"
import Vyber from "@/components/Vyber"
import VyberFarby from "@/components/VyberFarby"
import Oznam from "@/components/Oznam"
import { stavPoskytovatela, NAZOV_POSKYTOVATELA, ID_POSKYTOVATELA } from "@/lib/oauth"
import { ulozTenant, prepniStav, poslatPokyny, ulozPrihlasenie, zmazPrihlasenie } from "../../akcie"
import type { StavDomeny } from "@/lib/vercel"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"


/**
 * Prihlasovacie údaje jedného poskytovateľa (D43).
 *
 * **Tajomstvo sa nikdy nevypisuje.** Pole je pri každom otvorení prázdne
 * a prázdne znamená „nemeň" — inak by uloženie zmeneného `clientId` ticho
 * vymazalo tajomstvo a prihlásenie by prestalo fungovať.
 */
function Poskytovatel({
  tenant, provider, domena,
}: {
  tenant: Tenant
  provider: OAuthProviderName
  /** Prvá doména tenanta — do nej sa skladá adresa návratu. */
  domena?: string
}) {
  const nazov = NAZOV_POSKYTOVATELA[provider]
  const s = stavPoskytovatela(tenant, provider)
  const navrat = domena
    ? `https://${domena}/api/auth/callback/${ID_POSKYTOVATELA[provider]}`
    : `https://<doména>/api/auth/callback/${ID_POSKYTOVATELA[provider]}`

  const popisStavu = {
    nastavene: "nastavené — vlastná aplikácia zákazníka",
    "z-prostredia": "beží z našich premenných prostredia, nie z vlastnej aplikácie zákazníka",
    necitatelne: "uložené, ale nedá sa prečítať — zmenil sa šifrovací kľúč, zadaj údaje znova",
    nenastavene: "nenastavené — tlačidlo sa neponúka",
  }[s.stav]

  return (
    <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Prihlásenie cez {nazov}</h2>
        <span
          className="stitok"
          style={s.stav === "necitatelne"
            ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            : undefined}
        >
          {s.stav === "nastavene" ? "nastavené" : s.stav === "z-prostredia" ? "z prostredia" : s.stav === "necitatelne" ? "nečitateľné" : "nenastavené"}
        </span>
      </div>

      <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{popisStavu}</p>

      {/* Najčastejšia príčina toho, prečo prihlásenie hneď na prvý raz nejde. */}
      <div>
        <div className="tichy pole-napoveda">Adresa návratu — zákazník ju musí zapísať do svojej aplikácie presne takto:</div>
        <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{navrat}</code>
      </div>

      <form action={ulozPrihlasenie} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <input type="hidden" name="provider" value={provider} />

        <Pole meno="clientId" popis="Client ID" hodnota={s.zdroj === "tenant" ? s.clientId : ""} />
        <Pole
          meno="clientSecret"
          popis="Client secret"
          typ="password"
          napoveda="Prázdne = nemeniť. Hodnota sa ukladá zašifrovaná a späť sa nikdy nevypíše."
        />

        {provider === "microsoft" ? (
          <>
            <Pole
              meno="tenantMode"
              popis="Režim tenanta"
              hodnota={tenant.oauth?.microsoft?.tenantMode ?? "organizations"}
              napoveda="organizations = pracovné a školské kontá · common = aj osobné · alebo UUID jedného Entra tenanta"
            />
            <Pole
              meno="allowedTenantIds"
              popis="Povolené Entra tenant id"
              hodnota={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")}
              napoveda="Oddelené čiarkou. Prázdne = nekontroluje sa — pri režime organizations je to jediná zábrana proti tomu, aby sa dnu dostal človek z cudzej organizácie s rovnakou adresou."
            />
          </>
        ) : (
          <Pole
            meno="hostedDomain"
            popis="Doména Workspace (hd)"
            hodnota={tenant.oauth?.google?.hostedDomain ?? ""}
            napoveda="Napr. futbalsfz.sk. Prázdne = ktorékoľvek Google konto."
          />
        )}

        <div>
          <button className="tlacidlo" type="submit">Uložiť</button>
        </div>
      </form>

      {s.zdroj === "tenant" && (
        <form action={zmazPrihlasenie} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="companyCode" value={tenant.companyCode} />
          <input type="hidden" name="provider" value={provider} />
          <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
            Odstránením zmizne tlačidlo z prihlasovacej obrazovky. Ľuďom, ktorí
            sa prihlasujú pracovným kontom, tým prestane fungovať jediná cesta,
            ktorú poznajú.
          </p>
          <Pole meno="potvrdenie" popis={`Napíš ${tenant.companyCode} na potvrdenie`} />
          <button className="tlacidlo tlacidlo--tiche" type="submit">Odstrániť</button>
        </form>
      )}
    </section>
  )
}

/** Kód jazyka sám o sebe nepovie nič — „sk" je pre nás jasné, pre iných nie. */
const JAZYKY: Record<string, string> = {
  sk: "slovenčina",
  cs: "čeština",
  en: "angličtina",
}

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
  searchParams: Promise<{ sprava?: string; chyba?: string }>
}) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { kod } = await params
  const { sprava, chyba } = await searchParams
  const tenant = (await allTenants()).find(t => t.companyCode === kod.toUpperCase())
  if (!tenant) notFound()

  // Stav domén sa číta naživo pri každom zobrazení (D27) — uložený by klamal
  // presne vtedy, keď si zákazník DNS prestaví.
  const domeny = await Promise.all(tenant.hostnames.map(stavDomeny))
  // Správca platformy vidí audit každej organizácie — kvôli podpore. Je to
  // ten istý výpis, aký vidí zákazník u seba (D51), len sem sa dostane bez
  // prepínania domén.
  const zaznamy = await auditZaznamy(tenant.companyCode, { limit: 50 })
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

      <Oznam sprava={sprava} chyba={chyba === "1"} spat={`/admin/tenanti/${encodeURIComponent(kod)}`} />

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

      <form action={ulozTenant} className="karta admin-forma" encType="multipart/form-data">
        <input type="hidden" name="companyCode" value={tenant.companyCode} />
        <h2 style={{ fontSize: 17, margin: 0 }}>Značka a jazyky</h2>

        <Pole meno="displayName" popis="Názov v hlavičke" hodnota={tenant.branding.displayName} />
        <Pole meno="shortName" popis="Skratka" hodnota={tenant.branding.shortName} />
        <div className="pole">
          <span className="pole-popis">Logo</span>
          {tenant.branding.logoUrl && (
            <span className="logo-nahlad">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.branding.logoUrl} alt="" width={34} height={34} />
              <span className="tichy pole-napoveda">súčasné</span>
            </span>
          )}
          <input className="pole-vstup" type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
          <span className="tichy pole-napoveda">
            PNG, JPEG alebo WebP, najviac 256 kB. Prázdne = nemeniť.
            SVG zámerne nie — môže obsahovať skript a servírovali by sme cudzí
            kód z domény, na ktorej sa potvrdzujú smernice.
          </span>
        </div>
        <div className="pole">
          <span className="pole-popis">Farba</span>
          <VyberFarby meno="accentColor" hodnota={tenant.branding.accentColor} />
          <span className="tichy pole-napoveda">
            Nesie ju tlačidlo s bielym textom, preto sú odtiene tmavšie, než by
            sa chcelo — svetlejší tón znamená nečitateľné tlačidlo u zákazníka.
          </span>
        </div>
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

        <div className="pole">
          <span className="pole-popis">Predvolený jazyk</span>
          <Vyber
            meno="defaultLanguage"
            volby={UI_LANGUAGES.map(j => ({ hodnota: j, popis: JAZYKY[j] ?? j }))}
            predvolena={tenant.defaultLanguage}
            popisPola="Predvolený jazyk"
          />
          <span className="tichy pole-napoveda">Platí pre človeka, ktorý ešte nie je prihlásený.</span>
        </div>

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

        <label className="pole">
          <span className="pole-popis">Domény pre automatické založenie</span>
          <textarea
            className="pole-vstup"
            name="autoProvisionDomains"
            rows={2}
            defaultValue={(tenant.autoProvisionDomains ?? []).join("\n")}
            placeholder="futbalsfz.sk&#10;sfzmarketing.sk"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">
            Jedna na riadok. Kto sa prihlási <strong>pracovným kontom</strong> z tejto
            domény a v zozname osôb ešte nie je, založí sa sám ako bežný člen —
            bez rolí a bez trás. Platí len pre kontá, nie pre odkaz v e-maile:
            konto z adresára organizácie je dôkaz príslušnosti, napísaná adresa nie.
            Prázdne = nikoho nezakladať.
          </span>
        </label>

        <button className="tlacidlo" type="submit">Uložiť</button>
      </form>

      {/* Prihlasovacie údaje sú medzi úpravou a vypnutím zámerne: patria
          k zavedeniu zákazníka, nie k jeho dennému nastaveniu. */}
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <Poskytovatel tenant={tenant} provider="microsoft" domena={tenant.hostnames[0]} />
        <Poskytovatel tenant={tenant} provider="google" domena={tenant.hostnames[0]} />
      </div>

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

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Audit</h2>
        <p className="tichy" style={{ fontSize: 14, margin: "0 0 12px" }}>
          Posledných 50 správcovských zmien tejto organizácie. Celý výpis
          s hľadaním má zákazník na svojej doméne v nastavení organizácie.
        </p>
        <AuditVypis zaznamy={zaznamy} />
      </section>
    </div>
  )
}
