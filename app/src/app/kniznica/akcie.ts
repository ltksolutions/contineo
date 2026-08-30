"use server"

/**
 * akcie.ts — zápisy z knižnice (D53).
 *
 * Každá akcia začína bránou `kniznicaContext()`. Serverová akcia je koncový
 * bod ako každý iný; to, že sa volá z formulára na chránenej stránke, nie je
 * kontrola prístupu.
 *
 * `companyCode` sa **nikdy** neberie z formulára, vždy z prihláseného
 * človeka — inak by správca obsahu jedného zväzu vedel prepísať normu
 * druhého (D32).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { kniznicaContext } from "@/lib/kniznica"
import { jePresmerovanie } from "@/lib/presmerovanie"
import {
  nahrajDokument, ulozKoncept, publikuj, overMetadata, idDokumentu, ulozUdaje,
  preindexuj, opravZnenie, KniznicaError,
} from "@/lib/kniznica.zapis"
import { UloziskoError, nacitajSubor } from "@/lib/ulozisko"
import { doplnkyTenanta } from "@/lib/ciselnikyTenanta"
import {
  zalozPriecinok, premenujPriecinok, presunPriecinok, zrusPriecinok,
  zaradDokument, PriecinokError,
} from "@/lib/priecinky"
import type { Doplnky } from "@/lib/ciselniky"
import type { ProfilClenenia } from "@/lib/chunker"
import { precisti, prepisPdf, PrepisError } from "@/lib/prepisLlm"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { zapisAudit } from "@/lib/audit"

async function kto(): Promise<
  {
    email: string
    companyCode: string
    doplnky: Doplnky
    profil?: Partial<ProfilClenenia>
  } | null
> {
  const ctx = await kniznicaContext()
  return ctx.state === "ready"
    ? {
        email: ctx.person.email,
        companyCode: ctx.person.companyCode,
        // Vlastné položky číselníkov organizácie (D55) — bez nich by
        // obrazovka ponúkala druh dokumentu, ktorý zápis vzápätí odmietne.
        doplnky: doplnkyTenanta(ctx.tenant),
        // Profil členenia organizácie (D58). Chýbajúci znamená predvolený.
        profil: ctx.tenant.chunkovanie,
      }
    : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v.trim() : ""
}

function spravaChyby(e: unknown): string {
  if (
    e instanceof KniznicaError || e instanceof UloziskoError ||
    e instanceof PrepisError || e instanceof PriecinokError
  ) {
    return e.message
  }
  console.error("[kniznica] akcia zlyhala:", e)
  return "Nepodarilo sa to. Skús to znova."
}

export async function nahraj(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  try {
    const subor = fd.get("subor")
    if (!(subor instanceof File) || subor.size === 0) {
      throw new KniznicaError("Nevybral si súbor.")
    }

    // Organizácia je z prihláseného človeka, nie z formulára.
    const meta = overMetadata({
      title: textPola(fd, "title"),
      sectionKey: textPola(fd, "sectionKey"),
      companyCode: ja.companyCode,
      scope: textPola(fd, "scope"),
      accessLevel: textPola(fd, "accessLevel"),
      language: textPola(fd, "language"),
      category: textPola(fd, "category") || undefined,
      tags: fd.getAll("tags").filter((t): t is string => typeof t === "string"),
    }, ja.doplnky)

    const v = await nahrajDokument(
      meta, subor.name, Buffer.from(await subor.arrayBuffer()), ja.email,
    )

    revalidatePath("/kniznica")
    // Rovno do editora: po nahratí nasleduje čítanie prevedeného textu
    // a hľadať dokument v zozname je zbytočný krok.
    redirect(`/kniznica/${encodeURIComponent(v.documentId)}/text?sprava=${encodeURIComponent(
      v.upozornenia.length
        ? `Prevedené. ${v.upozornenia.join(" ")}`
        : "Prevedené. Prečítaj text a porovnaj ho s originálom.",
    )}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (jePresmerovanie(e)) throw e
    const q = new URLSearchParams({
      chyba: spravaChyby(e),
      title: textPola(fd, "title"),
      sectionKey: textPola(fd, "sectionKey"),
    })
    redirect(`/kniznica/nova?${q.toString()}`)
  }
}

export async function ulozText(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = "Uložené."
  let chyba = false
  try {
    await ulozKoncept(ja.companyCode, id, String(fd.get("markdown") ?? ""), ja.email)
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}/text?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

export async function publikujZnenie(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = ""
  let chyba = false
  try {
    const den = textPola(fd, "effectiveFrom")
    const v = await publikuj(ja.companyCode, id, {
      label: textPola(fd, "label"),
      // Dátum bez času a v UTC — `effectiveFrom` je deň, nie okamih, a
      // miestne pásmo by ho pri polnoci posunulo o deň.
      effectiveFrom: new Date(`${den}T00:00:00.000Z`),
      effectiveFromSource: textPola(fd, "effectiveFromSource"),
      changeNote: textPola(fd, "changeNote"),
    }, ja.email, ja.profil)

    sprava = v.uzBolo
      ? "Toto znenie už publikované je — nič sa nezmenilo."
      : `Publikované: ${v.chunkov} úsekov, ${v.archivovanych} starých archivovaných.`
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/** Pomôcka pre obrazovku: aký `documentId` z týchto metadát vznikne. */
export async function nahladId(companyCode: string, sectionKey: string): Promise<string> {
  return idDokumentu({ companyCode, sectionKey })
}

