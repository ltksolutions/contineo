/**
 * graph.ts — údaje o človeku z Microsoft Graphu (D52).
 *
 * Konto z Entry vie viac než adresu: meno a priezvisko zvlášť, oddelenie, jazyk
 * a fotografiu. Bez toho vznikala pri automatickom založení (D47) osoba, ktorá
 * sa v zozname volala rovnako ako jej adresa — a personalista ju musel
 * prepísať ručne, hoci ten údaj bol v adresári zákazníka celý čas.
 *
 * Tri pravidlá, ktoré určujú celé správanie tohto súboru:
 *
 *  1. **Zlyhanie Graphu nikdy nesmie zablokovať prihlásenie.** Preto sa tu
 *     nič nevyhadzuje a všetko má krátky časový strop: prihlásenie, ktoré
 *     čaká na cudzie API, je horšie než osoba bez fotky.
 *  2. **Dopĺňa sa len to, čo chýba** (`doplnChybajuce` v `persons.ts`).
 *     Adresár nie je nadriadený personalistovi: keď niekto meno alebo oddelenie
 *     v `/osoby` opraví, ďalšie prihlásenie mu opravu neprepíše.
 *  3. **Volá sa len vtedy, keď naozaj niečo chýba.** Inak by každé prihlásenie
 *     platilo dve cudzie požiadavky za nič.
 *
 * Potrebuje oprávnenie **`User.Read`** v aplikácii zákazníka. Je to
 * najzákladnejšie delegované oprávnenie Entry („prečítaj profil prihláseného"),
 * schvaľuje si ho používateľ sám a nedáva prístup k nikomu inému. Keď chýba,
 * Graph vráti 403 a všetko ostatné funguje ďalej.
 */

/** Aké polia pýtame. Menej než celý profil — zvyšok nepotrebujeme. */
const FIELDS = "givenName,surname,displayName,department,jobTitle,preferredLanguage"

/** Fotka do hlavičky. 96 px kvôli obrazovkám s dvojnásobnou hustotou. */
export const PHOTO_SIZE = 96

/** Krátky strop. Prihlásenie nesmie visieť na cudzom API. */
const TIMEOUT_MS = 4000

export interface GraphData {
  givenName?: string
  surname?: string
  displayName?: string
  department?: string
  jobTitle?: string
  /** Napr. `sk-SK`. Prevádza sa až v `persons.ts`. */
  preferredLanguage?: string
  fotka?: { contentType: string; data: Buffer }
}

async function fetchWithTimeout(url: string, token: string): Promise<Response | null> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
      // Odpoveď je o konkrétnom človeku a nikdy sa nesmie zdieľať medzi nimi.
      cache: "no-store",
    })
  } catch (e) {
    console.error("[graph] požiadavka zlyhala:", (e as Error).message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Prečíta profil prihláseného človeka.
 *
 * `chceFotku` je tu preto, že fotka je druhá požiadavka a väčšina prihlásení
 * ju nepotrebuje — má ju už uloženú z prvého.
 */
export async function graphData(
  accessToken: string | undefined,
  wantPhoto = true,
): Promise<GraphData | null> {
  if (!accessToken) return null

  const r = await fetchWithTimeout(`https://graph.microsoft.com/v1.0/me?$select=${FIELDS}`, accessToken)
  if (!r) return null
  if (!r.ok) {
    // 403 spravidla znamená chýbajúce `User.Read` v aplikácii zákazníka —
    // menovite do logu, lebo oprava je konkrétna a inde sa nedá uhádnuť.
    console.error(`[graph] /me odmietnuté (${r.status}) — chýba oprávnenie User.Read?`)
    return null
  }

  let profile: Record<string, unknown>
  try {
    profile = (await r.json()) as Record<string, unknown>
  } catch {
    return null
  }

  const text = (k: string): string | undefined => {
    const v = profile[k]
    return typeof v === "string" && v.trim() ? v.trim() : undefined
  }

  const out: GraphData = {
    givenName: text("givenName"),
    surname: text("surname"),
    displayName: text("displayName"),
    department: text("department"),
    jobTitle: text("jobTitle"),
    preferredLanguage: text("preferredLanguage"),
  }

  if (wantPhoto) {
    const f = await fetchWithTimeout(
      `https://graph.microsoft.com/v1.0/me/photos/${PHOTO_SIZE}x${PHOTO_SIZE}/$value`,
      accessToken,
    )
    // Fotku nemá každý a 404 je bežná odpoveď, nie chyba — do logu nepatrí.
    if (f?.ok) {
      try {
        const bytes = Buffer.from(await f.arrayBuffer())
        // Prázdna odpoveď sa tvári ako obrázok. Uložiť ju by znamenalo mať
        // v hlavičke prázdny štvorec namiesto iniciál.
        if (bytes.byteLength > 0) {
          out.fotka = {
            contentType: f.headers.get("content-type") ?? "image/jpeg",
            data: bytes,
          }
        }
      } catch { /* fotka je bonus, nie podmienka */ }
    }
  }

  return out
}

/**
 * Celé meno z častí.
 *
 * `displayName` sa berie až ako druhé: v niektorých adresároch je v tvare
 * „Priezvisko, Meno (oddelenie)" a to sa v zozname osôb číta zle. Meno
 * a priezvisko zvlášť sú spoľahlivejšie.
 */
export function fullName(u: GraphData): string | undefined {
  const joined = [u.givenName, u.surname].filter(Boolean).join(" ").trim()
  return joined || u.displayName
}
