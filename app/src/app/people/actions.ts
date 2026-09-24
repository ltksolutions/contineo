"use server"

/**
 * actions.ts — zápisy zo správy osôb (D46).
 *
 * **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný;
 * to, že sa volá z formulára na chránenej stránke, nie je kontrola prístupu.
 *
 * Organizácia sa **nikdy neberie z formulára**, vždy z prihláseného človeka.
 * Keby prišla z prehliadača, personalista jedného zväzu by mohol založiť
 * alebo vyradiť človeka v druhom (D32).
 */

import { redirect } from "next/navigation"
import { isRedirect } from "@/lib/redirects"
import { revalidatePath } from "next/cache"
import { peopleContext, savePerson, invitePerson, setPersonStatus, setPersonEndedAt, neverSignedIn, loadPersonById } from "@/lib/people"
import { needsInvitation } from "@/lib/personFields"
import { send, inviteEmail } from "@/lib/ecomail"
import { brandingView } from "@/lib/tenants"
import { requestHostname } from "@/lib/session"
import { writeAudit, diff } from "@/lib/audit"
import { normalizeLanguage } from "@/lib/i18n"

/**
 * Poslať pozvánku znovu — jednej osobe, z jej detailu.
 *
 * Ponúka sa len tomu, kto **ešte nikdy nebol dnu** (`firstLoginAt` chýba);
 * kto sa už prihlásil, pozvánku nepotrebuje a e-mail by ho len mýlil.
 * Kritérium je to isté ako v `neverSignedIn()` — nie `status`, lebo osoby
 * z importu a zo samozaloženia (D47) majú `active` od začiatku.
 *
 * Nie je tu žiadne obmedzenie frekvencie: posiela to personalista vlastnej
 * organizácie vlastnému kolegovi a rozhoduje sa podľa toho, čo mu ten človek
 * povedal do telefónu. Stroj, ktorý mu v tom bráni, rieši problém, ktorý nemá.
 */
export async function resendInviteAction(fd: FormData) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") redirect("/people")
  const language = ctx.person.language

  const id = fieldText(fd, "id")
  const person = await loadPersonById(ctx.person.companyCode, id)
  if (!person) redirect("/people")

  const back = `/people/${encodeURIComponent(id)}`
  // Prihlásená ani vyradená osoba pozvánku nedostane ani cez priamo odoslaný
  // formulár: tlačidlo sa jej nekreslí, ale kontrola patrí na server.
  if (!needsInvitation(person)) {
    redirect(`${back}?error=1&msg=${encodeURIComponent(say(language).inviteNotNeeded)}`)
  }

  const ok = await sendInviteTo(person, ctx.tenant)

  await writeAudit({
    companyCode: ctx.person.companyCode, subject: "person", action: "changed",
    actor: ctx.person.email, targetId: person.id, targetLabel: person.fullName,
    changes: diff({ invitation: "" }, { invitation: ok ? "sent" : "failed" }),
  })

  revalidatePath(back)
  redirect(`${back}?msg=${encodeURIComponent(
    ok ? say(language).inviteResent(person.email) : say(language).inviteFailed,
  )}${ok ? "" : "&error=1"}`)
}

/** Koľko e-mailov naraz. Rovnaká hodnota ako pri oznámeniach v `/hr`. */
const INVITE_CONCURRENCY = 5
import { csvToPersons, emptyNotes } from "@/lib/personsImport"
import type { ImportSettings } from "@/lib/personsImport"
import { tenantByCompanyCode } from "@/lib/tenants"
import { availableOptions } from "@/lib/codelistsTenant"
import { previewImport, upsertPersons } from "@/lib/persons"
import type { PersonType } from "@/lib/persons"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

async function peopleAdmin(): Promise<
  { email: string; companyCode: string; language: UiLanguage } | null
> {
  const ctx = await peopleContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }
    : null
}

/** Hlásenia v jazyku prihláseného človeka. */
function say(language: UiLanguage) {
  return dictionary(language).people.actions
}

/** Kým nevieme, kto sa pýta, nevieme ani v akom jazyku — predvolený. */
const NO_RIGHT = dictionary(undefined).people.actions.noRight

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

