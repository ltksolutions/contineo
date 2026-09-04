"use server"

/**
 * actions.ts — zápisy z knižnice (D53).
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
import { libraryContext } from "@/lib/library"
import { isRedirect } from "@/lib/redirects"
import {
  uploadDocument, saveDraft, publish, checkMetadata, makeDocumentId, saveMetadata,
  reindex, fixVersion, LibraryError,
} from "@/lib/libraryWrite"
import { loadFile } from "@/lib/fileStore"
import { tenantExtras } from "@/lib/codelistsTenant"
import {
  createFolder, renameFolder, moveFolder, deleteFolder,
  assignDocument, shiftFolder, saveFolderOrder,
} from "@/lib/folders"
import type { CodelistExtras } from "@/lib/codelists"
import type { ChunkingProfile } from "@/lib/chunkingProfile"
import { cleanMarkdown, rewritePdf } from "@/lib/llmRewrite"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { writeAudit } from "@/lib/audit"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

async function actor(): Promise<
  {
    email: string
    companyCode: string
    /** Jazyk prostredia — hlásenia sa vracajú v ňom. */
    language: UiLanguage
    extras: CodelistExtras
    profile?: Partial<ChunkingProfile>
  } | null
> {
  const ctx = await libraryContext()
  return ctx.state === "ready"
    ? {
        email: ctx.person.email,
        companyCode: ctx.person.companyCode,
        language: ctx.person.language,
        // Vlastné položky číselníkov organizácie (D55) — bez nich by
        // obrazovka ponúkala druh dokumentu, ktorý zápis vzápätí odmietne.
        extras: tenantExtras(ctx.tenant),
        // Profil členenia organizácie (D58). Chýbajúci znamená predvolený.
        profile: ctx.tenant.chunking,
      }
    : null
}

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

/** Hlásenia akcií v jazyku prihláseného človeka. */
function say(language: UiLanguage) {
  return dictionary(language).library.actions
}

