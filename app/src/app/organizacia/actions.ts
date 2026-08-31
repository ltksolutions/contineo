"use server"

/**
 * actions.ts — zmeny, ktoré si organizácia robí sama (D48).
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
import { orgContext } from "@/lib/orgSettings"
import { isRedirect } from "@/lib/redirects"
import { tabValue } from "@/lib/urlParams"
import { saveTenant, saveOAuth, deleteOAuth, normalizeDomains, TenantValidationError } from "@/lib/tenantAdmin"
import { saveBrand, BrandError } from "@/lib/branding"
import { splitList } from "@/lib/oauth"
import {
  requestDomain, verifyRequest, cancelDomain, DomainError,
} from "@/lib/customerDomains"
import { addDomain, skipVercel } from "@/lib/vercel"
import {
  createDepartment, renameDepartment, moveDepartment, deleteDepartment,
  shiftDepartment, saveOrder, DepartmentError,
} from "@/lib/departments"
import { addCodelistItem, removeCodelistItem } from "@/lib/codelistsTenant"
import { CodelistError } from "@/lib/codelists"
import { reindexAll, LibraryError } from "@/lib/libraryWrite"
import { dictionary, type UiLanguage } from "@/lib/i18n"

async function actor(): Promise<{ email: string; companyCode: string; language: UiLanguage } | null> {
  const ctx = await orgContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }
    : null
}

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

/** Hlásenia v jazyku prihláseného človeka. */
function say(language: UiLanguage) {
  return dictionary(language).org.actions
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (
    e instanceof TenantValidationError || e instanceof BrandError ||
    e instanceof DomainError || e instanceof DepartmentError ||
    e instanceof CodelistError || e instanceof LibraryError
  ) {
    return e.message
  }
  console.error("[organizacia] akcia zlyhala:", e)
  return say(language).failed
}

/**
 * Späť na tú istú záložku, z ktorej sa odosielalo.
 *
 * Bez toho by človeka po uložení domény hodilo na vzhľad a musel by sa
 * preklikať späť — pri chybe by navyše nevidel pole, ktoré má opraviť.
 */
/**
 * Jedno hlásenie na všetky uloženia.
 *
 * Predtým mala každá akcia vlastnú vetu („Oddelenie pribudol.", „Doména
 * odstránená.") a bola to zbytočná príležitosť pomýliť sa v skloňovaní —
 * čo sa aj stalo. Človek navyše vidí výsledok na obrazovke pod dialógom;
 * hlásenie má povedať, že sa zápis podaril, nie ho prerozprávať.
 *
 * Vlastnú vetu si nechávajú len akcie, ktoré hovoria niečo, čo z obrazovky
 * vidieť nie je — napríklad že treba nastaviť DNS.
 */


function back(fd: FormData, message: string, error = false): never {
  // Starý kľúč záložky (`utvary`) sa preloží aj tu, nielen pri čítaní stránky:
  // formulár vykreslený pred premenovaním ho ešte nesie a bez prekladu by
  // človeka po uložení hodilo na prvú záložku.
  const given = fieldText(fd, "tab") || fieldText(fd, "zalozka")
  const tab = tabValue(given) || "branding"
  const q = new URLSearchParams({ tab, msg: message })
  if (error) q.set("error", "1")
  redirect(`/organizacia?${q.toString()}`)
}

// ── vzhľad ───────────────────────────────────────────────────────────────────

