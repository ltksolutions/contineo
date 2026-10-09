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

import { slugifyKey } from "@/lib/slug"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { orgContext } from "@/lib/orgSettings"
import { isRedirect } from "@/lib/redirects"
import { tabValue } from "@/lib/urlParams"
import { isOrgSection, orgSectionHref } from "@/lib/orgSections"
import { saveTenant, saveOAuth, deleteOAuth, normalizeDomains, plannedOAuth } from "@/lib/tenantAdmin"
import { saveBrand, deleteBrand } from "@/lib/branding"
import { splitList } from "@/lib/oauth"
import { requestDomain, verifyRequest, cancelDomain } from "@/lib/customerDomains"
import { addDomain, skipVercel } from "@/lib/vercel"
import {
  createDepartment, renameDepartment, moveDepartment, deleteDepartment,
  shiftDepartment, saveOrder,
} from "@/lib/departments"
import { addCodelistItem, removeCodelistItem } from "@/lib/codelistsTenant"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import { addLegalBasis, retireLegalBasis, setStandardLegalBasisHidden } from "@/lib/legalBasesDb"
import { prefixForCountry } from "@/lib/phoneCountries"
import { saveAiSettings, deleteAiKey } from "@/lib/aiSettings"
import { saveConnector, removeConnector, disconnectConnector, connectorById, type ConnectorScope } from "@/lib/connectors"
import { pathPattern } from "@/lib/connectorReduction"
import { startAuthorization } from "@/lib/mcp/client"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"

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
  // Vetu skladá `errorText()` z kódu, ktorý chyba nesie. Cudzia výnimka sa
  // na obrazovku nerozbalí — jej text môže obsahovať čokoľvek.
  if (!(e instanceof AppError)) console.error("[organizacia] akcia zlyhala:", e)
  return errorText(e, language)
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


/**
 * Kľúč položky číselníka: ručne zadaný, inak odvodený z názvu — to isté
 * pravidlo, aké formulár ukazuje (`KeyFromLabel`). Bez JavaScriptu zostane
 * pole prázdne a kľúč vznikne až tu.
 */
function keyOrFromLabel(fd: FormData): string {
  return fieldText(fd, "key") || slugifyKey(fieldText(fd, "label"))
}

function back(fd: FormData, message: string, error = false): never {
  // Starý kľúč záložky (`utvary`) sa preloží aj tu, nielen pri čítaní stránky:
  // formulár vykreslený pred premenovaním ho ešte nesie a bez prekladu by
  // človeka po uložení hodilo na prvú záložku.
  const given = fieldText(fd, "tab") || fieldText(fd, "zalozka")
  const section = tabValue(given)
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  // Záložka číselníkov (3. 10. 2026) — po uložení späť na ten istý číselník.
  const list = fieldText(fd, "list")
  if (list) q.set("list", list)
  // Každá časť má vlastnú cestu (2. 10. 2026); neznámy kľúč vedie na rozcestník.
  redirect(`${isOrgSection(section) ? orgSectionHref(section) : "/organisation"}?${q.toString()}`)
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
      // Krajina zo zoznamu → predvoľba; uložený tvar sa nemení (`+421`).
      phonePrefix: prefixForCountry(fieldText(fd, "phoneCountry")),
      controllerLegalName: fieldText(fd, "controllerLegalName"),
      controllerAddress: fieldText(fd, "controllerAddress"),
      controllerRegistrationNumber: fieldText(fd, "controllerRegistrationNumber"),
      controllerCountry: fieldText(fd, "controllerCountry") || undefined,
      ...(logoUrl ? { logoUrl } : {}),
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organisation", "layout")
  back(fd, say(self.language).saved)
}

/**
 * Potvrdzovanie (3. 10. 2026) — prah meškania pre Pripomienky a týždenný
 * súhrn personalistovi. Dovtedy 14 dní natvrdo v kóde.
 */
export async function saveAcknowledgementAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await saveTenant(self.companyCode, { overdueDays: Number(fieldText(fd, "overdueDays")) }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
  revalidatePath("/organisation", "layout")
  revalidatePath("/hr/reminders")
  back(fd, say(self.language).saved)
}

