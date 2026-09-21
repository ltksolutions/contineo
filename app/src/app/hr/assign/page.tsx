/**
 * Prideliť normy — hromadne.
 *
 * Prideľuje sa **N noriem × M publík naraz**, s jedným spoločným dôvodom.
 * Nie je to zrýchlenie pre lenivých: reálne zadanie znie „nový rozhodca
 * dostáva päť predpisov" alebo „novela sa týka rozhodcov aj delegátov aj
 * klubov". Prideľovať to po jednom znamená napísať ten istý dôvod pätnásťkrát
 * — a pri pätnástom už nikto nepíše to isté, takže sa záznamy o tej istej
 * udalosti rozídu.
 *
 * Serverový formulár bez klientskeho stavu: funguje aj bez jediného riadku
 * JavaScriptu a po chybe sa vráti aj s celým výberom. Zaškrtávacie políčka,
 * nie `select multiple` — ten sa na telefóne ovláda mizerne a viacnásobný
 * výber v ňom nie je vidieť.
 *
 * **Dôvod je povinný.** Systém nevie odlíšiť opravu preklepu od novej
 * povinnosti (D30) a nemá sa o to pokúšať; rozhodne to človek a tu to napíše.
 * O rok je to jediné miesto, kde sa dá zistiť, prečo sto ľudí muselo niečo
 * potvrdiť znova.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext, assignableDocuments } from "@/lib/hr"
import { audienceFromSelection, audienceImpact, type Audience } from "@/lib/assignments"
import { audiencesInOrg } from "@/lib/persons"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import { assignAction, previewAssignAction } from "../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Select from "@/components/Select"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

/** Hodnoty z adresy sa vracajú späť do formulára — viď `spatSChybou`. */
function asArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

type Query = {
  error?: string
  document?: string | string[]
  audience?: string | string[]
  all?: string
  addresses?: string
  reason?: string
  dueMode?: string
  dueDate?: string
  dueDays?: string
  /** `1` po kroku „Skontrolovať dopad" — súhrn sa počíta z výberu v adrese. */
  preview?: string
}

