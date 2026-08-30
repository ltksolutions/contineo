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
import { peopleContext, loadPersonById, ASSIGNABLE_ROLES } from "@/lib/people"
import { audiencesInOrg } from "@/lib/persons"
import { allDepartments, flattenTree, pathTo } from "@/lib/departments"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import Notice from "@/components/Notice"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, UI_LANGUAGES } from "@/lib/i18n"
import { savePersonAction, togglePersonStatusAction } from "../actions"

export const dynamic = "force-dynamic"

const TYPY = [
  { hodnota: "employee", popis: "zamestnanec" },
  { hodnota: "external", popis: "externý" },
  { hodnota: "referee", popis: "rozhodca" },
  { hodnota: "official", popis: "funkcionár" },
]

/** Kód jazyka sám o sebe nepovie nič — „sk" je pre nás jasné, pre iných nie. */
const JAZYKY: Record<string, string> = {
  sk: "slovenčina",
  cs: "čeština",
  en: "angličtina",
}

const POPIS_ROLY: Record<string, string> = {
  hr: "hr — prideľuje normy a vidí, kto ich nepotvrdil",
  "people-admin": "people-admin — spravuje osoby (táto obrazovka)",
  "spravca-obsahu": "spravca-obsahu — nahráva a upravuje normy v knižnici",
}

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sprava?: string; chyba?: string }>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { sprava, chyba } = await searchParams
  const o = await loadPersonById(ctx.person.companyCode, id)
  // Neexistuje vs. patrí inej organizácii je zámerne tá istá odpoveď (D32).
  if (!o) notFound()

  // Zoznam sa odvodzuje z ľudí, nie z číselníka (D38) — a je to ten istý
  // zoznam, aký vidí prideľovanie noriem.
  const publika = await audiencesInOrg(ctx.person.companyCode)
  const strom = await allDepartments(ctx.person.companyCode)
  const stromRiadky = flattenTree(strom)
  // Celá cesta, nie len vlastné oddelenie: „Oddelenie sociálnych sietí" samo
  // o sebe nepovie, pod koho patrí, a práve to rozhoduje o tom, ktoré
  // pridelenia sa človeka týkajú.
  const zaradenie = pathTo(strom, o.departmentId)

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
        {o.emailHistory.length > 0 && (
          <> · predtým {o.emailHistory.map(h => h.email).join(", ")}</>
        )}
      </p>
      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
        {o.status === "invited" ? "pozvaná, ešte sa neprihlásila"
          : o.status === "inactive" ? "vyradená — neprihlási sa"
          : `naposledy ${o.lastLoginAt ? formatDate(o.lastLoginAt, jazyk) : "—"}`}
        {o.konta.length > 0 && ` · prihlasuje sa cez ${o.konta.join(", ")}`}
      </p>

      <Notice sprava={sprava} chyba={chyba === "1"} spat={`/osoby/${encodeURIComponent(id)}`} />

      <form action={savePersonAction} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={o.id} />

        <label className="pole">
          <span className="pole-popis">E-mailová adresa</span>
          <input
            className="pole-vstup"
            name="email"
            type="email"
            defaultValue={o.email}
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">
            Zmeniť sa dá — identita človeka na nej nestojí. Potvrdenia sa viažu
            na jeho záznam, nie na adresu, takže história zostáva celá a stará
            adresa sa uloží do jeho histórie. Zmení sa tým to, kam chodí
            prihlasovací odkaz; prihlásenie pracovným kontom funguje ďalej.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Meno</span>
          <input className="pole-vstup" name="fullName" defaultValue={o.fullName} required />
        </label>

        <label className="pole">
          <span className="pole-popis">Pozícia</span>
          <input className="pole-vstup" name="jobTitle" defaultValue={o.jobTitle ?? ""} />
          <span className="tichy pole-napoveda">
            Evidenčný údaj. Dopĺňa sa z pracovného konta, keď ho tam adresár má —
            ale len keď je tu prázdny, takže ručná oprava vydrží.
          </span>
        </label>

        <div className="pole">
          <span className="pole-popis">Oddelenie</span>
          <Select
            meno="departmentId"
            popisPola="Oddelenie"
            predvolena={o.departmentId ?? ""}
            volby={[
              { hodnota: "", popis: "— bez oddelenia —" },
              ...stromRiadky.map(r => ({
                hodnota: r.oddelenie.id,
                popis: `${"— ".repeat(r.uroven - 1)}${r.oddelenie.nazov}`,
              })),
            ]}
          />
          <span className="tichy pole-napoveda">
            {stromRiadky.length === 0 ? (
              <>
                Štruktúra je zatiaľ prázdna. Oddelenia sa zakladajú
                v <Link href="/organizacia?zalozka=oddelenia">nastavení organizácie</Link>.
              </>
            ) : (
              <>
                Práve jedno — oddelenie je miesto v štruktúre. Kto sa má osloviť
                naprieč oddeleniami, na to sú skupiny nižšie.
                {zaradenie.length > 1 ? ` Zaradenie: ${zaradenie.map(x => x.nazov).join(" › ")}.` : ""}
              </>
            )}
          </span>
        </div>

        {o.department && !o.departmentId ? (
          <p className="tichy" style={{ fontSize: 13, margin: "-6px 0 0" }}>
            Pôvodne tu bolo zapísané textom: <strong>{o.department}</strong>. Ostáva to
            uložené, kým sa nezaradí do štruktúry — aby bolo vidieť, z čoho oddelenie vznikol.
          </p>
        ) : null}

        <div className="pole">
          <span className="pole-popis">Typ osoby</span>
          <Select meno="personType" volby={TYPY} predvolena={o.personType} popisPola="Typ osoby" />
          <span className="tichy pole-napoveda">
            Evidenčný údaj. O prístupe k obsahu nerozhoduje — ten rieši organizácia
            a úroveň dokumentu.
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Jazyk prostredia</span>
          <Select
            meno="language"
            volby={UI_LANGUAGES.map(l => ({ hodnota: l, popis: JAZYKY[l] ?? l }))}
            predvolena={o.language}
            popisPola="Jazyk prostredia"
          />
          <span className="tichy pole-napoveda">
            V čom sa s človekom rozprávame. Nie jazyk dokumentov, ktoré číta.
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Skupiny</span>
          <TagSelect
            meno="groups"
            ponuka={publika.skupiny}
            vybrane={o.groups}
            popisNovej="nová skupina, napr. rozhodcovia"
          />
          <span className="tichy pole-napoveda">
            Podľa nich sa prideľujú normy. Číslo je počet ľudí, ktorí skupinu
            majú — skupina, ktorú nemá nikto, nedostane nič.
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Trasy onboardingu</span>
          <TagSelect
            meno="tracks"
            ponuka={publika.trasy}
            vybrane={o.tracks}
            popisNovej="nová trasa, napr. zaklad-2026"
          />
        </div>

        <fieldset className="hr-skupina" style={{ border: "1px solid var(--line)" }}>
          <legend className="pole-popis">Roly</legend>
          <ul className="hr-volby">
            {ASSIGNABLE_ROLES.map(r => (
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

      <form action={togglePersonStatusAction} className="karta" style={{ padding: 20, marginTop: 16, display: "grid", gap: 12 }}>
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
