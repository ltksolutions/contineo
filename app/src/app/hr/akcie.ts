"use server"

/**
 * akcie.ts — zápisy z HR obrazovky (Fáza 9, rozsah B).
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
import { hrContext, pridelitelneDokumenty } from "@/lib/hr"
import { assign, revoke, AssignmentValidationError } from "@/lib/assignments"
import type { AudienceKind } from "@/lib/assignments"

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

/** Späť na formulár s chybou a s tým, čo už bolo vyplnené. */
function spatSChybou(chyba: string, fd: FormData): never {
  const q = new URLSearchParams({
    chyba,
    dokument: textPola(fd, "dokument"),
    publikum: textPola(fd, "publikum"),
    hodnota: textPola(fd, "hodnota"),
    dovod: textPola(fd, "dovod"),
  })
  redirect(`/hr/pridelit?${q.toString()}`)
}

export async function pridelit(fd: FormData) {
  const kto = await personal()
  if (!kto) redirect("/hr")

  const documentId = textPola(fd, "dokument")
  const kind = textPola(fd, "publikum") as AudienceKind
  const hodnota = textPola(fd, "hodnota")
  const dovod = textPola(fd, "dovod")

  // Znenie sa berie zo servera, nie z formulára. Keby `versionId` prišlo
  // z prehliadača, dalo by sa prideliť ľubovoľné — aj z cudzej organizácie
  // alebo staré, ktoré sa už nedá potvrdiť.
  const ponuka = await pridelitelneDokumenty(kto.companyCode)
  const dokument = ponuka.find(d => d.documentId === documentId)
  if (!dokument) spatSChybou("Taký dokument s platným znením tu nie je.", fd)

  let vysledok
  try {
    vysledok = await assign({
      companyCode: kto.companyCode,
      subject: {
        documentId: dokument.documentId,
        versionId: dokument.versionId,
        documentTitle: dokument.title,
        versionLabel: dokument.versionLabel,
        effectiveFrom: dokument.effectiveFrom,
      },
      audience: { kind, value: kind === "all" ? undefined : hodnota },
      reason: dovod,
      assignedBy: kto.email,
    })
  } catch (e) {
    if (e instanceof AssignmentValidationError) spatSChybou(e.message, fd)
    console.error("[hr] pridelenie zlyhalo:", e)
    spatSChybou("Pridelenie sa nepodarilo uložiť. Skús to znova.", fd)
  }

  revalidatePath("/hr")
  redirect(vysledok.stav === "uz-je"
    ? "/hr?sprava=" + encodeURIComponent("Toto znenie už tomuto publiku pridelené je — nič sa nezdvojilo.")
    : "/hr?sprava=" + encodeURIComponent("Pridelené."))
}

export async function odvolat(fd: FormData) {
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
