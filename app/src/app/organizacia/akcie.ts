"use server"

/**
 * akcie.ts — zmeny, ktoré si organizácia robí sama (D48).
 *
 * **Kód organizácie sa nikdy neberie z formulára**, vždy z prihláseného
 * človeka. Keby prišiel z prehliadača, personalista jedného zväzu by mohol
 * prepísať vzhľad alebo prihlasovanie druhého (D32).
 *
 * Čo tu **nie je a nebude**: vypnutie organizácie a jej kód. To sú veci medzi
 * zákazníkom a nami; organizácia, ktorá si vie sama vypnúť prístup celému
 * zväzu, je len iný spôsob, ako si privolať telefonát o polnoci.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { organizaciaContext } from "@/lib/organizacia"
import { saveTenant, ulozOAuth, zmazOAuth, normalizeDomeny, TenantValidationError } from "@/lib/tenantAdmin"
import { ulozZnacku, ZnackaError } from "@/lib/znacka"
import { rozdelZoznam } from "@/lib/oauth"
import {
  poziadajODomenu, overZiadost, zrusDomenu, DomenaError,
} from "@/lib/domenyZakaznika"
import { pridajDomenu, preskocitVercel } from "@/lib/vercel"
import {
  zalozOddelenie, premenujOddelenie, presunOddelenie, zmazOddelenie, OddelenieError,
} from "@/lib/oddelenia"

async function kto(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await organizaciaContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode }
    : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v.trim() : ""
}

function spravaChyby(e: unknown): string {
  if (
    e instanceof TenantValidationError || e instanceof ZnackaError ||
    e instanceof DomenaError || e instanceof OddelenieError
  ) {
    return e.message
  }
  console.error("[organizacia] akcia zlyhala:", e)
  return "Zmenu sa nepodarilo uložiť. Skús to znova."
}

/**
 * Späť na tú istú záložku, z ktorej sa odosielalo.
 *
 * Bez toho by človeka po uložení domény hodilo na vzhľad a musel by sa
 * preklikať späť — pri chybe by navyše nevidel pole, ktoré má opraviť.
 */
function spat(fd: FormData, sprava: string, chyba = false): never {
  const zalozka = textPola(fd, "zalozka") || "vzhlad"
  const q = new URLSearchParams({ zalozka, sprava })
  if (chyba) q.set("chyba", "1")
  redirect(`/organizacia?${q.toString()}`)
}

// ── vzhľad ───────────────────────────────────────────────────────────────────

export async function ulozVzhlad(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    // Prázdny súbor znamená „nemeň" — vo formulári sa nepamätá, takže prázdno
    // je stav pri každom otvorení.
    const subor = fd.get("logo")
    let logoUrl: string | undefined
    if (subor instanceof File && subor.size > 0) {
      logoUrl = await ulozZnacku(
        ja.companyCode, subor.type, Buffer.from(await subor.arrayBuffer()), ja.email,
      )
    }

    await saveTenant(ja.companyCode, {
      displayName: textPola(fd, "displayName"),
      shortName: textPola(fd, "shortName"),
      accentColor: textPola(fd, "accentColor"),
      supportEmail: textPola(fd, "supportEmail"),
      languages: fd.getAll("languages").filter(v => typeof v === "string") as string[],
      defaultLanguage: textPola(fd, "defaultLanguage"),
      autoProvisionDomains: normalizeDomeny(textPola(fd, "autoProvisionDomains")),
      ...(logoUrl ? { logoUrl } : {}),
    }, ja.email)
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Uložené.")
}

// ── prihlasovanie kontom ─────────────────────────────────────────────────────