/**
 * Odstráni logo organizácie.
 *
 * Dve veci, nie jedna: zmaže sa **obrázok** z `tenant_assets` aj **odkaz naň**
 * v zázname tenanta. Zmazať len odkaz by znamenalo, že v databáze zostávajú
 * osirené binárky, ktoré nikto nepočíta ani neupratuje; zmazať len obrázok by
 * nechalo v hlavičke adresu, ktorá vracia 404.
 *
 * **Bez písania kódu organizácie** — na rozdiel od odstránenia prihlasovania
 * kontom. Tam je následok nezvratný a okamžitý (ľudia sa prestanú dostať dnu),
 * tu stačí nahrať logo znova. Obradnosť neúmerná následku učí ľudí preklikávať
 * potvrdenia bez čítania, a potom ju prehliadnu aj tam, kde na nej záleží.
 *
 * `saveTenant()` zapíše prázdny `logoUrl`, čo je vedomé „bez loga" — hlavička
 * aj onboarding potom ukážu samotný názov, na čo sú pripravené.
 */
export async function deleteLogoAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    await deleteBrand(self.companyCode)
    await saveTenant(self.companyCode, { logoUrl: "" }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organisation", "layout")
  back(fd, say(self.language).logoRemoved)
}

// ── prihlasovanie kontom ─────────────────────────────────────────────────────

/**
 * Celá stránka Prihlásenie jedným uložením (ZAKLAD-lista-ulozenia,
 * 7. 10. 2026): Microsoft, Google aj domény automatického zakladania.
 * Polia poskytovateľov nesú predponu (`microsoft.clientId`). Najprv sa všetko
 * skontroluje (`plannedOAuth`, `normalizeDomains`), až potom sa zapisuje —
 * keď jedna sekcia neprejde, neuloží sa nič (Q6).
 */
export async function saveSignInPageAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const inputs = {
    microsoft: {
      clientId: fieldText(fd, "microsoft.clientId"),
      clientSecret: fieldText(fd, "microsoft.clientSecret"),
      tenantMode: fieldText(fd, "microsoft.tenantMode"),
      allowedTenantIds: splitList(fieldText(fd, "microsoft.allowedTenantIds")),
    },
    google: {
      clientId: fieldText(fd, "google.clientId"),
      clientSecret: fieldText(fd, "google.clientSecret"),
      hostedDomain: fieldText(fd, "google.hostedDomain"),
    },
  }
  try {
    const domains = normalizeDomains(fieldText(fd, "autoProvisionDomains"))
    const providers = await plannedOAuth(self.companyCode, inputs)
    for (const p of providers) await saveOAuth(self.companyCode, p, inputs[p], self.email)
    await saveTenant(self.companyCode, { autoProvisionDomains: domains }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }

  revalidatePath("/organisation", "layout")
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

  revalidatePath("/organisation", "layout")
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

  revalidatePath("/organisation", "layout")
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
      message = toVercel && toVercel.state !== "added" && toVercel.state !== "already-there"
        ? say(self.language).domainOnNotInVercel(v.host)
        : say(self.language).domainOn(v.host)
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/organisation", "layout")
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

  revalidatePath("/organisation", "layout")
  back(fd, say(self.language).domainRemoved)
}

// ── oddelenia (D49) ─────────────────────────────────────────────────────────────

/**
 * Založenie, premenovanie, presun a zrušenie oddelenia.
 *
 * Všetky štyri idú cez `organizaciaContext()`, ktorý stráži rolu aj kód
 * organizácie. Identifikátory prichádzajú z formulára, a preto sa v každej
 * funkcii v `departments.ts` overuje, že patria tejto organizácii — cudzí
 * identifikátor sa dá uhádnuť (D32).
 */