function errorMessage(e: unknown, language: UiLanguage): string {
  // `errorText()` pozná kódy zo `src/lib` a zloží z nich vetu v jazyku
  // prihláseného človeka. Cudziu výnimku nerozbalí — jej text na obrazovku
  // nepatrí, do logu áno.
  if (!(e instanceof AppError)) console.error("[kniznica] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function uploadAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    const file = fd.get("file")
    if (!(file instanceof File) || file.size === 0) {
      throw new LibraryError("library.noFileChosen", "Nevybral si súbor.")
    }

    // Organizácia je z prihláseného človeka, nie z formulára.
    const meta = checkMetadata({
      title: fieldText(fd, "title"),
      sectionKey: fieldText(fd, "sectionKey"),
      companyCode: self.companyCode,
      scope: fieldText(fd, "scope"),
      accessLevel: fieldText(fd, "accessLevel"),
      language: fieldText(fd, "language"),
      category: fieldText(fd, "category") || undefined,
      tags: fd.getAll("tags").filter((t): t is string => typeof t === "string"),
    }, self.extras)

    const v = await uploadDocument(
      meta, file.name, Buffer.from(await file.arrayBuffer()), self.email,
    )

    revalidatePath("/kniznica")
    // Rovno do editora: po nahratí nasleduje čítanie prevedeného textu
    // a hľadať dokument v zozname je zbytočný krok.
    redirect(`/kniznica/${encodeURIComponent(v.documentId)}/text?msg=${encodeURIComponent(
      v.warnings.length
        ? say(self.language).convertedWithWarnings(v.warnings.join(" "))
        : say(self.language).converted,
    )}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (isRedirect(e)) throw e
    const q = new URLSearchParams({
      error: errorMessage(e, self.language),
      title: fieldText(fd, "title"),
      sectionKey: fieldText(fd, "sectionKey"),
    })
    redirect(`/kniznica/nova?${q.toString()}`)
  }
}

export async function saveTextAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = say(self.language).saved
  let error = false
  try {
    await saveDraft(self.companyCode, id, String(fd.get("markdown") ?? ""), self.email)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

export async function publishVersionAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const day = fieldText(fd, "effectiveFrom")
    const v = await publish(self.companyCode, id, {
      label: fieldText(fd, "label"),
      // Dátum bez času a v UTC — `effectiveFrom` je deň, nie okamih, a
      // miestne pásmo by ho pri polnoci posunulo o deň.
      effectiveFrom: new Date(`${day}T00:00:00.000Z`),
      effectiveFromSource: fieldText(fd, "effectiveFromSource"),
      changeNote: fieldText(fd, "changeNote"),
    }, self.email, self.profile)

    message = v.alreadyDone
      ? say(self.language).alreadyPublished
      : say(self.language).published(v.chunks, v.archived)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Pomôcka pre obrazovku: aký `documentId` z týchto metadát vznikne. */
export async function previewId(companyCode: string, sectionKey: string): Promise<string> {
  return makeDocumentId({ companyCode, sectionKey })
}

/**
 * Pošle text alebo pôvodný sken jazykovému modelu (D53).
 *
 * Výsledok sa **neuloží do konceptu**, len vedľa neho ako návrh. Prepísať
 * znenie normy strojom bez toho, aby to niekto videl, je presne ten druh
 * tichej zmeny, po ktorej sa o rok nedá povedať, čo v predpise vlastne stálo.
 */
export async function sendToModelAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  const mode = fieldText(fd, "mode")
  let message = ""
  let error = false

  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await col.findOne({ documentId: id, companyCode: self.companyCode }) as Record<string, unknown> | null
    if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

    const draft = mode === "rewrite-scan"
      ? await (async () => {
          const original = doc.originalFile as { id: string; type: string } | undefined
          if (!original) throw new LibraryError("library.noOriginalFile", "Dokument nemá pôvodný súbor, ktorý by sa dal prepísať.")
          if (original.type !== "pdf") {
            throw new LibraryError("library.onlyPdfRewrite", "Prepisovať sa dá len PDF — ostatné formáty sa prevedú priamo.")
          }
          const s = await loadFile(self.companyCode, original.id)
          if (!s) throw new LibraryError("library.originalNotFound", "Pôvodný súbor sa nenašiel.")
          return rewritePdf(s.data)
        })()
      : await cleanMarkdown(String(doc.draftMarkdown ?? ""))

    await col.updateOne(
      { documentId: id, companyCode: self.companyCode },
      { $set: { llmDraft: draft }, $unset: { llmNavrh: "" } } as never,
    )
    await writeAudit({
      companyCode: self.companyCode, subject: "document", action: "model-draft",
      actor: self.email, targetId: id, targetLabel: String(doc.title ?? id),
      note: `${draft.mode} · ${draft.model} · ${draft.text.length} znakov`,
    })

    message = say(self.language).modelReturnedDraft
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  redirect(`/kniznica/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Prijme alebo zahodí návrh modelu. Prijatie je vedomý krok človeka. */
export async function decideOnDraftAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  const accept = fieldText(fd, "choice") === "accept"
  let message = ""
  let error = false

  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await col.findOne({ documentId: id, companyCode: self.companyCode }) as Record<string, unknown> | null
    const draft = doc?.llmDraft as { text?: string } | undefined
    if (!draft?.text) throw new LibraryError("library.noDraft", "Žiadny návrh tu nie je.")

    if (accept) {
      await saveDraft(self.companyCode, id, draft.text, `${self.email} (návrh modelu)`)
      message = say(self.language).draftAccepted
    } else {
      message = say(self.language).draftDiscarded
    }
    await col.updateOne(
      { documentId: id, companyCode: self.companyCode },
      { $unset: { llmDraft: "", llmNavrh: "" } } as never,
    )
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Uloží údaje o dokumente z detailu. */
export async function saveDocumentMetadataAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = say(self.language).saved
  let error = false
  try {
    await saveMetadata(self.companyCode, id, {
      title: fieldText(fd, "title"),
      scope: fieldText(fd, "scope"),
      accessLevel: fieldText(fd, "accessLevel"),
      language: fieldText(fd, "language"),
      category: fieldText(fd, "category") || undefined,
      tags: fd.getAll("tags").filter((t): t is string => typeof t === "string"),
    }, self.email, self.extras)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}


// ── priečinky (D56) ──────────────────────────────────────────────────────────

/** Späť na zoznam so zachovaným filtrom — inak sa človek po každej zmene stratí. */
function backToLibrary(fd: FormData, message: string, error = false): never {
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  for (const field of ["folder", "search", "status", "category", "language", "accessLevel", "tag"]) {
    const v = fieldText(fd, field)
    if (v) q.set(field, v)
  }
  redirect(`/kniznica?${q.toString()}`)
}

export async function createFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await createFolder(self.companyCode, fieldText(fd, "name"), fieldText(fd, "parentId") || null, self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

export async function renameFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await renameFolder(self.companyCode, fieldText(fd, "id"), fieldText(fd, "name"), self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

export async function moveFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await moveFolder(self.companyCode, fieldText(fd, "id"), fieldText(fd, "parentId") || null, self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

export async function deleteFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await deleteFolder(self.companyCode, fieldText(fd, "id"), self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

/** Zaradí dokument do priečinka z jeho detailu. */
export async function assignToFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = say(self.language).assigned
  let error = false
  try {
    await assignDocument(self.companyCode, id, fieldText(fd, "folderId") || null, self.email)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }
  revalidatePath("/kniznica")
  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Preindexuje dokument podľa aktuálneho profilu členenia (D57). */
export async function reindexDocumentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const v = await reindex(self.companyCode, id, self.email, self.profile)
    message = v.alreadyDone
      ? say(self.language).reindexUpToDate
      : say(self.language).reindexed(v.chunks, v.archived)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Oprava údajov už publikovaného znenia (D57). */
export async function fixVersionAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const day = fieldText(fd, "effectiveFrom")
    const choice = fieldText(fd, "onDateChange")
    const v = await fixVersion(self.companyCode, id, fieldText(fd, "versionId"), {
      label: fieldText(fd, "label") || undefined,
      effectiveFrom: day ? new Date(`${day}T00:00:00.000Z`) : undefined,
      effectiveFromSource: fieldText(fd, "effectiveFromSource"),
      changeNote: fieldText(fd, "changeNote"),
      reason: fieldText(fd, "reason"),
      onDateChange: choice === "correction" || choice === "reacknowledge" ? choice : undefined,
    }, self.email)

    message = v.reacknowledged
      ? say(self.language).fixedNeedsReacknowledge(v.acknowledgementCount)
      : say(self.language).fixed
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/kniznica/${id}`)
  redirect(`/kniznica/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Posun priečinka o jedno miesto medzi súrodencami (D60).
 *
 * Obyčajný formulár — funguje bez JavaScriptu a ovláda sa klávesnicou.
 * Ťahanie myšou robí to isté, ale je to nadstavba, nie jediná cesta.
 */
export async function shiftFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const direction = fieldText(fd, "direction") === "down" ? "down" : "up"
  try {
    await shiftFolder(self.companyCode, fieldText(fd, "id"), direction, self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

/** Nové poradie celej úrovne — sem posiela výsledok ťahanie myšou. */
export async function saveFolderOrderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const order = fieldText(fd, "order").split(",").map(x => x.trim()).filter(Boolean)
  try {
    if (order.length > 1) await saveFolderOrder(self.companyCode, order, self.email)
    revalidatePath("/kniznica")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}
