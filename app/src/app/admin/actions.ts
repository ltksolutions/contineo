"use server"

/**
 * actions.ts — zápisy zo správy tenantov (Fáza 5b, rozsahy B a C).
 *
 * **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný;
 * to, že sa volá z formulára na chránenej stránke, nie je kontrola prístupu —
 * volať sa dá aj bez nej. Kontrola stránky a kontrola akcie sú dve nezávislé
 * veci a obe musia byť (D41, D42).
 *
 * Chyby sa vracajú **do adresy**, nie ako výnimka: formulár je serverový, bez
 * klientskeho stavu, a človek má po neúspechu vidieť dôvod na tej istej
 * stránke. Mobile first tým nič nestráca — nepotrebuje to ani riadok JS.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { platformContext } from "@/lib/admin"
import { send } from "@/lib/ecomail"
import {
  createTenant,
  saveTenant,
  normalizeHostnames,
  normalizeDomains,
  DomainOwnedError,
  TenantValidationError,
} from "@/lib/tenantAdmin"
import { addDomain, customerInstructions, domainStatus, skipVercel } from "@/lib/vercel"
import { saveOAuth, deleteOAuth } from "@/lib/tenantAdmin"
import { splitList, PROVIDER_LABEL } from "@/lib/oauth"
import { saveBrand, BrandError } from "@/lib/branding"

/** Kto akciu spustil — alebo `null`, keď na ňu nemá právo. */
async function isAdmin(): Promise<string | null> {
  const ctx = await platformContext()
  return ctx.state === "ready" ? ctx.person.email : null
}

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v : ""
}

function errorMessage(e: unknown): string {
  if (e instanceof DomainOwnedError || e instanceof TenantValidationError) return e.message
  if (e instanceof BrandError) return e.message
  console.error("[admin] akcia zlyhala:", e)
  return "Zmenu sa nepodarilo uložiť. Skús to znova."
}

/** Domény, ktoré vo Verceli pribudli, a čo sa s nimi stalo. */
async function ensureDomains(hostnames: string[]): Promise<string[]> {
  const messages: string[] = []
  for (const h of hostnames) {
    if (skipVercel(h)) continue
    const v = await addDomain(h)
    if (v.state === "pridana") messages.push(`${h} pridaná do Vercelu`)
    else if (v.state === "bez-nastavenia") {
      messages.push(`${h}: chýba VERCEL_TOKEN, doménu pridaj ručne`)
    } else if (v.state === "chyba") messages.push(`${h}: ${v.message}`)
  }
  return messages
}

/**
 * Uloží nahraté logo a vráti cestu, ktorou sa bude servírovať.
 *
 * `null`, keď sa nič nenahralo — vtedy sa logo nemení.
 */
async function saveUploadedLogo(fd: FormData, code: string, actor: string): Promise<string | null> {
  const file = fd.get("logo")
  if (!(file instanceof File) || file.size === 0) return null
  const bytes = Buffer.from(await file.arrayBuffer())
  return saveBrand(code.toUpperCase(), file.type, bytes, actor)
}

// ── rozsah B: zmena existujúcej organizácie ─────────────────────────────────

