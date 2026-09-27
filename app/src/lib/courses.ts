/**
 * Kurz a jeho verzie (ADR-018, D117, D118) — typy a čisté pravidlá.
 *
 * Kurz je **plochý**: kurz → časti → bloky obsahu. Verzie sú vnorené ako
 * pri dokumente (`documents.versions[]`): koncept sa upravuje, **zverejnená
 * verzia sa nemení**, zmena = nová verzia (kópia). Zápis nesie `versionId`
 * v čase zápisu — človek dokončuje to, do čoho sa zapísal (D118).
 *
 * Tu nie je databáza (tá je v `coursesDb.ts`), aby sa pravidlá dali
 * testovať bez nej a volať aj z formulára.
 */

import type { SmartTag } from "./smartTags"

export const COURSES_COLLECTION = "courses"

/** Kľúč kurzu je v adrese (`/learning/[courseKey]`) — pomlčky ako pri trasách. */
export const COURSE_KEY = /^[a-z0-9][a-z0-9-]{1,59}$/
/** Kľúč časti (`/learning/[courseKey]/[partKey]`) — stačí aj jeden znak. */
export const PART_KEY = /^[a-z0-9][a-z0-9-]{0,59}$/

export type CourseVersionState = "draft" | "published" | "archived"

/** Kto vydáva certifikát — kópia v čase zverejnenia (D122). */
export interface Issuer {
  kind: "tenant" | "external"
  name: string
  shortName?: string
  /**
   * Logo vydavateľa — kópia `branding.logoUrl` v čase vydania. Chýbajúce =
   * na certifikáte je logo Contineo (rám CERTIFICATE, Ján 27. 9. 2026).
   */
  logoUrl?: string
}

/** Podpisujúci certifikát — meno a funkcia, kópia (nie odkaz na osobu). */
export interface Signer {
  name: string
  role: string
}

export type VideoSource =
  | { kind: "internal"; assetId: string }
  | { kind: "external"; provider: "youtube" | "vimeo" | "stream"; url: string }

export type ContentBlock =
  | { id: string; type: "text"; markdown: string }
  | { id: string; type: "image"; fileId: string; alt: string; caption?: string }
  | { id: string; type: "gallery"; items: { fileId: string; alt: string; caption?: string }[] }
  /** Znenie z knižnice — odkaz na **konkrétne** znenie a kópia názvu (nie obsah). */
  | { id: string; type: "document"; documentId: string; versionId: string; title: string }
  | {
      id: string
      type: "video"
      source: VideoSource
      /** Povinné dopozeranie (≥ 90 %, D119). Pri externom videu sa zaručiť nedá. */
      mustWatch: boolean
      /** Dĺžka v sekundách — bez nej sa percento dopozerania nedá spočítať. */
      durationSec?: number
      posterFileId?: string
    }

export type ContentBlockType = ContentBlock["type"]

/** Test pri časti. `testVersion` sa doplní pri zverejnení (zmrazenie, D118). */
export interface PartTest {
  testKey: string
  required: boolean
  testVersion?: number
}

export interface Part {
  key: string
  title: string
  summary?: string
  required: boolean
  blocks: ContentBlock[]
  tests: PartTest[]
  /** Odhad času; bez neho sa odhad kurzu skladá z častí, ktoré ho majú. */
  estimatedMinutes?: number
}

export interface CourseVersion {
  versionId: string
  /** Poradové číslo verzie od 1 — to, čo človek vidí („verzia 3"). */
  version: number
  state: CourseVersionState
  title: string
  subtitle?: string
  /** Markdown. */
  description?: string
  estimatedMinutes?: number
  /**
   * Časti postupne (`true`: ďalšia sa otvorí až po hotovej predošlej
   * povinnej) alebo v ľubovoľnom poradí. Zamknutie sa **odvodzuje**
   * (D119), nikde sa neukladá. Doplnené do ADR-018 27. 9. 2026.
   */
  sequential: boolean
  parts: Part[]
  issuesCertificate: boolean
  issuer?: Issuer
  /**
   * Kto podpisuje certifikát za vydavateľa (rám CERTIFICATE, Q1 ✅) — kópia
   * mena a funkcie; predvolené z `Tenant.certificateSigner`. V PDF je len
   * meno nad čiarou, nie obrázok podpisu.
   */
  signer?: Signer
  /** Právny základ ako pri znení (D92, D121) — pre záznamy o postupe a pokusoch. */
  legalBasisKey?: string
  legalBasisLabel?: string
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
  publishedAt?: Date
  publishedBy?: string
  archivedAt?: Date
  archivedBy?: string
  changeNote?: string
}

export interface Course {
  companyCode: string
  /** Stabilný kľúč, jedinečný v organizácii; nemení sa ani s názvom. */
  key: string
  /** Kópia názvu z poslednej zverejnenej verzie (alebo konceptu) — pre zoznamy. */
  title: string
  topicKey: string
  /** Kópia názvu témy — téma sa smie premenovať aj vyradiť. */
  topicLabel: string
  smartTags: SmartTag[]
  /** Jazyk obsahu (D35) — kurz v inom jazyku je iný kurz. */
  language: string
  /** Samozápis: kurz sa ponúka v „Na zápis" každému v organizácii. */
  openEnrollment: boolean
  versions: CourseVersion[]
  createdAt: Date
  createdBy: string
  updatedAt?: Date
}

/** Zverejnená verzia — najviac jedna. `null`, keď kurz ešte nevyšiel alebo je archivovaný. */
export function publishedVersion(course: Pick<Course, "versions">): CourseVersion | null {
  return course.versions.find(v => v.state === "published") ?? null
}

