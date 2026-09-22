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
import { isHr } from "@/lib/hr"
import { evidenceForPerson } from "@/lib/evidenceDb"
import { dutyState, dutyTagClass } from "@/lib/due"
import EvidenceTimeline from "@/components/EvidenceTimeline"
import { audiencesInOrg, personTagClass } from "@/lib/persons"
import { availableOptions } from "@/lib/codelistsTenant"
import { displayName, needsInvitation } from "@/lib/personFields"
import { allDepartments, flattenTree, pathTo } from "@/lib/departments"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import Notice from "@/components/Notice"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, UI_LANGUAGES, dictionary } from "@/lib/i18n"
import { savePersonAction, togglePersonStatusAction, resendInviteAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

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
    if (ctx.state === "not-signed-in") redirect("/sign-in")
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
  // Ponuka pracovísk je číselník organizácie (D85) — ten istý zoznam, aký
  // sa spravuje v Organizácia → Číselníky.
  const workplaces = availableOptions(ctx.tenant, "workplace")
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
  const tl = d.list
  const te = dictionary(language).evidence
  const tds = dictionary(language).hr.dutyState
  const now = new Date()
  const excluded = o.status === "inactive"

  /*
    Reťaz dôkazov na karte osoby (ADR-005, D67) — **ten istý komponent nad tou
    istou funkciou** ako `/hr/evidence`.

    Podmienená rolou `hr`, nie `people-admin`. Kartu osoby spravuje
    `people-admin`, ale reťaz dôkazov je údaj o tom, ako si človek plní
    povinnosti — a ten patrí personalistovi (D67). Kto smie meniť meno
    a oddelenie, nemá tým automaticky vidieť, čo kto otvoril a nepotvrdil.
    Väčšinou je to ten istý človek; keď nie je, rozhoduje rola, nie zvyk.
  */
  // Odvolanie výkaz nevidí (platí len „nepotvrdené") — pilulka ho povedať má,
  // rovnako ako na `/hr/evidence`.
  const duty = (r: { duty: Parameters<typeof dutyTagClass>[0]; revocation: { revokedAt: Date } | null }) =>
    ({ ...r.duty, revokedAt: r.revocation?.revokedAt ?? null })

  const evidence = isHr(ctx.person)
    ? await evidenceForPerson(ctx.person.companyCode, o.id)
    : []

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/people" style={{ fontSize: "var(--fs-body)" }}>{t.back}</Link>
      </p>

      {/* V nadpise meno **s titulmi** (D84) — je to zobrazenie, nie záznam.
          Vedľa neho stav osoby tou istou pilulkou ako v zozname (OSOBY.md,
          úloha 1); stav povinností nižšie je iná škála a nezlučuje sa s ním. */}
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 4px" }}>
        <h1 className="page-title" style={{ margin: 0 }}>{displayName(o)}</h1>
        <span className={personTagClass(o)}>{tl.status[o.status] ?? o.status}</span>
      </div>
      <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 4px", overflowWrap: "anywhere" }}>
        {o.email}
        {o.emailHistory.length > 0 && (
          <> · {t.previously(o.emailHistory.map(h => h.email).join(", "))}</>
        )}
      </p>
      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 20px" }}>
        {o.status === "invited" ? t.invitedNotSignedIn
          : o.status === "inactive" ? t.excludedNoSignIn
          : t.lastSeen(o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.never)}
        {o.accounts.length > 0 && ` · ${t.signsInVia(o.accounts.join(", "))}`}
      </p>

      <Notice message={message} error={error === "1"} back={`/people/${encodeURIComponent(id)}`} />

      <form action={savePersonAction} className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <input type="hidden" name="id" value={o.id} />

        <label className="field">
          <span className="field-label">{t.email}</span>
          <input
            className="field-input"
            name="email"
            type="email"
            defaultValue={o.email}
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="quiet field-hint">{t.emailNote}</span>
        </label>

        {/*
          Dve polia, nie jedno (D83). `fullName` sa z nich skladá na serveri —
          skrytým poľom by sa dalo podvrhnúť niečo iné, než čo je v poliach,
          a v zozname osôb by potom bolo iné meno než v potvrdení.

          Na telefóne pod sebou, na širšom vedľa seba: sú to dve krátke polia
          a samostatný riadok na každé z nich znamená zbytočné posúvanie.
        */}
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t.givenName}</span>
            <input className="field-input" name="givenName" defaultValue={o.givenName ?? ""} required />
          </label>
          <label className="field">
            <span className="field-label">{t.surname}</span>
            <input className="field-input" name="surname" defaultValue={o.surname ?? ""} required />
          </label>
        </div>
        <span className="quiet field-hint" style={{ marginTop: -8 }}>
          {(!o.givenName || !o.surname) ? t.nameMissing : t.nameNote}
        </span>

        <div className="field-row">
          <label className="field">
            <span className="field-label">{t.titleBefore}</span>
            <input className="field-input" name="titleBefore" defaultValue={o.titleBefore ?? ""} />
          </label>
          <label className="field">
            <span className="field-label">{t.titleAfter}</span>
            <input className="field-input" name="titleAfter" defaultValue={o.titleAfter ?? ""} />
          </label>
        </div>
        <span className="quiet field-hint" style={{ marginTop: -8 }}>{t.titlesNote}</span>

        <label className="field">
          <span className="field-label">{t.jobTitle}</span>
          <input className="field-input" name="jobTitle" defaultValue={o.jobTitle ?? ""} />
          <span className="quiet field-hint">{t.jobTitleNote}</span>
        </label>

        <label className="field">
          <span className="field-label">{t.mobilePhone}</span>
          <input
            className="field-input"
            name="mobilePhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={o.mobilePhone ?? ""}
          />
          <span className="quiet field-hint">{t.mobilePhoneNote}</span>
        </label>

        <div className="field">
          <span className="field-label">{t.workplace}</span>
          <Select
            name="workplace"
            fieldLabel={t.workplace}
            initial={o.workplace ?? ""}
            options={[
              { value: "", label: t.workplaceNone },
              ...workplaces.map(w => ({ value: w.key, label: w.label ?? w.key })),
            ]}
          />
          <span className="quiet field-hint">
            {workplaces.length === 0 ? (
              <>
                {t.noWorkplacesBefore}
                <Link href="/organisation?tab=codelists">{t.noWorkplacesLink}</Link>
                {t.noWorkplacesAfter}
              </>
            ) : t.workplaceNote}
          </span>
        </div>

        <div className="field">
          <span className="field-label">{t.department}</span>
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
          <span className="quiet field-hint">
            {treeRows.length === 0 ? (
              <>
                {t.noDepartmentsBefore}
                <Link href="/organisation?tab=departments">{t.noDepartmentsLink}</Link>
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
          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "-6px 0 0" }}>
            {t.legacyDepartmentBefore}<strong>{o.department}</strong>{t.legacyDepartmentAfter}
          </p>
        ) : null}

        <div className="field">
          <span className="field-label">{t.personType}</span>
          <Select
            name="personType"
            options={Object.entries(d.types).map(([value, label]) => ({ value, label }))}
            initial={o.personType}
            fieldLabel={t.personType}
          />
          <span className="quiet field-hint">{t.personTypeNote}</span>
        </div>

        <div className="field">
          <span className="field-label">{t.language}</span>
          <Select
            name="language"
            options={UI_LANGUAGES.map(l => ({ value: l, label: d.languages[l] ?? l }))}
            initial={o.language}
            fieldLabel={t.language}
          />
          <span className="quiet field-hint">{t.languageNote}</span>
        </div>

        <div className="field">
          <span className="field-label">{t.groups}</span>
          <TagSelect
            name="groups"
            options={audiences.groups}
            selected={o.groups}
            newLabel={t.newGroup}
            language={language}
          />
          <span className="quiet field-hint">{t.groupsNote}</span>
        </div>

        <div className="field">
          <span className="field-label">{t.tracks}</span>
          <TagSelect
            name="tracks"
            options={audiences.tracks}
            selected={o.tracks}
            newLabel={t.newTrack}
            language={language}
          />
        </div>

        <fieldset className="hr-group" style={{ border: "1px solid var(--line)" }}>
          <legend className="field-label">{t.roles}</legend>
          <ul className="hr-choices">
            {ASSIGNABLE_ROLES.map(r => (
              <li key={r}>
                <label className="hr-choice">
                  <input type="checkbox" name="roles" value={r} defaultChecked={o.roles.includes(r)} />
                  <span>{d.roles[r] ?? r}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="quiet field-hint" style={{ margin: "6px 0 0" }}>
            {t.rolesNote}
          </p>
        </fieldset>

        <div>
          <button className="button" type="submit">{t.save}</button>
        </div>
      </form>

      {/*
        Vzácne a nevratné akcie do `<details>` (OSOBY.md, úloha 3) — ten istý
        `.detail-tools` ako na detaile dokumentu. Vylúčenie schované je
        zámer: nie je to súčasť úpravy telefónneho čísla. Zatvorený stav je
        správny predvolený — kto prišiel opraviť údaj, toto vidieť nechce.
      */}
      <details className="detail-tools" style={{ marginTop: 18 }}>
        <summary>{t.accessSummary}</summary>
        <div className="detail-tools-body">
        {/*
          Pozvánka — **len kým osoba ani raz nebola dnu** (`firstLoginAt`, nie
          `status`: osoby z importu a zo samozaloženia majú `active` od začiatku
          a pozvánku nikdy nedostali, D47). Kto sa už prihlásil, kartu nevidí —
          tlačidlo, ktoré nič nerieši, len pridáva otázku, na čo je.

          Vyradenej osobe sa tiež nekreslí: pozvánka niekomu, kto v organizácii
          už nie je, je horšia než žiadna — rovnaké pravidlo ako v `neverSignedIn()`.
        */}
        {needsInvitation(o) && (
          <form action={resendInviteAction} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={o.id} />

            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.inviteHeading}</h2>

            <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>
              {t.inviteNote}
              {o.invitedAt && ` ${t.inviteNoteSince(formatDate(o.invitedAt, language))}`}
            </p>

            <div><button className="button button--quiet" type="submit">{t.inviteSubmit}</button></div>
          </form>
        )}

        {/* Rozostupy drží mriežka `.detail-tools-body`, nie okraj karty. */}
        <form action={togglePersonStatusAction} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="email" value={o.email} />
          <input type="hidden" name="status" value={excluded ? "invited" : "inactive"} />

          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{excluded ? t.returnHeading : t.excludeHeading}</h2>

          {excluded ? (
            <>
              <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>
                {t.returnNoteBefore}<strong>{t.returnNoteHighlight}</strong>{t.returnNoteAfter}
              </p>
              <div><button className="button" type="submit">{t.returnSubmit}</button></div>
            </>
          ) : (
            <>
              <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>{t.excludeNote}</p>
              <label className="field">
                <span className="field-label">{t.confirmLabel}</span>
                <input className="field-input" name="confirmation" autoCapitalize="none" autoCorrect="off" />
                <span className="quiet field-hint">{t.confirmNote}</span>
              </label>
              <div><button className="button button--quiet" type="submit">{t.excludeSubmit}</button></div>
            </>
          )}
        </form>
        </div>
      </details>

      {/*
        Os je posledná, pod správou osoby. Je to pohľad, nie ovládanie —
        a keby stála hore, karta by prestala byť obrazovkou na úpravu údajov
        a stala by sa výkazom.
      */}
      {evidence.length > 0 && (
        <section className="card" style={{ padding: 20, marginTop: 24, display: "grid", gap: 10 }}>
          <div className="evidence-head">
            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{te.heading}</h2>
            <Link className="quiet" style={{ fontSize: "var(--fs-small)" }} href="/hr/evidence">
              {te.allPeople}
            </Link>
          </div>
          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>{te.notifiedMissing}</p>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 16 }}>
            {evidence.map(r => (
              <li key={r.duty.versionId}>
                <div className="evidence-head">
                  <strong style={{ fontSize: "var(--fs-body)" }}>{r.duty.documentTitle}</strong>
                  {/*
                    Stav povinnosti tou istou škálou ako u personalistu
                    (OSOBY.md, úloha 3 → `dutyTagClass()` z HR.md, úloha 1).
                    Je to **iný** stav než stav osoby v hlavičke a nezlučujú sa.
                  */}
                  <span className={dutyTagClass(duty(r), now)}>{tds[dutyState(duty(r), now)]}</span>
                </div>
                <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>{r.duty.versionLabel}</div>
                <EvidenceTimeline timeline={r.timeline} language={language} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </AppShell>
  )
}
