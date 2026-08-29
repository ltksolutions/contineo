/**
 * vercel.ts — priradenie domény projektu a jej stav (Fáza 5b, rozsah C).
 *
 * Doména tenanta žije na troch miestach a toto je prostredné z nich:
 *
 *   DNS (zákazník) → **projekt vo Verceli** → `tenants` (D29)
 *
 * Bez zápisu vo Verceli sa nevystaví certifikát, takže `https://` padne pri
 * TLS — teda skôr, než sa požiadavka vôbec dostane k aplikácii. Nie je to
 * kozmetika, je to podmienka toho, aby doména existovala.
 *
 * **Modul nikdy nevyhadzuje kvôli chýbajúcemu nastaveniu.** Keď `VERCEL_TOKEN`
 * nie je, vráti to ako výsledok, nie ako výnimku: zápis tenanta je zdroj
 * pravdy a výpadok cudzieho API nesmie brániť založiť organizáciu. Doména sa
 * doplní ručne a obrazovka o tom povie.
 */

const API = "https://api.vercel.com"

export interface VercelConfig {
  token: string
  projectId: string
  orgId?: string
}

export function vercelConfig(): VercelConfig | null {
  const token = process.env.VERCEL_TOKEN
  // `VERCEL_PROJECT_ID` a `VERCEL_ORG_ID` dopĺňa Vercel do prostredia sám,
  // takže na produkcii stačí doplniť token.
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null
  return { token, projectId, orgId: process.env.VERCEL_ORG_ID }
}

/**
 * Prečo niektoré domény vo Verceli riešiť netreba.
 *
 * Vracia **dôvod**, nie `true/false` — obrazovka aj skript ho ukazujú človeku
 * a „nič sa nestalo" bez vysvetlenia vyzerá ako chyba.
 */
export function preskocitVercel(host: string): string | null {
  if (host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1") {
    return "beží lokálne, k Vercelu nedorazí"
  }
  if (host.endsWith(".vercel.app")) return "Vercel ju prideľuje sám"
  // Wildcard `*.contineo.app` je vo Verceli zapísaný raz za všetky subdomény.
  if (host !== "contineo.app" && host.endsWith(".contineo.app")) {
    return "pokrýva wildcard *.contineo.app"
  }
  return null
}

export type VysledokDomeny =
  | { stav: "pridana" }
  | { stav: "uz-je" }
  | { stav: "preskocena"; dovod: string }
  | { stav: "bez-nastavenia" }
  /**
   * Token existuje, ale Vercel ho neprijal. Najčastejšia príčina: hodnota
   * prevzatá z lokálneho `vercel login` medzitým vypršala — CLI si ju
   * priebežne obnovuje, kto ju číta zo súboru, dostane starú. Na stálu
   * prevádzku patrí vlastný `VERCEL_TOKEN`.
   */
  | { stav: "neplatny-token" }
  | { stav: "chyba"; sprava: string }

async function volaj(c: VercelConfig, cesta: string, init?: RequestInit) {
  const oddelovac = cesta.includes("?") ? "&" : "?"
  const url = `${API}${cesta}${c.orgId ? `${oddelovac}teamId=${encodeURIComponent(c.orgId)}` : ""}`
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Stav domény sa mení mimo nás; odpoveď sa nesmie cachovať.
    cache: "no-store",
  })
  return { stav: r.status, telo: await r.json().catch(() => ({})) }
}

