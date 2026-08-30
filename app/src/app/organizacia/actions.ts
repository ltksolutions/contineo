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
import { LEGACY_TAB_KEYS } from "@/lib/urlTabs"
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

async function kto(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await orgContext()
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
    e instanceof TenantValidationError || e instanceof BrandError ||
    e instanceof DomainError || e instanceof DepartmentError ||
    e instanceof CodelistError || e instanceof LibraryError
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
const HOTOVO = "Zmeny boli uložené."

function spat(fd: FormData, sprava: string, chyba = false): never {
  // Starý kľúč záložky (`utvary`) sa preloží aj tu, nielen pri čítaní stránky:
  // formulár vykreslený pred premenovaním ho ešte nesie a bez prekladu by
  // človeka po uložení hodilo na prvú záložku.
  const zadana = textPola(fd, "zalozka")
  const zalozka = (LEGACY_TAB_KEYS[zadana] ?? zadana) || "vzhlad"
  const q = new URLSearchParams({ zalozka, sprava })
  if (chyba) q.set("chyba", "1")
  redirect(`/organizacia?${q.toString()}`)
}

// ── vzhľad ───────────────────────────────────────────────────────────────────

export async function saveBrandingAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    // Prázdny súbor znamená „nemeň" — vo formulári sa nepamätá, takže prázdno
    // je stav pri každom otvorení.
    const subor = fd.get("logo")
    let logoUrl: string | undefined
    if (subor instanceof File && subor.size > 0) {
      logoUrl = await saveBrand(
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
      autoProvisionDomains: normalizeDomains(textPola(fd, "autoProvisionDomains")),
      ...(logoUrl ? { logoUrl } : {}),
    }, ja.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, HOTOVO)
}

// ── prihlasovanie kontom ─────────────────────────────────────────────────────

export async function saveSignInAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  try {
    await saveOAuth(ja.companyCode, provider, {
      clientId: textPola(fd, "clientId"),
      clientSecret: textPola(fd, "clientSecret"),
      tenantMode: provider === "microsoft" ? textPola(fd, "tenantMode") : undefined,
      allowedTenantIds: provider === "microsoft"
        ? splitList(textPola(fd, "allowedTenantIds"))
        : undefined,
      hostedDomain: provider === "google" ? textPola(fd, "hostedDomain") : undefined,
    }, ja.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, HOTOVO)
}

