/**
 * domenyZakaznika.ts — vlastná doména, o ktorú si zákazník požiada sám (D48).
 *
 * Zadanie znelo „nech si domény nastavuje pod sebou, ak to nie je nebezpečné".
 * **Voľný zápis nebezpečný je**, a to dvomi spôsobmi, ktoré na prvý pohľad
 * nie sú vidieť:
 *
 *  1. **Cudzia doména v našom účte.** Každá nová doména sa pridáva do **nášho**
 *     projektu vo Verceli. Zákazník by tak mohol zapísať doménu, ktorá mu
 *     nepatrí — Vercel na ňu drží nárok v našom účte a jej skutočný majiteľ si
 *     ju do svojho projektu nepridá, kým sa spor nevyrieši. To je odstávka
 *     spôsobená tretej strane, z nášho účtu, niekým, kto nie sme my.
 *
 *  2. **Naša vlastná doména.** `*.contineo.app` už dnes smeruje na naše
 *     nasadenie, takže ktorákoľvek voľná subdoména (`admin.contineo.app`)
 *     by sa zapísaním okamžite rozsvietila pod našou značkou. Kontrola
 *     „nepatrí inému tenantovi" na to nestačí — nepatrí zatiaľ nikomu.
 *
 * Čo z toho robí bezpečnú vec, je **dôkaz o vlastníctve**, a ten vie dať len
 * DNS. Preto: zákazník doménu **požiada**, dostane presný CNAME, a doména sa
 * zapne až vtedy, keď smeruje na nás. Nastaviť DNS totiž vie len ten, kto
 * doménu naozaj ovláda — a je to zároveň krok, ktorý musí spraviť tak či tak.
 *
 * Naše vlastné domény si zákazník nepridelí vôbec; tie ostávajú v `/admin`.
 */

import dns from "node:dns/promises"
import { getCollection } from "./mongodb"
import { zapisAudit } from "./audit"
import { normalizeHostname, invalidateTenants, TENANTS_COLLECTION } from "./tenants"
import { CNAME_CIEL, pokynCname, preskocitVercel } from "./vercel"
import type { Tenant } from "./tenants"

/** Domény, ktoré si zákazník nepridelí. Naše, nech sú akokoľvek voľné. */
export const NASE_DOMENY = ["contineo.app", "vercel.app", "localhost"]

export interface ZiadostODomenu {
  host: string
  requestedAt: Date
  requestedBy: string
  /** Vyplní sa, keď DNS začne sedieť a doména sa zapne. */
  verifiedAt?: Date | null
}

export class DomenaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DomenaError"
  }
}

/** Je to doména, ktorú si zákazník prideliť nesmie? Vracia dôvod, nie `false`. */
export function nasaDomena(host: string): string | null {
  const h = normalizeHostname(host)
  for (const nasa of NASE_DOMENY) {
    if (h === nasa || h.endsWith(`.${nasa}`)) {
      return `${nasa} je naša doména — subdoménu na nej vieme prideliť len my.`
    }
  }
  return null
}

/**
 * Overí, či doména smeruje na nás.
 *
 * Pozerá sa na CNAME aj na výsledné A záznamy: niektoré správcovstvá DNS
 * (a apex domény vždy) CNAME neponúkajú a nahrádzajú ho ALIAS-om, ktorý sa
 * navonok tvári ako A. Kto to nastavil správne, nemá padnúť na tom, akým
 * typom záznamu to jeho poskytovateľ rieši.
 */
export async function smerujeNaNas(host: string): Promise<boolean> {
  const h = normalizeHostname(host)
  // Surový cieľ, nie veta pre človeka — `pokynCname()` vracia text do
  // rozhrania a porovnávať s ním DNS by bolo porovnávanie s vetou.
  const ciel = CNAME_CIEL.toLowerCase()

  try {
    const cname = await dns.resolveCname(h).catch((): string[] => [])
    if (cname.some(c => c.toLowerCase().replace(/\.$/, "") === ciel.replace(/\.$/, ""))) return true
  } catch { /* skúsi sa ešte adresa */ }

  try {
    const [nase, ich] = await Promise.all([
      dns.resolve4(ciel).catch((): string[] => []),
      dns.resolve4(h).catch((): string[] => []),
    ])
    if (nase.length && ich.length && ich.some(a => nase.includes(a))) return true
  } catch { /* neoverené */ }

  return false
}

/** Žiadosti tenanta. Nie sú to domény — kým sa neoveria, nefungujú. */
export async function ziadosti(companyCode: string): Promise<ZiadostODomenu[]> {
  const col = await getCollection<Tenant & { domainRequests?: ZiadostODomenu[] }>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  return t?.domainRequests ?? []
}

