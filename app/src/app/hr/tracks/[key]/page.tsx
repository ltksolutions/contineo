/**
 * Detail trasy — poradie krokov.
 *
 * Kroky sa posielajú **celé pri každej zmene** (skryté polia v jednom
 * formulári). Vyzerá to zbytočne, ale je to jediný spôsob, ako mať poradie
 * na jednom mieste: pridanie, odobranie aj posun sú tu tri spôsoby, ako
 * zostaviť to isté pole, a očísluje ho až `setTrackSteps()`.
 */

import { notFound, redirect } from "next/navigation"
import { trackManagerContext } from "@/lib/hr"
import { trackByKey } from "@/lib/tracks"
import { libraryList } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Select from "@/components/Select"
import MultiSelect from "@/components/MultiSelect"
import PeopleSearch from "@/components/PeopleSearch"
import { listPeople } from "@/lib/people"
import { sortPeopleBySurname } from "@/lib/assignOrder"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { treeOptions } from "@/lib/treeOptions"
import { duties, trackStatuses } from "@/lib/hrReport"
import Link from "next/link"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import {
  addStepAction, removeStepAction, moveStepAction, setTrackActiveAction,
  addMembersAction, removeMemberAction, saveTrackSettingsAction,
} from "../actions"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"

export const dynamic = "force-dynamic"

