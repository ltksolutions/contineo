"use server"

/**
 * akcie.ts — zápisy zo správy tenantov (Fáza 5b, rozsahy B a C).
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
  DomainOwnedError,
  TenantValidationError,
} from "@/lib/tenantAdmin"
import { pridajDomenu, pokynyPreZakaznika, stavDomeny, preskocitVercel } from "@/lib/vercel"
import { ulozOAuth, zmazOAuth } from "@/lib/tenantAdmin"
import { rozdelZoznam, NAZOV_POSKYTOVATELA } from "@/lib/oauth"

/** Kto akciu spustil — alebo `null`, keď na ňu nemá právo. */
async function spravca(): Promise<string | null> {
  const ctx = await platformContext()
  return ctx.state === "ready" ? ctx.person.email : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v : ""
}

function spravaChyby(e: unknown): string {
  if (e instanceof DomainOwnedError || e instanceof TenantValidationError) return e.message
  console.error("[admin] akcia zlyhala:", e)
  return "Zmenu sa nepodarilo uložiť. Skús to znova."
}

/** Domény, ktoré vo Verceli pribudli, a čo sa s nimi stalo. */
async function zabezpecDomeny(hostnames: string[]): Promise<string[]> {
  const spravy: string[] = []
  for (const h of hostnames) {
    if (preskocitVercel(h)) continue
    const v = await pridajDomenu(h)
    if (v.stav === "pridana") spravy.push(`${h} pridaná do Vercelu`)
    else if (v.stav === "bez-nastavenia") {
      spravy.push(`${h}: chýba VERCEL_TOKEN, doménu pridaj ručne`)
    } else if (v.stav === "chyba") spravy.push(`${h}: ${v.sprava}`)
  }
  return spravy
}

// ── rozsah B: zmena existujúcej organizácie ─────────────────────────────────