export async function saveTenantAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode")
  const hostnames = normalizeHostnames(fieldText(fd, "hostnames"))
  let message = ""
  let error = false

  try {
    // Nahraté logo prebije predchádzajúce. Prázdny vstup znamená „nemeň" —
    // súbor sa vo formulári po načítaní nepamätá, takže prázdno je stav pri
    // každom otvorení a mazať ním by znamenalo, že uloženie názvu zmaže logo.
    const logo = await saveUploadedLogo(fd, code, actor)

    await saveTenant(
      code,
      {
        displayName: fieldText(fd, "displayName"),
        shortName: fieldText(fd, "shortName"),
        logoUrl: logo ?? fieldText(fd, "logoUrl"),
        accentColor: fieldText(fd, "accentColor"),
        supportEmail: fieldText(fd, "supportEmail"),
        languages: fd.getAll("languages").filter(v => typeof v === "string") as string[],
        defaultLanguage: fieldText(fd, "defaultLanguage"),
        hostnames,
        autoProvisionDomains: normalizeDomains(fieldText(fd, "autoProvisionDomains")),
      },
      actor,
    )
    const vercel = await ensureDomains(hostnames)
    message = ["Uložené.", ...vercel].join(" ")
  } catch (e) {
    message = errorMessage(e)
    error = true
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Vypnutie je jediná zmena, ktorá ľudí **okamžite** odstrihne od portálu.
 * Preto sa žiada napísať kód organizácie — nie „naozaj?", ktoré človek
 * odklikne skôr, než si prečíta, čoho sa týka.
 */
export async function toggleTenantStatusAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode")
  const enable = fieldText(fd, "status") === "active"
  let message = ""
  let error = false

  if (!enable && fieldText(fd, "potvrdenie").trim().toUpperCase() !== code.toUpperCase()) {
    message = `Na vypnutie treba napísať kód organizácie (${code}). Nič sa nezmenilo.`
    error = true
  } else {
    try {
      await saveTenant(code, { status: enable ? "active" : "disabled" }, actor)
      message = enable
        ? "Organizácia je zapnutá."
        : "Organizácia je vypnutá — nikto z nej sa teraz neprihlási."
    } catch (e) {
      message = errorMessage(e)
    error = true
      error = true
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

// ── rozsah C: založenie a pokyny ────────────────────────────────────────────

export async function createTenantAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode").trim().toUpperCase()
  const hostnames = normalizeHostnames(fieldText(fd, "hostnames"))

  try {
    await createTenant(
      code,
      {
        displayName: fieldText(fd, "displayName"),
        supportEmail: fieldText(fd, "supportEmail"),
        hostnames,
      },
      actor,
    )
  } catch (e) {
    const message = errorMessage(e)
    redirect(`/admin/novy?msg=${encodeURIComponent(message)}&error=1`)
  }

  // Až po uloženom tenantovi — zdroj pravdy je `tenants` a výpadok Vercelu
  // nesmie brániť organizáciu založiť.
  const vercel = await ensureDomains(hostnames)
  const message = ["Organizácia založená.", ...vercel].join(" ")

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}`)
}

/**
 * Odošle zákazníkovi pokyny k doméne a **zaznamená ten akt** (`domainSetup`).
 * Stav domény sa neukladá — číta sa naživo; uložený by klamal presne vtedy,
 * keď si zákazník DNS prestaví. Zaznamenáva sa len to, čo sa odvodiť nedá:
 * komu a kedy sme písali.
 */
export async function sendInstructionsAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode")
  const to = fieldText(fd, "komu").trim().toLowerCase()
  const hostnames = normalizeHostnames(fieldText(fd, "hostnames"))
  let message = ""
  let error = false

  if (!to) {
    message = "Nie je kam poslať — doplň kontaktnú adresu organizácie."
    error = true
  } else {
    try {
      const sent: string[] = []
      for (const h of hostnames) {
        if (skipVercel(h)) continue
        const s = await domainStatus(h)
        if (s.nastaveneCez) continue
        const p = customerInstructions(h, s.cname)
        await send({
          to: to,
          subject: p.subject,
          text: p.text,
          html: `<pre style="font:14px ui-monospace,monospace;white-space:pre-wrap">${p.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")}</pre>`,
        })
        sent.push(h)
      }
      if (!sent.length) {
        message = "Niet čo posielať — všetky domény sú už nasmerované."
      } else {
        await saveTenant(code, {}, actor)
        await writeInstructions(code, to, sent)
        message = `Pokyny pre ${sent.join(", ")} odoslané na ${to}.`
      }
    } catch (e) {
      message = errorMessage(e)
    error = true
      error = true
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Zápis aktu. Oddelené, aby bolo v kóde vidieť, že sa ukladá len toto. */
async function writeInstructions(code: string, to: string, hostnames: string[]) {
  const { getCollection } = await import("@/lib/mongodb")
  const col = await getCollection(process.env.TENANTS_COLLECTION ?? "tenants")
  await col.updateOne(
    { companyCode: code },
    { $set: { domainSetup: { requestedAt: new Date(), requestedTo: to, hostnames } } },
  )
}

// ── prihlasovacie údaje poskytovateľov (D43) ─────────────────────────────────

/**
 * Uloží údaje k Entra alebo Google aplikácii zákazníka.
 *
 * Tajomstvo prichádza z formulára čitateľné a **odchádza odtiaľto zašifrované**
 * — do databázy sa v pôvodnej podobe nedostane ani na okamih. Do logu ani do
 * chybovej hlášky sa nedostane vôbec; preto sa nikde nevypisuje `vstup`.
 */
export async function saveSignInAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode")
  const provider = fieldText(fd, "provider") === "google" ? "google" : "microsoft"
  let message = ""
  let error = false

  try {
    await saveOAuth(code, provider, {
      clientId: fieldText(fd, "clientId"),
      // Prázdne pole znamená „nemeň" — obrazovka hodnotu nikdy neukazuje,
      // takže je pri každom otvorení prázdne.
      clientSecret: fieldText(fd, "clientSecret"),
      tenantMode: provider === "microsoft" ? fieldText(fd, "tenantMode") : undefined,
      allowedTenantIds: provider === "microsoft"
        ? splitList(fieldText(fd, "allowedTenantIds"))
        : undefined,
      hostedDomain: provider === "google" ? fieldText(fd, "hostedDomain") : undefined,
    }, actor)
    message = `Prihlásenie cez ${PROVIDER_LABEL[provider]} uložené.`
  } catch (e) {
    message = errorMessage(e)
    error = true
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Odstráni údaje poskytovateľa — tlačidlo prihlásenia tým zmizne.
 *
 * Vyžiada si napísanie kódu organizácie, rovnako ako vypnutie tenanta: ľuďom,
 * ktorí sa prihlasujú pracovným kontom, tým okamžite prestane fungovať jediná
 * cesta, ktorú poznajú.
 */
export async function deleteSignInAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")

  const code = fieldText(fd, "companyCode")
  const provider = fieldText(fd, "provider") === "google" ? "google" : "microsoft"
  const confirmation = fieldText(fd, "potvrdenie")
  let message = ""
  let error = false

  if (confirmation.trim().toUpperCase() !== code.toUpperCase()) {
    message = `Na odstránenie napíš kód organizácie (${code}).`
    error = true
  } else {
    try {
      await deleteOAuth(code, provider, actor)
      message = `Prihlásenie cez ${PROVIDER_LABEL[provider]} odstránené.`
    } catch (e) {
      message = errorMessage(e)
    error = true
      error = true
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(code)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}
