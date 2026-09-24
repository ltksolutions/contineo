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

import { normalizeMeta, parseDate, metaCanonical, documentDraftIdentity, type VersionMeta } from "@/lib/versionMeta"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { libraryContext, isContentManager } from "@/lib/library"
import { isRedirect } from "@/lib/redirects"
import {
  uploadDocument, saveDraft, saveDraftMeta, saveDraftResponsible, saveDraftTitle, publish, checkMetadata, makeDocumentId, saveMetadata,
  reindex, fixText, LibraryError, type UploadFiles, type IncomingFile,
} from "@/lib/libraryWrite"
import { loadFile } from "@/lib/fileStore"
import { textDiff } from "@/lib/textFix"
import { revokeVersion } from "@/lib/acknowledgements"
import { assign, carryOverCandidates, audienceRef } from "@/lib/assignments"
import { dueFromFields } from "@/lib/due"
import { notify } from "@/lib/notifications"
import { isHr } from "@/lib/hr"
import { tenantExtras } from "@/lib/codelistsTenant"
import {
  createFolder, renameFolder, moveFolder, deleteFolder,
  assignDocument, shiftFolder, saveFolderOrder,
} from "@/lib/folders"
import type { CodelistExtras } from "@/lib/codelists"
import { rewritePdf } from "@/lib/llmRewrite"
import { tidyStructure } from "@/lib/tidyStructure"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "@/lib/documents"
import { writeAudit } from "@/lib/audit"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import { assignHref, summarize, type BulkOutcome } from "@/lib/libraryBulk"
import { submitForApproval, cancelRound, markNotified } from "@/lib/approvalsDb"
import { approvalEmail, send } from "@/lib/ecomail"
import { requestHostname, currentTenant } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { personLanguage } from "@/lib/persons"
import type { ApprovalRound } from "@/lib/approvals"
import { formatDate } from "@/lib/i18n"
import { setVersionResponsible } from "@/lib/versionResponsibilityDb"

async function actor(): Promise<
  {
    email: string
    companyCode: string
    /** Identita osoby. Upozornenie ide osobe, nie adrese — adresa sa mení. */
    personId: string
    /** Jazyk prostredia — hlásenia sa vracajú v ňom. */
    language: UiLanguage
    extras: CodelistExtras
    /**
     * Rola správcu obsahu. `libraryContext()` ju už overila — nesie sa ďalej
     * preto, aby pravidlá v `src/lib` nemuseli veriť tomu, že sa akcia volala
     * z chránenej stránky. Kontrola, ktorá sa dá obísť iným vstupom, nie je
     * kontrola.
     */
    canManageContent: boolean
  } | null
> {
  const ctx = await libraryContext()
  return ctx.state === "ready"
    ? {
        email: ctx.person.email,
        companyCode: ctx.person.companyCode,
        personId: ctx.person.id,
        language: ctx.person.language,
        // Vlastné položky číselníkov organizácie (D55) — bez nich by
        // obrazovka ponúkala druh dokumentu, ktorý zápis vzápätí odmietne.
        extras: tenantExtras(ctx.tenant),
        // Profil členenia sa sem už nepodáva: od D79 si ho každý zápis
        // rozlíši podľa **dokumentu**, nie podľa organizácie. Podávaný zvonku
        // znamenal, že dávkové preindexovanie prerezalo aj dokumenty
        // s vlastným profilom.
        canManageContent: isContentManager(ctx.person),
      }
    : null
}

/**
 * Názov dokumentu do upozornenia — **kópia v čase udalosti**.
 *
 * Z rovnakého dôvodu ako v `assignments` a `acknowledgements`: dokument sa
 * môže premenovať alebo zmiznúť a o mesiac musí byť čitateľné, čoho sa oznam
 * týkal. Zlyhanie dotazu nie je dôvod nezapísať upozornenie — vtedy sa
 * použije identifikátor.
 */
async function documentTitleFor(companyCode: string, documentId: string): Promise<string> {
  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const d = await col.findOne({ documentId, companyCode }, { projection: { title: 1 } })
    return d?.title ? String(d.title) : documentId
  } catch {
    return documentId
  }
}

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

/** Hlásenia akcií v jazyku prihláseného človeka. */
/**
 * Údaje o znení z formulára (ADR-013). Dátum z `<input type="date">` ide
 * ako deň v UTC; nečitateľný dátum sa odmietne, nezahodí.
 */
function metaFromForm(fd: FormData): VersionMeta {
  const date = (name: string) => {
    const v = fieldText(fd, name)
    if (!v) return null
    const d = parseDate(v)
    if (!d) throw new LibraryError("meta.badDate", "Dátum v údajoch o znení nie je platný dátum.")
    return d
  }
  return normalizeMeta({
    author: fieldText(fd, "metaAuthor"),
    approvedBy: fieldText(fd, "metaApprovedBy"),
    approvedOn: date("metaApprovedOn"),
    effectiveFrom: date("metaEffectiveFrom"),
  })
}

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

