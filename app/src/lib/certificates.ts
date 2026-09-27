/**
 * Certifikáty kurzov (ADR-018, D122; rám CERTIFICATE) — typy a čisté pravidlá.
 *
 * Certifikát je **záznam o tom, že sa dokončenie vyhodnotilo a vydalo**
 * (D119) — nie príznak postupu. Nesie **kópie** všetkého, čo je na ňom
 * vidieť (meno, kurz, verzia, vydavateľ, logo, podpisujúci): o rok musí
 * vyzerať rovnako, aj keď sa organizácia premenuje alebo zmení logo.
 *
 * Nemaže sa: odvolanie je `revokedAt` + dôvod (D24); pri retencii
 * (ADR-012) sa z neho odstráni meno, číslo ostane overiteľné.
 *
 * Verejné overenie potrebuje číslo **a** `verificationHash` (80 bitov
 * náhody) — číslo samo sa dá uhádnuť, hash nie.
 */

import { randomBytes } from "node:crypto"

export const CERTIFICATES_COLLECTION = "certificates"
export const CERTIFICATE_COUNTERS_COLLECTION = "certificate_counters"

export interface CertificateIssuer {
  kind: "tenant" | "external"
  /** Názov v hlavičke („Slovenský futbalový zväz"). */
  name: string
  /** Právny názov, sídlo a IČO z údajov prevádzkovateľa — na verejnom overení. */
  legalName?: string
  address?: string
  registrationNumber?: string
  /** Kópia nahratého loga v úložisku (ak organizácia logo nahrala). */
  logoFileId?: string
  /** Statické logo (`/tenants/…`) — súbor sa nemení, stačí adresa. */
  logoUrl?: string
}

export interface Certificate {
  id: string
  companyCode: string
  type: "course"
  enrollmentId: string
  personId: string
  /** Kópia mena; pri retencii sa odstráni (`anonymizedAt`). */
  holderName: string | null
  /**
   * Kópia pohlavia pre tvar „absolvoval/-a". Chýba = v čase vydania
   * nebolo vyplnené; doplní sa raz, keď ho osoba dostane
   * (`withHolderGender`), potom sa nemení.
   */
  holderGender?: "male" | "female"
  courseKey: string
  versionId: string
  courseTitle: string
  courseVersion: number
  partsCount: number
  testsPassed: number
  completedAt: Date
  issuedAt: Date
  issuedBy: CertificateIssuer
  signer?: { name: string; role: string }
  /** `SFZ-2026-0198` — jedinečné v organizácii. */
  registrationNumber: string
  verificationHash: string
  /**
   * PDF vyrobené pri prvom stiahnutí a odvtedy to isté (kópia, nie
   * nové vykreslenie — zmena šablóny vydaný certifikát nezmení).
   */
  pdfFileId?: string
  revokedAt?: Date | null
  revokedBy?: string
  revokedReason?: string
  anonymizedAt?: Date | null
}

/** Predpona čísla: skratka organizácie (len písmená a číslice), inak kód. */
export function numberPrefix(shortName: string | undefined, companyCode: string): string {
  const s = (shortName ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return (s || companyCode.toUpperCase().replace(/[^A-Z0-9]/g, "")).slice(0, 12)
}

/** `{SHORT}-{ROK}-{poradie}` — poradie aspoň štvormiestne (D122). */
export function registrationNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
}

const BASE32 = "abcdefghijkmnpqrstuvwxyz23456789"

/** 16 znakov z abecedy bez zameniteľných (l/1, o/0) — 80 bitov. */
export function newVerificationHash(): string {
  const bytes = randomBytes(16)
  return Array.from(bytes, b => BASE32[b % 32]).join("")
}

export function verifyPath(c: Pick<Certificate, "registrationNumber" | "verificationHash">): string {
  return `/verify/${encodeURIComponent(c.registrationNumber)}?h=${c.verificationHash}`
}

/**
 * Adresa organizácie pre overovací odkaz: prvý hostiteľ, ktorý nie je
 * lokálny. Nie z požiadavky — PDF sa ukladá natrvalo a lokálny server
 * zapisuje do ostrej databázy; `sfz.localhost` by na papieri ostal navždy.
 */
export function tenantOrigin(hostnames: readonly string[]): string {
  const host = hostnames.find(h => h !== "localhost" && !h.endsWith(".localhost")) ?? hostnames[0] ?? ""
  return `https://${host}`
}

export function isRevoked(c: Pick<Certificate, "revokedAt">): boolean {
  return Boolean(c.revokedAt)
}
