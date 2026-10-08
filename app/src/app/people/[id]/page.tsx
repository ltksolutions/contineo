/**
 * Detail a úprava osoby (D46).
 *
 * **Adresa sa nedá zmeniť.** Je to kľúč, na ktorý sú naviazané potvrdenia aj
 * prihlasovacie kontá; prepísať ho pod existujúcimi záznamami by znamenalo,
 * že sa audit odkazuje na niekoho, kto tam už nie je. Preklep sa rieši
 * vyradením a pozvaním nanovo — je to nepohodlnejšie a je to správne.
 */

import { notFound, redirect } from "next/navigation"
import { treeOptions } from "@/lib/treeOptions"
import Link from "next/link"
import { peopleContext, loadPersonById, ASSIGNABLE_ROLES } from "@/lib/people"
import { LEARNING_ROLE, learningEnabled } from "@/lib/learning"
import { isHr } from "@/lib/hr"
import { evidenceForPerson } from "@/lib/evidenceDb"
import { dutyState, dutyTagClass } from "@/lib/due"
import EvidenceTimeline from "@/components/EvidenceTimeline"
import { audiencesInOrg, personTagClass, personDisplayStatus } from "@/lib/persons"
import { allTracks } from "@/lib/tracks"
import { availableOptions } from "@/lib/codelistsTenant"
import { displayName, needsInvitation } from "@/lib/personFields"
import { allDepartments, flattenTree } from "@/lib/departments"
import Select from "@/components/Select"
import PhoneField from "@/components/PhoneField"
import ValueSelect, { SimilarWarning } from "@/components/ValueSelect"
import Notice from "@/components/Notice"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, UI_LANGUAGES, dictionary } from "@/lib/i18n"
import { savePersonAction, togglePersonStatusAction, resendInviteAction, setEndedAtAction } from "../actions"
import { addYears, RETENTION_YEARS } from "@/lib/retention"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"

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
  const { msg: message, error, similar, like, pick, exclude } = normalizeQuery<{ msg?: string; error?: string; similar?: string; like?: string; pick?: string; exclude?: string }>(await searchParams)
  const o = await loadPersonById(ctx.person.companyCode, id)
  // Neexistuje vs. patrí inej organizácii je zámerne tá istá odpoveď (D32).
  if (!o) notFound()

  // Zoznam sa odvodzuje z ľudí, nie z číselníka (D38) — a je to ten istý
  // zoznam, aký vidí prideľovanie noriem.
  const audiences = await audiencesInOrg(ctx.person.companyCode)
  // Trasy podľa **názvu** zo zoznamu trás (2. 10. 2026) — kľúč sa nezadáva
  // ani neukazuje. Kľúč, ktorý osoba má a trasa k nemu nie je (zapísaný
  // kedysi ručne), ostane zaškrtnutý, aby ho uloženie potichu nezmazalo.
  const tracks = await allTracks(ctx.person.companyCode)
  const orphanTracks = o.tracks.filter(k => !tracks.some(tr => tr.key === k))
  // Ponuka pracovísk je číselník organizácie (D85) — ten istý zoznam, aký
  // sa spravuje v Organizácia → Číselníky.
  const workplaces = availableOptions(ctx.tenant, "workplace")
  const tree = await allDepartments(ctx.person.companyCode)
  const treeRows = flattenTree(tree)

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const d = dictionary(language).people
  const t = d.detail
  const here = `/people/${encodeURIComponent(id)}`
  const tl = d.list
  const te = dictionary(language).evidence
  const tds = dictionary(language).hr.dutyState
  const now = new Date()
  const excluded = o.status === "inactive"
  const todayIso = now.toISOString().slice(0, 10)

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

  // Posledný krok časovej osi pri povinnosti — riadok ukazuje len ten,
  // celá os je zbalená (OSOBY-karta-osoby Q3).
  const lastStep = (timeline: { kind: keyof typeof te.kind; at: Date | null }[]) => {
    const done = timeline.filter(e => e.at).sort((a, b) => b.at!.getTime() - a.at!.getTime())[0]
    return done ? `${te.kind[done.kind]} ${formatDate(done.at!, language)}` : null
  }
  const excluding = !excluded && exclude === "1"
  const lead = o.status === "invited" ? (o.invitationSentAt ? t.invitedNotSignedIn : t.newNotInvited)
    : excluded ? t.excludedNoSignIn
    : t.lastSeen(o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.never)

  return (
    <AppShell language={ctx.person.language} title={displayName(o)}>
    {/*
      Karta osoby (OSOBY-karta-osoby, 8. 10. 2026): jeden `.set-form` so
      sekciami a lištou, bez karty v karte; vyradenie, pozvánka a skončenie
      vzťahu v „Ďalších akciách"; povinnosti so zbalenou osou.
    */}
    <div className="page-narrow" style={tenantStyle(branding)}>
      {/* V nadpise meno **s titulmi** (D84) — je to zobrazenie, nie záznam.
          Vedľa neho stav osoby tou istou pilulkou ako v zozname (OSOBY.md,
          úloha 1); stav povinností nižšie je iná škála a nezlučuje sa s ním. */}
      <div className="page-head">
        <h1 className="page-title">{displayName(o)}</h1>
        <span className={personTagClass(o)}>{tl.status[personDisplayStatus(o)] ?? o.status}</span>
      </div>
      <p className="quiet page-lead person-lead">{o.email} · {lead}</p>

      <Notice language={language} message={message} error={error === "1"} back={here} />

      <form action={savePersonAction} className="card set-form">
        <input type="hidden" name="id" value={o.id} />

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionPerson}</h2></div>
          <div className="set-sec-body">
            {/*
              Dve polia, nie jedno (D83). `fullName` sa z nich skladá na serveri —
              skrytým poľom by sa dalo podvrhnúť niečo iné, než čo je v poliach,
              a v zozname osôb by potom bolo iné meno než v potvrdení.
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
            <span className="quiet field-hint">{(!o.givenName || !o.surname) ? t.nameMissing : t.nameNote}</span>
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
            <span className="quiet field-hint">{t.titlesNote}</span>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionContact}</h2></div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.email}</span>
              <input className="field-input" name="email" type="email" defaultValue={o.email} required autoCapitalize="none" autoCorrect="off" />
              <span className="quiet field-hint">{t.emailNote}</span>
              {/* Predošlé adresy a kontá pod e-mailom, nie v hlavičke (Q5 podkladu). */}
              {(o.emailHistory.length > 0 || o.accounts.length > 0) && (
                <span className="quiet field-hint">
                  {[
                    o.emailHistory.length > 0 ? t.previously(o.emailHistory.map(h => h.email).join(", ")) : null,
                    o.accounts.length > 0 ? t.signsInVia(o.accounts.join(", ")) : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </label>
            <PhoneField language={language}
              label={t.mobilePhone}
              countryLabel={t.mobilePhoneCountry}
              hint={t.mobilePhoneNote}
              value={o.mobilePhone}
              tenantPrefix={ctx.tenant.phonePrefix}
            />
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionPlacement}</h2></div>
          <div className="set-sec-body">
            <div className="field-row">
              <label className="field">
                <span className="field-label">{t.jobTitle}</span>
                <input className="field-input" name="jobTitle" defaultValue={o.jobTitle ?? ""} />
                <span className="quiet field-hint">{t.jobTitleNote}</span>
              </label>
              <div className="field">
                <span className="field-label">{t.workplace}</span>
                <Select language={language}
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
                      <Link href="/organisation/codelists">{t.noWorkplacesLink}</Link>
                      {t.noWorkplacesAfter}
                    </>
                  ) : t.workplaceNote}
                </span>
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t.department}</span>
              <Select language={language}
                name="departmentId"
                fieldLabel={t.department}
                initial={o.departmentId ?? ""}
                options={[
                  { value: "", label: t.departmentNone },
                  ...treeOptions(treeRows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level }))),
                ]}
              />
              <span className="quiet field-hint">
                {treeRows.length === 0 ? (
                  <>
                    {t.noDepartmentsBefore}
                    <Link href="/organisation/departments">{t.noDepartmentsLink}</Link>
                    {t.noDepartmentsAfter}
                  </>
                ) : (
                  // Cesta v strome je pod hodnotou výberu (rám KOMPONENT-vyber-oddelenia),
                  // veta „Zaradenie: …" by ju len opakovala.
                  t.departmentNote
                )}
              </span>
            </div>
            {o.department && !o.departmentId ? (
              <p className="quiet field-hint">
                {t.legacyDepartmentBefore}<strong>{o.department}</strong>{t.legacyDepartmentAfter}
              </p>
            ) : null}
            <div className="field">
              <span className="field-label">{t.personType}</span>
              <Select language={language}
                name="personType"
                options={Object.entries(d.types).map(([value, label]) => ({ value, label }))}
                initial={o.personType}
                fieldLabel={t.personType}
              />
              <span className="quiet field-hint">{t.personTypeNote}</span>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionLanguage}</h2></div>
          <div className="set-sec-body">
            <div className="field-row">
              <div className="field">
                <span className="field-label">{t.language}</span>
                <Select language={language}
                  name="language"
                  options={UI_LANGUAGES.map(l => ({ value: l, label: d.languages[l] ?? l }))}
                  initial={o.language}
                  fieldLabel={t.language}
                />
                <span className="quiet field-hint">{t.languageNote}</span>
              </div>
              <div className="field">
                <span className="field-label">{t.gender}</span>
                <Select language={language}
                  name="gender"
                  fieldLabel={t.gender}
                  initial={o.gender ?? ""}
                  options={[
                    { value: "", label: d.genders.none },
                    { value: "male", label: d.genders.male },
                    { value: "female", label: d.genders.female },
                  ]}
                />
                <span className="quiet field-hint">{t.genderNote}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Výbery ako riadky priamo v sekcii, bez karty v karte (Q2). */}
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionGroups}</h2></div>
          <div className="set-sec-body">
            {/* Podobný názov server neuloží a vráti `?similar=&like=`
                (ZAKLAD-vyber-skupin-a-znaciek Q3). */}
            <div id="groups">
              <ValueSelect
                variant="rows"
                kind="groups"
                name="groups"
                legend={t.groups}
                options={audiences.groups}
                selected={pick === "like" && like ? [...o.groups, like] : o.groups}
                prefillNew={pick === "new" ? similar : undefined}
                forced={pick === "new" ? similar : undefined}
                language={language}
                warning={pick ? undefined : <SimilarWarning href={here} anchor="groups" kind="groups" similar={similar} like={like} language={language} />}
              />
            </div>
            <fieldset className="sec-rows">
              <legend className="sec-rows-head">{t.tracks}</legend>
              <div className="sec-rows-body">
                {tracks.length === 0 && orphanTracks.length === 0 ? (
                  <p className="quiet field-hint sec-rows-empty">{t.noTracks}</p>
                ) : (
                  <div className="form-list">
                    {tracks.map(tr => (
                      <label key={tr.key} className="form-row select-row">
                        <input type="checkbox" name="track" value={tr.key} defaultChecked={o.tracks.includes(tr.key)} />
                        <span className="form-row-main">
                          <span>{tr.title}{!tr.isActive && <span className="quiet"> · {t.trackInactive}</span>}</span>
                        </span>
                      </label>
                    ))}
                    {orphanTracks.map(k => (
                      <label key={k} className="form-row select-row">
                        <input type="checkbox" name="track" value={k} defaultChecked />
                        <span className="form-row-main quiet">{t.trackUnknown}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sectionRoles}</h2></div>
          <div className="set-sec-body">
            <fieldset className="sec-rows">
              <legend className="sr-only">{t.roles}</legend>
              <div className="sec-rows-body">
                <div className="form-list">
                  {ASSIGNABLE_ROLES.filter(r => r !== LEARNING_ROLE || learningEnabled(ctx.tenant)).map(r => (
                    <label key={r} className="form-row select-row">
                      <input type="checkbox" name="roles" value={r} defaultChecked={o.roles.includes(r)} />
                      <span className="form-row-main">{d.roles[r] ?? r}</span>
                    </label>
                  ))}
                </div>
                {/* Vypnutý modul: rola sa neukáže, ale uložením sa nesmie stratiť. */}
                {!learningEnabled(ctx.tenant) && o.roles.includes(LEARNING_ROLE) && (
                  <input type="hidden" name="roles" value={LEARNING_ROLE} />
                )}
              </div>
              <p className="sec-rows-foot quiet">{t.rolesNote}</p>
            </fieldset>
          </div>
        </section>

        <div className="set-savebar">
          <SubmitButton className="button">{t.save}</SubmitButton>
          <span className="quiet">{dictionary(language).common.saveBarNote}</span>
        </div>
      </form>

      {/*
        Ďalšie akcie (OSOBY-karta-osoby Q1) namiesto `<details>` „Prístup
        a členstvo". Vyradenie je vzácne a nevratné, preto predvolene len
        riadok — karta s potvrdením adresou sa otvorí až pri `?exclude=1`.
      */}
      <section className="card more person-more" id="more">
        <div className="more-head"><h2>{dictionary(language).common.moreActions}</h2></div>

        {/*
          Pozvánka — **len kým osoba ani raz nebola dnu** (`firstLoginAt`, nie
          `status`, D47). Vyradenej osobe sa nekreslí.
        */}
        {needsInvitation(o) && (
          <form action={resendInviteAction} className="more-row">
            <input type="hidden" name="id" value={o.id} />
            <div className="more-main">
              <b>{t.inviteHeading}</b>
              <span>
                {t.inviteNote}
                {o.invitedAt && ` ${t.inviteNoteSince(formatDate(o.invitedAt, language))}`}
                {o.invitationSentAt && ` ${t.inviteNoteSent(formatDate(o.invitationSentAt, language))}`}
              </span>
            </div>
            <SubmitButton className="button button--quiet">{o.invitationSentAt ? t.inviteSubmit : t.inviteSubmitFirst}</SubmitButton>
          </form>
        )}

        {!excluded && (
          <div className="more-row">
            <div className="more-main">
              <b>{t.excludeHeading}</b>
              <span>{t.excludeRowNote}</span>
            </div>
            {!excluding && <Link className="button button--danger" href={`${here}?exclude=1#more`}>{t.excludeOpen}</Link>}
          </div>
        )}
        {excluding && (
          // Karta vyradenia (rám OSOBY-skoncenie-vztahu): časová os, adresa
          // na opísanie, nepovinný dátum skončenia vzťahu.
          <form action={togglePersonStatusAction} className="more-confirm ex-confirm">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="email" value={o.email} />
            <input type="hidden" name="status" value="inactive" />
            <h3 className="ex-confirm-title"><span className="ex-ico" aria-hidden="true">!</span>{t.excludeConfirmTitle(displayName(o))}</h3>
            <p>{t.excludeNote}</p>
            {/* Obrázok toho, čo hovorí text vyššie a nápoveda dátumu (Ján 24. 9.). */}
            <ol className="ex-tl" aria-hidden="true">
              <li className="ex-tl-step is-now"><span className="ex-tl-dot" /><b>{t.tlDeactivate}</b><span>{t.tlDeactivateSub}</span></li>
              <li className="ex-tl-step"><span className="ex-tl-dot" /><b>{t.tlEnded}</b><span>{t.tlEndedSub}</span></li>
              <li className="ex-tl-step is-end"><span className="ex-tl-dot" /><b>{t.tlRetention(RETENTION_YEARS)}</b><span>{t.tlRetentionSub}</span></li>
            </ol>
            {/* Skončenie vzťahu (ADR-012, D100) — od neho plynie lehota dokladov.
                Nepovinné: dátum z personalistiky často príde až neskôr. */}
            <label className="field">
              <span className="field-label">{t.endedAtLabel}</span>
              <input className="field-input" type="date" name="endedAt" max={todayIso} />
              <span className="quiet field-hint">{t.endedAtNote}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.confirmLabel}</span>
              <code className="ex-copy">{o.email}</code>
              <input className="field-input" name="confirmation" autoCapitalize="none" autoCorrect="off" />
              <span className="quiet field-hint">{t.confirmNote}</span>
            </label>
            <div className="more-acts">
              <SubmitButton className="button button--danger">{t.excludeSubmit}</SubmitButton>
              <Link className="button button--quiet" href={`${here}#more`}>{t.cancel}</Link>
            </div>
          </form>
        )}

        {/*
          Pri vyradenej osobe: odkedy plynie lehota dokladov a oprava dátumu
          skončenia. Samostatný formulár — vrátiť osobu a opraviť dátum sú dve
          rôzne rozhodnutia.
        */}
        {excluded && (
          <form action={setEndedAtAction} className="more-row more-row--stack">
            <input type="hidden" name="id" value={o.id} />
            <div className="more-main"><b>{t.endedAtHeading}</b></div>
            <dl className="facts ex-facts">
              <div>
                <dt>{t.factDeactivated}</dt>
                <dd>{o.deactivatedAt ? formatDate(o.deactivatedAt, language) : "—"}</dd>
              </div>
              <div>
                <dt>{t.factEnded}</dt>
                <dd>{o.endedAt ? formatDate(o.endedAt, language) : "—"}</dd>
              </div>
              {/* Odvodené z pravidla ADR-012 (D100), nikde sa neukladá (Ján 24. 9.). */}
              {(o.endedAt ?? o.deactivatedAt) && (
                <div>
                  <dt>{t.factDeleteFrom}</dt>
                  <dd>{formatDate(addYears(new Date((o.endedAt ?? o.deactivatedAt)!), RETENTION_YEARS), language)}</dd>
                </div>
              )}
            </dl>
            {!o.endedAt && <p className="quiet field-hint">{t.endedAtMissing}</p>}
            <label className="field">
              <span className="field-label">{t.endedAtLabel}</span>
              <input className="field-input" type="date" name="endedAt" max={todayIso}
                     defaultValue={o.endedAt ? o.endedAt.toISOString().slice(0, 10) : ""} />
              <span className="quiet field-hint">{t.endedAtNote}</span>
            </label>
            <div><SubmitButton className="button button--quiet">{t.endedAtSubmit}</SubmitButton></div>
          </form>
        )}

        {excluded && (
          <form action={togglePersonStatusAction} className="more-row">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="email" value={o.email} />
            <input type="hidden" name="status" value="invited" />
            <div className="more-main">
              <b>{t.returnHeading}</b>
              <span>{t.returnNoteBefore}<strong>{t.returnNoteHighlight}</strong>{t.returnNoteAfter}</span>
            </div>
            <SubmitButton className="button button--quiet">{t.returnSubmit}</SubmitButton>
          </form>
        )}
      </section>

      {/*
        Os je posledná, pod správou osoby. Je to pohľad, nie ovládanie —
        a keby stála hore, karta by prestala byť obrazovkou na úpravu údajov
        a stala by sa výkazom. Vidí ju len rola `hr` (D67).
      */}
      {isHr(ctx.person) && evidence.length === 0 && (
        <div className="empty person-duties">
          <div className="empty-title">{t.evidenceEmptyTitle}</div>
          <div className="empty-text">{t.evidenceEmptyText}</div>
        </div>
      )}

      {evidence.length > 0 && (
        <section className="form-group person-duties">
          <h2 className="form-group-head form-group-head--step">
            {te.heading} <span className="quiet">{evidence.length}</span>
            <Link className="duty-all" href="/hr/evidence">{te.allPeople}</Link>
          </h2>
          <div className="card duty">
            {evidence.map(r => {
              const last = lastStep(r.timeline)
              return (
                <div key={r.duty.versionId} className="duty-row">
                  <div className="duty-top">
                    <b>{r.duty.documentTitle}</b>
                    {/*
                      Stav povinnosti tou istou škálou ako u personalistu
                      (OSOBY.md, úloha 3 → `dutyTagClass()` z HR.md, úloha 1).
                      Je to **iný** stav než stav osoby v hlavičke a nezlučujú sa.
                    */}
                    <span className={dutyTagClass(duty(r), now)}>{tds[dutyState(duty(r), now)]}</span>
                  </div>
                  <span className="duty-sub">{[last, r.duty.versionLabel].filter(Boolean).join(" · ")}</span>
                  {/* Celá os pri každom dokumente (ADR-005), zbalená (Q3). */}
                  <details className="duty-tl">
                    <summary>{t.dutyTimeline}</summary>
                    <EvidenceTimeline timeline={r.timeline} language={language} />
                  </details>
                </div>
              )
            })}
          </div>
          <p className="form-group-foot quiet">{te.notifiedMissing}</p>
        </section>
      )}
    </div>
    </AppShell>
  )
}
