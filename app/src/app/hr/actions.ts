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
import { formatDate, normalizeLanguage } from "@/lib/i18n"

async function personal(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await hrContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode }
    : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v.trim() : ""
}

/**
 * Späť na formulár s chybou — **a s tým, čo už bolo vyplnené**.
 *
 * Pri hromadnom pridelení to nie je zdvorilosť: kto zaškrtal päť noriem, tri
 * skupiny a napísal odsek odôvodnenia, to po chybe druhýkrát nenapíše. Preto
 * sa vracia celý výber, nie len chybová hláška.
 */
function spatSChybou(chyba: string, fd: FormData): never {
  const q = new URLSearchParams({ chyba, dovod: textPola(fd, "dovod") })
  for (const d of fd.getAll("dokument")) if (typeof d === "string") q.append("dokument", d)
  for (const p of fd.getAll("publikum")) if (typeof p === "string") q.append("publikum", p)
  if (fd.get("vsetci")) q.set("vsetci", "1")
  const adresy = textPola(fd, "adresy")
  if (adresy) q.set("adresy", adresy)
  redirect(`/hr/pridelit?${q.toString()}`)
}

export async function assignAction(fd: FormData) {
  const kto = await personal()
  if (!kto) redirect("/hr")

  const dovod = textPola(fd, "dovod")
  // Názvy oddelení sa do pridelenia zapisujú ako **kópia** (`audience.label`),
  // z rovnakého dôvodu ako názov dokumentu: oddelenie sa premenuje alebo zruší
  // a o rok musí byť čitateľné, komu sa vtedy prideľovalo.
  const strom = await allDepartments(kto.companyCode)
  const nazvyOddeleni = Object.fromEntries(strom.map(o => [o.id, o.nazov]))

  const publika = audienceFromSelection({
    vsetci: Boolean(fd.get("vsetci")),
    vybrane: fd.getAll("publikum").filter((v): v is string => typeof v === "string"),
    adresy: textPola(fd, "adresy"),
    nazvyOddeleni,
  })
  if (publika.length === 0) spatSChybou("Nevybral si, komu sa prideľuje.", fd)

  // Znenia sa berú zo servera, nie z formulára. Keby `versionId` prišlo
  // z prehliadača, dalo by sa prideliť ľubovoľné — aj z cudzej organizácie
  // alebo staré, ktoré sa už nedá potvrdiť.
  const ponuka = await assignableDocuments(kto.companyCode)
  const vybrane = fd.getAll("dokument")
    .filter((d): d is string => typeof d === "string")
    .map(id => ponuka.find(p => p.documentId === id))
    .filter(d => d !== undefined)

  if (vybrane.length === 0) spatSChybou("Nevybral si žiadny dokument s platným znením.", fd)

  let pridelene = 0
  let uzBolo = 0

  for (const dokument of vybrane) {
    for (const audience of publika) {
      try {
        const v = await assign({
          companyCode: kto.companyCode,
          subject: {
            documentId: dokument.documentId,
            versionId: dokument.versionId,
            documentTitle: dokument.title,
            versionLabel: dokument.versionLabel,
            effectiveFrom: dokument.effectiveFrom,
          },
          audience,
          reason: dovod,
          assignedBy: kto.email,
        })
        v.stav === "pridelene" ? pridelene++ : uzBolo++
      } catch (e) {
        // Chyba pri prvom páre zastaví celé rozposielanie: sú to tie isté
        // pravidlá pre všetky (dôvod, publikum), takže druhý pokus by zlyhal
        // rovnako. Čiastočne prideliť a nepovedať to je horšie než neprideliť.
        if (e instanceof AssignmentValidationError) spatSChybou(e.message, fd)
        console.error("[hr] pridelenie zlyhalo:", e)
        spatSChybou("Pridelenie sa nepodarilo uložiť. Skús to znova.", fd)
      }
    }
  }

  const kombinacie = `${vybrane.length} ${vybrane.length === 1 ? "norma" : vybrane.length < 5 ? "normy" : "noriem"}` +
    ` × ${publika.length} ${publika.length === 1 ? "publikum" : publika.length < 5 ? "publiká" : "publík"}`
  const sprava = uzBolo === 0
    ? `Pridelené: ${pridelene} (${kombinacie}).`
    : `Pridelené: ${pridelene} (${kombinacie}). ${uzBolo} už pridelených bolo — nič sa nezdvojilo.`

  revalidatePath("/hr")
  redirect("/hr?sprava=" + encodeURIComponent(sprava))
}

