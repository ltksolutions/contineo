/**
 * /library/compliance/new — nová kontrola (KNIZ-kontroly-a-kola, 20. 10. 2026,
 * Q4: vlastná adresa). Jeden vstup pre oba druhy (ADR-036): súlad dokumentov
 * aj návrhy z helpdesku do manuálov — dovtedy formulár na zozname a zvlášť
 * karta „Navrhnúť doplnenie manuálov".
 *
 * Formulár ide metódou GET na rekapituláciu (`/library/compliance/confirm`,
 * D235) — tu sa nič nespúšťa. Pole Kanál sa ukáže len pri druhu helpdesk
 * (CSS `:has`); bez JavaScriptu je vidieť vždy a pri súlade sa ignoruje.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import MultiSelect from "@/components/MultiSelect"
import { complianceContext } from "@/lib/complianceAccess"
import { checkForChannel, roundsOf } from "@/lib/complianceChecks"
import { listChannels } from "@/lib/channels"
import { questionCounts } from "@/lib/helpdeskQuestions"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { categoryRank, documentRole } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function NewCheckPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ kind?: string; channel?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const dict = dictionary(language)
  const t = dict.library.compliance
  const code = ctx.tenant.companyCode
  const docs = await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: code }, { projection: { documentId: 1, title: 1, category: 1, accessLevel: 1 } })
    .sort({ title: 1 }).toArray() as unknown as { documentId: string; title?: string; category?: string; accessLevel?: string }[]
  const option = (d: (typeof docs)[number]) => ({ value: d.documentId, label: `${String(d.title ?? d.documentId)}${d.accessLevel === "internal" ? " · interný" : ""}` })
  // Úloha dokumentu (ADR-034, D218): kontroluje sa výkladový aj záväzný, záznam nie;
  // meradlom je len záväzný, od najvyššieho.
  const extras = tenantExtras(ctx.tenant)
  const subjectOptions = docs.filter(d => documentRole(d.category, extras) !== "record").map(option)
  const referenceOptions = docs.filter(d => documentRole(d.category, extras) === "binding")
    .sort((a, b) => categoryRank(a.category, extras) - categoryRank(b.category, extras) || String(a.title ?? "").localeCompare(String(b.title ?? ""), "sk"))
    .map(option)
  // Kanály s otázkami z helpdesku (ADR-034, D221) a ich existujúca kontrola (Q6).
  const counts = await questionCounts(code)
  const channels = await Promise.all((await listChannels(code)).filter(ch => (counts.get(ch.key) ?? 0) > 0).map(async ch => {
    const existing = await checkForChannel(code, ch.key)
    const rounds = existing ? (await roundsOf(code, existing.checkId)).length : 0
    return { key: ch.key, name: ch.name, questions: counts.get(ch.key) ?? 0, existing, rounds }
  }))
  const helpdesk = q.kind === "helpdesk" && channels.length > 0
  const chosenChannel = channels.find(c => c.key === q.channel)?.key ?? (channels.length === 1 ? channels[0].key : "")

  return (
    <AppShell language={language} title={t.ck.newHeading} trail={{ "/library": dict.library.list.heading, "/library/compliance": t.heading }}>
    <div className="detail-page ck-new" style={{ maxWidth: 760, ...tenantStyle(brandingView(ctx.tenant)) }}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{t.ck.newHeading}</h1>
          <p className="quiet page-lead">{t.ck.newLead}</p>
        </div>
      </div>

      <form method="get" action="/library/compliance/confirm" style={{ display: "grid", gap: 18 }}>
        {/* Druh (SwiftUI `Picker(.inline)`) — kanál pod riadkom helpdesku (`.choice-field`). */}
        <fieldset className="form-group">
          <legend className="form-group-head">{t.ck.kindLabel}</legend>
          <div className="card form-group-body form-group-body--rows">
            <div className="form-list">
              <label className="form-row choice-row">
                <input type="radio" name="kind" value="documents" defaultChecked={!helpdesk} />
                <span className="form-row-main">
                  <span>{t.ck.kindDocuments}</span>
                  <span className="form-row-sub">{t.ck.kindDocumentsSub}</span>
                </span>
              </label>
              {channels.length > 0 && (
                <>
                  <label className="form-row choice-row">
                    <input type="radio" name="kind" value="helpdesk" defaultChecked={helpdesk} />
                    <span className="form-row-main">
                      <span>{t.ck.kindHelpdeskTitle}</span>
                      <span className="form-row-sub">{t.ck.kindHelpdeskSub}</span>
                    </span>
                  </label>
                  <div className="choice-field choice-field--block ck-channels">
                    <span className="field-label">{t.ck.channelLabel}</span>
                    {channels.map(ch => (
                      <div key={ch.key} className="ck-channel">
                        <label className="ck-channel-row">
                          <input type="radio" name="channelKey" value={ch.key} defaultChecked={ch.key === chosenChannel} />
                          <span><b>{ch.name}</b> <span className="quiet">· {t.helpdeskIntro(ch.questions)}</span></span>
                        </label>
                        {ch.existing && (
                          <div className="lnote lnote--warn">
                            <span className="lnote-mark" aria-hidden="true">!</span>
                            <div className="lnote-text">
                              {t.ck.channelHasCheck(ch.existing.name || t.helpdeskRunName(ch.name), t.ck.rounds(ch.rounds))}{" "}
                              <Link href={`/library/compliance/confirm?check=${encodeURIComponent(ch.existing.checkId)}`}>{t.ck.startRoundThere(ch.rounds + 1)}</Link>
                              <small>{t.ck.newCheckNoCarry}</small>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <span className="quiet field-hint">{t.ck.helpdeskSubjectsNote}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {channels.length === 0 && <p className="form-group-foot quiet">{t.ck.noChannels}</p>}
        </fieldset>

        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">{t.nameLabel}</span>
          <input className="field-input" name="name" maxLength={120} />
          <span className="quiet field-hint">{t.nameHint}</span>
        </label>

        {/* Prázdny výber (Ján 11. 10. 2026: „mám prednastavené posledné dokumenty, to nie je ok"). */}
        <div className="field" style={{ margin: 0 }}>
          <span className="field-label">{t.subjects}</span>
          <MultiSelect name="subjectIds" options={subjectOptions} selected={[]} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
          <span className="quiet field-hint">{t.subjectsHint}</span>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <span className="field-label">{t.references}</span>
          <MultiSelect name="documentIds" options={referenceOptions} selected={[]} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
          <span className="quiet field-hint">{t.ck.referencesInherited}</span>
        </div>

        {/* Nič sa ešte nespúšťa — plné tlačidlo vedie na rekapituláciu (R2, D235). */}
        <div className="ck-new-foot">
          <button type="submit" className="button">{t.ck.continueToConfirm}</button>
          <span className="quiet">{t.ck.nothingStarts}</span>
        </div>
      </form>
    </div>
    </AppShell>
  )
}
