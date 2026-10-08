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

import Link from "next/link"
import { Fragment } from "react"
import { notFound, redirect } from "next/navigation"
import MultiSelect from "@/components/MultiSelect"
import PeopleSearch, { DocumentSearch } from "@/components/PeopleSearch"
import { AssignFinish, AudienceAll } from "@/components/AssignForm"
import { sortPeopleBySurname } from "@/lib/assignOrder"
import { audienceSignature } from "@/lib/assignSummary"
import { listPeople } from "@/lib/people"
import { treeOptions } from "@/lib/treeOptions"
import { hrContext, assignableDocuments } from "@/lib/hr"
import { audienceFromSelection, audienceImpact, type Audience } from "@/lib/assignments"
import { audiencesInOrg } from "@/lib/persons"
import { trackNames } from "@/lib/tracks"
import { allDepartments, flattenTree, counts } from "@/lib/departments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import { assignAction, previewAssignAction } from "../actions"
import { normalizeQuery, hrefWithout, type RawQuery } from "@/lib/urlParams"
import Notice from "@/components/Notice"
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

  const raw = await searchParams
  const q = normalizeQuery<Query>(raw)
  const [documents, audiences, tree, departmentCounts, people, names] = await Promise.all([
    assignableDocuments(ctx.person.companyCode),
    audiencesInOrg(ctx.person.companyCode),
    allDepartments(ctx.person.companyCode),
    counts(ctx.person.companyCode),
    listPeople(ctx.person.companyCode),
    trackNames(ctx.person.companyCode),
  ])
  const treeRows = flattenTree(tree)
  const branding = brandingView(ctx.tenant)
  const t = dictionary(ctx.person.language).hr.assign
  const tr = dictionary(ctx.person.language).responsibility
  const language = ctx.person.language

  const selectedDocuments = new Set(asArray(q.document))
  const selectedAudiences = new Set(asArray(q.audience))
  /*
   * Jednotlivé osoby (KOMPONENT-hladanie-osob, Q3). Hodnota je
   * `person:<e-mail>` — to isté publikum, aké vznikne z napísanej adresy,
   * takže server ani pridelenie nič nové nepoznajú. Vyradení sa neponúkajú:
   * povinnosť by čakala na niekoho, kto v zväze nie je.
   */
  const personChoices = sortPeopleBySurname(people.filter(p => p.status !== "inactive"))
    .map(p => ({ id: `person:${p.email.toLowerCase()}`, fullName: p.fullName, email: p.email, department: p.department }))

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
        trackNames: names,
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

  /*
   * Normy pre `DocumentSearch` — poradie už prišlo zo servera (najnovšie
   * účinné znenie hore, `assignableDocuments()`). Riadok nesie znenie a príznak
   * chýbajúceho právneho základu (D91 — upozornenie, nie brána).
   */
  const documentItems = documents.map(d => ({
    id: d.documentId,
    name: d.title,
    meta: [t.versionLine(d.versionLabel ?? "", formatDate(d.effectiveFrom, language))],
    flagged: d.legalBasisMissing,
  }))
  /*
   * Podpis výberu publika, pre ktorý sa dopad počítal (bod 8). Prehliadač ho
   * porovná so živým výberom; keď sa líšia, dopad je zastaraný. Počíta sa z tej
   * istej adresy ako `impact`, nie z formulára — to je výber, ktorý sa kontroloval.
   */
  const previewSignature = impact
    ? audienceSignature({ all: q.all === "1", audience: [...selectedAudiences], addresses: q.addresses ?? "" })
    : null
  const impactView = impact
    ? {
        people: impact.people,
        breakdown: impact.perAudience.map(p => `${audienceName(p.audience)} (${p.count})`).join(", "),
      }
    : null

  return (
    <AppShell language={ctx.person.language} title={t.heading}>
    {/* 1180 namiesto 680 (Q1): dva stĺpce od 1100 px. Pod tým jeden stĺpec
        v dnešnom poradí — na telefóne sa nič nemení. */}
    <div className="assign-page" style={tenantStyle(branding)}>

      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      {/* Chyba ako oznam s potvrdením, nie karta hore — pri dlhom formulári
          je človek dole pri tlačidle a kartu by nevidel. Výber v adrese ostáva. */}
      <Notice language={language} message={q.error} error back={hrefWithout("/hr/assign", raw, ["error"])} />

      {documents.length === 0 ? (
        <div className="empty">
          <div className="empty-title">{t.emptyTitle}</div>
          <div className="empty-text">{t.emptyText}</div>
        </div>
      ) : (
        <form id="assign-form" action={assignAction} className="assign">
          {/* Normy | Komu vedľa seba (HR-pridelit-normy-hladanie, bod 1).
              Čísla krokov sú len orientácia, nie sprievodca (bod 6). Nadpis
              kroku nad kartou, nie v jej čiare (HR-pridelit-nadpis-karty). */}
          <div className="assign-cols">
          <fieldset className="form-group form-group--lg">
            <legend className="form-group-head form-group-head--step">
              <span className="assign-step" aria-hidden="true">1</span>
              {t.whichDocuments} <span className="quiet hr-count">{t.documentsCount(documents.length)}</span>
            </legend>
            <div className="card form-group-body form-group-body--rows">
            {/* Upozornenie, nie brána (D91): pridelenie bez právneho základu
                prejde. Jantárový rámček namiesto sivej nápovedy (rám HR, bod 1). */}
            {documents.some(d => d.legalBasisMissing) && (
              <p className="hr-warn"><span aria-hidden="true">⚠</span> {tr.missingBasisNote}</p>
            )}
            {/* Ten istý obal ako osoby (bod 2): od 8 noriem hľadanie, čipy,
                Enter nikdy neodošle formulár. Hodnoty `document` sa nemenia. */}
            <DocumentSearch
              items={documentItems}
              name="document"
              language={language}
              defaultSelected={documents.filter(d => selectedDocuments.has(d.documentId)).map(d => d.documentId)}
              listLabel={t.whichDocuments}
              listClassName="assign-doc-list"
            />
            </div>
          </fieldset>

          <fieldset className="form-group form-group--lg">
            <legend className="form-group-head form-group-head--step">
              <span className="assign-step" aria-hidden="true">2</span>
              {t.to}
            </legend>

            {/* „Všetkým" je prepínač nad ostatným výberom (ZAKLAD-vyber-a-prepinace,
                Q2) — s JS sa zvyšok stlmí (Q4), hodnoty ostávajú. Každé
                publikum má vlastnú kartu s nadpisom nad ňou. */}
            <AudienceAll label={t.everyone} note={t.everyoneNote} defaultChecked={q.all === "1"}>

            {/*
              Oddelenia ako výber s hľadaním a stromom (rám
              KOMPONENT-vyber-oddelenia, 24. 9. 2026) — dovtedy štítky
              v strome, pri desiatkach oddelení stena. Hodnoty sú tie isté
              `department:<id>` ako predtým; bez JavaScriptu zaškrtávacie
              políčka. Počet ľudí vrátane podriadených (`withDescendants`).
            */}
            {treeRows.length > 0 && (
              <fieldset className="form-group assign-sub">
                <legend className="form-group-head">{t.departments}</legend>
                <div className="card form-group-body">
                <MultiSelect
                  name="audience"
                  emit="repeat"
                  caseSensitive
                  noscript="checkboxes"
                  language={language}
                  note={`${t.departmentNoteBefore}${t.departmentNoteHighlight}${t.departmentNoteAfter}`}
                  selected={[...selectedAudiences].filter(a => a.startsWith("department:"))}
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

            {audiences.groups.length === 0 && audiences.tracks.length === 0 ? (
              // Bez príkazu pre vývojára: kde v aplikácii skupina a trasa
              // vznikne (D38; ZAKLAD-zvysne-odchylky, 8. 10. 2026).
              <div className="card empty assign-empty">
                <div className="empty-title">{t.noAudiencesTitle}</div>
                <div className="empty-text">{t.noAudiencesText}</div>
                <div className="empty-links">
                  <Link href="/people">{t.linkPeople}</Link>
                  <Link href="/people/import">{t.linkImport}</Link>
                  <Link href="/hr/tracks">{t.linkTracks}</Link>
                </div>
              </div>
            ) : (
              <>
                {/* Skupiny a trasy ako riadky s kruhom vľavo, nie pilulky
                    (ZAKLAD-vyber-a-prepinace, Q3). Počet ľudí vpravo. */}
                {audiences.groups.length > 0 && (
                  <fieldset className="form-group assign-sub">
                    <legend className="form-group-head">{t.groups}</legend>
                    <div className="card form-group-body form-group-body--rows">
                    <div className="form-list">
                      {audiences.groups.map(s => (
                        <label key={`g-${s.value}`} className="form-row select-row">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`group:${s.value}`}
                            defaultChecked={selectedAudiences.has(`group:${s.value}`)}
                          />
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
                    <legend className="form-group-head">{t.tracks}</legend>
                    <div className="card form-group-body form-group-body--rows">
                    <div className="form-list">
                      {audiences.tracks.map(t => (
                        <label key={`t-${t.value}`} className="form-row select-row">
                          <input
                            type="checkbox"
                            name="audience"
                            value={`track:${t.value}`}
                            defaultChecked={selectedAudiences.has(`track:${t.value}`)}
                          />
                          {/* Názov, nie kľúč — kľúč sa ľuďom neukazuje (2. 10. 2026). */}
                          <span className="form-row-main">{names[t.value] ?? t.value}</span>
                          <span className="form-row-sub">{t.count}</span>
                        </label>
                      ))}
                    </div>
                    </div>
                  </fieldset>
                )}
              </>
            )}

            {/* Osoby podľa priezviska (bod 5), ako adresár. */}
            {personChoices.length > 0 && (
              <fieldset className="form-group assign-sub">
                <legend className="form-group-head">{t.people}</legend>
                <div className="card form-group-body form-group-body--rows">
                <PeopleSearch
                  people={personChoices}
                  name="audience"
                  language={language}
                  multiple
                  defaultSelected={personChoices.filter(p => selectedAudiences.has(p.id)).map(p => p.id)}
                  listLabel={t.people}
                  missing="people"
                />
                </div>
              </fieldset>
            )}

            <div className="assign-sub">
            <label className="field card form-group-body">
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
            </label>
            <p className="form-group-foot quiet">{t.addressesNote}</p>
            </div>
            </AudienceAll>
          </fieldset>
          </div>

          {/* Dôvod | Termín ako dve skupiny vedľa seba, pod nimi súhrn
              a tlačidlá v karte bez nadpisu (HR-pridelit-nadpis-karty, Q4).
              Nápovedy pod kartou (Q3). */}
          <div className="assign-finish-grid">
          <fieldset className="form-group form-group--lg">
            <legend id="assign-reason" className="form-group-head form-group-head--step">
              <span className="assign-step" aria-hidden="true">3</span>
              {t.reason}
            </legend>
            <div className="card form-group-body">
            {/* Textarea nemá vlastný `<label>` — názov nesie legenda nad kartou. */}
            <textarea
              name="reason"
              defaultValue={q.reason ?? ""}
              required
              rows={4}
              className="field-input"
              placeholder={t.reasonPlaceholder}
              aria-labelledby="assign-reason"
            />
            </div>
            <p className="form-group-foot quiet">{t.reasonNote}</p>
          </fieldset>

          {/*
            Termín (D61). **Výslovná voľba, nie „čo je vyplnené, to platí"** —
            prázdne pole je dvojznačné a pri sľube danom človeku sa hádať nemá,
            či termín nechcel, alebo ho zabudol vyplniť.

            Pole nezvolenej voľby skrýva len CSS (`.choice-field`, varianta A
            z 6. 10. 2026) — bez JavaScriptu a hodnota ostáva vo formulári,
            takže kto sa prepne z dátumu na dni a späť, o svoj dátum nepríde.
          */}
          <fieldset className="form-group form-group--lg">
            <legend className="form-group-head form-group-head--step">
              <span className="assign-step" aria-hidden="true">4</span>
              {t.due}
            </legend>
            <div className="card form-group-body form-group-body--rows">

            {/*
              Tri voľby s fajkou vpravo, pole pod svojou voľbou
              (ZAKLAD-vyber-a-prepinace, Picker .inline). Tie isté mená
              a hodnoty ako predtým výber (`dueMode` none/date/days) — server
              (`dueFromFields()`) číta to isté. Bez JavaScriptu funguje rovnako.
            */}
            <div className="form-list">
              {([
                ["none", t.dueNone, null],
                ["date", t.dueDate, (
                  <input key="d" type="date" name="dueDate" defaultValue={q.dueDate ?? ""}
                         className="field-input" aria-label={t.dueDate} />
                )],
                ["days", t.dueDays, (
                  <input key="n" type="number" name="dueDays" min={1} step={1} defaultValue={q.dueDays ?? ""}
                         className="field-input" inputMode="numeric" aria-label={t.dueDaysUnit}
                         placeholder={t.dueDaysUnit} />
                )],
              ] as [string, string, React.ReactNode][]).map(([value, label, input]) => (
                <Fragment key={value}>
                  <label className="form-row choice-row">
                    <input type="radio" name="dueMode" value={value} defaultChecked={(q.dueMode ?? "none") === value} />
                    <span className="form-row-main">{label}</span>
                  </label>
                  {input && <div className="choice-field">{input}</div>}
                </Fragment>
              ))}
            </div>
            </div>
            <p className="form-group-foot quiet">{t.dueNote}</p>
          </fieldset>
          </div>

          {/*
            Súhrn výberu, dopad a tlačidlá (body 7 a 8). Dopad počíta len server
            po „Skontrolovať dopad" (Ján, 22. 9. 2026) — súhrn nad ním je počet
            vybraných položiek, nie počet ľudí.
          */}
          <div className="card form-group-body form-group-body--lg">
          <AssignFinish
            formId="assign-form"
            language={language}
            impact={impactView}
            previewSignature={previewSignature}
            previewAction={previewAssignAction}
          />
          </div>
        </form>
      )}
    </div>
    </AppShell>
  )
}