export async function saveBrandingAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    // Prázdny súbor znamená „nemeň" — vo formulári sa nepamätá, takže prázdno
    // je stav pri každom otvorení.
    const file = fd.get("logo")
    let logoUrl: string | undefined
    if (file instanceof File && file.size > 0) {
      logoUrl = await saveBrand(
        self.companyCode, file.type, Buffer.from(await file.arrayBuffer()), self.email,
      )
    }

    await saveTenant(self.companyCode, {
      displayName: fieldText(fd, "displayName"),
      shortName: fieldText(fd, "shortName"),
      accentColor: fieldText(fd, "accentColor"),
      supportEmail: fieldText(fd, "supportEmail"),
      languages: fd.getAll("languages").filter(v => typeof v === "string") as string[],
      defaultLanguage: fieldText(fd, "defaultLanguage"),
      autoProvisionDomains: normalizeDomains(fieldText(fd, "autoProvisionDomains")),
      ...(logoUrl ? { logoUrl } : {}),
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organizacia")
  back(fd, say(self.language).saved)
}

// ── prihlasovanie kontom ─────────────────────────────────────────────────────

export async function saveSignInAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const provider = fieldText(fd, "provider") === "google" ? "google" : "microsoft"
  try {
    await saveOAuth(self.companyCode, provider, {
      clientId: fieldText(fd, "clientId"),
      clientSecret: fieldText(fd, "clientSecret"),
      tenantMode: provider === "microsoft" ? fieldText(fd, "tenantMode") : undefined,
      allowedTenantIds: provider === "microsoft"
        ? splitList(fieldText(fd, "allowedTenantIds"))
        : undefined,
      hostedDomain: provider === "google" ? fieldText(fd, "hostedDomain") : undefined,
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organizacia")
  back(fd, say(self.language).saved)
}

export async function deleteSignInAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const provider = fieldText(fd, "provider") === "google" ? "google" : "microsoft"
  // Vyžiada si napísanie kódu organizácie: ľuďom, ktorí sa prihlasujú
  // pracovným kontom, tým okamžite prestane fungovať jediná cesta dnu.
  if (fieldText(fd, "confirmation").toUpperCase() !== self.companyCode.toUpperCase()) {
    back(fd, say(self.language).confirmCode(self.companyCode), true)
  }

  try {
    await deleteOAuth(self.companyCode, provider, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organizacia")
  back(fd, say(self.language).signInRemoved)
}

// ── domény ───────────────────────────────────────────────────────────────────

/**
 * Požiadanie o doménu. **Nič sa nezapína.**
 *
 * Doména sa zapne až vtedy, keď na nás začne smerovať DNS — a to vie nastaviť
 * len ten, kto ju naozaj ovláda. Zapísať ju rovno by znamenalo, že si ktokoľvek
 * pripíše cudziu doménu do nášho účtu vo Verceli.
 */
export async function requestDomainAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    await requestDomain(self.companyCode, fieldText(fd, "host"), self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organizacia")
  back(fd, say(self.language).domainRequested)
}

/** Overí DNS a — keď sedí — doménu zapne a pridá do Vercelu. */
export async function verifyDomainAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const host = fieldText(fd, "host")
  let message = ""
  let error = false

  try {
    const v = await verifyRequest(self.companyCode, host, self.email)
    if (v.state === "nenajdena") {
      message = say(self.language).domainNotFound
      error = true
    } else if (v.state === "caka") {
      message = say(self.language).domainWaiting(v.host)
      error = true
    } else {
      // Až teraz — dôkaz existuje. Do Vercelu sa doména pridáva až po ňom.
      const toVercel = skipVercel(v.host) ? null : await addDomain(v.host)
      message = toVercel && toVercel.state !== "pridana" && toVercel.state !== "uz-je"
        ? say(self.language).domainOnNotInVercel(v.host)
        : say(self.language).domainOn(v.host)
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/organizacia")
  back(fd, message, error)
}

export async function cancelDomainAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    await cancelDomain(self.companyCode, fieldText(fd, "host"), self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organizacia")
  back(fd, say(self.language).domainRemoved)
}

// ── oddelenia (D49) ─────────────────────────────────────────────────────────────

/**
 * Založenie, premenovanie, presun a zrušenie oddelenia.
 *
 * Všetky štyri idú cez `organizaciaContext()`, ktorý stráži rolu aj kód
 * organizácie. Identifikátory prichádzajú z formulára, a preto sa v každej
 * funkcii v `oddelenia.ts` overuje, že patria tejto organizácii — cudzí
 * identifikátor sa dá uhádnuť (D32).
 */
export async function createDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await createDepartment(
      self.companyCode, fieldText(fd, "name"), fieldText(fd, "parentId") || null, self.email,
    )
    revalidatePath("/organizacia")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function renameDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await renameDepartment(self.companyCode, fieldText(fd, "id"), fieldText(fd, "name"), self.email)
    revalidatePath("/organizacia")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function moveDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await moveDepartment(
      self.companyCode, fieldText(fd, "id"), fieldText(fd, "parentId") || null, self.email,
    )
    // Presunom sa zmenili cesty ľudí v podstrome, a tie rozhodujú o tom, komu
    // sa pridelenia týkajú. Prepočet robí `presunOddelenie` sám.
    revalidatePath("/organizacia")
    revalidatePath("/osoby")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function deleteDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await deleteDepartment(self.companyCode, fieldText(fd, "id"), self.email)
    revalidatePath("/organizacia")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

// ── číselníky organizácie (D55) ──────────────────────────────────────────────

export async function addCodelistItemAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await addCodelistItem(
      self.companyCode, fieldText(fd, "codelist"), fieldText(fd, "key"), fieldText(fd, "label"), self.email,
    )
    revalidatePath("/organizacia")
    revalidatePath("/kniznica")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function removeCodelistItemAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await removeCodelistItem(self.companyCode, fieldText(fd, "codelist"), fieldText(fd, "key"), self.email)
    revalidatePath("/organizacia")
    revalidatePath("/kniznica")
    back(fd, say(self.language).codelistRemoved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

// ── profil členenia (D58) ────────────────────────────────────────────────────

/**
 * Uloží profil členenia dokumentov.
 *
 * Zmena profilu **nepreindexuje nič sama**. Je to zámer: preindexovanie
 * všetkých dokumentov naraz je operácia, ktorá sa nedá vziať späť jedným
 * klikom, a človek má najprv vidieť, čo nový profil spraví s jedným
 * dokumentom (`Preindexovať` v jeho detaile).
 */
export async function saveChunkingProfileAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const number = (actorName: string) => {
    const v = Number(fieldText(fd, actorName))
    return Number.isFinite(v) ? v : undefined
  }

  try {
    await saveTenant(self.companyCode, {
      chunking: {
        slovoClanok: fieldText(fd, "slovoClanok"),
        annexWord: fieldText(fd, "slovoPriloha"),
        headerRepeats: number("opakovaniHlavicky"),
        cielMinTokenov: number("cielMinTokenov"),
        cielMaxTokenov: number("cielMaxTokenov"),
      },
    }, self.email)
    revalidatePath("/organizacia")
    back(fd, say(self.language).chunkingSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

/**
 * Preindexuje všetky dokumenty podľa uloženého profilu.
 *
 * V dávke, nie naraz: funkcia má strop na čas behu a pád uprostred by nechal
 * časť dokumentov narezanú po starom. Keď niečo zostane, obrazovka to povie
 * a tlačidlo sa stlačí znova — opakovanie je lacné, lebo hotové dokumenty
 * sa preskočia.
 */
export async function reindexAllAction(fd: FormData) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") redirect("/")
  const m = say(ctx.person.language)

  try {
    const v = await reindexAll(
      ctx.person.companyCode, ctx.person.email, ctx.tenant.chunking, 25,
    )
    const parts = [m.reindexedCount(v.preindexovanych)]
    if (v.preskocenych) parts.push(m.reindexSkipped(v.preskocenych))
    if (v.remaining) parts.push(m.reindexRemaining(v.remaining))
    if (v.errors.length) parts.push(m.reindexErrors(v.errors.slice(0, 3).join("; ")))
    revalidatePath("/kniznica")
    back(fd, parts.join(" · "), v.errors.length > 0)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, ctx.person.language), true)
  }
}

/**
 * Posun o jedno miesto medzi súrodencami (D60).
 *
 * Obyčajný formulár s tlačidlom — funguje bez JavaScriptu a dá sa ovládať
 * klávesnicou. Ťahanie myšou je nadstavba nad tým istým zápisom, nie jediná
 * cesta: organizačnú schému niekto usporadúva raz za rok a nemá pri tom
 * bojovať s presnosťou pustenia.
 */
export async function shiftDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const direction = fieldText(fd, "direction") === "down" ? "down" : "up"
  try {
    await shiftDepartment(self.companyCode, fieldText(fd, "id"), direction, self.email)
    revalidatePath("/organizacia")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

/** Nové poradie celej úrovne — sem posiela výsledok ťahanie myšou. */
export async function saveDepartmentOrderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const order = fieldText(fd, "order").split(",").map(x => x.trim()).filter(Boolean)
  try {
    if (order.length > 1) await saveOrder(self.companyCode, order, self.email)
    revalidatePath("/organizacia")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}