export async function createDepartmentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await createDepartment(
      self.companyCode, fieldText(fd, "name"), fieldText(fd, "parentId") || null, self.email,
    )
    revalidatePath("/organisation", "layout")
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
    revalidatePath("/organisation", "layout")
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
    revalidatePath("/organisation", "layout")
    revalidatePath("/people")
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
    revalidatePath("/organisation", "layout")
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
      self.companyCode, fieldText(fd, "codelist"), keyOrFromLabel(fd), fieldText(fd, "label"), self.email,
    )
    revalidatePath("/organisation", "layout")
    revalidatePath("/library")
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
    revalidatePath("/organisation", "layout")
    revalidatePath("/library")
    back(fd, say(self.language).codelistRemoved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

// ── právne základy (D92) ─────────────────────────────────────────────────────

export async function addLegalBasisAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await addLegalBasis({
      companyCode: self.companyCode,
      key: keyOrFromLabel(fd),
      label: fieldText(fd, "label"),
      basis: fieldText(fd, "basis"),
      reference: fieldText(fd, "reference"),
      actor: self.email,
    })
    revalidatePath("/organisation", "layout")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function retireLegalBasisAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await retireLegalBasis(self.companyCode, fieldText(fd, "key"), self.email)
    revalidatePath("/organisation", "layout")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

export async function toggleStandardLegalBasisAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await setStandardLegalBasisHidden(
      self.companyCode, fieldText(fd, "key"), fieldText(fd, "hidden") === "1", self.email,
    )
    revalidatePath("/organisation", "layout")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

// ── profil členenia (D58) ────────────────────────────────────────────────────

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
    revalidatePath("/organisation", "layout")
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
    revalidatePath("/organisation", "layout")
    back(fd, say(self.language).saved)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
}

// ── umelá inteligencia (D157) ────────────────────────────────────────────────

/**
 * Kľúč a modely. Prázdne pole kľúča znamená „nemeň" (`saveAiSettings()`);
 * kľúč sa pred uložením overí volaním Anthropic, preto môže akcia trvať
 * sekundu-dve.
 */
export async function saveAiSettingsAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await saveAiSettings(self.companyCode, {
      apiKey: fieldText(fd, "apiKey"),
      models: {
        answer: fieldText(fd, "modelAnswer") || undefined,
        rewrite: fieldText(fd, "modelRewrite") || undefined,
      },
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
  revalidatePath("/organisation", "layout")
  back(fd, dictionary(self.language).org.ai.saved)
}

export async function deleteAiKeyAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await deleteAiKey(self.companyCode, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(fd, errorMessage(e, self.language), true)
  }
  revalidatePath("/organisation", "layout")
  back(fd, dictionary(self.language).org.ai.keyDeleted)
}

// ── Konektory (ADR-029, D178; návrh ORG-konektory, 9. 10. 2026) ───────────────

const CONNECTORS_HREF = "/organisation/connectors"

function connectorHref(id: string, q: Record<string, string> = {}, hash = ""): string {
  const qs = new URLSearchParams(q).toString()
  return `${CONNECTORS_HREF}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}${hash}`
}

/** Späť na detail konektora so správou; `keep` nesie stav obrazovky (otvorené Vyskúšať). */
function backToConnector(id: string, message: string, error = false, keep: Record<string, string> = {}, hash = ""): never {
  redirect(connectorHref(id, { ...keep, msg: message, ...(error ? { error: "1" } : {}) }, hash))
}

/** Hodnoty opakovaného poľa (riadky formulára), bez prázdnych. */
function fieldAll(fd: FormData, name: string): string[] {
  return fd.getAll(name).map(v => (typeof v === "string" ? v.trim() : "")).filter(Boolean)
}

/**
 * Riadky zoznamu s krížikom: tlačidlo `remove=<kind>:<i>` odošle formulár
 * a riadok `i` sa vynechá. Prázdne riadky (voľný riadok navyše) vypadnú.
 */
function rowsWithout(fd: FormData, name: string, kind: string): string[] {
  const all = fd.getAll(name).map(v => (typeof v === "string" ? v.trim() : ""))
  const remove = fieldText(fd, "remove")
  const drop = remove.startsWith(`${kind}:`) ? Number(remove.slice(kind.length + 1)) : -1
  return all.filter((v, i) => v && i !== drop)
}