/** Priradí doménu projektu. Opakované volanie nie je chyba. */
export async function pridajDomenu(host: string): Promise<VysledokDomeny> {
  const dovod = preskocitVercel(host)
  if (dovod) return { stav: "preskocena", dovod }

  const c = vercelConfig()
  if (!c) return { stav: "bez-nastavenia" }

  try {
    const { stav, telo } = await volaj(c, `/v10/projects/${encodeURIComponent(c.projectId)}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: host }),
    })
    if (stav >= 200 && stav < 300) return { stav: "pridana" }
    // Tá istá doména na tom istom projekte je hotový stav, nie chyba.
    const e = (telo as { error?: { code?: string; message?: string; domain?: { projectId?: string } } }).error
    if (e?.code === "domain_already_in_use" && e.domain?.projectId === c.projectId) {
      return { stav: "uz-je" }
    }
    if (stav === 401 || stav === 403) return { stav: "neplatny-token" }
    return { stav: "chyba", sprava: e?.message ?? `HTTP ${stav}` }
  } catch (err) {
    return { stav: "chyba", sprava: err instanceof Error ? err.message : String(err) }
  }
}

export interface StavDomeny {
  host: string
  /** Netýka sa Vercelu — a vtedy je `null` všetko ostatné. */
  preskocena: string | null
  vProjekte: boolean
  overena: boolean
  /** `null` = zákazník ešte nenasmeroval DNS. */
  nastaveneCez: string | null
  konflikty: string[]
  /** Čo má zákazník nastaviť. */
  cname: string
}

/** Univerzálny cieľ, ktorý Vercel uvádza v dokumentácii. */
export const CNAME_CIEL = "cname.vercel-dns.com"

/**
 * Stav sa **číta naživo**, nikde sa neukladá. Uložená kópia by klamala presne
 * vtedy, keď si zákazník prestaví DNS — a to je jediný okamih, keď na tomto
 * údaji záleží. Rovnaké pravidlo ako D27.
 */
export async function stavDomeny(host: string): Promise<StavDomeny> {
  const zaklad: StavDomeny = {
    host,
    preskocena: preskocitVercel(host),
    vProjekte: false,
    overena: false,
    nastaveneCez: null,
    konflikty: [],
    cname: CNAME_CIEL,
  }
  if (zaklad.preskocena) return zaklad

  const c = vercelConfig()
  if (!c) return zaklad

  try {
    const q = encodeURIComponent(host)
    const vProjekte = await volaj(c, `/v9/projects/${encodeURIComponent(c.projectId)}/domains/${q}`)
    const konfig = await volaj(c, `/v6/domains/${q}/config`)
    const kt = konfig.telo as {
      configuredBy?: string | null
      conflicts?: { type?: string; value?: string }[]
      recommendedCNAME?: { value?: string }[]
    }
    return {
      ...zaklad,
      vProjekte: vProjekte.stav === 200,
      overena: (vProjekte.telo as { verified?: boolean }).verified === true,
      nastaveneCez: kt.configuredBy ?? null,
      konflikty: (kt.conflicts ?? []).map(k => `${k.type ?? "?"} ${k.value ?? ""}`.trim()),
      cname: kt.recommendedCNAME?.[0]?.value ?? CNAME_CIEL,
    }
  } catch (e) {
    console.error(`[vercel] stav domény ${host} sa nepodarilo zistiť:`, e)
    return zaklad
  }
}

/** Pokyn pre zákazníka. Odvodí sa z hostiteľa — neukladá sa nikde. */
export function pokynCname(host: string, cname = CNAME_CIEL): string {
  const [pod] = host.split(".")
  return `CNAME ${pod} → ${cname}`
}

/**
 * Znenie pokynov pre zákazníka. Jedna definícia pre obrazovku aj skript —
 * dva rôzne texty o tom istom nastavení sú spoľahlivý spôsob, ako niekomu
 * poradiť dvakrát rozdielne.
 */
export function pokynyPreZakaznika(host: string, cname = CNAME_CIEL) {
  const [pod] = host.split(".")
  return {
    subject: `Nastavenie domény ${host}`,
    text: [
      "Dobrý deň,",
      "",
      `aby portál bežal na adrese https://${host}, treba do DNS zóny domény`,
      "pridať jeden záznam:",
      "",
      "    typ:    CNAME",
      `    názov:  ${pod}`,
      `    cieľ:   ${cname}`,
      "",
      "Bezpečnostný certifikát vybavíme my, vydá sa automaticky do niekoľkých",
      "minút po tom, ako sa záznam rozšíri. Dovtedy adresa nefunguje — nie je",
      "to chyba, len ešte nie je kam smerovať.",
      "",
      "Keď to nastavíte, dajte nám prosím vedieť a overíme to.",
    ].join("\n"),
  }
}
