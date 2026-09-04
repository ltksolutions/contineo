"use server"

/**
 * actions.ts — zápisy z HR obrazovky (Fáza 9, rozsah B).
 *
 * **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný;
 * to, že sa volá z formulára na chránenej stránke, nie je kontrola prístupu.
 *
 * Chyby sa vracajú **do adresy**, nie ako výnimka: formulár je serverový, bez
 * klientskeho stavu, a človek má po neúspechu vidieť dôvod na tej istej
 * stránke — aj s tým, čo už vypísal, aby to nemusel písať znova.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { hrContext, assignableDocuments } from "@/lib/hr"
import {
  assign, revoke, loadAssignment, notAcknowledged, recordNotification,
  audienceFromSelection, AssignmentValidationError,
} from "@/lib/assignments"
import { allDepartments } from "@/lib/departments"
import { send, assignmentEmail } from "@/lib/ecomail"
import { brandingView } from "@/lib/tenants"
import { requestHostname } from "@/lib/session"
import { dictionary, formatDate, normalizeLanguage } from "@/lib/i18n"

async function hr(): Promise<{ email: string; companyCode: string; language?: string } | null> {
  const ctx = await hrContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }
    : null
}

function fieldText(fd: FormData, field: string): string {
  const v = fd.get(field)
  return typeof v === "string" ? v.trim() : ""
}

/**
 * Späť na formulár s chybou — **a s tým, čo už bolo vyplnené**.
 *
 * Pri hromadnom pridelení to nie je zdvorilosť: kto zaškrtal päť noriem, tri
 * skupiny a napísal odsek odôvodnenia, to po chybe druhýkrát nenapíše. Preto
 * sa vracia celý výber, nie len chybová hláška.
 */
function backWithError(error: string, fd: FormData): never {
  const q = new URLSearchParams({ error, reason: fieldText(fd, "reason") })
  for (const d of fd.getAll("document")) if (typeof d === "string") q.append("document", d)
  for (const p of fd.getAll("audience")) if (typeof p === "string") q.append("audience", p)
  if (fd.get("all")) q.set("all", "1")
  const addresses = fieldText(fd, "addresses")
  if (addresses) q.set("addresses", addresses)
  redirect(`/hr/pridelit?${q.toString()}`)
}

export async function assignAction(fd: FormData) {
  const actor = await hr()
  if (!actor) redirect("/hr")

  const reason = fieldText(fd, "reason")
  // Názvy oddelení sa do pridelenia zapisujú ako **kópia** (`audience.label`),
  // z rovnakého dôvodu ako názov dokumentu: oddelenie sa premenuje alebo zruší
  // a o rok musí byť čitateľné, komu sa vtedy prideľovalo.
  const tree = await allDepartments(actor.companyCode)
  const departmentNames = Object.fromEntries(tree.map(o => [o.id, o.name]))

  const audiences = audienceFromSelection({
    all: Boolean(fd.get("all")),
    selected: fd.getAll("audience").filter((v): v is string => typeof v === "string"),
    addresses: fieldText(fd, "addresses"),
    departmentNames: departmentNames,
  })
  if (audiences.length === 0) {
    backWithError(dictionary(actor.language).hr.actions.noAudience, fd)
  }

  // Znenia sa berú zo servera, nie z formulára. Keby `versionId` prišlo
  // z prehliadača, dalo by sa prideliť ľubovoľné — aj z cudzej organizácie
  // alebo staré, ktoré sa už nedá potvrdiť.
  const available = await assignableDocuments(actor.companyCode)
  const selected = fd.getAll("document")
    .filter((d): d is string => typeof d === "string")
    .map(id => available.find(p => p.documentId === id))
    .filter(d => d !== undefined)

  if (selected.length === 0) {
    backWithError(dictionary(actor.language).hr.actions.noDocument, fd)
  }

  let assigned = 0
  let already = 0

  for (const document of selected) {
    for (const audience of audiences) {
      try {
        const v = await assign({
          companyCode: actor.companyCode,
          subject: {
            documentId: document.documentId,
            versionId: document.versionId,
            documentTitle: document.title,
            versionLabel: document.versionLabel,
            effectiveFrom: document.effectiveFrom,
          },
          audience,
          reason: reason,
          assignedBy: actor.email,
        })
        v.status === "pridelene" ? assigned++ : already++
      } catch (e) {
        // Chyba pri prvom páre zastaví celé rozposielanie: sú to tie isté
        // pravidlá pre všetky (dôvod, publikum), takže druhý pokus by zlyhal
        // rovnako. Čiastočne prideliť a nepovedať to je horšie než neprideliť.
        if (e instanceof AssignmentValidationError) backWithError(e.message, fd)
        console.error("[hr] pridelenie zlyhalo:", e)
        backWithError(dictionary(actor.language).hr.actions.saveFailed, fd)
      }
    }
  }

  const t = dictionary(actor.language).hr.actions
  const message = already === 0
    ? t.assigned(assigned, selected.length, audiences.length)
    : t.assignedWithExisting(assigned, selected.length, audiences.length, already)

  revalidatePath("/hr")
  redirect("/hr?msg=" + encodeURIComponent(message))
}