export async function revokeAction(fd: FormData) {
  const kto = await personal()
  if (!kto) redirect("/hr")

  const id = textPola(fd, "id")
  // Odvolanie **nemaže potvrdenia**, ktoré medzitým vznikli — človek ten
  // dokument naozaj prečítal a záznam o tom je jeho.
  const zmenene = await revoke(kto.companyCode, id, kto.email)

  revalidatePath("/hr")
  redirect("/hr?sprava=" + encodeURIComponent(
    zmenene ? "Pridelenie odvolané. Záznam o ňom zostáva." : "Toto pridelenie už neplatí."
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
const NAJVIAC_NARAZ = 150

/** Koľko naraz „vo vzduchu". Ecomail je cudzia služba, nie náš server. */
const SUBEZNE = 5

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
  const kod = ctx.person.companyCode
  const id = textPola(fd, "id")

  const pridelenie = await loadAssignment(kod, id)
  if (!pridelenie) redirect("/hr")

  // Bývalým členom oddelenia sa nepíše (D50): pripomínať normu oddelenia, v ktorom
  // človek už nie je, je nezmysel. V prehľade zostávajú vidieť, aby sa
  // personalista mohol rozhodnúť sám.
  const prijemcovia = (await notAcknowledged(kod, id)).filter(o => !o.byvaly)
  if (prijemcovia.length === 0) {
    redirect("/hr?chyba=1&sprava=" + encodeURIComponent("Nie je komu poslať — potvrdili už všetci, kto v oddelení zostal."))
  }
  if (prijemcovia.length > NAJVIAC_NARAZ) {
    redirect(`/hr/${encodeURIComponent(id)}/oznamit?chyba=` + encodeURIComponent(
      `Príjemcov je ${prijemcovia.length}, naraz sa dá poslať najviac ${NAJVIAC_NARAZ}. ` +
      `Rozdeľ pridelenie na menšie publiká.`
    ))
  }

  const host = await requestHostname()
  const branding = brandingView(ctx.tenant)
  const odkaz = `https://${host}/dokumenty/${encodeURIComponent(pridelenie.subject.documentId)}`

  let odoslane = 0
  const zlyhali: string[] = []

  for (let i = 0; i < prijemcovia.length; i += SUBEZNE) {
    await Promise.all(prijemcovia.slice(i, i + SUBEZNE).map(async osoba => {
      const jazyk = normalizeLanguage(osoba.language)
      try {
        await send({
          to: osoba.email,
          ...assignmentEmail(
            odkaz,
            host,
            {
              title: pridelenie.subject.documentTitle,
              versionLabel: pridelenie.subject.versionLabel,
              effectiveFrom: pridelenie.subject.effectiveFrom
                ? formatDate(pridelenie.subject.effectiveFrom, jazyk)
                : "—",
            },
            pridelenie.reason,
            jazyk,
            branding,
          ),
        })
        odoslane++
      } catch (e) {
        // Jeden neplatný e-mail nesmie zastaviť zvyšok. Menovite do logu,
        // aby sa dalo zistiť, komu správa nedošla.
        console.error(`[hr] e-mail na ${osoba.email} zlyhal:`, e)
        zlyhali.push(osoba.email)
      }
    }))
  }

  if (odoslane > 0) await recordNotification(kod, id, ctx.person.email, odoslane)

  revalidatePath("/hr")
  const sprava = zlyhali.length === 0
    ? `Odoslané ${odoslane} ľuďom, ktorí ešte nepotvrdili.`
    : `Odoslané ${odoslane}. Nedoručiteľné (${zlyhali.length}): ${zlyhali.slice(0, 5).join(", ")}${zlyhali.length > 5 ? "…" : ""}`
  redirect(`/hr?sprava=${encodeURIComponent(sprava)}${zlyhali.length ? "&chyba=1" : ""}`)
}