/**
 * PDF a zdroj z formulára (ADR-011).
 *
 * Každý môže prísť dvoma cestami: ako **identifikátor** súboru, ktorý
 * prehliadač už nahral po kúskoch (`pdfFileId`, `sourceFileId` — s
 * JavaScriptom, do 25 MB), alebo ako **súbor vo formulári** (`pdf`,
 * `source` — bez JavaScriptu, do 4 MB). Identifikátor má prednosť: keď ho
 * skript vyplnil, súbor z poľa už neodoslal.
 */
async function filesFromForm(fd: FormData): Promise<UploadFiles> {
  const pick = async (idField: string, fileField: string): Promise<IncomingFile | null> => {
    const storedId = fieldText(fd, idField)
    if (storedId) return { storedId }
    const file = fd.get(fileField)
    if (file instanceof File && file.size > 0) {
      return { name: file.name, data: Buffer.from(await file.arrayBuffer()) }
    }
    return null
  }
  const pdf = await pick("pdfFileId", "pdf")
  if (!pdf) throw new LibraryError("library.pdfRequired", "Schvaľovaná podoba musí byť PDF — ulož dokument vo Worde ako PDF.")
  return { pdf, source: await pick("sourceFileId", "source") }
}

export async function uploadAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  try {
    const files = await filesFromForm(fd)

    // Organizácia je z prihláseného človeka, nie z formulára.
    const meta = checkMetadata({
      title: fieldText(fd, "title"),
      documentKey: fieldText(fd, "documentKey"),
      // Zaradenie z formulára odišlo (ADR-010); nové dokumenty ho nemajú.
      sectionKey: "",
      companyCode: self.companyCode,
      scope: fieldText(fd, "scope"),
      accessLevel: fieldText(fd, "accessLevel"),
      language: fieldText(fd, "language"),
      category: fieldText(fd, "category") || undefined,
      tags: fd.getAll("tags").filter((t): t is string => typeof t === "string"),
      ownerDepartmentId: fieldText(fd, "ownerDepartmentId") || undefined,
      internalNumber: fieldText(fd, "internalNumber") || undefined,
    }, self.extras)

    // Táto obrazovka zakladá **nový** dokument. Keď kľúč už existuje, zápis
    // sa odmietne — dovtedy ticho prepísal koncept, metadáta aj pôvodný
    // súbor existujúceho dokumentu (D80).
    const v = await uploadDocument(meta, files, self.email, "new", metaFromForm(fd))

    revalidatePath("/library")
    // Rovno do editora: po nahratí nasleduje čítanie prevedeného textu
    // a hľadať dokument v zozname je zbytočný krok.
    redirect(`/library/${encodeURIComponent(v.documentId)}/text?msg=${encodeURIComponent(
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
      documentKey: fieldText(fd, "documentKey"),
    })
    redirect(`/library/new?${q.toString()}`)
  }
}

/**
 * Nahrá nový súbor ako **koncept existujúceho** dokumentu (D80).
 *
 * Oddelená cesta od `uploadAction()` zámerne. Dovtedy sa nové znenie
 * dostávalo dnu tak, že človek prešiel znova cez obrazovku nového dokumentu
 * a zopakoval kľúč — čo bola tá istá akcia ako založenie a nedalo sa
 * rozlíšiť, čo z toho chcel. Teraz je zámer v adrese aj v kóde.
 *
 * **Metadáta sa preberajú z existujúceho záznamu**, formulár ich neposiela.
 * Nové znenie mení text, nie pôsobnosť ani prístupnosť; keby ich formulár
 * niesol, dal by sa nimi pri nahrávaní súboru nechtiac pohnúť.
 *
 * Publikované znenie sa tým **nemení** — vzniká koncept a publikuje sa
 * samostatným úkonom, ktorý prechádza schvaľovaním (D75).
 */
export async function uploadVersionAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  try {
    const files = await filesFromForm(fd)

    const col = await getCollection(DOCUMENTS_COLLECTION)
    const before = await col.findOne({ documentId: id, companyCode: self.companyCode })
    if (!before) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

    const meta = checkMetadata({
      title: String(before.title ?? ""),
      // Kľúč dokumentu chýba záznamom spred D80 — vtedy platí zaradenie,
      // presne ako v `makeDocumentId()`.
      documentKey: String(before.documentKey ?? before.sectionKey ?? ""),
      sectionKey: String(before.sectionKey ?? ""),
      companyCode: self.companyCode,
      scope: String(before.scope ?? ""),
      accessLevel: String(before.accessLevel ?? ""),
      language: String(before.language ?? ""),
      category: (before.category as string | null) ?? undefined,
      tags: Array.isArray(before.tags) ? (before.tags as string[]) : [],
      // Aj tieto dve sa berú z existujúceho záznamu, nie z formulára —
      // z rovnakého dôvodu ako všetko ostatné vyššie: nové znenie mení text,
      // nie to, kto dokument spravuje ani pod akým číslom je vedený.
      ownerDepartmentId: (before.ownerDepartmentId as string | null) ?? undefined,
      internalNumber: (before.internalNumber as string | null) ?? undefined,
    }, self.extras)

    const v = await uploadDocument(meta, files, self.email, "version", metaFromForm(fd))

    // **Porovnanie s platným znením hneď, nie až v editore.** Bez neho sa nedá
    // odlíšiť novela od znovunahratia toho istého PDF — a to je presne tá
    // chyba, ktorá sa zistí až vtedy, keď stovka ľudí potvrdí „nové" znenie
    // s nezmeneným textom. Rozdiel po riadkoch je vidieť na detaile dokumentu;
    // tu ide o jednu vetu, ktorá povie, či sa vôbec oplatí pozerať.
    const versions = (before.versions ?? []) as { isActive?: boolean; markdown?: string }[]
    const published = String(versions.find(x => x.isActive)?.markdown ?? "")
    const m = say(self.language)
    const parts = [v.warnings.length ? m.convertedWithWarnings(v.warnings.join(" ")) : m.converted]
    if (published) {
      const d = textDiff(published, v.markdown)
      parts.push(d.added + d.removed === 0
        ? m.versionSameAsPublished
        : m.versionDiffers(d.added, d.removed))
    }

    revalidatePath(`/library/${id}`)
    redirect(`/library/${encodeURIComponent(v.documentId)}/text?msg=${encodeURIComponent(parts.join(" "))}`)
  } catch (e) {
    if (isRedirect(e)) throw e
    // Späť na formulár nového znenia — tam sa súbor vyberá znova.
    redirect(`/library/${encodeURIComponent(id)}/version?msg=${encodeURIComponent(
      errorMessage(e, self.language),
    )}&error=1`)
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

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Uloží údaje o znení konceptu (ADR-013). Zámok po predložení stráži `saveDraftMeta()`. */
export async function saveDraftMetaAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "documentId")
  let message: string
  let error = false
  try {
    await saveDraftMeta(self.companyCode, id, metaFromForm(fd), self.email)
    message = say(self.language).metaSaved
  } catch (e) {
    if (isRedirect(e)) throw e
    message = errorMessage(e, self.language)
    error = true
  }
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}#version-meta`)
}

