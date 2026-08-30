/**
 * Nastavenie organizácie — na doméne zákazníka (D48).
 *
 * Čo tu **je**: vzhľad, jazyky, vlastné prihlasovacie údaje, domény
 * s overením a domény pre automatické zakladanie.
 *
 * Čo tu **nie je**: vypnutie organizácie a jej kód. To sú veci medzi
 * zákazníkom a nami a zostávajú v `/admin`, kde má správca platformy naďalej
 * plnú správu všetkých organizácií — kvôli podpore a helpdesku.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { organizaciaContext } from "@/lib/orgSettings"
import { ziadosti, pokynPreDomenu } from "@/lib/customerDomains"
import { stavPoskytovatela, NAZOV_POSKYTOVATELA, ID_POSKYTOVATELA } from "@/lib/oauth"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { UI_LANGUAGES, formatDate } from "@/lib/i18n"
import Vyber from "@/components/Select"
import VyberFarby from "@/components/ColorSelect"
import Oznam from "@/components/Notice"
import { ulozVzhlad, ulozPrihlasenie, zmazPrihlasenie, poziadaj, overDomenu, zrus } from "./akcie"
import { zalozUtvar, premenujUtvar, presunUtvar, zrusUtvar } from "./akcie"
import { pridajDoCiselnika, odoberZCiselnika, ulozClenenie, preindexujVsetkyAkcia } from "./akcie"
import { posunOddelenieAkcia, ulozPoradieAkcia } from "./akcie"
import StromSPoradim from "@/components/TreeWithOrder"
import { stavPreindexovania } from "@/lib/libraryWrite"
import { PREDVOLENY_PROFIL } from "@/lib/chunker.mjs"
import { POPIS_CISELNIKA, ponuka, vlastnePolozky, pouzitie } from "@/lib/codelistsTenant"
import { preloz } from "@/lib/urlTabs"
import { VLASTNE_CISELNIKY } from "@/lib/codelists"
import { vsetkyOddelenia, splostiStrom, podstrom, pocty, MAX_HLBKA, hlbka } from "@/lib/departments"
import { auditZaznamy } from "@/lib/audit"
import AuditVypis from "@/components/AuditList"
import type { OAuthProviderName } from "@/lib/oauth"
import type { Tenant } from "@/lib/tenants"

const ZALOZKY = [
  { kluc: "vzhlad", popis: "Vzhľad a jazyky" },
  { kluc: "oddelenia", popis: "Oddelenia" },
  { kluc: "domeny", popis: "Domény" },
  { kluc: "prihlasenie", popis: "Prihlasovanie" },
  { kluc: "ciselniky", popis: "Číselníky" },
  { kluc: "clenenie", popis: "Členenie" },
  { kluc: "audit", popis: "Audit" },
]

export const dynamic = "force-dynamic"

const JAZYKY: Record<string, string> = {
  sk: "slovenčina",
  cs: "čeština",
  en: "angličtina",
}

function Poskytovatel({
  tenant, provider, domena,
}: {
  tenant: Tenant
  provider: OAuthProviderName
  domena?: string
}) {
  const nazov = NAZOV_POSKYTOVATELA[provider]
  const s = stavPoskytovatela(tenant, provider)
  const navrat = `https://${domena ?? "<vaša doména>"}/api/auth/callback/${ID_POSKYTOVATELA[provider]}`

  return (
    <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Prihlásenie cez {nazov}</h2>
        <span
          className="stitok"
          style={s.stav === "necitatelne" ? { background: "var(--warn-bg)", color: "var(--warn-fg)" } : undefined}
        >
          {s.stav === "nastavene" ? "zapnuté"
            : s.stav === "z-prostredia" ? "z nastavenia dodávateľa"
            : s.stav === "necitatelne" ? "nečitateľné" : "vypnuté"}
        </span>
      </div>

      <p className="tichy" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        Aplikáciu si zaregistrujete <strong>vo vlastnom {nazov} adresári</strong> — vy
        udeľujete súhlas, vy vidíte, kto sa prihlasoval, a vy viete prístup
        kedykoľvek odvolať. My hodnotu tajomstva nikdy nevidíme.
      </p>

      <div>
        <div className="tichy pole-napoveda">
          Adresa návratu — zapíšte ju do svojej aplikácie presne takto:
        </div>
        <code style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>{navrat}</code>
      </div>

      <form action={ulozPrihlasenie} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="zalozka" value="prihlasenie" />

        <label className="pole">
          <span className="pole-popis">Client ID</span>
          <input className="pole-vstup" name="clientId" defaultValue={s.zdroj === "tenant" ? s.clientId : ""} />
        </label>

        <label className="pole">
          <span className="pole-popis">Client secret</span>
          <input className="pole-vstup" name="clientSecret" type="password" />
          <span className="tichy pole-napoveda">
            Prázdne = nemeniť. Ukladá sa zašifrované a späť sa nikdy nevypíše.
          </span>
        </label>

        {provider === "microsoft" ? (
          <>
            <label className="pole">
              <span className="pole-popis">Režim tenanta</span>
              <input
                className="pole-vstup"
                name="tenantMode"
                defaultValue={tenant.oauth?.microsoft?.tenantMode ?? "organizations"}
              />
              <span className="tichy pole-napoveda">
                Pri aplikácii pre jediný adresár sem patrí vaše <strong>Directory
                (tenant) ID</strong>. `organizations` = pracovné a školské kontá
                odkiaľkoľvek, `common` = aj osobné.
              </span>
            </label>
            <label className="pole">
              <span className="pole-popis">Povolené Entra tenant id</span>
              <input
                className="pole-vstup"
                name="allowedTenantIds"
                defaultValue={(tenant.oauth?.microsoft?.allowedTenantIds ?? []).join(", ")}
              />
              <span className="tichy pole-napoveda">
                Prázdne = nekontroluje sa. Pri režime `organizations` je to jediná
                zábrana proti tomu, aby sa dnu dostal človek z cudzej organizácie,
                ktorý má rovnakú adresu ako niekto u vás.
              </span>
            </label>
          </>
        ) : (
          <label className="pole">
            <span className="pole-popis">Doména Workspace</span>
            <input
              className="pole-vstup"
              name="hostedDomain"
              defaultValue={tenant.oauth?.google?.hostedDomain ?? ""}
            />
          </label>
        )}

        <div><button className="tlacidlo" type="submit">Uložiť</button></div>
      </form>

      {s.zdroj === "tenant" && (
        <form action={zmazPrihlasenie} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="zalozka" value="prihlasenie" />
          <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
            Odstránením zmizne tlačidlo z prihlasovacej obrazovky. Ľuďom, ktorí
            sa prihlasujú pracovným kontom, tým prestane fungovať jediná cesta,
            ktorú poznajú.
          </p>
          <label className="pole">
            <span className="pole-popis">Napíšte {tenant.companyCode} na potvrdenie</span>
            <input className="pole-vstup" name="potvrdenie" autoCapitalize="characters" autoCorrect="off" />
          </label>
          <div><button className="tlacidlo tlacidlo--tiche" type="submit">Odstrániť</button></div>
        </form>
      )}
    </section>
  )
}

export default async function Organizacia({
  searchParams,
}: {
  searchParams: Promise<{ sprava?: string; chyba?: string; zalozka?: string; hladat?: string }>
}) {
  const ctx = await organizaciaContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { sprava, chyba, zalozka, hladat } = await searchParams
  // Záložka je v adrese, nie v klientskom stave: dá sa poslať odkazom,
  // vrátiť sa naň z histórie a funguje bez jediného riadku JavaScriptu.
  // `strom` je starý kľúč tejto záložky. Odkazy s ním existujú v e-mailoch
  // aj v záložkách prehliadača — presmerovať by ich rozbilo, tak sa len
  // preloží. Zmizne, keď prestane chodiť.
  const kluc = preloz(zalozka)
  const teraz = ZALOZKY.some(z => z.kluc === kluc) ? kluc! : "vzhlad"
  const tenant = ctx.tenant
  const branding = brandingView(tenant)
  const jazyk = ctx.person.language
  const cakajuce = (await ziadosti(tenant.companyCode)).filter(
    z => !tenant.hostnames.includes(z.host),
  )

  // Strom sa načítava len pre svoju záložku. Na ostatných by to bol dotaz
  // navyše za nič.
  const oddeleniaTenanta = teraz === "oddelenia" ? await vsetkyOddelenia(tenant.companyCode) : []
  const riadky = teraz === "oddelenia" ? splostiStrom(oddeleniaTenanta) : []
  const koliOsob = teraz === "oddelenia" ? await pocty(tenant.companyCode) : new Map()
  // Počty použití sa čítajú len pre svoju záložku — inak by to boli dva
  // dotazy na dokumenty pri každom otvorení nastavenia.
  const ciselniky = teraz === "ciselniky"
    ? await Promise.all(VLASTNE_CISELNIKY.map(async nazov => ({
        nazov,
        vsetky: ponuka(tenant, nazov),
        vlastne: vlastnePolozky(tenant, nazov),
        pocty: Object.fromEntries(
          await Promise.all(
            vlastnePolozky(tenant, nazov).map(async p =>
              [p.key, await pouzitie(tenant.companyCode, nazov, p.key)] as const),
          ),
        ) as Record<string, number>,
      })))
    : []

  // Koľko dokumentov by nový profil narezal inak. Počíta sa naozajstným
  // narezaním — odhad by pri zmene parametra nevedel povedať, či na tomto
  // obsahu vôbec niečo spraví.
  const stavIndexu = teraz === "clenenie"
    ? await stavPreindexovania(tenant.companyCode, tenant.chunkovanie)
    : null

  const zaznamy = teraz === "audit"
    ? await auditZaznamy(tenant.companyCode, { hladat, limit: 200 })
    : []

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 720, ...tenantStyle(branding) }}>
      <Oznam
        sprava={sprava}
        chyba={chyba === "1"}
        spat={`/organizacia?zalozka=${teraz}`}
      />

      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Organizácia</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 22px", maxWidth: 620 }}>
        Nastavenie, ktoré si spravujete sami. Kód organizácie
        (<strong>{tenant.companyCode}</strong>) a vypnutie portálu tu zámerne nie sú —
        s tým sa ozvite nám.
      </p>

      {/* Záložky, nie jeden dlhý stĺpec. Blokov je päť a na telefóne to
          znamenalo, že sa k prihlasovaniu človek dostal až po dvoch
          obrazovkách posúvania cez veci, ktoré nehľadal. */}
      <nav className="zalozky" aria-label="Časti nastavenia">
        {ZALOZKY.map(z => (
          <Link
            key={z.kluc}
            href={`/organizacia?zalozka=${z.kluc}`}
            className={`zalozka${z.kluc === teraz ? " je-aktivna" : ""}`}
            aria-current={z.kluc === teraz ? "page" : undefined}
          >
            {z.popis}
          </Link>
        ))}
      </nav>

      {teraz === "vzhlad" && (
      <form action={ulozVzhlad} className="karta" style={{ padding: 20, display: "grid", gap: 16 }} encType="multipart/form-data">
        <input type="hidden" name="zalozka" value="vzhlad" />

        <label className="pole">
          <span className="pole-popis">Názov</span>
          <input className="pole-vstup" name="displayName" defaultValue={tenant.branding.displayName} required />
          <span className="tichy pole-napoveda">Celý názov. Je v e-mailoch a na prihlasovacej obrazovke.</span>
        </label>

        <label className="pole">
          <span className="pole-popis">Skratka</span>
          <input className="pole-vstup" name="shortName" defaultValue={tenant.branding.shortName ?? ""} />
          <span className="tichy pole-napoveda">
            Do hornej lišty, kde je vedľa nej ešte menu — &bdquo;SFZ&ldquo; tam povie to isté
            čo celý názov a nechá miesto na zvyšok.
          </span>
        </label>

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
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Farba</span>
          <VyberFarby meno="accentColor" hodnota={tenant.branding.accentColor} />
          <span className="tichy pole-napoveda">
            Nesie ju tlačidlo s bielym textom, preto sú odtiene tmavšie, než by
            sa chcelo — svetlejší tón znamená nečitateľné tlačidlo.
          </span>
        </div>

        <label className="pole">
          <span className="pole-popis">Kontaktná adresa</span>
          <input className="pole-vstup" name="supportEmail" type="email" defaultValue={tenant.branding.supportEmail ?? ""} />
          <span className="tichy pole-napoveda">Kam sa má obrátiť človek, ktorému niečo nesedí.</span>
        </label>

        <fieldset className="hr-skupina" style={{ border: "1px solid var(--line)" }}>
          <legend className="pole-popis">Jazyky</legend>
          <div className="stitky-zoznam">
            {UI_LANGUAGES.map(j => (
              <label key={j} className="stitok stitok--volba stitok--pole">
                <input type="checkbox" name="languages" value={j} defaultChecked={tenant.languages.includes(j)} />
                <span className="stitok-znak" aria-hidden="true" />
                {JAZYKY[j] ?? j}
              </label>
            ))}
          </div>
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
            bez rolí a bez trás. Platí len pre kontá, nie pre odkaz v e-maile.
          </span>
        </label>

        <div><button className="tlacidlo" type="submit">Uložiť</button></div>
      </form>
      )}

      {teraz === "oddelenia" && (
      <div style={{ display: "grid", gap: 16 }}>
        <section className="karta" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Organizačná štruktúra</h2>
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
              Poradie sa dá meniť ťahaním myšou alebo šípkami po rozbalení položky —
            organizačná schéma nie je abecedný zoznam.{" "}
            Oddelenie je <strong>kam človek patrí</strong> — práve jeden, ako v organizačnej
              schéme. Kto sa má osloviť naprieč oddeleniami (rozhodcovia, delegáti,
              štatutári), na to sú <Link href="/osoby">skupiny</Link>; tie sa s oddeleniami
              nemiešajú a jeden človek ich môže mať viac.
            </p>
          </div>

          {riadky.length === 0 ? (
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
              Zatiaľ tu nie je nič. Založ prvé oddelenie nižšie — ak už máte oddelenia
              zapísané pri ľuďoch ako text, ozvite sa nám a prevedieme ich naraz.
            </p>
          ) : (
            <StromSPoradim
              skryte={{ zalozka: "oddelenia" }}
              akcia={ulozPoradieAkcia}
              polozky={riadky.map(({ oddelenie, uroven }) => {
                const p = koliOsob.get(oddelenie.id) ?? { priamo: 0, sPodriadenymi: 0 }
                const pod = podstrom(oddeleniaTenanta, oddelenie.id)
                return {
                  id: oddelenie.id,
                  nazov: oddelenie.nazov,
                  parentId: oddelenie.parentId ?? null,
                  uroven,
                  obsah: (
                    <details>
                      <summary className="strom-riadok">
                        <span className="strom-uchop" aria-hidden="true">⠿</span>
                        <span className="strom-nazov">{oddelenie.nazov}</span>
                        <span className="tichy strom-pocet">
                          {p.priamo}
                          {p.sPodriadenymi !== p.priamo ? ` (${p.sPodriadenymi} aj s podriadenými)` : ""}
                        </span>
                      </summary>

                      <div className="strom-uprava">
                        {/* Posun o jedno miesto — obyčajné tlačidlá. Ťahanie
                            myšou robí to isté, ale toto funguje aj bez
                            JavaScriptu, klávesnicou a na telefóne. */}
                        <div className="strom-sipky">
                          <form action={posunOddelenieAkcia}>
                            <input type="hidden" name="zalozka" value="oddelenia" />
                            <input type="hidden" name="id" value={oddelenie.id} />
                            <input type="hidden" name="smer" value="hore" />
                            <button className="tlacidlo tlacidlo--tiche" type="submit"
                                    aria-label={`Posunúť ${oddelenie.nazov} vyššie`}>↑ vyššie</button>
                          </form>
                          <form action={posunOddelenieAkcia}>
                            <input type="hidden" name="zalozka" value="oddelenia" />
                            <input type="hidden" name="id" value={oddelenie.id} />
                            <input type="hidden" name="smer" value="dole" />
                            <button className="tlacidlo tlacidlo--tiche" type="submit"
                                    aria-label={`Posunúť ${oddelenie.nazov} nižšie`}>↓ nižšie</button>
                          </form>
                        </div>

                        <form action={premenujUtvar} className="strom-forma">
                          <input type="hidden" name="zalozka" value="oddelenia" />
                          <input type="hidden" name="id" value={oddelenie.id} />
                          <input
                            className="pole-vstup"
                            name="nazov"
                            defaultValue={oddelenie.nazov}
                            aria-label={`Názov oddelenia ${oddelenie.nazov}`}
                            required
                          />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">Premenovať</button>
                        </form>

                        <form action={presunUtvar} className="strom-forma">
                          <input type="hidden" name="zalozka" value="oddelenia" />
                          <input type="hidden" name="id" value={oddelenie.id} />
                          <Vyber
                            meno="parentId"
                            predvolena={oddelenie.parentId ?? ""}
                            popisPola={`Nadriadené oddelenie pre ${oddelenie.nazov}`}
                            volby={[
                              { hodnota: "", popis: "— najvyššia úroveň —" },
                              ...riadky
                                // Pod seba ani pod vlastného potomka sa presunúť
                                // nedá, tak sa to ani neponúka. Pravidlo aj tak
                                // platí na serveri — toto len šetrí človeku chybu.
                                .filter(r => !pod.has(r.oddelenie.id))
                                .map(r => ({
                                  hodnota: r.oddelenie.id,
                                  popis: `${"— ".repeat(r.uroven - 1)}${r.oddelenie.nazov}`,
                                })),
                            ]}
                          />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">Presunúť</button>
                        </form>

                        {p.sPodriadenymi === 0 && pod.size === 1 ? (
                          <form action={zrusUtvar}>
                            <input type="hidden" name="zalozka" value="oddelenia" />
                            <input type="hidden" name="id" value={oddelenie.id} />
                            <button className="tlacidlo tlacidlo--tiche" type="submit">Zrušiť oddelenie</button>
                          </form>
                        ) : (
                          <p className="tichy" style={{ fontSize: 13, margin: 0 }}>
                            Zrušiť sa dá až prázdne oddelenie bez podriadených — inak by
                            ľudia zmizli zo štruktúry bez toho, aby si to niekto všimol.
                          </p>
                        )}
                      </div>
                    </details>
                  ),
                }
              })}
            />
          )}
        </section>

        <form action={zalozUtvar} className="karta" style={{ padding: 20, display: "grid", gap: 14 }}>
          <input type="hidden" name="zalozka" value="oddelenia" />
          <h2 style={{ fontSize: 17, margin: 0 }}>Nové oddelenie</h2>

          <label className="pole">
            <span className="pole-popis">Názov</span>
            <input className="pole-vstup" name="nazov" placeholder="Úsek komunikácie" required />
          </label>

          <label className="pole">
            <span className="pole-popis">Nadriadené oddelenie</span>
            <Vyber
              meno="parentId"
              predvolena=""
              volby={[
                { hodnota: "", popis: "— najvyššia úroveň —" },
                ...riadky
                  // Hlbšie než povolené sa založiť nedá, tak sa to neponúka.
                  .filter(r => hlbka(oddeleniaTenanta, r.oddelenie.id) < MAX_HLBKA)
                  .map(r => ({
                    hodnota: r.oddelenie.id,
                    popis: `${"— ".repeat(r.uroven - 1)}${r.oddelenie.nazov}`,
                  })),
              ]}
            />
            <span className="tichy pole-napoveda">
              Štruktúra môže mať najviac {MAX_HLBKA} úrovní. Nie je to technický
              limit — hlbší strom sa na telefóne nedá prehľadne ukázať a to, čo
              je v ňom najhlbšie, býva v skutočnosti skupina.
            </span>
          </label>

          <div><button className="tlacidlo" type="submit">Založiť</button></div>
        </form>
      </div>
      )}

      {teraz === "domeny" && (
      <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>

        <ul className="admin-domeny">
          {tenant.hostnames.map(h => (
            <li key={h} className="karta" style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{h}</span>
              <span className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>funguje</span>
              {tenant.hostnames.length > 1 && (
                <form action={zrus} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="host" value={h} />
                  <input type="hidden" name="zalozka" value="domeny" />
                  <button className="tlacidlo tlacidlo--tiche" type="submit" style={{ padding: "5px 10px", fontSize: 13 }}>
                    Odstrániť
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {cakajuce.length > 0 && (
          <ul className="admin-domeny">
            {cakajuce.map(z => {
              const p = pokynPreDomenu(z.host)
              return (
                <li key={z.host} className="karta" style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{z.host}</span>
                    <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                      čaká na DNS
                    </span>
                    <span className="tichy" style={{ fontSize: 13, marginLeft: "auto" }}>
                      od {formatDate(z.requestedAt, jazyk)}
                    </span>
                  </div>

                  {p && (
                    <p className="tichy" style={{ margin: 0, fontSize: 13.5, overflowWrap: "anywhere" }}>
                      U svojho správcu DNS pridajte <strong>{p.typ}</strong> záznam{" "}
                      <code>{p.nazov}</code> → <code>{p.hodnota}</code>
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={overDomenu}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="zalozka" value="domeny" />
                      <button className="tlacidlo" type="submit" style={{ padding: "6px 14px", fontSize: 13.5 }}>
                        Overiť a zapnúť
                      </button>
                    </form>
                    <form action={zrus}>
                      <input type="hidden" name="host" value={z.host} />
                      <input type="hidden" name="zalozka" value="domeny" />
                      <button className="tlacidlo tlacidlo--tiche" type="submit" style={{ padding: "6px 14px", fontSize: 13.5 }}>
                        Zrušiť žiadosť
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <form action={poziadaj} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="zalozka" value="domeny" />
          <label className="pole">
            <span className="pole-popis">Pridať vlastnú doménu</span>
            <input className="pole-vstup" name="host" placeholder="intranet.vasazorganizacia.sk" autoCapitalize="none" autoCorrect="off" />
            <span className="tichy pole-napoveda">
              Doména sa zapne až vtedy, keď na nás začne smerovať DNS. Nastaviť to
              vie len ten, kto ju naozaj ovláda — a je to jediný dôkaz, ktorý
              existuje. Bez neho by si ktokoľvek mohol pripísať cudziu doménu.
            </span>
          </label>
          <div><button className="tlacidlo tlacidlo--tiche" type="submit">Požiadať</button></div>
        </form>
      </section>
      )}

      {teraz === "prihlasenie" && (
      <div style={{ display: "grid", gap: 16 }}>
        <Poskytovatel tenant={tenant} provider="microsoft" domena={tenant.hostnames[0]} />
        <Poskytovatel tenant={tenant} provider="google" domena={tenant.hostnames[0]} />
      </div>
      )}

      {teraz === "ciselniky" && (
      <div style={{ display: "grid", gap: 16 }}>
        <p className="tichy" style={{ fontSize: 14.5, margin: 0, maxWidth: 620 }}>
          Čím označujete vlastný obsah v knižnici. Základné hodnoty sú tu vždy —
          je nimi označený existujúci obsah a ich zmiznutie by z neho spravilo
          neplatné údaje. Odobrať sa dá len to, čo ste pridali vy, a aj vtedy
          zmizne <strong>len z ponuky</strong>: dokumenty, ktoré hodnotu majú,
          si ju nesú ďalej.
        </p>

        {ciselniky.map(c => (
          <section key={c.nazov} className="karta" style={{ padding: 20, display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{POPIS_CISELNIKA[c.nazov].nazov}</h2>
              <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
                {POPIS_CISELNIKA[c.nazov].napoveda}
              </p>
            </div>

            <ul className="strom">
              {c.vsetky.map(p => {
                const vlastna = c.vlastne.some(v => v.key === p.key)
                return (
                  <li key={p.key} className="strom-polozka">
                    <div className="strom-riadok">
                      <span className="strom-nazov">{p.label ?? p.key}</span>
                      <span className="tichy strom-pocet">
                        <code>{p.key}</code>
                        {!vlastna && " · základná"}
                        {vlastna && c.pocty[p.key] > 0 && ` · použitá ${c.pocty[p.key]}×`}
                      </span>
                      {vlastna && (
                        <form action={odoberZCiselnika} style={{ marginLeft: "auto" }}>
                          <input type="hidden" name="zalozka" value="ciselniky" />
                          <input type="hidden" name="ciselnik" value={c.nazov} />
                          <input type="hidden" name="kluc" value={p.key} />
                          <button className="tlacidlo tlacidlo--tiche" type="submit">Odobrať</button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <form action={pridajDoCiselnika} className="strom-forma">
              <input type="hidden" name="zalozka" value="ciselniky" />
              <input type="hidden" name="ciselnik" value={c.nazov} />
              <input className="pole-vstup" name="popis" placeholder="Metodický pokyn"
                     aria-label={`Názov novej položky — ${POPIS_CISELNIKA[c.nazov].nazov}`} required />
              <input className="pole-vstup" name="kluc" placeholder="metodicky_pokyn"
                     aria-label="Kľúč" autoCapitalize="none" autoCorrect="off" required
                     style={{ maxWidth: 220 }} />
              <button className="tlacidlo tlacidlo--tiche" type="submit">Pridať</button>
            </form>

            <p className="tichy" style={{ fontSize: 13, margin: 0 }}>
              Kľúč: malé písmená bez diakritiky, číslice a podčiarkovník. Zostáva v obsahu
              natrvalo, takže sa nedá vziať späť — názov vedľa neho sa meniť dá.
            </p>
          </section>
        ))}
      </div>
      )}

      {teraz === "clenenie" && (
      <form action={ulozClenenie} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="zalozka" value="clenenie" />

        <div>
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Členenie dokumentov na úseky</h2>
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Vyhľadávanie nepracuje s celým dokumentom — model dostane niekoľko úsekov
            a odpovedá z nich. Tieto hodnoty určujú, ako sa dokument na úseky reže.
            <strong> S textom normy ani s potvrdeniami to nemá nič spoločné:</strong> členenie
            sa dá meniť koľkokrát treba a nikomu nenaskočí povinnosť potvrdzovať znova.
          </p>
        </div>

        <label className="pole">
          <span className="pole-popis">Slovo, ktorým začína článok</span>
          <input className="pole-vstup" name="slovoClanok"
                 defaultValue={tenant.chunkovanie?.slovoClanok ?? PREDVOLENY_PROFIL.slovoClanok} />
          <span className="tichy pole-napoveda">
            Predvolene <code>Článok</code>. Predpisy členené na <code>§</code> alebo na
            <code> Bod</code> sa bez tejto zmeny zlejú do jedného bloku a vyhľadávanie
            nemá čoho chytiť. Je to <strong>slovo, nie vzor</strong> — okolie si doplní systém.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Slovo, ktorým začína príloha</span>
          <input className="pole-vstup" name="slovoPriloha"
                 defaultValue={tenant.chunkovanie?.slovoPriloha ?? PREDVOLENY_PROFIL.slovoPriloha} />
          <span className="tichy pole-napoveda">
            Prílohy stoja mimo číslovania článkov — bez rozpoznania by spadli pod posledný
            článok a citácia by klamala.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Riadok je hlavička, keď sa opakuje viac ráz než</span>
          <input className="pole-vstup" type="number" name="opakovaniHlavicky" min={2} max={50}
                 defaultValue={tenant.chunkovanie?.opakovaniHlavicky ?? PREDVOLENY_PROFIL.opakovaniHlavicky} />
          <span className="tichy pole-napoveda">
            Hlavičky a päty sa v PDF opakujú na každej strane. Nižšie číslo odstráni viac
            šumu, ale pri krátkom dokumente môže zožrať aj obsah.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Cieľová veľkosť úseku — od (tokenov)</span>
          <input className="pole-vstup" type="number" name="cielMinTokenov" min={50} max={2000}
                 defaultValue={tenant.chunkovanie?.cielMinTokenov ?? PREDVOLENY_PROFIL.cielMinTokenov} />
        </label>

        <label className="pole">
          <span className="pole-popis">Cieľová veľkosť úseku — do (tokenov)</span>
          <input className="pole-vstup" type="number" name="cielMaxTokenov" min={100} max={4000}
                 defaultValue={tenant.chunkovanie?.cielMaxTokenov ?? PREDVOLENY_PROFIL.cielMaxTokenov} />
          <span className="tichy pole-napoveda">
            Malý úsek znamená tisíce úryvkov bez kontextu, veľký zas jeden úsek na celý
            dokument. Predvolené <code>300–800</code> je odladené na slovenských predpisoch.
          </span>
        </label>

        <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
          Uloženie <strong>nepreindexuje existujúce dokumenty</strong>. Vyskúšaj nový profil
          najprv na jednom — v jeho detaile v knižnici je tlačidlo <em>Preindexovať</em>.
        </p>

        <div><button className="tlacidlo" type="submit">Uložiť členenie</button></div>
      </form>
      )}

      {teraz === "clenenie" && stavIndexu && (
      <form action={preindexujVsetkyAkcia} className="karta" style={{ padding: 20, display: "grid", gap: 12, marginTop: 16 }}>
        <input type="hidden" name="zalozka" value="clenenie" />
        <h2 style={{ fontSize: 17, margin: 0 }}>Preindexovať všetko</h2>

        {stavIndexu.neaktualnych === 0 ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Všetkých {stavIndexu.celkom} dokumentov je narezaných podľa tohto profilu.
            Niet čo preindexovať.
          </p>
        ) : (
          <>
            <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
              <strong>{stavIndexu.neaktualnych}</strong> z {stavIndexu.celkom} dokumentov je
              narezaných inak, než hovorí tento profil. Preindexovanie <strong>nemení znenia
              ani potvrdenia</strong> — vymení len úseky, z ktorých číta vyhľadávanie.
            </p>
            <p className="tichy" style={{ fontSize: 13, margin: 0 }}>
              Spracuje sa najviac 25 dokumentov naraz. Nie je to opatrnosť navyše: pri
              väčšej dávke by beh spadol na časovom strope a časť dokumentov by zostala
              narezaná po starom. Keď niečo zostane, stlač to znova — hotové sa preskočia.
            </p>
            <div><button className="tlacidlo" type="submit">Preindexovať ({stavIndexu.neaktualnych})</button></div>
          </>
        )}
      </form>
      )}

      {teraz === "audit" && (
      <div>
        <p className="tichy" style={{ fontSize: 14.5, margin: "0 0 16px", maxWidth: 620 }}>
          Kto, čo a kedy zmenil. Zapisuje sa každá správcovská zmena — rola,
          prístup, oddelenie, pridelenie aj nastavenie organizácie. Záznamy sa
          <strong> nedajú upraviť ani zmazať</strong>; to je celý zmysel.
          Tajomstvá (napr. klientsky secret) sú tu len ako &bdquo;zmenené&ldquo; —
          audit, ktorý zbiera heslá, je sám o sebe únik.
        </p>

        {/* Formulár metódou GET: filter je v adrese, dá sa poslať odkazom
            a funguje bez jediného riadku JavaScriptu. */}
        <form className="audit-filter" method="get">
          <input type="hidden" name="zalozka" value="audit" />
          <label className="pole" style={{ flex: "1 1 260px", margin: 0 }}>
            <span className="pole-popis">Hľadať</span>
            <input
              className="pole-vstup"
              name="hladat"
              defaultValue={hladat ?? ""}
              placeholder="meno, adresa, oddelenie…"
              autoCapitalize="none"
            />
          </label>
          <button className="tlacidlo tlacidlo--tiche" type="submit">Hľadať</button>
          {hladat ? (
            <Link className="tichy" href="/organizacia?zalozka=audit" style={{ fontSize: 14 }}>
              zrušiť filter
            </Link>
          ) : null}
        </form>

        <AuditVypis zaznamy={zaznamy} jazyk={jazyk} />

        {zaznamy.length >= 200 && (
          <p className="tichy" style={{ fontSize: 13, marginTop: 14 }}>
            Ukazuje sa najnovších 200 záznamov. Staršie sa dajú vyhľadať poľom vyššie —
            načítať ich všetky naraz by obrazovku zhodilo práve vtedy, keď ju
            niekto otvorí kvôli kontrole.
          </p>
        )}
      </div>
      )}
    </div>
  )
}