function listField(fd: FormData, actorName: string): string[] {
  return fieldText(fd, actorName).split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[osoby] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function savePersonAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/people")

  const id = fieldText(fd, "id")
  let message = ""
  let error = false
  try {
    await savePerson(actor.companyCode, id, {
      email: fieldText(fd, "email"),
      // Celé meno sa **neposiela** — skladá ho server z týchto dvoch polí (D83).
      givenName: fieldText(fd, "givenName"),
      surname: fieldText(fd, "surname"),
      titleBefore: fieldText(fd, "titleBefore"),
      titleAfter: fieldText(fd, "titleAfter"),
      mobilePhone: fieldText(fd, "mobilePhone"),
      // Prázdna voľba znamená „bez pracoviska", nie „nemeniť" — rovnako ako
      // pri oddelení.
      workplace: fieldText(fd, "workplace"),
      // Voľba „— bez oddelenia —" má prázdnu hodnotu a znamená vyradiť zo
      // štruktúry, nie „nemeniť". Preto `|| null`, nie `|| undefined`.
      departmentId: fieldText(fd, "departmentId") || null,
      jobTitle: fieldText(fd, "jobTitle"),
      personType: (fieldText(fd, "personType") || undefined) as PersonType | undefined,
      language: fieldText(fd, "language") || undefined,
      tracks: listField(fd, "tracks"),
      groups: listField(fd, "groups"),
      // Zaškrtávacie políčka: neprítomná hodnota znamená „odobrať".
      roles: fd.getAll("roles").filter((r): r is string => typeof r === "string"),
    }, actor.email)
    message = say(actor.language).saved
  } catch (e) {
    message = errorMessage(e, actor.language)
    error = true
  }

  revalidatePath("/people")
  redirect(`/people/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Odoslanie jednej pozvánky.
 *
 * Jedno miesto pre formulár „Pozvať osobu" aj pre „Poslať pozvánku znovu" —
 * dve kópie skladania e-mailu by sa raz rozišli a jedna z nich by posielala
 * pozvánku bez loga organizácie.
 *
 * E-mail nesie **odkaz na portál, nie prihlasovací odkaz** (rovnako ako
 * hromadné rozosielanie): prihlasovací odkaz platí 24 hodín a raz, takže ho
 * poštové brány spotrebujú skôr než človek (zaznamenané 2026-08-28).
 *
 * Vracia `true`/`false` namiesto výnimky: volajúci vie, či sa podarilo, ale
 * zlyhanie pošty nesmie zhodiť zápis osoby — tá je v evidencii tak či tak
 * a pozvánku možno poslať znovu.
 */
async function sendInviteTo(
  person: { email: string; language: string },
  tenant: Parameters<typeof brandingView>[0],
): Promise<boolean> {
  try {
    const host = await requestHostname()
    await send({
      to: person.email,
      ...inviteEmail(`https://${host}/sign-in`, host, normalizeLanguage(person.language), brandingView(tenant)),
    })
    return true
  } catch (e) {
    // Menovite do logu — inak sa nedá zistiť, komu správa nedošla.
    console.error(`[osoby] pozvánka na ${person.email} zlyhala:`, e)
    return false
  }
}