export async function ulozPrihlasenie(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  try {
    await ulozOAuth(ja.companyCode, provider, {
      clientId: textPola(fd, "clientId"),
      clientSecret: textPola(fd, "clientSecret"),
      tenantMode: provider === "microsoft" ? textPola(fd, "tenantMode") : undefined,
      allowedTenantIds: provider === "microsoft"
        ? rozdelZoznam(textPola(fd, "allowedTenantIds"))
        : undefined,
      hostedDomain: provider === "google" ? textPola(fd, "hostedDomain") : undefined,
    }, ja.email)
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Prihlasovacie údaje uložené.")
}

export async function zmazPrihlasenie(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  // Vyžiada si napísanie kódu organizácie: ľuďom, ktorí sa prihlasujú
  // pracovným kontom, tým okamžite prestane fungovať jediná cesta dnu.
  if (textPola(fd, "potvrdenie").toUpperCase() !== ja.companyCode.toUpperCase()) {
    spat(fd, `Na odstránenie napíš kód organizácie (${ja.companyCode}).`, true)
  }

  try {
    await zmazOAuth(ja.companyCode, provider, ja.email)
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Prihlasovacie údaje odstránené.")
}

// ── domény ───────────────────────────────────────────────────────────────────

/**
 * Požiadanie o doménu. **Nič sa nezapína.**
 *
 * Doména sa zapne až vtedy, keď na nás začne smerovať DNS — a to vie nastaviť
 * len ten, kto ju naozaj ovláda. Zapísať ju rovno by znamenalo, že si ktokoľvek
 * pripíše cudziu doménu do nášho účtu vo Verceli.
 */
export async function poziadaj(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    await poziadajODomenu(ja.companyCode, textPola(fd, "host"), ja.email)
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Zapísané. Teraz nastavte CNAME u svojho správcu DNS a dajte overiť.")
}

/** Overí DNS a — keď sedí — doménu zapne a pridá do Vercelu. */
export async function overDomenu(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const host = textPola(fd, "host")
  let sprava = ""
  let chyba = false

  try {
    const v = await overZiadost(ja.companyCode, host)
    if (v.stav === "nenajdena") {
      sprava = "Takú žiadosť tu nemáme."
      chyba = true
    } else if (v.stav === "caka") {
      sprava = `${v.host} zatiaľ nesmeruje na nás. Zmena DNS býva viditeľná do hodiny; ak je to dlhšie, skontrolujte CNAME.`
      chyba = true
    } else {
      // Až teraz — dôkaz existuje. Do Vercelu sa doména pridáva až po ňom.
      const doVercelu = preskocitVercel(v.host) ? null : await pridajDomenu(v.host)
      sprava = doVercelu && doVercelu.stav !== "pridana" && doVercelu.stav !== "uz-je"
        ? `${v.host} je zapnutá, ale do Vercelu sa nepridala — ozvite sa nám.`
        : `${v.host} je zapnutá. Portál na nej odpovedá.`
    }
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath("/organizacia")
  spat(fd, sprava, chyba)
}

export async function zrus(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    await zrusDomenu(ja.companyCode, textPola(fd, "host"))
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Doména odstránená. Portál na nej prestal odpovedať.")
}

// ── útvary (D49) ─────────────────────────────────────────────────────────────

/**
 * Založenie, premenovanie, presun a zrušenie útvaru.
 *
 * Všetky štyri idú cez `organizaciaContext()`, ktorý stráži rolu aj kód
 * organizácie. Identifikátory prichádzajú z formulára, a preto sa v každej
 * funkcii v `oddelenia.ts` overuje, že patria tejto organizácii — cudzí
 * identifikátor sa dá uhádnuť (D32).
 */
export async function zalozUtvar(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await zalozOddelenie(
      ja.companyCode, textPola(fd, "nazov"), textPola(fd, "parentId") || null, ja.email,
    )
    revalidatePath("/organizacia")
    spat(fd, "Útvar pribudol.")
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }
}

export async function premenujUtvar(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await premenujOddelenie(ja.companyCode, textPola(fd, "id"), textPola(fd, "nazov"), ja.email)
    revalidatePath("/organizacia")
    spat(fd, "Útvar sa premenoval.")
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }
}

export async function presunUtvar(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await presunOddelenie(
      ja.companyCode, textPola(fd, "id"), textPola(fd, "parentId") || null, ja.email,
    )
    // Presunom sa zmenili cesty ľudí v podstrome, a tie rozhodujú o tom, komu
    // sa pridelenia týkajú. Prepočet robí `presunOddelenie` sám.
    revalidatePath("/organizacia")
    revalidatePath("/osoby")
    spat(fd, "Útvar sa presunul.")
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }
}

export async function zrusUtvar(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await zmazOddelenie(ja.companyCode, textPola(fd, "id"))
    revalidatePath("/organizacia")
    spat(fd, "Útvar sa zrušil.")
  } catch (e) {
    spat(fd, spravaChyby(e), true)
  }
}