/**
 * Pošle text alebo pôvodný sken jazykovému modelu (D53).
 *
 * Výsledok sa **neuloží do konceptu**, len vedľa neho ako návrh. Prepísať
 * znenie normy strojom bez toho, aby to niekto videl, je presne ten druh
 * tichej zmeny, po ktorej sa o rok nedá povedať, čo v predpise vlastne stálo.
 */
export async function poslatNaModel(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  const rezim = textPola(fd, "rezim")
  let sprava = ""
  let chyba = false

  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await col.findOne({ documentId: id, companyCode: ja.companyCode }) as Record<string, unknown> | null
    if (!doc) throw new KniznicaError("Taký dokument tu nie je.")

    const navrh = rezim === "prepisat-sken"
      ? await (async () => {
          const povodny = doc.originalFile as { id: string; typ: string } | undefined
          if (!povodny) throw new KniznicaError("Dokument nemá pôvodný súbor, ktorý by sa dal prepísať.")
          if (povodny.typ !== "pdf") {
            throw new KniznicaError("Prepisovať sa dá len PDF — ostatné formáty sa prevedú priamo.")
          }
          const s = await nacitajSubor(ja.companyCode, povodny.id)
          if (!s) throw new KniznicaError("Pôvodný súbor sa nenašiel.")
          return prepisPdf(s.data)
        })()
      : await precisti(String(doc.draftMarkdown ?? ""))

    await col.updateOne(
      { documentId: id, companyCode: ja.companyCode },
      { $set: { llmNavrh: navrh } } as never,
    )
    await zapisAudit({
      companyCode: ja.companyCode, predmet: "dokument", akcia: "navrh-modelu",
      aktor: ja.email, cielId: id, cielPopis: String(doc.title ?? id),
      poznamka: `${navrh.rezim} · ${navrh.model} · ${navrh.text.length} znakov`,
    })

    sprava = "Model vrátil návrh. Porovnaj ho s doterajším textom a rozhodni sa."
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  redirect(`/kniznica/${encodeURIComponent(id)}/text?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/** Prijme alebo zahodí návrh modelu. Prijatie je vedomý krok človeka. */
export async function rozhodniONavrhu(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  const prijat = textPola(fd, "volba") === "prijat"
  let sprava = ""
  let chyba = false

  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await col.findOne({ documentId: id, companyCode: ja.companyCode }) as Record<string, unknown> | null
    const navrh = doc?.llmNavrh as { text?: string } | undefined
    if (!navrh?.text) throw new KniznicaError("Žiadny návrh tu nie je.")

    if (prijat) {
      await ulozKoncept(ja.companyCode, id, navrh.text, `${ja.email} (návrh modelu)`)
      sprava = "Návrh je teraz konceptom. Publikovanie je stále samostatný krok."
    } else {
      sprava = "Návrh zahodený."
    }
    await col.updateOne(
      { documentId: id, companyCode: ja.companyCode },
      { $unset: { llmNavrh: "" } } as never,
    )
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}/text?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/** Uloží údaje o dokumente z detailu. */
export async function ulozUdajeDokumentu(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = "Uložené."
  let chyba = false
  try {
    await ulozUdaje(ja.companyCode, id, {
      title: textPola(fd, "title"),
      scope: textPola(fd, "scope"),
      accessLevel: textPola(fd, "accessLevel"),
      language: textPola(fd, "language"),
      category: textPola(fd, "category") || undefined,
      tags: fd.getAll("tags").filter((t): t is string => typeof t === "string"),
    }, ja.email, ja.doplnky)
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}


// ── priečinky (D56) ──────────────────────────────────────────────────────────

/** Späť na zoznam so zachovaným filtrom — inak sa človek po každej zmene stratí. */
function spatDoKniznice(fd: FormData, sprava: string, chyba = false): never {
  const q = new URLSearchParams({ sprava })
  if (chyba) q.set("chyba", "1")
  for (const pole of ["priecinok", "hladat", "stav", "category", "language", "accessLevel", "tag"]) {
    const v = textPola(fd, pole)
    if (v) q.set(pole, v)
  }
  redirect(`/kniznica?${q.toString()}`)
}

export async function zalozPriecinokAkcia(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await zalozPriecinok(ja.companyCode, textPola(fd, "nazov"), textPola(fd, "parentId") || null, ja.email)
    revalidatePath("/kniznica")
    spatDoKniznice(fd, "Priečinok pribudol.")
  } catch (e) {
    if (jePresmerovanie(e)) throw e
    spatDoKniznice(fd, spravaChyby(e), true)
  }
}

export async function premenujPriecinokAkcia(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await premenujPriecinok(ja.companyCode, textPola(fd, "id"), textPola(fd, "nazov"), ja.email)
    revalidatePath("/kniznica")
    spatDoKniznice(fd, "Priečinok sa premenoval.")
  } catch (e) {
    if (jePresmerovanie(e)) throw e
    spatDoKniznice(fd, spravaChyby(e), true)
  }
}

export async function presunPriecinokAkcia(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await presunPriecinok(ja.companyCode, textPola(fd, "id"), textPola(fd, "parentId") || null, ja.email)
    revalidatePath("/kniznica")
    spatDoKniznice(fd, "Priečinok sa presunul.")
  } catch (e) {
    if (jePresmerovanie(e)) throw e
    spatDoKniznice(fd, spravaChyby(e), true)
  }
}

export async function zrusPriecinokAkcia(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")
  try {
    await zrusPriecinok(ja.companyCode, textPola(fd, "id"), ja.email)
    revalidatePath("/kniznica")
    spatDoKniznice(fd, "Priečinok sa zrušil.")
  } catch (e) {
    if (jePresmerovanie(e)) throw e
    spatDoKniznice(fd, spravaChyby(e), true)
  }
}

/** Zaradí dokument do priečinka z jeho detailu. */
export async function zaradDoPriecinka(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = "Zaradené."
  let chyba = false
  try {
    await zaradDokument(ja.companyCode, id, textPola(fd, "folderId") || null, ja.email)
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }
  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/** Preindexuje dokument podľa aktuálneho profilu členenia (D57). */
export async function preindexujDokument(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = ""
  let chyba = false
  try {
    const v = await preindexuj(ja.companyCode, id, ja.email, ja.profil)
    sprava = v.uzBolo
      ? "Členenie je už aktuálne — nič sa nemenilo."
      : `Preindexované: ${v.chunkov} úsekov, ${v.archivovanych} starých archivovaných. ` +
        "Znenie ani potvrdenia sa nedotklo."
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/** Oprava údajov už publikovaného znenia (D57). */
export async function opravZnenieAkcia(fd: FormData) {
  const ja = await kto()
  if (!ja) redirect("/")

  const id = textPola(fd, "documentId")
  let sprava = ""
  let chyba = false
  try {
    const den = textPola(fd, "effectiveFrom")
    const volba = textPola(fd, "priZmeneDatumu")
    const v = await opravZnenie(ja.companyCode, id, textPola(fd, "versionId"), {
      label: textPola(fd, "label") || undefined,
      effectiveFrom: den ? new Date(`${den}T00:00:00.000Z`) : undefined,
      effectiveFromSource: textPola(fd, "effectiveFromSource"),
      changeNote: textPola(fd, "changeNote"),
      dovod: textPola(fd, "dovod"),
      priZmeneDatumu: volba === "oprava" || volba === "znovaPotvrdit" ? volba : undefined,
    }, ja.email)

    sprava = v.znovaPotvrdit
      ? `Opravené. Znenie je označené ako vyžadujúce nové potvrdenie — týka sa to ${v.potvrdeni} ľudí.`
      : "Opravené. Potvrdenia zostávajú platné."
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}