/**
 * Krok 1 — Príprava (ADR-014): údaje o znení, zodpovedná osoba a
 * schvaľovatelia **v jednom formulári**. „Len uložiť" uloží, „Uložiť
 * a predložiť" navyše otvorí kolo.
 *
 * Na čom kolo beží, sa počíta **až po uložení** a na serveri: údaje o znení
 * sú súčasťou identity konceptu (D107), takže identita z chvíle načítania
 * stránky by po uložení už nesedela.
 */
export async function prepareDraftAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  const id = fieldText(fd, "documentId")
  const submit = fieldText(fd, "intent") === "submit"
  const m = say(self.language)
  let message = m.draftPrepared
  let error = false
  try {
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const before = await col.findOne({ documentId: id, companyCode: self.companyCode })
    if (!before) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

    // Údaje o znení len vtedy, keď ich formulár nesie (pri zámku nie)
    // a keď sa naozaj zmenili — rovnaké uloženie by zapisovalo prázdny audit.
    if (fieldText(fd, "metaEditable") === "1") {
      const meta = metaFromForm(fd)
      const was = before.draftMeta ? normalizeMeta(before.draftMeta as never) : null
      if (!was || metaCanonical(was) !== metaCanonical(meta)) {
        await saveDraftMeta(self.companyCode, id, meta, self.email)
      }
    }

    const responsibleId = fieldText(fd, "responsiblePersonId")
    if (responsibleId) await saveDraftResponsible(self.companyCode, id, responsibleId, self.email)

    // Nový názov (ADR-015, D112) — len keď ho formulár nesie (pri zámku nie).
    if (fieldText(fd, "titleEditable") === "1") {
      await saveDraftTitle(self.companyCode, id, fieldText(fd, "title"), self.email)
    }

    if (submit) {
      const after = await col.findOne({ documentId: id, companyCode: self.companyCode })
      if (!after) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")
      const round = await submitForApproval({
        companyCode: self.companyCode,
        documentId: id,
        versionId: documentDraftIdentity(after as never),
        approverIds: fd.getAll("approver").filter(v => typeof v === "string") as string[],
        note: fieldText(fd, "note"),
        submittedBy: self.email,
      })
      const effectiveFrom = after.draftMeta ? normalizeMeta(after.draftMeta as never).effectiveFrom : null
      const notified = await notifyApprovers({
        companyCode: self.companyCode,
        documentId: id,
        round,
        versionLabel: fieldText(fd, "versionLabel"),
        effectiveFrom: effectiveFrom ? effectiveFrom.toISOString() : "",
        title: String(after.title ?? id),
        submittedBy: self.email,
      })
      message = m.submittedForApproval(round.approvers.length)
      if (notified < round.approvers.length) {
        message += ` ${m.approvalNotAllNotified(round.approvers.length - notified)}`
      }
    }
  } catch (e) {
    if (isRedirect(e)) throw e
    message = errorMessage(e, self.language)
    error = true
  }
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}#flow`)
}

