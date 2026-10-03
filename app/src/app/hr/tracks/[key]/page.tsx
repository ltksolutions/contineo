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
  renameTrackAction, addStepAction, removeStepAction, moveStepAction, setTrackActiveAction,
  addMembersAction, removeMemberAction, setTrackDueAction,
} from "../actions"
import AppShell from "@/components/AppShell"

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
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)

  const t = dictionary(ctx.person.language).library.tracks
  const branding = brandingView(ctx.tenant)

  const track = await trackByKey(ctx.tenant.companyCode, key)
  if (!track) notFound()

  const documents = await libraryList(ctx.tenant.companyCode, {})
  const titles = new Map(documents.map(d => [d.documentId, d.title]))
  const steps = track.steps.filter(s => s.documentId)

  const here = `/hr/tracks/${encodeURIComponent(track.key)}`

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
      <Notice message={message ?? error} error={Boolean(error)} back={here} />


      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 className="page-title" style={{ margin: 0, flex: "1 1 auto" }}>
          {track.title}
        </h1>
        <span
          className="tag"
          style={track.isActive ? { background: "var(--ok-bg)", color: "var(--ok-fg)" } : undefined}
        >
          {track.isActive ? t.active : t.inactive}
        </span>
      </div>
      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 12px" }}>
        {t.stepCount(steps.length)}
      </p>

      {/*
        Názov a popis — hore pri názve, nie pod krokmi. Na konci stránky bez
        nadpisu ho Ján nenašiel (2. 10. 2026). `<details>`, takže bez
        JavaScriptu; zbalené, lebo sa mení zriedka.
      */}
      <details className="track-edit" style={{ margin: "0 0 24px" }}>
        <summary className="button button--quiet">{t.edit}</summary>
        <form action={renameTrackAction} className="card" style={{ padding: 20, display: "grid", gap: 16, marginTop: 12 }}>
          <input type="hidden" name="key" value={track.key} />
          <label className="field">
            <span className="field-label">{t.title}</span>
            <input className="field-input" name="title" defaultValue={track.title} required />
          </label>
          <label className="field">
            <span className="field-label">{t.description}</span>
            <input className="field-input" name="description" defaultValue={track.description ?? ""} />
          </label>
          <p style={{ margin: 0 }}>
            <button className="button" type="submit">{t.rename}</button>
          </p>
        </form>
      </details>

      {/*
        Termín potvrdenia (3. 10. 2026) — len dni od pridania na trasu; pevný
        dátum by neskôr pridaným nechal len zvyšok lehoty. Zbalené ako názov,
        zhrnutie je vidieť aj bez rozbalenia.
      */}
      <details className="track-edit" style={{ margin: "0 0 24px" }}>
        <summary className="button button--quiet">{t.dueHeading}: {t.dueCurrent(track.due?.days ?? null)}</summary>
        <form action={setTrackDueAction} className="card" style={{ padding: 20, display: "grid", gap: 14, marginTop: 12 }}>
          <input type="hidden" name="key" value={track.key} />
          <label className="check-row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="radio" name="dueMode" value="none" defaultChecked={!track.due} />
            <span>{t.dueNone}</span>
          </label>
          <label className="check-row" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input type="radio" name="dueMode" value="days" defaultChecked={Boolean(track.due)} />
            <span>{t.dueDays}</span>
          </label>
          <label className="field" style={{ maxWidth: 220 }}>
            <span className="quiet field-label">{t.dueDaysUnit}</span>
            <input className="field-input" type="number" min={1} max={365} name="dueDays"
                   defaultValue={track.due?.days ?? 14} />
          </label>
          <span className="quiet field-hint">{t.dueNote}</span>
          <p style={{ margin: 0 }}>
            <button className="button" type="submit">{t.dueSave}</button>
          </p>
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
                <button className="button button--quiet" type="submit" disabled={i === 0}>
                  {t.moveUp}
                </button>
              </form>
              <form action={moveStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <input type="hidden" name="direction" value="down" />
                <button className="button button--quiet" type="submit" disabled={i === steps.length - 1}>
                  {t.moveDown}
                </button>
              </form>
              <form action={removeStepAction}>
                {carry}
                <input type="hidden" name="documentId" value={s.documentId!} />
                <button className="button button--quiet" type="submit">{t.remove}</button>
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

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--fs-body)" }}>
            <input type="checkbox" name="requiresAcknowledgement" defaultChecked style={{ marginTop: 3 }} />
            <span>
              {t.requiresAck}
              <span className="quiet" style={{ display: "block", fontSize: "var(--fs-small)" }}>{t.requiresAckHint}</span>
            </span>
          </label>

          <p style={{ margin: 0 }}>
            <button className="button" type="submit">{t.addStep}</button>
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
                <button className="button button--quiet" type="submit">{t.removeMember}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <details className="track-edit" style={{ margin: "0 0 32px" }}>
        <summary className="button">{t.addMembers}</summary>
        <form action={addMembersAction} className="card" style={{ padding: 20, display: "grid", gap: 16, marginTop: 12 }}>
          <input type="hidden" name="key" value={track.key} />
          <p className="quiet field-hint" style={{ margin: 0 }}>{t.addMembersNote}</p>
          {departmentOptions.length > 0 && (
            <div>
              <div className="hr-subtitle">{t.departments}</div>
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
          )}
          {choices.length > 0 && (
            <div>
              <div className="hr-subtitle">{t.people}</div>
              <PeopleSearch
                people={choices}
                name="person"
                language={ctx.person.language}
                multiple
                listLabel={t.people}
                missing="people"
              />
            </div>
          )}
          {/* Predvolene zaškrtnuté (Ján, 3. 10. 2026) — kto na trasu pribudne, má
              sa to dozvedieť hneď, nie až z pripomienky pred termínom. Odškrtnúť
              sa dá, takže e-mail ostáva rozhodnutím personalistu. */}
          {track.isActive && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "var(--fs-body)" }}>
              <input type="checkbox" name="notify" value="1" defaultChecked style={{ marginTop: 3 }} />
              <span>
                {t.notifyAdded}
                <span className="quiet" style={{ display: "block", fontSize: "var(--fs-small)" }}>{t.notifyAddedHint}</span>
              </span>
            </label>
          )}
          <p style={{ margin: 0 }}>
            <button className="button" type="submit">{t.addSubmit}</button>
          </p>
        </form>
      </details>

      {/* ── zapnutie ── */}

      <form action={setTrackActiveAction} style={{ margin: "0 0 32px" }}>
        <input type="hidden" name="key" value={track.key} />
        <input type="hidden" name="isActive" value={track.isActive ? "0" : "1"} />
        <button className="button button--quiet" type="submit">
          {track.isActive ? t.disable : t.enable}
        </button>
      </form>

    </div>
    </AppShell>
  )
}
