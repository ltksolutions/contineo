/**
 * versionResponsibilityDb.ts — zápis zodpovednej osoby a právneho základu (D91).
 *
 * Pravidlá sú v `versionResponsibility.ts`; tu je len to, čo potrebuje databázu:
 * dotiahnuť osobu, overiť oprávnenie proti uloženému zneniu a zapísať zmenu aj
 * s históriou.
 *
 * **Mená sa berú zo záznamu osoby, nie z formulára** — rovnako ako pri
 * schvaľovateľoch (`approvalsDb.ts`). Odtlačok mena je dôkazná vec a formulár
 * je vstup od človeka.
 *
 * **`companyCode` je v podmienke každého dotazu** (D32): osobu aj dokument
 * hľadáme len vo vlastnej organizácii.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type Version } from "./documents"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import {
  canSetLegalBasis, legalBasisChoiceProblem, responsibleChangeProblem,
  type ResponsiblePerson,
} from "./versionResponsibility"
import { TENANTS_COLLECTION, type Tenant } from "./tenants"
import { findLegalBasisOption, type LegalBasisOption } from "./legalBases"

export class ResponsibilityError extends AppError {}

const MESSAGES: Record<string, string> = {
  "responsibility.personRequired": "Zodpovedná osoba je povinná — na ňu sa budú obracať ľudia, ktorí znenie potvrdzujú.",
  "responsibility.unknownPerson": "Vybraná zodpovedná osoba tu nie je alebo je vyradená.",
  "responsibility.samePerson": "Toto je už zodpovedná osoba tohto znenia.",
  "responsibility.reasonRequired": "Dôvod zmeny zodpovednej osoby je povinný — o rok sa musí dať zistiť, prečo sa kontakt zmenil.",
  "responsibility.notContentManager": "Zodpovednú osobu určuje správca obsahu.",
  "legalBasis.invalid": "Taký právny základ systém nepozná.",
  "legalBasis.referenceRequired": "Pri zákonnej povinnosti je odkaz na predpis povinný (napríklad § 7 zákona č. 124/2006 Z. z.).",
  "legalBasis.referenceTooLong": "Odkaz na predpis je pridlhý — stačí citácia, nie text ustanovenia.",
  "legalBasis.noChange": "Právny základ je už takto určený.",
  "legalBasis.reasonRequired": "Dôvod zmeny právneho základu je povinný — potvrdenia, ktoré medzitým vznikli, si nesú pôvodný.",
  "legalBasis.unknownKey": "Taká položka v číselníku právnych základov nie je, alebo je skrytá či vyradená.",
  "legalBasis.notAllowed": "Právny základ určuje zodpovedná osoba tohto znenia. Správca obsahu ho smie určiť len vtedy, keď znenie zodpovednú osobu nemá alebo už nie je aktívna.",
  "library.documentNotFound": "Taký dokument tu nie je.",
  "library.versionNotFound": "Také znenie tu nie je.",
}

function fail(code: string): never {
  throw new ResponsibilityError(code, MESSAGES[code] ?? code)
}

/**
 * Odtlačok osoby na určenie za zodpovednú. `null`, keď v organizácii nie je
 * alebo je vyradená — znenie, ktorého garant v zväze nie je, by ľudí posielalo
 * na adresu, na ktorú nikto neodpovie.
 */
export async function responsibleSnapshot(companyCode: string, personId: string): Promise<ResponsiblePerson | null> {
  const id = personId.trim()
  if (!id) return null
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const p = await col.findOne(
    { companyCode, id, status: { $ne: "inactive" } },
    { projection: { id: 1, fullName: 1, email: 1 } },
  )
  return p ? { personId: p.id, fullName: p.fullName, email: p.email } : null
}

/**
 * Súčasný kontakt na zodpovednú osobu — pre obrazovku, nie pre záznam.
 *
 * Obrazovka potvrdenia ukazuje **dnešný** e-mail a telefón (človek sa má
 * dovolať), záznam o potvrdení si nesie odtlačok z okamihu potvrdenia.
 * `active: false` znamená, že osoba medzitým odišla alebo zmizla.
 */
export async function responsibleContact(
  companyCode: string,
  responsible: ResponsiblePerson | null | undefined,
): Promise<{ personId: string; fullName: string; email: string; mobilePhone: string | null; active: boolean } | null> {
  if (!responsible) return null
  try {
    const col = await getCollection<Person>(PERSONS_COLLECTION)
    const p = await col.findOne(
      { companyCode, id: responsible.personId },
      { projection: { id: 1, fullName: 1, email: 1, mobilePhone: 1, status: 1 } },
    )
    if (!p) return { ...responsible, mobilePhone: null, active: false }
    return {
      personId: p.id,
      fullName: p.fullName,
      email: p.email,
      mobilePhone: p.mobilePhone?.trim() || null,
      active: p.status !== "inactive",
    }
  } catch (e) {
    // Kontakt je pomoc, nie podmienka: bez neho sa znenie potvrdiť dá.
    console.error("[zodpovednost] kontakt sa nepodarilo načítať:", e)
    return { ...responsible, mobilePhone: null, active: true }
  }
}

async function loadVersion(companyCode: string, documentId: string, versionId: string) {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { title: 1, versions: 1 } },
  ) as { title?: string; versions?: Version[] } | null
  if (!doc) fail("library.documentNotFound")
  const v = (doc.versions ?? []).find(x => x.versionId === versionId)
  if (!v) fail("library.versionNotFound")
  return { col, title: String(doc.title ?? documentId), version: v }
}

