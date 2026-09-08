"use server"

/**
 * actions.ts — potvrdenie dokumentu serverovou akciou.
 *
 * **Prečo akcia a nie formulár mierený na `/api/acknowledgements`.**
 * Dnešné API chráni pred cudzou stránkou len to, že klient posiela
 * `Content-Type: application/json`: taký `fetch` z iného pôvodu si vyžiada
 * predletovú kontrolu a prehliadač ho zastaví. Obyčajný `<form method="post">`
 * ale cudzí web odoslať **vie** a typ obsahu mu určí prehliadač — pripojiť
 * formulár priamo na to API by teda znamenalo vyrobiť CSRF na právne
 * záväznom úkone: cudzia stránka by dokázala potvrdiť normu za prihláseného
 * človeka. Serverová akcia si pôvod overuje sama.
 *
 * Pravidlá okolo dôkazného záznamu sa tu **nepíšu druhýkrát** — akcia je
 * lepidlo okolo tej istej `acknowledge()`, ktorú volá aj API. Verziu, znenie
 * aj jazyk určuje server (D24, D28); z formulára prichádza len to, ktorý
 * dokument sa potvrdzuje, a aj ten sa načítava **pre osobu** (D32).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { onboardingContext } from "@/lib/session"
import { acknowledge } from "@/lib/acknowledgements"
import { clientIp } from "@/lib/requestMeta"
import { isRedirect } from "@/lib/redirects"
import { dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"

/**
 * Späť na dokument s hlásením. Chyba aj úspech idú tou istou cestou, takže
 * človek bez skriptu vidí výsledok rovnako ako človek so skriptom.
 */
function back(documentId: string, message: string, error = false): never {
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`/documents/${encodeURIComponent(documentId)}?${q.toString()}`)
}

export async function acknowledgeAction(fd: FormData) {
  const raw = fd.get("documentId")
  const documentId = typeof raw === "string" ? raw.trim() : ""

  const ctx = await onboardingContext()
  // Rovnaké štyri stavy ako v API. Neprihlásený človek nemá dostať hlásenie
  // o dokumente, ale prihlasovaciu obrazovku — potvrdzovať sa dá až po nej.
  if (ctx.state === "unknown-host") redirect("/")
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") redirect("/")
  const person = ctx.person
  const t = dictionary(person.language as UiLanguage).onboarding

  if (!documentId) back(documentId || "-", t.error["document-not-found"], true)

  let result
  try {
    const h = await headers()
    result = await acknowledge(
      {
        personId: person.id,
        email: person.email,
        fullName: person.fullName,
        companyCode: person.companyCode,
        language: person.language,
        departmentId: person.departmentId ?? null,
      },
      documentId,
      {
        ip: clientIp(h),
        userAgent: h.get("user-agent"),
        // Trasa sa do záznamu zatiaľ nedostáva ani cez API — je to otvorená
        // úloha (`docs/TODO.md`), nie niečo, čo by táto cesta mala riešiť
        // inak než tá druhá.
        trackId: null,
      },
    )
  } catch (e) {
    if (isRedirect(e)) throw e
    console.error("[potvrdenie] zápis zlyhal:", e)
    back(documentId, t.error["write-failed"], true)
  }

  if (!result.ok) {
    // „Už potvrdené" nie je chyba človeka — má to za sebou. Hlásenie to
    // povie tými istými vetami, aké používalo tlačidlo cez API.
    back(documentId, t.error[result.reason] ?? t.error["write-failed"], true)
  }

  // Stav sa nikde neukladá, odvodzuje sa (D27) — po prekreslení stránky
  // vráti `hasAcknowledged()` už `true` a namiesto tlačidla bude štítok.
  revalidatePath(`/documents/${documentId}`)
  back(documentId, t.confirmed)
}