export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<Query>(await searchParams)
  const [documents, audiences, tree, departmentCounts] = await Promise.all([
    assignableDocuments(ctx.person.companyCode),
    audiencesInOrg(ctx.person.companyCode),
    allDepartments(ctx.person.companyCode),
    counts(ctx.person.companyCode),
  ])
  const treeRows = flattenTree(tree)
  const branding = brandingView(ctx.tenant)
  const t = dictionary(ctx.person.language).hr.assign
  const language = ctx.person.language

  const selectedDocuments = new Set(asArray(q.document))
  const selectedAudiences = new Set(asArray(q.audience))

  /*
   * Súhrn dopadu (HR.md, úloha 3) — až po kroku „Skontrolovať dopad":
   * formulár beží bez skriptu, takže výber je na serveri až po odoslaní.
   * Číslo ide cez `audienceImpact()` → `matchesAudience()`, jediné miesto
   * s pravidlom príslušnosti; tu sa nič nepočíta druhýkrát. Číslo pred
   * odoslaním je jediná poistka proti prekliku: prideliť je nevratné v tom,
   * že ľuďom sa objaví povinnosť a chodia im pripomienky.
   */
  const departmentNames = Object.fromEntries(tree.map(o => [o.id, o.name]))
  const previewAudiences = q.preview === "1"
    ? audienceFromSelection({
        all: q.all === "1",
        selected: [...selectedAudiences],
        addresses: q.addresses,
        departmentNames,
      })
    : []
  const impact = previewAudiences.length > 0
    ? await audienceImpact(ctx.person.companyCode, previewAudiences)
    : null
  const audienceName = (a: Audience): string => {
    switch (a.kind) {
      case "all": return t.everyone
      case "department": return a.label ?? a.value ?? ""
      default: return a.value ?? ""
    }
  }

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/hr" style={{ fontSize: "var(--fs-body)" }}>{t.back}</Link>
      </p>

      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      {q.error && (
        <p
          className="card"
          style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: "var(--fs-body)", color: "var(--warn-fg)" }}
        >
          {q.error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="card" style={{ padding: 20, fontSize: "var(--fs-lead)" }}>
          {t.noEffectiveVersion}
        </p>
      ) : (
        <form action={assignAction} style={{ display: "grid", gap: 22 }}>
          <fieldset className="card hr-group">
            <legend className="field-label">{t.whichDocuments}</legend>
            <ul className="hr-choices">
              {documents.map(d => (
                <li key={d.documentId}>
                  <label className="hr-choice">
                    <input
                      type="checkbox"
                      name="document"
                      value={d.documentId}
                      defaultChecked={selectedDocuments.has(d.documentId)}
                    />
                    <span>
                      {d.title}
                      <span className="quiet field-hint">
                        {" "}{t.versionLine(d.versionLabel ?? "", formatDate(d.effectiveFrom, language))}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="card hr-group">
            <legend className="field-label">{t.to}</legend>

            <label className="hr-choice" style={{ marginBottom: 10 }}>
              <input type="checkbox" name="all" value="1" defaultChecked={q.all === "1"} />
              <span>
                <strong>{t.everyone}</strong>
                <span className="quiet field-hint">
                  {" "}{t.everyoneNote}
                </span>
              </span>
            </label>

            {treeRows.length > 0 && (
              <>
                <div className="hr-subtitle">{t.departments}</div>
                <p className="quiet field-hint" style={{ margin: "0 0 8px" }}>
                  {t.departmentNoteBefore}<strong>{t.departmentNoteHighlight}</strong>{t.departmentNoteAfter}
                </p>
                <div className="tags-list">
                  {treeRows.map(({ department: department, level: level }) => {
                    const p = departmentCounts.get(department.id) ?? { direct: 0, withDescendants: 0 }
                    return (
                      <label
                        key={`d-${department.id}`}
                        className="tag tag--choice tag--field"
                        style={{ marginLeft: (level - 1) * 14 }}
                      >
                        <input
                          type="checkbox"
                          name="audience"
                          value={`department:${department.id}`}
                          defaultChecked={selectedAudiences.has(`department:${department.id}`)}
                        />
                        <span className="tag-mark" aria-hidden="true" />
                        {department.name}
                        <span className="tag-count">{p.withDescendants}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            {audiences.groups.length === 0 && audiences.tracks.length === 0 ? (
              <p className="quiet field-hint" style={{ margin: "10px 0 0" }}>
                {t.noGroupsOrTracks}
                <code> npm run person</code>.
              </p>
            ) : (
              <>
                {/* Rovnaké štítky ako pri úprave osoby — tá istá vec má
                    vyzerať rovnako. Tu ich ale nesie zaškrtávacie políčko,
                    lebo tento formulár funguje aj bez JavaScriptu. */}
                {audiences.groups.length > 0 && (
                  <>
                    <div className="hr-subtitle">{t.groups}</div>
                    <div className="tags-list">
                      {audiences.groups.map(s => (
                        <label key={`g-${s.value}`} className="tag tag--choice tag--field">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`group:${s.value}`}
                            defaultChecked={selectedAudiences.has(`group:${s.value}`)}
                          />
                          <span className="tag-mark" aria-hidden="true" />
                          {s.value}
                          <span className="tag-count">{s.count}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {audiences.tracks.length > 0 && (
                  <>
                    <div className="hr-subtitle">{t.tracks}</div>
                    <div className="tags-list">
                      {audiences.tracks.map(t => (
                        <label key={`t-${t.value}`} className="tag tag--choice tag--field">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`track:${t.value}`}
                            defaultChecked={selectedAudiences.has(`track:${t.value}`)}
                          />
                          <span className="tag-mark" aria-hidden="true" />
                          {t.value}
                          <span className="tag-count">{t.count}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <label className="field" style={{ marginTop: 14 }}>
              <span className="field-label">{t.addresses}</span>
              <textarea
                className="field-input"
                name="addresses"
                rows={2}
                defaultValue={q.addresses ?? ""}
                placeholder="jan.novak@example.sk, eva.mala@example.sk"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className="quiet field-hint">
                {t.addressesNote}
              </span>
            </label>
          </fieldset>

          <label className="field">
            <span className="field-label">{t.reason}</span>
            <textarea
              name="reason"
              defaultValue={q.reason ?? ""}
              required
              rows={3}
              className="field-input"
              placeholder={t.reasonPlaceholder}
            />
            <span className="quiet field-hint">
              {t.reasonNote}
            </span>
          </label>

          {/*
            Termín (D61). **Výslovná voľba, nie „čo je vyplnené, to platí"** —
            prázdne pole je dvojznačné a pri sľube danom človeku sa hádať nemá,
            či termín nechcel, alebo ho zabudol vyplniť.

            Obe polia zostávajú vidieť aj vtedy, keď k voľbe nepatria:
            formulár beží bez JavaScriptu, takže sa skrývať nedajú — a kto sa
            prepne z dátumu na dni a späť, o svoj dátum nepríde.
          */}
          <fieldset className="hr-group">
            {/* `hr-group`, nie vlastný tvar: na tej istej stránke je nad tým
                rovnaký rámik okolo výberu publika. Druhý vzhľad pre druhý
                fieldset v jednom formulári je presne to, čo robí obrazovku
                nejednotnou. */}
            <legend className="field-label">{t.due}</legend>

            <Select
              name="dueMode"
              fieldLabel={t.due}
              initial={q.dueMode ?? "none"}
              options={[
                { value: "none", label: t.dueNone },
                { value: "date", label: t.dueDate },
                { value: "days", label: t.dueDays },
              ]}
            />

            <div className="due-fields">
              <label className="field">
                <span className="quiet field-label">{t.dueDate}</span>
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={q.dueDate ?? ""}
                  className="field-input"
                />
              </label>
              <label className="field">
                <span className="quiet field-label">{t.dueDaysUnit}</span>
                <input
                  type="number"
                  name="dueDays"
                  min={1}
                  step={1}
                  defaultValue={q.dueDays ?? ""}
                  className="field-input"
                  inputMode="numeric"
                />
              </label>
            </div>

            <span className="quiet field-hint">{t.dueNote}</span>
          </fieldset>

          <div>
            {impact && (
              <div className="assign-impact" role="status">
                <div className="assign-impact-count">{t.impactPeople(impact.people)}</div>
                <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {impact.perAudience.map(p => `${audienceName(p.audience)} (${p.count})`).join(", ")}
                  {". "}
                  {t.impactNote}
                </div>
              </div>
            )}

            {/* Dve tlačidlá, jeden formulár: „Skontrolovať dopad" je serverová
                akcia, ktorá nič nezapíše — vráti výber v adrese a súhrn hore.
                Funguje bez skriptu rovnako ako návrat s chybou. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="button" type="submit">{t.submit}</button>
              <button className="button button--quiet" type="submit" formAction={previewAssignAction}>
                {t.checkImpact}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
    </AppShell>
  )
}