/**
 * Zmení (alebo doplní) zodpovednú osobu znenia. Robí to **správca obsahu**.
 *
 * Text sa nemení, takže schválenie ani potvrdenia zostávajú. Potvrdenia, ktoré
 * už vznikli, si nesú odtlačok pôvodnej osoby — a to je správne: vtedy sa
 * človek mal obrátiť na ňu.
 */
export async function setVersionResponsible(input: {
  companyCode: string
  documentId: string
  versionId: string
  personId: string
  reason: string
  actor: string
  canManageContent: boolean
}): Promise<ResponsiblePerson> {
  if (!input.canManageContent) fail("responsibility.notContentManager")
  const { col, title, version } = await loadVersion(input.companyCode, input.documentId, input.versionId)

  const problem = responsibleChangeProblem({
    personId: input.personId,
    current: version.responsiblePerson,
    reason: input.reason,
  })
  if (problem) fail(problem)

  const to = await responsibleSnapshot(input.companyCode, input.personId)
  if (!to) fail("responsibility.unknownPerson")

  await col.updateOne(
    { companyCode: input.companyCode, documentId: input.documentId },
    {
      $set: {
        "versions.$[v].responsiblePerson": to,
        updatedAt: new Date(),
        updatedBy: input.actor,
      },
      $push: {
        "versions.$[v].responsibleChanges": {
          at: new Date(),
          by: input.actor,
          reason: input.reason.trim(),
          from: version.responsiblePerson ?? null,
          to,
        },
      },
    } as never,
    { arrayFilters: [{ "v.versionId": input.versionId }] },
  )

  await writeAudit({
    companyCode: input.companyCode, subject: "document", action: "responsible-changed", actor: input.actor,
    targetId: input.documentId, targetLabel: `${title} — ${version.label}`,
    changes: {
      responsiblePerson: {
        from: version.responsiblePerson?.fullName ?? null,
        to: to.fullName,
      },
    },
    note: input.reason.trim(),
  })

  return to
}

/**
 * Určí alebo zmení právny základ znenia — **výberom z číselníka** (D92).
 *
 * Oprávnenie sa overuje **tu, proti uloženému zneniu**, nie na obrazovke:
 * akcií môže pribudnúť viac a kontrola, ktorá sa dá obísť iným vstupom, nie je
 * kontrola. Z formulára prichádza len kľúč položky; názov, kategória a odkaz
 * sa berú z číselníka organizácie a do znenia sa uložia ako kópia.
 */
export async function setVersionLegalBasis(input: {
  companyCode: string
  documentId: string
  versionId: string
  legalBasisKey: string
  reason?: string
  actor: { personId: string; email: string }
  isContentManager: boolean
}): Promise<LegalBasisOption> {
  const { col, title, version } = await loadVersion(input.companyCode, input.documentId, input.versionId)

  const responsible = version.responsiblePerson ?? null
  const responsibleActive = responsible
    ? Boolean(await responsibleSnapshot(input.companyCode, responsible.personId))
    : false
  const allowed = canSetLegalBasis({
    actorPersonId: input.actor.personId,
    isContentManager: input.isContentManager,
    responsible,
    responsibleActive,
  })
  if (!allowed) fail("legalBasis.notAllowed")

  const tenants = await getCollection<Tenant>(TENANTS_COLLECTION)
  const tenant = await tenants.findOne(
    { companyCode: input.companyCode },
    { projection: { legalBases: 1, legalBasesHidden: 1 } },
  )
  const option = findLegalBasisOption(tenant, input.legalBasisKey ?? "")

  const problem = legalBasisChoiceProblem({
    option,
    currentKey: version.legalBasisKey ?? null,
    current: version.legalBasis ?? null,
    reason: input.reason,
  })
  if (problem) fail(problem)
  const chosen = option as LegalBasisOption
  const reason = input.reason?.trim()

  await col.updateOne(
    { companyCode: input.companyCode, documentId: input.documentId },
    {
      $set: {
        "versions.$[v].legalBasis": chosen.basis,
        "versions.$[v].legalBasisKey": chosen.key,
        "versions.$[v].legalBasisLabel": chosen.label,
        ...(chosen.reference ? { "versions.$[v].legalBasisReference": chosen.reference } : {}),
        updatedAt: new Date(),
        updatedBy: input.actor.email,
      },
      // Položka bez odkazu nemá niesť odkaz z predošlej voľby — to by bol
      // údaj, ktorý nikto nezadal.
      ...(chosen.reference ? {} : { $unset: { "versions.$[v].legalBasisReference": "" } }),
      $push: {
        "versions.$[v].legalBasisChanges": {
          at: new Date(),
          by: input.actor.email,
          ...(reason ? { reason } : {}),
          from: version.legalBasis ?? null,
          fromReference: version.legalBasisReference ?? null,
          fromKey: version.legalBasisKey ?? null,
          to: chosen.basis,
          toReference: chosen.reference,
          toKey: chosen.key,
          toLabel: chosen.label,
        },
      },
    } as never,
    { arrayFilters: [{ "v.versionId": input.versionId }] },
  )

  await writeAudit({
    companyCode: input.companyCode, subject: "document", action: "legal-basis", actor: input.actor.email,
    targetId: input.documentId, targetLabel: `${title} — ${version.label}`,
    changes: {
      legalBasis: { from: version.legalBasisLabel ?? version.legalBasis ?? null, to: chosen.label },
      legalBasisReference: { from: version.legalBasisReference ?? null, to: chosen.reference },
    },
    ...(reason ? { note: reason } : {}),
  })

  return chosen
}