export async function invitePersonAction(fd: FormData) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") redirect("/people")
  const actor = { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }

  try {
    const person = await invitePerson(actor.companyCode, {
      email: fieldText(fd, "email"),
      givenName: fieldText(fd, "givenName"),
      surname: fieldText(fd, "surname"),
      titleBefore: fieldText(fd, "titleBefore"),
      titleAfter: fieldText(fd, "titleAfter"),
      jobTitle: fieldText(fd, "jobTitle"),
      mobilePhone: fieldText(fd, "mobilePhone"),
      workplace: fieldText(fd, "workplace"),
      departmentId: fieldText(fd, "departmentId") || null,
      personType: (fieldText(fd, "personType") || undefined) as PersonType | undefined,
      language: fieldText(fd, "language") || undefined,
    }, actor.email)

    /*
     * **Pozvánka sa aj odošle** (rozhodnutie Jána 2026-09-21). Dovtedy
     * formulár osobu len zapísal a hlásil „Pozvaná" — hlásil teda zápis do
     * evidencie, nie odoslanie, a e-mail odchádzal až hromadnou akciou na
     * `/people/invite`. Človek, ktorý niekoho pozve, čaká, že pozvánka odišla.
     *
     * Zlyhanie pošty osobu nezruší: je zapísaná a hláška povie, že pozvánku
     * treba poslať znovu — tlačidlo je na jej detaile.
     */
    const ok = await sendInviteTo(person, ctx.tenant)

    revalidatePath("/people")
    // Rovno na detail: po pozvaní nasleduje priradenie trás a skupín,
    // a hľadať toho človeka znova v zozname je zbytočný krok.
    redirect(`/people/${encodeURIComponent(person.id)}?msg=${encodeURIComponent(
      ok ? say(actor.language).invited : say(actor.language).invitedNoEmail,
    )}${ok ? "" : "&error=1"}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (isRedirect(e)) throw e
    // Späť do formulára ide **všetko, čo človek napísal**. Vrátiť len adresu
    // by znamenalo, že po preklepe v telefónnom čísle prepisuje aj meno.
    const q = new URLSearchParams({
      error: errorMessage(e, actor.language),
      email: fieldText(fd, "email"),
      givenName: fieldText(fd, "givenName"),
      surname: fieldText(fd, "surname"),
      titleBefore: fieldText(fd, "titleBefore"),
      titleAfter: fieldText(fd, "titleAfter"),
      jobTitle: fieldText(fd, "jobTitle"),
      mobilePhone: fieldText(fd, "mobilePhone"),
      workplace: fieldText(fd, "workplace"),
      departmentId: fieldText(fd, "departmentId"),
    })
    redirect(`/people/new?${q.toString()}`)
  }
}

/**
 * Vyradí alebo vráti osobu.
 *
 * Vyradenie si vyžiada napísanie adresy. Je to jediná zmena, ktorá človeka
 * okamžite odstrihne od portálu; obyčajné „naozaj?" sa odklikne skôr, než sa
 * prečíta. Vrátenie potvrdenie nepotrebuje — nič sa ním nestráca.
 */
export async function togglePersonStatusAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/people")

  const id = fieldText(fd, "id")
  const email = fieldText(fd, "email")
  const toStatus = fieldText(fd, "status") === "inactive" ? "inactive" : "invited"
  let message = ""
  let error = false

  if (toStatus === "inactive" && fieldText(fd, "confirmation").toLowerCase() !== email.toLowerCase()) {
    message = say(actor.language).confirmAddress(email)
    error = true
  } else {
    try {
      await setPersonStatus(actor.companyCode, id, toStatus, actor.email, dateField(fd, "endedAt"))
      message = toStatus === "inactive"
        ? say(actor.language).excluded
        : say(actor.language).returned
    } catch (e) {
      message = errorMessage(e, actor.language)
      error = true
    }
  }

  revalidatePath("/people")
  redirect(`/people/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * `<input type="date">` → dátum o polnoci UTC; prázdne pole je `null`.
 * Nečitateľná hodnota sa vráti ako neplatný dátum — odmietne ho `people.ts`
 * s vlastnou hláškou, nie tichým zahodením.
 */
function dateField(fd: FormData, name: string): Date | null {
  const v = fieldText(fd, name)
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : new Date(NaN)
}

/**
 * Skončenie vzťahu pri vyradenej osobe (ADR-012, D100) — doplnenie alebo oprava.
 */
export async function setEndedAtAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/people")

  const id = fieldText(fd, "id")
  let message = ""
  let error = false
  try {
    await setPersonEndedAt(actor.companyCode, id, dateField(fd, "endedAt"), actor.email)
    message = say(actor.language).endedAtSaved
  } catch (e) {
    message = errorMessage(e, actor.language)
    error = true
  }

  revalidatePath("/people")
  redirect(`/people/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Náhľad importu — **čo by sa stalo, keby**.
 *
 * Nie je to voliteľná ozdoba. Nahratie stovky ľudí naslepo je presne tá
 * operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` nemá rollback.
 * Preto import bez náhľadu neexistuje ani na obrazovke, ani v skripte.
 */
export async function previewImportAction(text: string): Promise<{
  ok: boolean
  message?: string
  created?: string[]
  existing?: string[]
  errors?: string[]
  /** Hodnoty, ktoré riadok neodmietli, ale pole nevyplnili (D85, D86). */
  unknownWorkplaces?: string[]
  badPhones?: string[]
  total?: number
}> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, message: NO_RIGHT }
  if (!text?.trim()) return { ok: false, message: say(actor.language).fileEmpty }

  // Organizácia sa doplní z prihláseného, nie zo súboru: personalista zväzu
  // nesmie importom založiť človeka do cudzej organizácie (D32).
  const notes = emptyNotes()
  const people = csvToPersons(text, actor.companyCode, await importSettings(actor.companyCode), notes)
  if (people.length === 0) {
    return { ok: false, message: say(actor.language).noRows }
  }

  try {
    const n = await previewImport(people)
    return {
      ok: true,
      total: people.length,
      created: n.created,
      existing: n.existing,
      errors: n.errors.map(e =>
        `${e.email || "—"} — ${dictionary(actor.language).people.import.reasons[e.reason] ?? e.reason}`),
      // Náhľad musí povedať aj to, čo sa **ticho nevyplní**. Inak personalista
      // uvidí „100 osôb pribudne", import prejde bez jedinej chyby a pracoviská
      // budú prázdne — a hľadať sa to bude až o mesiac.
      unknownWorkplaces: [...new Set(notes.unknownWorkplaces)],
      badPhones: [...new Set(notes.badPhones)],
    }
  } catch (e) {
    return { ok: false, message: errorMessage(e, actor.language) }
  }
}

/**
 * Nastavenia organizácie pre import — predvoľba telefónu a číselník pracovísk.
 *
 * Keď organizácia chýba, import beží ďalej a tie dve polia sa len nevyplnia.
 * Zastaviť import kvôli číselníku by znamenalo, že sa nedá naimportovať ani
 * meno a adresa.
 */
async function importSettings(companyCode: string): Promise<ImportSettings> {
  const tenant = await tenantByCompanyCode(companyCode)
  return {
    phonePrefix: tenant?.phonePrefix,
    workplaces: availableOptions(tenant ?? { codelists: {} }, "workplace"),
  }
}

/** Zápis. Volá sa až po náhľade, z toho istého textu. */
export async function runImportAction(text: string): Promise<{ ok: boolean; message: string }> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, message: NO_RIGHT }

  try {
    // Ten istý súbor a tie isté nastavenia ako v náhľade — inak by zápis
    // spravil niečo iné, než čo si personalista pred chvíľou odsúhlasil.
    const people = csvToPersons(text, actor.companyCode, await importSettings(actor.companyCode))
    const v = await upsertPersons(people, actor.email)
    revalidatePath("/people")
    return {
      ok: true,
      message: say(actor.language).importResult(v.created, v.updated, v.unchanged, v.errors.length),
    }
  } catch (e) {
    return { ok: false, message: errorMessage(e, actor.language) }
  }
}