/**
 * Zapíše žiadosť o doménu. **Nič nezapína a do Vercelu nič nepridáva.**
 *
 * Poradie je celý zmysel: najprv sa zapíše zámer, potom zákazník nastaví DNS,
 * a až to je dôkaz. Opačne by sme cudziu doménu zapísali do svojho účtu na
 * čiu slovo.
 */
export async function poziadajODomenu(
  companyCode: string,
  rawHost: string,
  actor: string,
): Promise<ZiadostODomenu> {
  const host = normalizeHostname(rawHost)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new DomenaError("To nevyzerá ako doména. Napr. `intranet.futbalsfz.sk`.")
  }
  const nasa = nasaDomena(host)
  if (nasa) throw new DomenaError(nasa)

  const col = await getCollection<Tenant & { domainRequests?: ZiadostODomenu[] }>(TENANTS_COLLECTION)

  // Doména, ktorú už niekto má — vrátane nás samých. Neprezrádza sa kto:
  // z toho, že je „obsadená", by sa dalo skúšaním zistiť, kto tu portál má.
  const uzJe = await col.findOne({ hostnames: host })
  if (uzJe) {
    throw new DomenaError(
      uzJe.companyCode === companyCode
        ? "Túto doménu už používate."
        : "Táto doména je už v systéme zapísaná. Ozvite sa nám."
    )
  }

  const ziadost: ZiadostODomenu = {
    host,
    requestedAt: new Date(),
    requestedBy: actor,
    verifiedAt: null,
  }

  await col.updateOne(
    { companyCode },
    { $pull: { domainRequests: { host } } } as never,
  )
  await col.updateOne(
    { companyCode },
    { $push: { domainRequests: ziadost } } as never,
  )
  await zapisAudit({
    companyCode, predmet: "domena", akcia: "poziadane", aktor: actor,
    cielId: host, cielPopis: host,
  })
  return ziadost
}

export type VysledokOverenia =
  | { stav: "zapnuta"; host: string }
  | { stav: "caka"; host: string; cname: string }
  | { stav: "nenajdena" }

/**
 * Skúsi žiadosť overiť a — keď DNS sedí — doménu zapnúť.
 *
 * Pridanie do Vercelu robí volajúci až po tomto kroku. Tu sa rozhoduje len
 * o tom, či dôkaz existuje.
 */
export async function overZiadost(
  companyCode: string,
  rawHost: string,
  aktor: string,
): Promise<VysledokOverenia> {
  const host = normalizeHostname(rawHost)
  const col = await getCollection<Tenant & { domainRequests?: ZiadostODomenu[] }>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  const ziadost = (t?.domainRequests ?? []).find(z => z.host === host)
  if (!ziadost) return { stav: "nenajdena" }

  if (!(await smerujeNaNas(host))) {
    return { stav: "caka", host, cname: CNAME_CIEL }
  }

  // Dôkaz existuje: doménu vie na nás nasmerovať len ten, kto ju ovláda.
  await col.updateOne(
    { companyCode },
    {
      $addToSet: { hostnames: host },
      $set: { "domainRequests.$[z].verifiedAt": new Date() },
    } as never,
    { arrayFilters: [{ "z.host": host }] },
  )
  await zapisAudit({
    companyCode, predmet: "domena", akcia: "overene", aktor,
    cielId: host, cielPopis: host,
    poznamka: "DNS smeruje na nás — doména zapnutá",
  })
  invalidateTenants()
  return { stav: "zapnuta", host }
}

/** Odstráni doménu aj žiadosť. Portál na nej prestane odpovedať. */
export async function zrusDomenu(companyCode: string, rawHost: string, aktor: string): Promise<void> {
  const host = normalizeHostname(rawHost)
  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  if ((t?.hostnames ?? []).length <= 1 && (t?.hostnames ?? []).includes(host)) {
    throw new DomenaError("Toto je vaša posledná doména — bez nej sa portál nikde neukáže.")
  }
  await col.updateOne(
    { companyCode },
    { $pull: { hostnames: host, domainRequests: { host } } } as never,
  )
  await zapisAudit({
    companyCode, predmet: "domena", akcia: "zrusene", aktor,
    cielId: host, cielPopis: host,
  })
  invalidateTenants()
}

/** Pokyn, ktorý zákazník zapíše u svojho správcu DNS. */
export function pokynPreDomenu(host: string): { typ: string; nazov: string; hodnota: string } | null {
  if (preskocitVercel(host)) return null
  const h = normalizeHostname(host)
  const bodky = h.split(".")
  return {
    typ: "CNAME",
    nazov: bodky.length > 2 ? bodky[0] : "@",
    hodnota: CNAME_CIEL,
  }
}