/** Rozpracovaný koncept — najviac jeden. */
export function draftVersion(course: Pick<Course, "versions">): CourseVersion | null {
  return course.versions.find(v => v.state === "draft") ?? null
}

export function versionById(course: Pick<Course, "versions">, versionId: string): CourseVersion | null {
  return course.versions.find(v => v.versionId === versionId) ?? null
}

/** Kurz je archivovaný, keď nemá zverejnenú verziu, ale nejaká už vyšla. */
export function isArchived(course: Pick<Course, "versions">): boolean {
  return !publishedVersion(course) && course.versions.some(v => v.state === "archived")
}

/**
 * Odhad času kurzu: zadaný pri verzii, inak súčet častí, ktoré odhad majú.
 * `null` = nevie sa (radšej nič než „0 minút").
 */
export function estimatedMinutes(version: Pick<CourseVersion, "estimatedMinutes" | "parts">): number | null {
  if (version.estimatedMinutes && version.estimatedMinutes > 0) return version.estimatedMinutes
  const sum = version.parts.reduce((n, p) => n + (p.estimatedMinutes ?? 0), 0)
  return sum > 0 ? sum : null
}

export function requiredParts(version: Pick<CourseVersion, "parts">): Part[] {
  return version.parts.filter(p => p.required)
}

export type PublishProblem =
  | { code: "noTitle" }
  | { code: "noParts" }
  | { code: "noRequiredPart" }
  | { code: "duplicatePartKey"; partKey: string }
  | { code: "badPartKey"; partKey: string }
  | { code: "emptyPart"; partKey: string }
  | { code: "videoWithoutDuration"; partKey: string; blockId: string }
  | { code: "mustWatchExternal"; partKey: string; blockId: string }
  | { code: "testNotReady"; partKey: string; testKey: string }
  | { code: "noIssuer" }
  /** Výsledky kurzu sú osobné údaje — bez právneho základu sa nezverejní (D121, rám MANAGE-COURSE). */
  | { code: "noLegalBasis" }

/**
 * Čo bráni zverejneniu (plán L1, bod 8). Prázdne pole = dá sa zverejniť.
 *
 * `readyTests` sú kľúče testov v stave `ready` (L2). Kým testy neexistujú,
 * volajúci podá prázdnu množinu a časť s testom sa zverejniť nedá — lepšie
 * než zverejniť kurz, ktorého povinný test sa nikdy nedá prejsť.
 */
export function publishProblems(
  version: Pick<CourseVersion, "title" | "parts" | "issuesCertificate" | "issuer" | "legalBasisKey">,
  readyTests: ReadonlySet<string> = new Set(),
): PublishProblem[] {
  const out: PublishProblem[] = []
  if (!version.title.trim()) out.push({ code: "noTitle" })
  if (version.parts.length === 0) out.push({ code: "noParts" })
  else if (!version.parts.some(p => p.required)) out.push({ code: "noRequiredPart" })

  const seen = new Set<string>()
  for (const p of version.parts) {
    if (!PART_KEY.test(p.key)) out.push({ code: "badPartKey", partKey: p.key })
    if (seen.has(p.key)) out.push({ code: "duplicatePartKey", partKey: p.key })
    seen.add(p.key)
    if (p.blocks.length === 0) out.push({ code: "emptyPart", partKey: p.key })
    for (const b of p.blocks) {
      if (b.type !== "video") continue
      // Povinné dopozeranie sa počíta z dĺžky; externé video ho zaručiť
      // nevie (ADR-018, D122) — nastavenie by sľubovalo, čo systém nesplní.
      if (b.mustWatch && b.source.kind === "external") out.push({ code: "mustWatchExternal", partKey: p.key, blockId: b.id })
      else if (b.mustWatch && !(b.durationSec && b.durationSec > 0)) {
        out.push({ code: "videoWithoutDuration", partKey: p.key, blockId: b.id })
      }
    }
    for (const t of p.tests) {
      if (!readyTests.has(t.testKey)) out.push({ code: "testNotReady", partKey: p.key, testKey: t.testKey })
    }
  }
  if (version.issuesCertificate && !version.issuer?.name.trim()) out.push({ code: "noIssuer" })
  if (!version.legalBasisKey) out.push({ code: "noLegalBasis" })
  return out
}

/**
 * Nová verzia z predošlej: hlboká kópia obsahu, stav `draft`, bez údajov
 * o zverejnení. Zmrazené verzie testov sa zahodia — pri ďalšom zverejnení
 * sa zmrazí to, čo bude vtedy platiť.
 */
export function draftFrom(
  from: CourseVersion,
  next: { versionId: string; version: number; at: Date; actor: string },
): CourseVersion {
  const copy = structuredClone(from)
  return {
    versionId: next.versionId,
    version: next.version,
    state: "draft",
    title: copy.title,
    subtitle: copy.subtitle,
    description: copy.description,
    estimatedMinutes: copy.estimatedMinutes,
    sequential: copy.sequential,
    parts: copy.parts.map(p => ({ ...p, tests: p.tests.map(({ testKey, required }) => ({ testKey, required })) })),
    issuesCertificate: copy.issuesCertificate,
    issuer: copy.issuer,
    signer: copy.signer,
    legalBasisKey: copy.legalBasisKey,
    legalBasisLabel: copy.legalBasisLabel,
    createdAt: next.at,
    createdBy: next.actor,
  }
}

/** Najbližšie číslo verzie. */
export function nextVersionNumber(course: Pick<Course, "versions">): number {
  return course.versions.reduce((n, v) => Math.max(n, v.version), 0) + 1
}