export async function ulozTenant(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode")
  const hostnames = normalizeHostnames(textPola(fd, "hostnames"))
  let sprava = ""

  try {
    await saveTenant(
      kod,
      {
        displayName: textPola(fd, "displayName"),
        shortName: textPola(fd, "shortName"),
        logoUrl: textPola(fd, "logoUrl"),
        accentColor: textPola(fd, "accentColor"),
        supportEmail: textPola(fd, "supportEmail"),
        languages: fd.getAll("languages").filter(v => typeof v === "string") as string[],
        defaultLanguage: textPola(fd, "defaultLanguage"),
        hostnames,
      },
      kto,
    )
    const vercel = await zabezpecDomeny(hostnames)
    sprava = ["Uložené.", ...vercel].join(" ")
  } catch (e) {
    sprava = spravaChyby(e)
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}

/**
 * Vypnutie je jediná zmena, ktorá ľudí **okamžite** odstrihne od portálu.
 * Preto sa žiada napísať kód organizácie — nie „naozaj?", ktoré človek
 * odklikne skôr, než si prečíta, čoho sa týka.
 */
export async function prepniStav(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode")
  const zapnut = textPola(fd, "status") === "active"
  let sprava = ""

  if (!zapnut && textPola(fd, "potvrdenie").trim().toUpperCase() !== kod.toUpperCase()) {
    sprava = `Na vypnutie treba napísať kód organizácie (${kod}). Nič sa nezmenilo.`
  } else {
    try {
      await saveTenant(kod, { status: zapnut ? "active" : "disabled" }, kto)
      sprava = zapnut
        ? "Organizácia je zapnutá."
        : "Organizácia je vypnutá — nikto z nej sa teraz neprihlási."
    } catch (e) {
      sprava = spravaChyby(e)
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}

// ── rozsah C: založenie a pokyny ────────────────────────────────────────────

export async function zalozTenant(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode").trim().toUpperCase()
  const hostnames = normalizeHostnames(textPola(fd, "hostnames"))

  try {
    await createTenant(
      kod,
      {
        displayName: textPola(fd, "displayName"),
        supportEmail: textPola(fd, "supportEmail"),
        hostnames,
      },
      kto,
    )
  } catch (e) {
    const sprava = spravaChyby(e)
    redirect(`/admin/novy?sprava=${encodeURIComponent(sprava)}`)
  }

  // Až po uloženom tenantovi — zdroj pravdy je `tenants` a výpadok Vercelu
  // nesmie brániť organizáciu založiť.
  const vercel = await zabezpecDomeny(hostnames)
  const sprava = ["Organizácia založená.", ...vercel].join(" ")

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}

/**
 * Odošle zákazníkovi pokyny k doméne a **zaznamená ten akt** (`domainSetup`).
 * Stav domény sa neukladá — číta sa naživo; uložený by klamal presne vtedy,
 * keď si zákazník DNS prestaví. Zaznamenáva sa len to, čo sa odvodiť nedá:
 * komu a kedy sme písali.
 */
export async function poslatPokyny(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode")
  const komu = textPola(fd, "komu").trim().toLowerCase()
  const hostnames = normalizeHostnames(textPola(fd, "hostnames"))
  let sprava = ""

  if (!komu) {
    sprava = "Nie je kam poslať — doplň kontaktnú adresu organizácie."
  } else {
    try {
      const poslane: string[] = []
      for (const h of hostnames) {
        if (preskocitVercel(h)) continue
        const s = await stavDomeny(h)
        if (s.nastaveneCez) continue
        const p = pokynyPreZakaznika(h, s.cname)
        await send({
          to: komu,
          subject: p.subject,
          text: p.text,
          html: `<pre style="font:14px ui-monospace,monospace;white-space:pre-wrap">${p.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")}</pre>`,
        })
        poslane.push(h)
      }
      if (!poslane.length) {
        sprava = "Niet čo posielať — všetky domény sú už nasmerované."
      } else {
        await saveTenant(kod, {}, kto)
        await zapisPokyny(kod, komu, poslane)
        sprava = `Pokyny pre ${poslane.join(", ")} odoslané na ${komu}.`
      }
    } catch (e) {
      sprava = spravaChyby(e)
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}

/** Zápis aktu. Oddelené, aby bolo v kóde vidieť, že sa ukladá len toto. */
async function zapisPokyny(kod: string, komu: string, hostnames: string[]) {
  const { getCollection } = await import("@/lib/mongodb")
  const col = await getCollection(process.env.TENANTS_COLLECTION ?? "tenants")
  await col.updateOne(
    { companyCode: kod },
    { $set: { domainSetup: { requestedAt: new Date(), requestedTo: komu, hostnames } } },
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
export async function ulozPrihlasenie(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode")
  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  let sprava = ""

  try {
    await ulozOAuth(kod, provider, {
      clientId: textPola(fd, "clientId"),
      // Prázdne pole znamená „nemeň" — obrazovka hodnotu nikdy neukazuje,
      // takže je pri každom otvorení prázdne.
      clientSecret: textPola(fd, "clientSecret"),
      tenantMode: provider === "microsoft" ? textPola(fd, "tenantMode") : undefined,
      allowedTenantIds: provider === "microsoft"
        ? rozdelZoznam(textPola(fd, "allowedTenantIds"))
        : undefined,
      hostedDomain: provider === "google" ? textPola(fd, "hostedDomain") : undefined,
    }, kto)
    sprava = `Prihlásenie cez ${NAZOV_POSKYTOVATELA[provider]} uložené.`
  } catch (e) {
    sprava = spravaChyby(e)
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}

/**
 * Odstráni údaje poskytovateľa — tlačidlo prihlásenia tým zmizne.
 *
 * Vyžiada si napísanie kódu organizácie, rovnako ako vypnutie tenanta: ľuďom,
 * ktorí sa prihlasujú pracovným kontom, tým okamžite prestane fungovať jediná
 * cesta, ktorú poznajú.
 */
export async function zmazPrihlasenie(fd: FormData) {
  const kto = await spravca()
  if (!kto) redirect("/admin")

  const kod = textPola(fd, "companyCode")
  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  const potvrdenie = textPola(fd, "potvrdenie")
  let sprava = ""

  if (potvrdenie.trim().toUpperCase() !== kod.toUpperCase()) {
    sprava = `Na odstránenie napíš kód organizácie (${kod}).`
  } else {
    try {
      await zmazOAuth(kod, provider, kto)
      sprava = `Prihlásenie cez ${NAZOV_POSKYTOVATELA[provider]} odstránené.`
    } catch (e) {
      sprava = spravaChyby(e)
    }
  }

  revalidatePath("/admin")
  redirect(`/admin/tenanti/${encodeURIComponent(kod)}?sprava=${encodeURIComponent(sprava)}`)
}