export async function revokeAction(fd: FormData) {
  const actor = await hr()
  if (!actor) redirect("/hr")

  const id = fieldText(fd, "id")
  // Odvolanie **nemaže potvrdenia**, ktoré medzitým vznikli — človek ten
  // dokument naozaj prečítal a záznam o tom je jeho.
  const changed = await revoke(actor.companyCode, id, actor.email)

  revalidatePath("/hr")
  redirect("/hr?msg=" + encodeURIComponent(
    changed ? dictionary(actor.language).hr.actions.revoked : dictionary(actor.language).hr.actions.alreadyRevoked
  ))
}

/**
 * Koľko e-mailov sa pošle jedným kliknutím.
 *
 * Serverová akcia má obmedzený čas behu; pri väčšom počte by odosielanie
 * spadlo v polovici a nikto by nevedel, kto správu dostal a kto nie. Radšej
 * to povedať dopredu než rozposlať náhodnú polovicu. Nad túto hranicu treba
 * naplánovanú úlohu — to je samostatný kus práce, nie prepínač.
 */
const MAX_AT_ONCE = 150

/** Koľko naraz „vo vzduchu". Ecomail je cudzia služba, nie náš server. */
const CONCURRENCY = 5

/**
 * Dá ľuďom vedieť, že im niečo pribudlo.
 *
 * Posiela **len tým, ktorí ešte nepotvrdili**. Kto to už má za sebou, dostane
 * pripomienku niečoho, čo spravil — a to je presne ten druh pošty, po ktorom
 * si ľudia zapnú filter a prestanú čítať aj tú dôležitú.
 *
 * Záznam sa zapíše **po** odoslaní a s počtom, ktorý naozaj odišiel. Zápis
 * dopredu by pri výpadku pošty tvrdil, že ľudia vedia, hoci nedostali nič.
 */
export async function sendNotificationAction(fd: FormData) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") redirect("/hr")
  const code = ctx.person.companyCode
  const t = dictionary(ctx.person.language).hr.actions
  const id = fieldText(fd, "id")

  const assignment = await loadAssignment(code, id)
  if (!assignment) redirect("/hr")

  // Bývalým členom oddelenia sa nepíše (D50): pripomínať normu oddelenia, v ktorom
  // človek už nie je, je nezmysel. V prehľade zostávajú vidieť, aby sa
  // personalista mohol rozhodnúť sám.
  const recipients = (await notAcknowledged(code, id)).filter(o => !o.former)
  if (recipients.length === 0) {
    redirect("/hr?error=1&msg=" + encodeURIComponent(t.nobodyToNotify))
  }
  if (recipients.length > MAX_AT_ONCE) {
    redirect(`/hr/${encodeURIComponent(id)}/oznamit?error=` + encodeURIComponent(
      t.tooManyRecipients(recipients.length, MAX_AT_ONCE)
    ))
  }

  const host = await requestHostname()
  const branding = brandingView(ctx.tenant)
  const link = `https://${host}/dokumenty/${encodeURIComponent(assignment.subject.documentId)}`

  let sent = 0
  const failed: string[] = []

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    await Promise.all(recipients.slice(i, i + CONCURRENCY).map(async person => {
      const language = normalizeLanguage(person.language)
      try {
        await send({
          to: person.email,
          ...assignmentEmail(
            link,
            host,
            {
              title: assignment.subject.documentTitle,
              versionLabel: assignment.subject.versionLabel,
              effectiveFrom: assignment.subject.effectiveFrom
                ? formatDate(assignment.subject.effectiveFrom, language)
                : "—",
            },
            assignment.reason,
            language,
            branding,
          ),
        })
        sent++
      } catch (e) {
        // Jeden neplatný e-mail nesmie zastaviť zvyšok. Menovite do logu,
        // aby sa dalo zistiť, komu správa nedošla.
        console.error(`[hr] e-mail na ${person.email} zlyhal:`, e)
        failed.push(person.email)
      }
    }))
  }

  if (sent > 0) await recordNotification(code, id, ctx.person.email, sent)

  revalidatePath("/hr")
  const message = failed.length === 0
    ? t.sent(sent)
    : t.sentWithFailures(sent, `(${failed.length}) ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`)
  redirect(`/hr?msg=${encodeURIComponent(message)}${failed.length ? "&error=1" : ""}`)
}