/**
 * Rozsahy z riadkov formulára: `scopeKey.<i>`, `scopeLabel.<i>`,
 * `scope.<i>.<vstup>`. Kľúč uloženého rozsahu je skrytý a nemenný (D175).
 */
export async function parseScopeRows(fd: FormData): Promise<ConnectorScope[]> {
  const rows = new Map<number, ConnectorScope>()
  const row = (i: number) => rows.get(i) ?? (rows.set(i, { key: "", label: "", filter: {} }), rows.get(i)!)
  const remove = fieldText(fd, "remove")
  for (const [name, v] of fd.entries()) {
    if (typeof v !== "string") continue
    let m = name.match(/^scopeKey\.(\d+)$/)
    if (m) { row(Number(m[1])).key = v.trim(); continue }
    m = name.match(/^scopeLabel\.(\d+)$/)
    if (m) { row(Number(m[1])).label = v.trim(); continue }
    m = name.match(/^scope\.(\d+)\.([\w.-]+)$/)
    if (m && v.trim()) row(Number(m[1])).filter[m[2]] = v.trim()
  }
  return [...rows.entries()].sort((x, y) => x[0] - y[0])
    .filter(([i]) => remove !== `scope:${i}`)
    .map(([, r]) => r)
    .filter(r => r.key || r.label || Object.keys(r.filter).length)
}

/** Pridať konektor (Q1): založí z adresy a hneď pošle na prihlásenie servera. */
export async function addAndConnectAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const endpoint = fieldText(fd, "endpoint")
  const name = fieldText(fd, "name")
  let url: URL | null = null
  let id = ""
  try {
    const c = await saveConnector(self.companyCode, {
      name, endpoint,
      clientId: fieldText(fd, "clientId"),
      clientSecret: fieldText(fd, "clientSecret"),
      retrievalEnabled: false,
      retrievalAccessLevel: "internal",
      ingestEnabled: false,
    }, self.email)
    id = c.id
    url = await startAuthorization(c, await connectorCallbackUrl())
  } catch (e) {
    if (isRedirect(e)) throw e
    // Konektor už mohol vzniknúť (zlyhalo až prihlásenie) — vtedy na detail,
    // kde sa dá pripojiť znova. Client Secret sa do adresy nikdy nevracia.
    if (id) backToConnector(id, errorMessage(e, self.language), true)
    const q = new URLSearchParams({ new: "1", error: "1", msg: errorMessage(e, self.language), endpoint, name })
    redirect(`${CONNECTORS_HREF}?${q}#new`)
  }
  revalidatePath("/organisation", "layout")
  if (!url) backToConnector(id, dictionary(self.language).org.connectors.connected)
  redirect(url.toString())
}

export async function saveConnectorAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const t = dictionary(self.language).org.connectors
  const id = fieldText(fd, "id")
  try {
    await saveConnector(self.companyCode, {
      id,
      name: fieldText(fd, "name"),
      retrievalEnabled: fieldText(fd, "retrievalEnabled") === "on",
      retrievalDefaultOn: fieldText(fd, "retrievalDefaultOn") === "on",
      retrievalAccessLevel: fieldText(fd, "accessLevel"),
      // Vypnutý prepínač sa neodošle; keď server import nevie, pole chýba celé.
      ingestEnabled: fd.has("ingestShown") ? fieldText(fd, "ingestEnabled") === "on" : undefined,
      searchTool: fd.has("searchTool") ? fieldText(fd, "searchTool") : undefined,
      searchQueryArg: fd.has("searchQueryArg") ? fieldText(fd, "searchQueryArg") : undefined,
      optionsTool: fd.has("optionsTool") ? fieldText(fd, "optionsTool") : undefined,
      scopes: fd.has("scopesShown") ? await parseScopeRows(fd) : undefined,
      reduction: {
        dropSections: rowsWithout(fd, "dropSections", "drop"),
        skipPaths: rowsWithout(fd, "skipPaths", "skip"),
        scrubPatterns: rowsWithout(fd, "scrubPatterns", "scrub"),
        scrubPresets: fieldAll(fd, "scrubPresets") as never,
      },
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToConnector(id, errorMessage(e, self.language), true, {}, "#uses")
  }
  revalidatePath("/organisation", "layout")
  // Krížik pri riadku je tiež uloženie — vráti sa tam, kde človek bol.
  backToConnector(id, t.saved, false, {}, fieldText(fd, "remove") ? "#uses" : "")
}

export async function removeConnectorAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "id")
  try {
    await removeConnector(self.companyCode, id, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToConnector(id, errorMessage(e, self.language), true)
  }
  revalidatePath("/organisation", "layout")
  redirect(`${CONNECTORS_HREF}?${new URLSearchParams({ msg: dictionary(self.language).org.connectors.removed })}`)
}