export default async function TrackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await trackManagerContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { key } = await params
  const { msg: message, error, add } = normalizeQuery<{ msg?: string; error?: string; add?: string }>(await searchParams)

  const t = dictionary(ctx.person.language).library.tracks
  const branding = brandingView(ctx.tenant)

  const track = await trackByKey(ctx.tenant.companyCode, key)
  if (!track) notFound()

  const documents = await libraryList(ctx.tenant.companyCode, {})
  const titles = new Map(documents.map(d => [d.documentId, d.title]))
  const steps = track.steps.filter(s => s.documentId)

  const here = `/hr/tracks/${encodeURIComponent(track.key)}`
  const adding = add === "people"

  /*
    Ľudia na trase (2. 10. 2026) — z `persons.tracks`, jediného zdroja (D27).
    Vyradení ostávajú v zozname (trasu mali), do výberu sa neponúkajú.
  */
  const [people, tree, departmentCounts, rows] = await Promise.all([
    listPeople(ctx.tenant.companyCode),
    allDepartments(ctx.tenant.companyCode),
    counts(ctx.tenant.companyCode),
    duties(ctx.tenant.companyCode),
  ])
  // Stav po ľuďoch z tých istých riadkov ako výkaz a karta v Pridelených dokumentoch.
  const status = trackStatuses(rows).get(track.title)
  const missing = status ? status.total - status.done : 0
  // Najbližší termín každého, kto ešte niečo z trasy nepotvrdil — z tých istých riadkov.
  const dueByPerson = new Map<string, Date>()
  for (const d of rows) {
    if (d.acknowledgedAt || !d.due || !d.trackTitles.includes(track.title)) continue
    const known = dueByPerson.get(d.personId)
    if (!known || d.due < known) dueByPerson.set(d.personId, d.due)
  }
  const tp = dictionary(ctx.person.language).pending
  const members = sortPeopleBySurname(people.filter(p => p.tracks.includes(track.key)))
  const choices = sortPeopleBySurname(people.filter(p => p.status !== "inactive" && !p.tracks.includes(track.key)))
    .map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))
  const departmentOptions = treeOptions(flattenTree(tree).map(r => ({ id: r.department.id, name: r.department.name, level: r.level })))
    .map(o => ({ ...o, count: (departmentCounts.get(o.value) ?? { withDescendants: 0 }).withDescendants }))

  // Skryté polia, ktoré nesú aktuálne poradie do každej akcie. Bez nich by
  // sa zmena vyhodnotila proti stavu v databáze a dve otvorené záložky by
  // sa navzájom potichu prepísali.
  const carry = (
    <>
      <input type="hidden" name="key" value={track.key} />
      {steps.map(s => (
        <span key={`carry-${s.documentId}`}>
          <input type="hidden" name="stepDocumentId" value={s.documentId!} />
          {s.requiresAcknowledgement && (
            <input type="hidden" name="stepAck" value={s.documentId!} />
          )}
        </span>
      ))}
    </>
  )

  // Do ponuky patria len dokumenty, ktoré v trase ešte nie sú — ten istý
  // dokument dva razy je krok, ktorý sa potvrdí sám sebou.
  const used = new Set(steps.map(s => s.documentId))
  const available = documents
    .filter(d => !used.has(d.documentId))
    .map(d => ({ value: d.documentId, label: d.title }))

  return (
    <AppShell language={ctx.person.language} title={track.title} trail={{ "/hr/tracks": t.heading }}>
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice language={ctx.person.language} message={message ?? error} error={Boolean(error)} back={here} />


      {/* Hlavička stránky (DESIGN_ODCHYLKY P1). */}
      {/* Jediné plné tlačidlo je „Pridať osoby" — otvorí úlohu `?add=people`,
          ktorá ho prevezme (ZAKLAD-lista-ulozenia, 7. 10. 2026). */}
      <div className="page-head">
        <h1 className="page-title">{track.title}</h1>
        {/* Tie isté štítky ako v zozname trás. */}
        <span className={track.isActive ? "tag tag--published" : "tag tag--archived"}>
          {track.isActive ? t.active : t.inactive}
        </span>
        <span className="page-head-spacer" aria-hidden="true" />
        {!adding && <Link className="button" href={`${here}?add=people`}>{t.addMembers}</Link>}
      </div>
      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 12px" }}>
        {t.stepCount(steps.length)}
      </p>

      {adding && (
        <section className="card task-card" aria-labelledby="add-people">
          <h2 id="add-people">{t.addHeading}</h2>
          <p className="quiet field-hint">{t.addMembersNote}</p>
          {/* Oddelenia a ľudia ako skupiny s nadpisom nad kartou, ako „Komu"
              na /hr/assign (DESIGN_ODCHYLKY P7). */}
          <form action={addMembersAction} className="task-form">
            <input type="hidden" name="key" value={track.key} />
            {departmentOptions.length > 0 && (
              <fieldset className="form-group">
                <legend className="form-group-head">{t.departments}</legend>
                <div className="card form-group-body">
                <MultiSelect
                  name="department"
                  emit="repeat"
                  caseSensitive
                  noscript="checkboxes"
                  language={ctx.person.language}
                  selected={[]}
                  options={departmentOptions}
                />
                </div>
              </fieldset>
            )}
            {choices.length > 0 && (
              <fieldset className="form-group">
                <legend className="form-group-head">{t.people}</legend>
                <div className="card form-group-body form-group-body--rows">
                <PeopleSearch
                  people={choices}
                  name="person"
                  language={ctx.person.language}
                  multiple
                  listLabel={t.people}
                  missing="people"
                />
                </div>
              </fieldset>
            )}
            {/* Predvolene zapnuté (Ján, 3. 10. 2026) — kto na trasu pribudne, má
                sa to dozvedieť hneď, nie až z pripomienky pred termínom. */}
            {track.isActive && (
              <div className="card form-group-body form-group-body--rows">
                <div className="form-list">
                  <label className="form-row">
                    <input type="checkbox" role="switch" className="toggle" name="notify" value="1" defaultChecked />
                    <span className="form-row-main">
                      <span>{t.notifyAdded}</span>
                      <span className="form-row-sub">{t.notifyAddedHint}</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
            <div className="task-acts">
              <SubmitButton className="button" pendingLabel={dictionary(ctx.person.language).common.pending.adding}>{t.addSubmit}</SubmitButton>
              <Link className="button button--quiet" href={here}>{t.cancel}</Link>
            </div>
          </form>
        </section>
      )}

      {/*
        Nastavenia trasy — názov, popis a termín v jednom formulári
        (ZAKLAD-lista-ulozenia, 7. 10. 2026; predtým dva `<details>`). Hore pri
        názve a zbalené (Ján 2. 10. 2026) — mení sa zriedka; súhrn ukazuje
        termín aj bez rozbalenia. Termín len v dňoch od pridania (3. 10. 2026).
      */}
      <details className="card track-settings">
        <summary>
          <span>{t.settingsHeading}</span>
          <span className="quiet">{t.dueHeading}: {t.dueCurrent(track.due?.days ?? null)}</span>
        </summary>
        <form action={saveTrackSettingsAction} className="track-settings-body">
          <input type="hidden" name="key" value={track.key} />
          <label className="field">
            <span className="field-label">{t.title}</span>
            <input className="field-input" name="title" defaultValue={track.title} required />
          </label>
          <label className="field">
            <span className="field-label">{t.description}</span>
            <input className="field-input" name="description" defaultValue={track.description ?? ""} />
          </label>
          {/* Dve voľby s fajkou vpravo a pole dní pod svojou voľbou — ten istý
              tvar ako termín na /hr/assign (ZAKLAD-vyber-a-prepinace, P7).
              Meno `dueMode` a hodnoty bez zmeny. */}
          <fieldset className="form-group">
            <legend className="form-group-head">{t.dueHeading}</legend>
            <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
                <label className="form-row choice-row">
                  <input type="radio" name="dueMode" value="none" defaultChecked={!track.due} />
                  <span className="form-row-main">{t.dueNone}</span>
                </label>
                <label className="form-row choice-row">
                  <input type="radio" name="dueMode" value="days" defaultChecked={Boolean(track.due)} />
                  <span className="form-row-main">{t.dueDays}</span>
                </label>
                <div className="choice-field">
                  <input className="field-input" type="number" min={1} max={365} name="dueDays"
                         defaultValue={track.due?.days ?? 14} aria-label={t.dueDaysUnit} />
                  <span className="quiet">{t.dueDaysUnit}</span>
                </div>
              </div>
            </div>
            <p className="form-group-foot quiet">{t.dueNote}</p>
          </fieldset>
          <div><SubmitButton className="button button--quiet">{t.saveSettings}</SubmitButton></div>
        </form>
      </details>

      {/* ── kroky ── */}

      <h2 style={{ fontSize: "var(--fs-section)", letterSpacing: "-0.01em", margin: "0 0 12px" }}>{t.steps}</h2>

      {steps.length === 0 && (
        <p className="card" style={{ padding: 20, margin: "0 0 20px" }}>{t.noSteps}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 12 }}>
        {steps.map((s, i) => (
          <li key={s.documentId} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{i + 1}.</span>
              <strong style={{ fontSize: "var(--fs-lead)", flex: "1 1 240px" }}>
                {titles.get(s.documentId!) ?? s.documentId}
              </strong>
              <span className="tag">{s.requiresAcknowledgement ? t.ackYes : t.ackNo}</span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
              <form action={moveStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <input type="hidden" name="direction" value="up" />
                <SubmitButton className="button button--quiet" disabled={i === 0}>
                  {t.moveUp}
                </SubmitButton>
              </form>
              <form action={moveStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <input type="hidden" name="direction" value="down" />
                <SubmitButton className="button button--quiet" disabled={i === steps.length - 1}>
                  {t.moveDown}
                </SubmitButton>
              </form>
              <form action={removeStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <SubmitButton className="button button--quiet">{t.remove}</SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <form action={addStepAction} className="card" style={{ padding: 20, display: "grid", gap: 14, margin: "0 0 32px" }}>
          {carry}
          <div className="field">
            <span className="field-label">{t.addStep}</span>
            <Select language={ctx.person.language}
              name="documentId"
              options={[{ value: "", label: t.chooseDocument }, ...available]}
              initial=""
              fieldLabel={t.addStep}
            />
          </div>

          {/* Áno/nie ako prepínač (DESIGN_ODCHYLKY P6); meno a hodnota bez zmeny. */}
          <label className="form-row form-row--bare">
            <input type="checkbox" role="switch" className="toggle" name="requiresAcknowledgement" defaultChecked />
            <span className="form-row-main">
              <span>{t.requiresAck}</span>
              <span className="form-row-sub">{t.requiresAckHint}</span>
            </span>
          </label>

          <p style={{ margin: 0 }}>
            <SubmitButton className="button button--quiet">{t.addStep}</SubmitButton>
          </p>
        </form>
      )}

      {/* ── ľudia na trase ── */}

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 12px" }}>
        <h2 style={{ fontSize: "var(--fs-section)", letterSpacing: "-0.01em", margin: 0, flex: "1 1 auto" }}>{t.members(members.length)}</h2>
        {track.isActive && missing > 0 && (
          <Link className="button button--quiet" href={`${here}/notify`}>{dictionary(ctx.person.language).hr.overview.notifyByEmail}</Link>
        )}
      </div>
      {members.length === 0 ? (
        <p className="quiet" style={{ margin: "0 0 16px" }}>{t.noMembers}</p>
      ) : (
        <ul className="track-members">
          {members.map(p => (
            <li key={p.id} className="track-member">
              <span className="track-member-name">
                <strong>{p.fullName}</strong>
                {p.department && <span className="quiet"> · {p.department}</span>}
                {p.status === "inactive" && <span className="quiet"> · {t.membersInactive}</span>}
                {status?.perPerson.get(p.id) && (() => {
                  const s = status.perPerson.get(p.id)!
                  return <span className={s.done === s.total ? "tag tag--published" : "tag"} style={{ marginLeft: 8 }}>{s.done} / {s.total}</span>
                })()}
                {dueByPerson.get(p.id) && (
                  <span className="quiet"> · {tp.dueBy(formatDate(dueByPerson.get(p.id)!, ctx.person.language))}</span>
                )}
              </span>
              <form action={removeMemberAction}>
                <input type="hidden" name="key" value={track.key} />
                <input type="hidden" name="personId" value={p.id} />
                <SubmitButton className="button button--quiet">{t.removeMember}</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* ── zapnutie ── */}

      {/* Vratné — tiché, nie `--danger` (ZAKLAD-lista-ulozenia). */}
      <section className="card more track-more">
        <div className="more-head"><h2>{dictionary(ctx.person.language).common.moreActions}</h2></div>
        <div className="more-row">
          <div className="more-main">
            <b>{track.isActive ? t.deactivateTitle : t.activateTitle}</b>
            <span>{track.isActive ? t.deactivateNote : t.activateNote}</span>
          </div>
          <form action={setTrackActiveAction}>
            <input type="hidden" name="key" value={track.key} />
            <input type="hidden" name="isActive" value={track.isActive ? "0" : "1"} />
            <SubmitButton className="button button--quiet">
              {track.isActive ? t.disable : t.enable}
            </SubmitButton>
          </form>
        </div>
      </section>

    </div>
    </AppShell>
  )
}