export async function deleteSignInAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const provider = textPola(fd, "provider") === "google" ? "google" : "microsoft"
  // Vyžiada si napísanie kódu organizácie: ľuďom, ktorí sa prihlasujú
  // pracovným kontom, tým okamžite prestane fungovať jediná cesta dnu.
  if (textPola(fd, "potvrdenie").toUpperCase() !== ja.companyCode.toUpperCase()) {
    spat(fd, `Na odstránenie napíš kód organizácie (${ja.companyCode}).`, true)
  }

  try {
    await deleteOAuth(ja.companyCode, provider, ja.email)
  } catch (e) {
    if (isRedirect(e)) throw e
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
export async function requestDomainAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    await requestDomain(ja.companyCode, textPola(fd, "host"), ja.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Zapísané. Teraz nastavte CNAME u svojho správcu DNS a dajte overiť.")
}

/** Overí DNS a — keď sedí — doménu zapne a pridá do Vercelu. */
export async function verifyDomainAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const host = textPola(fd, "host")
  let sprava = ""
  let chyba = false

  try {
    const v = await verifyRequest(ja.companyCode, host, ja.email)
    if (v.stav === "nenajdena") {
      sprava = "Takú žiadosť tu nemáme."
      chyba = true
    } else if (v.stav === "caka") {
      sprava = `${v.host} zatiaľ nesmeruje na nás. Zmena DNS býva viditeľná do hodiny; ak je to dlhšie, skontrolujte CNAME.`
      chyba = true
    } else {
      // Až teraz — dôkaz existuje. Do Vercelu sa doména pridáva až po ňom.
      const doVercelu = skipVercel(v.host) ? null : await addDomain(v.host)
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

export async function cancelDomainAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    await cancelDomain(ja.companyCode, textPola(fd, "host"), ja.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }

  revalidatePath("/organizacia")
  spat(fd, "Doména odstránená. Portál na nej prestal odpovedať.")
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
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await createDepartment(
      ja.companyCode, textPola(fd, "nazov"), textPola(fd, "parentId") || null, ja.email,
    )
    revalidatePath("/organizacia")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

export async function renameDepartmentAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await renameDepartment(ja.companyCode, textPola(fd, "id"), textPola(fd, "nazov"), ja.email)
    revalidatePath("/organizacia")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

export async function moveDepartmentAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await moveDepartment(
      ja.companyCode, textPola(fd, "id"), textPola(fd, "parentId") || null, ja.email,
    )
    // Presunom sa zmenili cesty ľudí v podstrome, a tie rozhodujú o tom, komu
    // sa pridelenia týkajú. Prepočet robí `presunOddelenie` sám.
    revalidatePath("/organizacia")
    revalidatePath("/osoby")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

export async function deleteDepartmentAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await deleteDepartment(ja.companyCode, textPola(fd, "id"), ja.email)
    revalidatePath("/organizacia")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

// ── číselníky organizácie (D55) ──────────────────────────────────────────────

export async function addCodelistItemAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await addCodelistItem(
      ja.companyCode, textPola(fd, "ciselnik"), textPola(fd, "kluc"), textPola(fd, "popis"), ja.email,
    )
    revalidatePath("/organizacia")
    revalidatePath("/kniznica")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

export async function removeCodelistItemAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await removeCodelistItem(ja.companyCode, textPola(fd, "ciselnik"), textPola(fd, "kluc"), ja.email)
    revalidatePath("/organizacia")
    revalidatePath("/kniznica")
    spat(fd, "Odobraté z ponuky. Dokumenty, ktoré túto hodnotu majú, si ju nesú ďalej.")
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
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
  const ja = await kto()
  if (!ja) redirect("/")

  const cislo = (meno: string) => {
    const v = Number(textPola(fd, meno))
    return Number.isFinite(v) ? v : undefined
  }

  try {
    await saveTenant(ja.companyCode, {
      chunkovanie: {
        slovoClanok: textPola(fd, "slovoClanok"),
        slovoPriloha: textPola(fd, "slovoPriloha"),
        opakovaniHlavicky: cislo("opakovaniHlavicky"),
        cielMinTokenov: cislo("cielMinTokenov"),
        cielMaxTokenov: cislo("cielMaxTokenov"),
      },
    }, ja.email)
    revalidatePath("/organizacia")
    spat(fd, "Uložené. Existujúce dokumenty sa nepreindexovali — spusti to pri konkrétnom dokumente.")
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
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

  try {
    const v = await reindexAll(
      ctx.person.companyCode, ctx.person.email, ctx.tenant.chunkovanie, 25,
    )
    const casti = [`preindexovaných ${v.preindexovanych}`]
    if (v.preskocenych) casti.push(`bez zmeny ${v.preskocenych}`)
    if (v.zostava) casti.push(`zostáva ${v.zostava} — spusti znova`)
    if (v.chyby.length) casti.push(`chyby: ${v.chyby.slice(0, 3).join("; ")}`)
    revalidatePath("/kniznica")
    spat(fd, casti.join(" · "), v.chyby.length > 0)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
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
  const ja = await kto()
  if (!ja) redirect("/")
  const smer = textPola(fd, "smer") === "dole" ? "dole" : "hore"
  try {
    await shiftDepartment(ja.companyCode, textPola(fd, "id"), smer, ja.email)
    revalidatePath("/organizacia")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}

/** Nové poradie celej úrovne — sem posiela výsledok ťahanie myšou. */
export async function saveDepartmentOrderAction(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  const poradie = textPola(fd, "poradie").split(",").map(x => x.trim()).filter(Boolean)
  try {
    if (poradie.length > 1) await saveOrder(ja.companyCode, poradie, ja.email)
    revalidatePath("/organizacia")
    spat(fd, HOTOVO)
  } catch (e) {
    if (isRedirect(e)) throw e
    spat(fd, spravaChyby(e), true)
  }
}