export async function disconnectConnectorAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "id")
  try {
    await disconnectConnector(self.companyCode, id, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToConnector(id, errorMessage(e, self.language), true)
  }
  revalidatePath("/organisation", "layout")
  backToConnector(id, dictionary(self.language).org.connectors.disconnected)
}

/**
 * Prihlásenie ku konektoru: človek odíde na server, vráti sa na
 * `/api/connectors/callback` s kódom (D172). `redirect()` na cudziu adresu
 * je mimo `try` — vyhadzuje výnimku a `catch` by ju ohlásil ako chybu.
 * Pri platných tokenoch nikam nejde, len nanovo načíta údaje o serveri
 * („Načítať znova").
 */
export async function connectConnectorAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "id")
  let url: URL | null
  try {
    const c = await connectorById(self.companyCode, id)
    if (!c) throw new AppError("connector.notFound", "Taký konektor tu nie je.")
    url = await startAuthorization(c, await connectorCallbackUrl())
  } catch (e) {
    if (isRedirect(e)) throw e
    backToConnector(id, errorMessage(e, self.language), true)
  }
  if (!url) {
    revalidatePath("/organisation", "layout")
    const t = dictionary(self.language).org.connectors
    backToConnector(id, fieldText(fd, "reload") ? t.reloaded : t.connected, false, {}, fieldText(fd, "reload") ? "#tools" : "")
  }
  redirect(url.toString())
}

/**
 * Návrhy z Vyskúšať hľadanie (Q7): zaškrtnuté nadpisy do „Zahodiť sekcie",
 * úseky ciest do „Vynechať cesty", hodnoty skupín ako nové rozsahy. Uloží
 * a vráti sa na ten istý výsledok.
 */
export async function applySuggestionsAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "id")
  const keep = { try: fieldText(fd, "q"), scope: fieldText(fd, "scope") }
  try {
    const c = await connectorById(self.companyCode, id)
    if (!c) throw new AppError("connector.notFound", "Taký konektor tu nie je.")
    const r = c.uses.retrieval
    const add = (xs: string[], more: string[]) => [...xs, ...more.filter(m => !xs.includes(m))]
    const groupField = fieldText(fd, "groupField")
    const newScopes = groupField ? fieldAll(fd, "group").filter(v => !c.scopes.some(s => s.filter[groupField] === v)).map(v => ({ key: "", label: v, filter: { [groupField]: v } })) : []
    await saveConnector(self.companyCode, {
      id, name: c.autoName ? "" : c.name,
      retrievalEnabled: r.enabled, retrievalDefaultOn: r.defaultOn, retrievalAccessLevel: r.accessLevel,
      reduction: {
        ...r.reduction,
        dropSections: add(r.reduction.dropSections, fieldAll(fd, "drop")),
        skipPaths: add(r.reduction.skipPaths, fieldAll(fd, "skip").map(pathPattern)),
      },
      scopes: [...c.scopes, ...newScopes],
    }, self.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToConnector(id, errorMessage(e, self.language), true, keep, "#try")
  }
  revalidatePath("/organisation", "layout")
  backToConnector(id, dictionary(self.language).org.connectors.suggestionsAdded, false, keep, "#try")
}
