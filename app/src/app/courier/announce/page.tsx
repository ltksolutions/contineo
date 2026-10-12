/**
 * Oznam publiku (ADR-033, D204) — len správca osôb, HR a správca obsahu.
 *
 * Dva kroky, oba bez JavaScriptu: „Skontrolovať príjemcov" odloží výber
 * a text do konceptu a ukáže, **komu presne** to pôjde (počet a mená); až
 * potom je tlačidlo „Odoslať N osobám" (R2). Odoslaný oznam sa nedá vziať
 * späť — preto nič neodchádza ako vedľajší účinok iného kroku.
 *
 * Publikum je to isté ako pri prideľovaní noriem (ADR-005): oddelenie
 * s podriadenými, skupina, trasa, osoby, všetci. Hodnoty `audience` sú
 * rovnaké, takže `audienceFromSelection()` ani `matchesAudience()` nič nové
 * nepoznajú. Rola ako publikum zatiaľ nie je — pridelenia ju nemajú tiež.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import MultiSelect from "@/components/MultiSelect"
import PeopleSearch from "@/components/PeopleSearch"
import SubmitButton from "@/components/SubmitButton"
import { AudienceAll } from "@/components/AssignForm"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { listPeople } from "@/lib/people"
import { sortPeopleBySurname } from "@/lib/assignOrder"
import { audienceSignature } from "@/lib/assignSummary"
import { treeOptions } from "@/lib/treeOptions"
import { audienceFromSelection } from "@/lib/assignments"
import { audiencesInOrg } from "@/lib/persons"
import { trackNames } from "@/lib/tracks"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { canAnnounce, loadDraft, announcementRecipients, SUBJECT_MAX, TEXT_MAX } from "@/lib/courier"
import { dictionary } from "@/lib/i18n"
import { previewAnnouncementAction, sendAnnouncementAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function AnnouncePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready" || !canAnnounce(ctx.person)) notFound()

  const q = normalizeQuery<{ error?: string; preview?: string }>(await searchParams)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.courier
  const th = d.hr.assign
  const branding = brandingView(ctx.tenant)
  const companyCode = ctx.person.companyCode

  const [audiences, tree, departmentCounts, people, names, draft] = await Promise.all([
    audiencesInOrg(companyCode),
    allDepartments(companyCode),
    counts(companyCode),
    listPeople(companyCode),
    trackNames(companyCode),
    loadDraft(companyCode, ctx.person.id),
  ])
  const treeRows = flattenTree(tree)
  const selected = new Set(draft?.audience ?? [])
  const all = draft?.all ?? false

  // Osoby ako `person:<e-mail>` — to isté publikum ako pri prideľovaní.
  const personChoices = sortPeopleBySurname(
    people.filter(p => p.status !== "inactive" && p.personType !== "external" && p.id !== ctx.person.id),
  ).map(p => ({ id: `person:${p.email.toLowerCase()}`, fullName: p.fullName, email: p.email, department: p.department }))

  // Náhľad: príjemcovia z konceptu. Podpis výberu ide do formulára skrytý
  // a odoslanie ho porovná so živým výberom — zmena po náhľade = náhľad znova.
  const previewAudiences = q.preview === "1" && draft
    ? audienceFromSelection({
        all,
        selected: [...selected],
        departmentNames: Object.fromEntries(tree.map(o => [o.id, o.name])),
        trackNames: names,
      })
    : []
  const recipients = previewAudiences.length > 0
    ? await announcementRecipients(companyCode, previewAudiences, ctx.person.id)
    : null
  const confirmed = recipients ? audienceSignature({ all, audience: [...selected], addresses: "" }) : ""

  return (
    <AppShell language={language} title={t.announceTitle} trail={{ "/courier": t.title }}>
      <div className="assign-page" style={tenantStyle(branding)}>
        <Notice language={language} message={q.error} error back="/courier/announce?preview=1" />

        <div className="page-head">
          <h1 className="page-title">{t.announceTitle}</h1>
          <span className="page-head-spacer" aria-hidden="true" />
          <Link className="button button--quiet" href="/courier/new">{t.modeDirect}</Link>
        </div>
        <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>{t.announceLead}</p>

        <form action={sendAnnouncementAction} className="assign">
          <input type="hidden" name="confirmed" value={confirmed} />
          <div className="assign-cols">
            <fieldset className="form-group form-group--lg">
              <legend className="form-group-head form-group-head--step">
                <span className="assign-step" aria-hidden="true">1</span>
                {t.text}
              </legend>
              <div className="card form-group-body form-group-body--rows" style={{ gap: 14 }}>
                <label className="field">
                  <span className="field-label">{t.subject}</span>
                  <input className="field-input" name="subject" required maxLength={SUBJECT_MAX} defaultValue={draft?.subject ?? ""} autoComplete="off" />
                </label>
                <label className="field">
                  <span className="field-label">{t.text}</span>
                  <textarea className="field-input" name="text" required rows={12} maxLength={TEXT_MAX} defaultValue={draft?.text ?? ""} style={{ resize: "vertical", lineHeight: 1.5 }} />
                  <span className="quiet field-hint">{t.textHint}</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="form-group form-group--lg">
              <legend className="form-group-head form-group-head--step">
                <span className="assign-step" aria-hidden="true">2</span>
                {th.to}
              </legend>
              <AudienceAll label={th.everyone} note={th.everyoneNote} defaultChecked={all}>
                {treeRows.length > 0 && (
                  <fieldset className="form-group assign-sub">
                    <legend className="form-group-head">{th.departments}</legend>
                    <div className="card form-group-body">
                      <MultiSelect
                        name="audience"
                        emit="repeat"
                        caseSensitive
                        noscript="checkboxes"
                        language={language}
                        note={`${th.departmentNoteBefore}${th.departmentNoteHighlight}${th.departmentNoteAfter}`}
                        selected={[...selected].filter(a => a.startsWith("department:"))}
                        options={treeOptions(treeRows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))
                          .map(o => ({
                            ...o,
                            value: `department:${o.value}`,
                            count: (departmentCounts.get(o.value) ?? { withDescendants: 0 }).withDescendants,
                          }))}
                      />
                    </div>
                  </fieldset>
                )}
                {audiences.groups.length > 0 && (
                  <fieldset className="form-group assign-sub">
                    <legend className="form-group-head">{th.groups}</legend>
                    <div className="card form-group-body form-group-body--rows">
                      <div className="form-list">
                        {audiences.groups.map(s => (
                          <label key={`g-${s.value}`} className="form-row select-row">
                            <input type="checkbox" name="audience" value={`group:${s.value}`} defaultChecked={selected.has(`group:${s.value}`)} />
                            <span className="form-row-main">{s.value}</span>
                            <span className="form-row-sub">{s.count}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                )}
                {audiences.tracks.length > 0 && (
                  <fieldset className="form-group assign-sub">
                    <legend className="form-group-head">{th.tracks}</legend>
                    <div className="card form-group-body form-group-body--rows">
                      <div className="form-list">
                        {audiences.tracks.map(tr => (
                          <label key={`t-${tr.value}`} className="form-row select-row">
                            <input type="checkbox" name="audience" value={`track:${tr.value}`} defaultChecked={selected.has(`track:${tr.value}`)} />
                            <span className="form-row-main">{names[tr.value] ?? tr.value}</span>
                            <span className="form-row-sub">{tr.count}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                )}
                {personChoices.length > 0 && (
                  <fieldset className="form-group assign-sub">
                    <legend className="form-group-head">{th.people}</legend>
                    <div className="card form-group-body form-group-body--rows">
                      <PeopleSearch
                        people={personChoices}
                        name="audience"
                        language={language}
                        multiple
                        defaultSelected={personChoices.filter(p => selected.has(p.id)).map(p => p.id)}
                        listLabel={th.people}
                        missing="people"
                      />
                    </div>
                  </fieldset>
                )}
              </AudienceAll>
            </fieldset>
          </div>

          {/* Náhľad a tlačidlá na konci (R2). Bez náhľadu je len „Skontrolovať
              príjemcov"; plné „Odoslať" až pri platnom náhľade s niekým v ňom. */}
          <div className="assign-summary">
            {recipients && (
              <div className="assign-impact" role="status">
                <div className="assign-impact-count">
                  {recipients.length > 0 ? t.recipientsCount(recipients.length) : t.recipientsNone}
                </div>
                {recipients.length > 0 && (
                  <details>
                    <summary className="quiet" style={{ cursor: "pointer", fontSize: "var(--fs-small)" }}>{th.people}</summary>
                    <ul className="quiet" style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "var(--fs-small)", columns: "2 220px" }}>
                      {recipients.map(r => <li key={r.personId}>{r.name}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <div className="assign-actions">
              <SubmitButton className="button button--quiet" formAction={previewAnnouncementAction} pendingLabel={d.common.pending.adding}>
                {t.checkRecipients}
              </SubmitButton>
              {recipients && recipients.length > 0 && (
                <SubmitButton className="button" pendingLabel={d.common.pending.sending}>
                  {t.sendTo(recipients.length)}
                </SubmitButton>
              )}
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