export async function publishVersionAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    // Zodpovedná osoba z prípravy (ADR-014) — `publish()` ju z konceptu
    // odstráni, upozornenie ju ale potrebuje aj potom.
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const before = await col.findOne({ documentId: id, companyCode: self.companyCode })
    const responsibleId = fieldText(fd, "responsiblePersonId")
      || String((before?.draftResponsible as { personId?: string } | null | undefined)?.personId ?? "")
    // Prenos pri zverejnení: dôvod a termín sa overia **pred** zverejnením,
    // nech chyba vo formulári nevyrobí zverejnené, ale nepridelené znenie.
    if (fieldText(fd, "carryOver") === "1") {
      if (!fieldText(fd, "reason")) {
        throw new AppError("assignment.missingReason", "Dôvod pridelenia je povinný.")
      }
      const due = dueFromFields({ mode: fd.get("dueMode"), date: fieldText(fd, "dueDate"), days: fieldText(fd, "dueDays") })
      if ("error" in due) throw new AppError(due.error, due.error)
    }
    const day = fieldText(fd, "effectiveFrom")
    const v = await publish(self.companyCode, id, {
      // Dátum bez času a v UTC — `effectiveFrom` je deň, nie okamih, a
      // miestne pásmo by ho pri polnoci posunulo o deň. Pole je vo formulári
      // len pri koncepte bez údajov o znení (ADR-013); inak ho berie `publish()`.
      effectiveFrom: day ? new Date(`${day}T00:00:00.000Z`) : null,
      effectiveFromSource: fieldText(fd, "effectiveFromSource"),
      changeNote: fieldText(fd, "changeNote"),
      responsiblePersonId: responsibleId,
    }, self.email)

    message = v.alreadyDone
      ? say(self.language).alreadyPublished
      : say(self.language).published(v.chunks, v.archived)
    if (!v.alreadyDone) {
      await notify({
        companyCode: self.companyCode,
        personId: self.personId,
        kind: "versionPublished",
        params: {
          documentId: id,
          documentTitle: await documentTitleFor(self.companyCode, id),
          versionLabel: v.label,
        },
      })
      // Zodpovednej osobe do zvončeka: má určiť právny základ (D91). Ide
      // osobe, nie adrese — a len ak to nie je ten, kto práve zverejnil.
      if (responsibleId && responsibleId !== self.personId) {
        await notify({
          companyCode: self.companyCode,
          personId: responsibleId,
          kind: "responsibleAssigned",
          params: {
            documentId: id,
            documentTitle: await documentTitleFor(self.companyCode, id),
            versionLabel: v.label,
          },
        })
      }

      /*
       * Prenos pridelení ako voľba pri zverejnení (ADR-014, D111). Znenie je
       * už zverejnené — keby prenos zlyhal (napr. chýba dôvod), zverejnenie
       * sa nevracia; povie sa to a karta prenosu (krok 4) zostane na detaile.
       */
      if (fieldText(fd, "carryOver") === "1") {
        const ctx = await libraryContext()
        if (ctx.state === "ready" && isHr(ctx.person)) {
          try {
            const after = await col.findOne({ documentId: id, companyCode: self.companyCode })
            const version = ((after?.versions ?? []) as { versionId: string; label: string; effectiveFrom?: Date | null }[])
              .find(x => x.versionId === v.versionId)
            if (after && version) {
              const r = await carryOverTo({
                companyCode: self.companyCode,
                documentId: id,
                documentTitle: String(after.title ?? id),
                version,
                fd,
                by: self.email,
              })
              message += ` ${say(self.language).carriedOver(r.created, r.already)}`
            }
          } catch (e) {
            message += ` ${say(self.language).carryOverFailed} ${errorMessage(e, self.language)}`
            error = true
          }
        }
      }
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/library")
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Pomôcka pre obrazovku: aký `documentId` z týchto metadát vznikne. */
export async function previewId(
  companyCode: string,
  sectionKey: string,
  documentKey?: string,
): Promise<string> {
  return makeDocumentId({ companyCode, sectionKey, documentKey })
}

/**
 * Pripraví návrh textu — **pravidlami, alebo modelom pri skene** (D53).
 *
 * Dve cesty, a rozdiel medzi nimi je podstatný:
 *
 * - `clean` — prečistenie členenia **bez modelu** (`tidyStructure`). Členenie
 *   sa v prevedenom PDF nestratilo, len nemá značky, takže na jeho obnovenie
 *   netreba stroj, ktorý prepisuje slová normy. Nemá limit na dĺžku a nemôže
 *   vrátiť polovicu dokumentu. Prečo sa to zmenilo, je v `tidyStructure.ts`.
 * - `rewrite-scan` — sken bez textovej vrstvy. Tam model nahradiť nevieme.
 *
 * Výsledok sa **neuloží do konceptu**, len vedľa neho ako návrh. Zmeniť
 * znenie normy strojom bez toho, aby to niekto videl, je presne ten druh
 * tichej zmeny, po ktorej sa o rok nedá povedať, čo v predpise vlastne stálo.
 * Platí to aj pre pravidlá — nie sú neomylnejšie než model, len sú verejné.
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
      : await (async () => {
          const text = String(doc.draftMarkdown ?? "").trim()
          if (!text) throw new LibraryError("rewrite.emptyInput", "Niet čo prečisťovať — text je prázdny.")
          const tidy = tidyStructure(text)
          if (tidy.headings === 0) {
            throw new LibraryError(
              "library.noStructureFound",
              "V texte sa nenašla ani jedna úroveň členenia (ČASŤ, hlava, Článok, príloha). " +
              "Buď je text inak členený, alebo ho treba prepísať zo skenu.",
            )
          }
          return {
            text: tidy.markdown,
            // Do záznamu sa píše, čím text vznikol. „Bez modelu" tu nie je
            // ozdoba — o rok to je rozdiel medzi „stroj to prepísal"
            // a „pravidlá to označkovali".
            model: `bez modelu · pravidlá · nadpisov ${tidy.headings}, ` +
                   `pätička ${tidy.removedFurniture} riadkov`,
            mode: "clean" as const,
            at: new Date(),
          }
        })()

    await col.updateOne(
      { documentId: id, companyCode: self.companyCode },
      { $set: { llmDraft: draft }, $unset: { llmNavrh: "" } } as never,
    )
    await writeAudit({
      companyCode: self.companyCode, subject: "document", action: "model-draft",
      actor: self.email, targetId: id, targetLabel: String(doc.title ?? id),
      note: `${draft.mode} · ${draft.model} · ${draft.text.length} znakov`,
    })

    message = mode === "rewrite-scan"
      ? say(self.language).modelReturnedDraft
      : say(self.language).rulesReturnedDraft

    /*
     * Upozornenie **len pri prepise modelom**, nie pri pravidlách.
     * Prepis skenu trvá minúty a človek medzitým odchádza inam; prečistenie
     * pravidlami je hotové skôr, než sa stránka prekreslí, a oznam o ňom by
     * bol len riadok navyše v zozname.
     */
    if (mode === "rewrite-scan") {
      await notify({
        companyCode: self.companyCode,
        personId: self.personId,
        kind: "rewritten",
        params: {
          documentId: id,
          documentTitle: String(doc.title ?? id),
        },
      })
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  redirect(`/library/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
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

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}/text?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}


/**
 * Zopakuje pridelenia predošlého znenia na to, ktoré platí teraz.
 *
 * **Prečo to vôbec existuje.** `subject.versionId` pripína pridelenie na
 * konkrétne znenie (D28), takže po zverejnení novely nie je na nové znenie
 * pridelený nikto, kým sa nepridelí znova. Dovtedy to nebolo z ničoho vidieť.
 *
 * **Prečo na detaile a nie hneď po zverejnení.** Znenie sa bežne zverejní
 * v septembri s účinnosťou od januára a `assign()` neúčinné znenie odmietne
 * (D73/D6). Ponuka viazaná na okamih zverejnenia by teda v polovici prípadov
 * skončila hláškou „zatiaľ to nejde" — a kto ju vtedy preklikne, už sa k nej
 * nevráti. Táto je viazaná na **stav**, takže sa dá doriešiť aj o týždeň.
 *
 * **Prideľuje personalista, nie správca obsahu.** Je to zápis povinnosti
 * človeku, nie úprava metadát dokumentu; rola sa preto overuje tu, nie sa
 * predpokladá z toho, že karta bola na obrazovke vidieť.
 *
 * **Dôvod je nový a povinný** (D30): pôvodný („nástup do zamestnania") sa
 * novely netýka a prevziať ho by znamenalo zapísať do záznamu nepravdu.
 * **Termín sa neprenáša** — pôvodný býva v minulosti a hneď by vyrobil
 * omeškanie u všetkých. **E-maily sa neposielajú**, rozposlanie zostáva
 * samostatným krokom: jeden klik nemá poslať mail stovke ľudí.
 */
export async function carryOverAssignmentsAction(fd: FormData) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")

  const id = fieldText(fd, "documentId")
  const language = ctx.person.language
  let message = ""
  let error = false

  try {
    if (!isHr(ctx.person)) {
      throw new AppError("assignment.forbidden", "Prideľovať smie personalista.")
    }

    // Znenie sa berie zo servera, nie z formulára — keby `versionId` prišlo
    // z prehliadača, dalo by sa prideliť ľubovoľné, aj cudzie.
    const col = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await col.findOne({ documentId: id, companyCode: ctx.person.companyCode })
    if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")
    const effective = effectiveVersion(doc as never)
    if (!effective.ok) {
      throw new LibraryError(
        "library.noPublishedVersion",
        "Dokument nemá platné znenie — prideliť sa dá len to, čo už platí.",
      )
    }
    const { created, already } = await carryOverTo({
      companyCode: ctx.person.companyCode,
      documentId: id,
      documentTitle: String(doc.title ?? id),
      version: effective.version,
      fd,
      by: ctx.person.email,
    })
    message = say(language).carriedOver(created, already)
  } catch (e) {
    if (isRedirect(e)) throw e
    message = errorMessage(e, language)
    error = true
  }

  revalidatePath("/library")
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Prenos pridelení na znenie — spoločné pre kartu prenosu aj pre voľbu pri
 * zverejnení (ADR-014, D111). Publiká aj znenie sú zo servera; formulár
 * hovorí len **ktoré** z ponúknutých, dôvod a termín.
 */
async function carryOverTo(input: {
  companyCode: string
  documentId: string
  documentTitle: string
  version: { versionId: string; label: string; effectiveFrom?: Date | string | null }
  fd: FormData
  by: string
}): Promise<{ created: number; already: number }> {
  const { fd } = input
  const reason = fieldText(fd, "reason")
  /*
   * Termín sa parsuje **pred** cyklom, rovnako ako v `/hr/assign`: je
   * spoločný pre celý výber a chyba v ňom má vrátiť človeka k formuláru
   * skôr, než sa čokoľvek zapíše.
   */
  const parsed = dueFromFields({
    mode: fd.get("dueMode"),
    date: fieldText(fd, "dueDate"),
    days: fieldText(fd, "dueDays"),
  })
  if ("error" in parsed) throw new AppError(parsed.error, parsed.error)
  const due = parsed.due

  // Publiká zo servera: formulár hovorí **ktoré** z ponúknutých, nie
  // aké. Inak by sa dalo prideliť publiku, ktoré tento dokument nikdy nemalo.
  const candidates = await carryOverCandidates(input.companyCode, input.documentId, input.version.versionId)
  const picked = new Set(
    fd.getAll("audience").filter((v): v is string => typeof v === "string"),
  )
  const chosen = candidates.filter(c => picked.has(audienceRef(c.audience)))
  if (chosen.length === 0) {
    throw new AppError("assignment.noAudience", "Nevybral si žiadne publikum.")
  }

  let created = 0
  let already = 0
  for (const c of chosen) {
    const r = await assign({
      companyCode: input.companyCode,
      subject: {
        documentId: input.documentId,
        versionId: input.version.versionId,
        documentTitle: input.documentTitle,
        versionLabel: input.version.label,
        effectiveFrom: input.version.effectiveFrom ? new Date(input.version.effectiveFrom) : null,
      },
      audience: c.audience,
      reason: reason,
      assignedBy: input.by,
      due: due,
    })
    if (r.status === "pridelene") created += 1
    else already += 1
  }
  return { created, already }
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
      ownerDepartmentId: fieldText(fd, "ownerDepartmentId") || undefined,
      internalNumber: fieldText(fd, "internalNumber") || undefined,
    }, self.email, self.extras)
    // Priečinok je od 24. 9. 2026 v tom istom formulári (rám
    // KNIZNICA-uprava-dokumentu, Q2). Presun ide cez `assignDocument()` —
    // ten istý auditný záznam ako samostatný presun; bez zmeny nezapíše nič.
    if (fd.has("folderId")) {
      await assignDocument(self.companyCode, id, fieldText(fd, "folderId") || null, self.email)
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/library")
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
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
  // Správa priečinkov má vlastnú stránku (NASADENIE, PR 4): jej formuláre
  // nesú `return=folders` a človek sa vracia tam, kde robil. Porovnáva sa
  // s bielym zoznamom, nie s hodnotou z formulára — inak open redirect.
  const target = fieldText(fd, "return") === "folders" ? "/library/folders" : "/library"
  redirect(`${target}?${q.toString()}`)
}

export async function createFolderAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")
  try {
    await createFolder(self.companyCode, fieldText(fd, "name"), fieldText(fd, "parentId") || null, self.email)
    revalidatePath("/library")
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
    revalidatePath("/library")
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
    revalidatePath("/library")
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
    revalidatePath("/library")
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
  revalidatePath("/library")
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** Označené dokumenty z formulára. Prázdny zoznam je platný stav, nie chyba. */
function selectedDocuments(fd: FormData): string[] {
  return fd.getAll("document")
    .filter((v): v is string => typeof v === "string")
    .map(v => v.trim())
    .filter(Boolean)
}

/**
 * Kam sa človek vráti. Nesie sa vo formulári, aby po akcii zostal pri tom
 * istom filtri, triedení a strane — inak by ho každý presun vyhodil na
 * začiatok nefiltrovaného zoznamu.
 */
function backTo(fd: FormData, message: string, error = false): string {
  const raw = fieldText(fd, "back") || "/library"
  // Z formulára smie prísť len cesta v knižnici; celá adresa by sa dala
  // zneužiť na presmerovanie preč (open redirect).
  const back = raw.startsWith("/library") ? raw : "/library"
  const sep = back.includes("?") ? "&" : "?"
  return `${back}${sep}msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`
}

/**
 * Hromadný presun do priečinka.
 *
 * Cyklus nad tou istou `assignDocument()`, akú používa presun po jednom —
 * takže kontroly aj audit zostávajú a nevzniká druhá cesta, ako sa dokument
 * dostane do priečinka.
 *
 * **Dávka môže skončiť čiastočne** a je to zámer: kolekcie sa v tomto projekte
 * menia po zázname a transakcia naprieč dokumentmi by sem zaviedla nástroj,
 * ktorý sa nikde inde nepoužíva. Preto sa na konci vypíše, čo neprešlo.
 */
export async function moveManyAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const ids = selectedDocuments(fd)
  const t = say(self.language)
  if (ids.length === 0) redirect(backTo(fd, t.bulkNothingSelected, true))

  const folderId = fieldText(fd, "folderId") || null
  const outcome: BulkOutcome = { moved: [], failed: [] }

  for (const id of ids) {
    try {
      await assignDocument(self.companyCode, id, folderId, self.email)
      outcome.moved.push(id)
    } catch (e) {
      if (isRedirect(e)) throw e
      outcome.failed.push({ documentId: id, reason: errorMessage(e, self.language) })
    }
  }

  revalidatePath("/library")
  for (const id of outcome.moved) revalidatePath(`/library/${id}`)

  const message = summarize(outcome, t.bulkMoved, t.bulkMovedPartly)
  redirect(backTo(fd, message, outcome.failed.length > 0))
}

/**
 * Odovzdá výber prideľovaniu.
 *
 * Nič nezapisuje — len prenesie označené dokumenty na obrazovku, ktorá
 * prideľovanie už vie (`/hr/assign`). Je to serverová akcia, a nie odkaz,
 * lebo výber žije v zaškrtávacích políčkach formulára, nie v adrese.
 */
export async function assignManyAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const ids = selectedDocuments(fd)
  if (ids.length === 0) redirect(backTo(fd, say(self.language).bulkNothingSelected, true))
  redirect(assignHref(ids))
}

/** Preindexuje dokument podľa aktuálneho profilu členenia (D57). */
export async function reindexDocumentAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const v = await reindex(self.companyCode, id, self.email)
    message = v.alreadyDone
      ? say(self.language).reindexUpToDate
      : say(self.language).reindexed(v.chunks, v.archived)
    // Upozornenie len keď sa naozaj niečo stalo. „Už bolo hotové" nie je
    // udalosť, je to zistenie — a zvonček plný zistení sa prestane čítať.
    if (!v.alreadyDone) {
      await notify({
        companyCode: self.companyCode,
        personId: self.personId,
        kind: "reindexed",
        params: {
          documentId: id,
          documentTitle: await documentTitleFor(self.companyCode, id),
          count: v.chunks,
        },
      })
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}


/**
 * Zmena (alebo doplnenie) zodpovednej osoby znenia (D91).
 *
 * Robí ju správca obsahu — tú istú rolu, ktorá znenie zverejňuje. Pravidlo aj
 * oprávnenie sa overujú v `setVersionResponsible()`, nie tu.
 */
export async function setResponsibleAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const to = await setVersionResponsible({
      companyCode: self.companyCode,
      documentId: id,
      versionId: fieldText(fd, "versionId"),
      personId: fieldText(fd, "responsiblePersonId"),
      reason: fieldText(fd, "reason"),
      actor: self.email,
      canManageContent: self.canManageContent,
    })
    message = dictionary(self.language).responsibility.responsibleSaved
    if (to.personId !== self.personId) {
      await notify({
        companyCode: self.companyCode,
        personId: to.personId,
        kind: "responsibleAssigned",
        params: {
          documentId: id,
          documentTitle: await documentTitleFor(self.companyCode, id),
          versionLabel: fieldText(fd, "versionLabel"),
        },
      })
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Hromadné odvolanie potvrdení jedného znenia (D82).
 *
 * Jediná cesta, ako odomknúť označenie a dátum platnosti. Nie je to pohodlie:
 * kto by odvolával po jednom z výkazu, pri desiatkach ľudí to nedokončí
 * a znenie zostane v polovičnom stave.
 */
export async function revokeVersionAction(fd: FormData) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")

  const id = fieldText(fd, "documentId")
  const language = ctx.person.language
  let message = ""
  let error = false
  try {
    const r = await revokeVersion({
      by: {
        personId: ctx.person.id,
        email: ctx.person.email,
        fullName: ctx.person.fullName,
        companyCode: ctx.person.companyCode,
      },
      isHr: isHr(ctx.person),
      versionId: fieldText(fd, "versionId"),
      reason: fieldText(fd, "reason"),
    })
    if (r.ok) message = say(language).versionRevoked(r.revoked)
    else {
      message = errorText(new AppError(r.reason, r.reason), language)
      error = true
    }
  } catch (e) {
    message = errorMessage(e, language)
    error = true
  }

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Oprava **textu** platného znenia bez novej verzie (`fixText()`).
 *
 * Formulárom ide len `documentId`, **odtlačok** konceptu a dôvod. Text sa berie
 * z konceptu na serveri: znenie predpisu má aj sto kilobajtov a posielať ho tam
 * a späť len preto, aby sa vrátilo tam, odkiaľ prišlo, je zbytočná cesta.
 * Odtlačok je poistka, že sa uloží to, čoho rozdiel mal človek pred očami.
 */
export async function fixTextAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const v = await fixText(self.companyCode, id, {
      expectedFingerprint: fieldText(fd, "expectedFingerprint"),
      reason: fieldText(fd, "reason"),
      canManageContent: self.canManageContent,
    }, self.email)

    message = say(self.language).textFixed(v.added, v.removed, v.chunks)
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath("/library")
  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
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
    revalidatePath("/library")
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
    revalidatePath("/library")
    backToLibrary(fd, say(self.language).changesSaved)
  } catch (e) {
    if (isRedirect(e)) throw e
    backToLibrary(fd, errorMessage(e, self.language), true)
  }
}

/**
 * Predloženie znenia na schválenie (ADR-006, krok 3).
 *
 * Formulár nad serverovou akciou, nie volanie API: predloženie otvára úkon
 * s následkom a cudzia stránka ho nemá vedieť spustiť za prihláseného človeka.
 *
 * Schvaľovatelia chodia ako `persons.id`, nie ako adresy — meno v kole je
 * odtlačok (D24) a berie sa zo záznamu osoby na serveri, nie z formulára.
 */
export async function submitForApprovalAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    const round = await submitForApproval({
      companyCode: self.companyCode,
      documentId: id,
      versionId: fieldText(fd, "versionId"),
      approverIds: fd.getAll("approver").filter(v => typeof v === "string") as string[],
      note: fieldText(fd, "note"),
      submittedBy: self.email,
      publishedBefore: fieldText(fd, "publishedBefore") === "1",
    })
    /*
      Ozvať sa menovaným ľuďom (krok 5). **Až po zápise kola** a mimo neho:
      keby odoslanie zhodilo zápis, vzniklo by kolo, ktoré v databáze nie je,
      a predkladateľ by ho otvoril druhý raz. Naopak zlyhané odoslanie kolo
      nezruší — kolo beží ďalej a v zázname je vidieť, komu sa neozvalo.

      Nie je to hromadná pošta: chodí len tým, koho predkladateľ menoval, a
      chodí **raz**. Kolo, ktoré leží, sa rieši rozhovorom alebo zrušením, nie
      piatym e-mailom o tom istom.
    */
    const notified = await notifyApprovers({
      companyCode: self.companyCode,
      documentId: id,
      round,
      versionLabel: fieldText(fd, "versionLabel"),
      effectiveFrom: fieldText(fd, "effectiveFrom"),
      title: fieldText(fd, "title"),
      submittedBy: self.email,
    })

    message = say(self.language).submittedForApproval(round.approvers.length)
    if (notified < round.approvers.length) {
      message += ` ${say(self.language).approvalNotAllNotified(round.approvers.length - notified)}`
    }
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Zrušenie bežiaceho kola (ADR-006, časť 5).
 *
 * Kolo sa **nemaže** — dostane dôvod a zostane v histórii. Je to jediná cesta,
 * ako zo zoznamu odstrániť schvaľovateľa, ktorý tam byť nemá; meniť zoznam za
 * behu by znamenalo, že sa dá nepohodlný schvaľovateľ potichu vymeniť.
 */
export async function cancelApprovalAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const id = fieldText(fd, "documentId")
  let message = ""
  let error = false
  try {
    await cancelRound({
      companyCode: self.companyCode,
      documentId: id,
      versionId: fieldText(fd, "versionId"),
      reason: fieldText(fd, "reason"),
      by: self.email,
    })
    message = say(self.language).approvalCancelled
  } catch (e) {
    message = errorMessage(e, self.language)
    error = true
  }

  revalidatePath(`/library/${id}`)
  redirect(`/library/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Ozve sa schvaľovateľom kola. Vracia počet, ktorým správa naozaj odišla.
 *
 * **Nikdy nevyhadzuje.** Jeden neplatný e-mail nesmie zhodiť predloženie ani
 * zastaviť ostatných — rovnaká úvaha ako pri rozposielaní z výkazu. Komu sa
 * neozvalo, je vidieť v zázname (`notifiedAt` zostane `null`) aj v logu.
 */
async function notifyApprovers(input: {
  companyCode: string
  documentId: string
  round: ApprovalRound
  versionLabel: string
  effectiveFrom: string
  title: string
  submittedBy: string
}): Promise<number> {
  let host = ""
  let branding: ReturnType<typeof brandingView> | undefined
  try {
    host = await requestHostname()
    const tenant = await currentTenant()
    if (tenant) branding = brandingView(tenant)
  } catch (e) {
    console.error("[schvalovanie] vzhľad organizácie sa nepodarilo načítať:", e)
  }

  const link = `https://${host}/approvals`
  const sent: string[] = []

  await Promise.all(input.round.approvers.map(async a => {
    try {
      const language = await personLanguage(a.email, input.companyCode)
      await send({
        to: a.email,
        ...approvalEmail(
          link,
          host,
          {
            title: input.title || input.documentId,
            versionLabel: input.versionLabel || input.round.versionId,
            effectiveFrom: input.effectiveFrom
              ? formatDate(new Date(input.effectiveFrom), language)
              : "—",
          },
          input.submittedBy,
          input.round.note ?? "",
          language,
          branding,
        ),
      })
      sent.push(a.email)
    } catch (e) {
      console.error(`[schvalovanie] e-mail na ${a.email} zlyhal:`, e)
    }
  }))

  if (sent.length > 0) {
    await markNotified({
      companyCode: input.companyCode,
      documentId: input.documentId,
      versionId: input.round.versionId,
      round: input.round.round,
      emails: sent,
    })
  }
  return sent.length
}
