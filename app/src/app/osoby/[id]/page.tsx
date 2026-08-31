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
import { formatDate, UI_LANGUAGES, dictionary } from "@/lib/i18n"
import { savePersonAction, togglePersonStatusAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const o = await loadPersonById(ctx.person.companyCode, id)
  // Neexistuje vs. patrí inej organizácii je zámerne tá istá odpoveď (D32).
  if (!o) notFound()

  // Zoznam sa odvodzuje z ľudí, nie z číselníka (D38) — a je to ten istý
  // zoznam, aký vidí prideľovanie noriem.
  const audiences = await audiencesInOrg(ctx.person.companyCode)
  const tree = await allDepartments(ctx.person.companyCode)
  const treeRows = flattenTree(tree)
  // Celá cesta, nie len vlastné oddelenie: „Oddelenie sociálnych sietí" samo
  // o sebe nepovie, pod koho patrí, a práve to rozhoduje o tom, ktoré
  // pridelenia sa človeka týkajú.
  const placement = pathTo(tree, o.departmentId)

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const d = dictionary(language).people
  const t = d.detail
  const excluded = o.status === "inactive"

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/osoby" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{o.fullName}</h1>
      <p className="tichy" style={{ fontSize: 14.5, margin: "0 0 4px", overflowWrap: "anywhere" }}>
        {o.email}
        {o.emailHistory.length > 0 && (
          <> · {t.previously(o.emailHistory.map(h => h.email).join(", "))}</>
        )}
      </p>
      <p className="tichy" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
        {o.status === "invited" ? t.invitedNotSignedIn
          : o.status === "inactive" ? t.excludedNoSignIn
          : t.lastSeen(o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.never)}
        {o.accounts.length > 0 && ` · ${t.signsInVia(o.accounts.join(", "))}`}
      </p>

      <Notice message={message} error={error === "1"} back={`/osoby/${encodeURIComponent(id)}`} />

      <form action={savePersonAction} className="karta" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={o.id} />

        <label className="pole">
          <span className="pole-popis">{t.email}</span>
          <input
            className="pole-vstup"
            name="email"
            type="email"
            defaultValue={o.email}
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="tichy pole-napoveda">{t.emailNote}</span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.fullName}</span>
          <input className="pole-vstup" name="fullName" defaultValue={o.fullName} required />
        </label>

        <label className="pole">
          <span className="pole-popis">{t.jobTitle}</span>
          <input className="pole-vstup" name="jobTitle" defaultValue={o.jobTitle ?? ""} />
          <span className="tichy pole-napoveda">{t.jobTitleNote}</span>
        </label>

        <div className="pole">
          <span className="pole-popis">{t.department}</span>
          <Select
            name="departmentId"
            fieldLabel={t.department}
            initial={o.departmentId ?? ""}
            options={[
              { value: "", label: t.departmentNone },
              ...treeRows.map(r => ({
                value: r.department.id,
                label: `${"— ".repeat(r.level - 1)}${r.department.name}`,
              })),
            ]}
          />
          <span className="tichy pole-napoveda">
            {treeRows.length === 0 ? (
              <>
                {t.noDepartmentsBefore}
                <Link href="/organizacia?tab=departments">{t.noDepartmentsLink}</Link>
                {t.noDepartmentsAfter}
              </>
            ) : (
              <>
                {t.departmentNote}
                {placement.length > 1 ? t.placement(placement.map(x => x.name).join(" › ")) : ""}
              </>
            )}
          </span>
        </div>

        {o.department && !o.departmentId ? (
          <p className="tichy" style={{ fontSize: 13, margin: "-6px 0 0" }}>
            {t.legacyDepartmentBefore}<strong>{o.department}</strong>{t.legacyDepartmentAfter}
          </p>
        ) : null}

        <div className="pole">
          <span className="pole-popis">{t.personType}</span>
          <Select
            name="personType"
            options={Object.entries(d.types).map(([value, label]) => ({ value, label }))}
            initial={o.personType}
            fieldLabel={t.personType}
          />
          <span className="tichy pole-napoveda">{t.personTypeNote}</span>
        </div>

        <div className="pole">
          <span className="pole-popis">{t.language}</span>
          <Select
            name="language"
            options={UI_LANGUAGES.map(l => ({ value: l, label: d.languages[l] ?? l }))}
            initial={o.language}
            fieldLabel={t.language}
          />
          <span className="tichy pole-napoveda">{t.languageNote}</span>
        </div>

        <div className="pole">
          <span className="pole-popis">{t.groups}</span>
          <TagSelect
            name="groups"
            options={audiences.groups}
            selected={o.groups}
            newLabel={t.newGroup}
            language={language}
          />
          <span className="tichy pole-napoveda">{t.groupsNote}</span>
        </div>

        <div className="pole">
          <span className="pole-popis">{t.tracks}</span>
          <TagSelect
            name="tracks"
            options={audiences.tracks}
            selected={o.tracks}
            newLabel={t.newTrack}
            language={language}
          />
        </div>

        <fieldset className="hr-skupina" style={{ border: "1px solid var(--line)" }}>
          <legend className="pole-popis">{t.roles}</legend>
          <ul className="hr-volby">
            {ASSIGNABLE_ROLES.map(r => (
              <li key={r}>
                <label className="hr-volba">
                  <input type="checkbox" name="roles" value={r} defaultChecked={o.roles.includes(r)} />
                  <span>{d.roles[r] ?? r}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="tichy pole-napoveda" style={{ margin: "6px 0 0" }}>
            {t.rolesNote}
          </p>
        </fieldset>

        <div>
          <button className="tlacidlo" type="submit">{t.save}</button>
        </div>
      </form>

      <form action={togglePersonStatusAction} className="karta" style={{ padding: 20, marginTop: 16, display: "grid", gap: 12 }}>
        <input type="hidden" name="id" value={o.id} />
        <input type="hidden" name="email" value={o.email} />
        <input type="hidden" name="status" value={excluded ? "invited" : "inactive"} />

        <h2 style={{ fontSize: 17, margin: 0 }}>{excluded ? t.returnHeading : t.excludeHeading}</h2>

        {excluded ? (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>
              {t.returnNoteBefore}<strong>{t.returnNoteHighlight}</strong>{t.returnNoteAfter}
            </p>
            <div><button className="tlacidlo" type="submit">{t.returnSubmit}</button></div>
          </>
        ) : (
          <>
            <p className="tichy" style={{ margin: 0, fontSize: 14 }}>{t.excludeNote}</p>
            <label className="pole">
              <span className="pole-popis">{t.confirmLabel}</span>
              <input className="pole-vstup" name="confirmation" autoCapitalize="none" autoCorrect="off" />
              <span className="tichy pole-napoveda">{t.confirmNote}</span>
            </label>
            <div><button className="tlacidlo tlacidlo--tiche" type="submit">{t.excludeSubmit}</button></div>
          </>
        )}
      </form>
    </div>
  )
}
