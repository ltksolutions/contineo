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
import {
  nahrajDokument, ulozKoncept, publikuj, overMetadata, idDokumentu, KniznicaError,
} from "@/lib/kniznica.zapis"
import { UloziskoError, nacitajSubor } from "@/lib/ulozisko"
import { precisti, prepisPdf, PrepisError } from "@/lib/prepisLlm"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { zapisAudit } from "@/lib/audit"

async function kto(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await kniznicaContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode }
    : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v.trim() : ""
}

function spravaChyby(e: unknown): string {
  if (e instanceof KniznicaError || e instanceof UloziskoError || e instanceof PrepisError) {
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
    })

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
    if (e && typeof e === "object" && "digest" in e) throw e
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
    }, ja.email)

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