/**
 * Hromadné pozvánky ľuďom, ktorí ešte nikdy neboli dnu.
 *
 * Zoznam sa **prepočíta tu znova**, neberie sa z formulára: medzi zobrazením
 * náhľadu a kliknutím sa mohol niekto prihlásiť a pozvánka niekomu, kto je
 * už dnu, je zbytočná pošta.
 *
 * E-mail nesie **odkaz na portál, nie prihlasovací odkaz** — ten platí 24
 * hodín a raz, takže pri stovke adries naraz časť vyprší skôr, než si to
 * niekto prečíta, a poštové brány ho spotrebujú ešte pred človekom
 * (zaznamenané 2026-08-28).
 */
export async function sendInvitationsAction() {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") redirect("/people")
  const language = ctx.person.language
  const t = dictionary(language).people.inviteAll

  const people = await neverSignedIn(ctx.person.companyCode)
  if (people.length === 0) {
    redirect("/people/invite?error=1&msg=" + encodeURIComponent(t.nobody))
  }

  let sent = 0
  const failed: string[] = []

  for (let i = 0; i < people.length; i += INVITE_CONCURRENCY) {
    // Tá istá `sendInviteTo` ako pri jednej osobe — jedno miesto, kde sa
    // pozvánka skladá. Jedna neplatná adresa nesmie zastaviť zvyšok, preto
    // funkcia vracia `false` namiesto výnimky.
    await Promise.all(people.slice(i, i + INVITE_CONCURRENCY).map(async person => {
      if (await sendInviteTo(person, ctx.tenant)) sent++
      else failed.push(person.email)
    }))
  }

  await writeAudit({
    companyCode: ctx.person.companyCode, subject: "person", action: "changed",
    actor: ctx.person.email, targetId: "invitations", targetLabel: t.heading,
    changes: diff({ sent: 0 }, { sent }),
  })

  revalidatePath("/people/invite")
  const message = failed.length === 0
    ? t.sent(sent)
    : `${t.sent(sent)} (${failed.length}) ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`
  redirect(`/people?msg=${encodeURIComponent(message)}${failed.length ? "&error=1" : ""}`)
}
