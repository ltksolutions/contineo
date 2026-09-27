/**
 * Certifikáty v databáze (ADR-018, D122). Vydanie je **idempotentné**
 * (jeden certifikát na zápis, unikátny index) a **znova overí dokončenie**
 * zo zápisu a udalostí (D119) — tlačidlo ani obrazovka o tom nerozhoduje.
 *
 * Každý dotaz nesie `companyCode` (D32); verejné overenie ho berie z domény.
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { loadBrand } from "./branding"
import { saveFile } from "./fileStore"
import { getCourse } from "./coursesDb"
import { versionById } from "./courses"
import { courseProgress } from "./learningProgress"
import { progressFacts } from "./learningProgressDb"
import type { Enrollment } from "./enrollments"
import type { Tenant } from "./tenants"
import {
  CERTIFICATE_COUNTERS_COLLECTION, CERTIFICATES_COLLECTION, newVerificationHash, numberPrefix, registrationNumber,
  type Certificate, type CertificateIssuer,
} from "./certificates"

export class CertificateError extends AppError {}

async function col() {
  return getCollection<Certificate>(CERTIFICATES_COLLECTION)
}

export async function certificateForEnrollment(companyCode: string, enrollmentId: string): Promise<Certificate | null> {
  return (await col()).findOne({ companyCode, enrollmentId }, { projection: { _id: 0 } })
}

export async function certificatesForCourse(companyCode: string, courseKey: string): Promise<Certificate[]> {
  return (await col()).find({ companyCode, courseKey }, { projection: { _id: 0 } }).toArray()
}

export async function certificatesForPerson(companyCode: string, personId: string): Promise<Certificate[]> {
  return (await col()).find({ companyCode, personId }, { projection: { _id: 0 } }).toArray()
}

/** Verejné overenie: organizácia z domény, číslo **aj** hash. Inak `null`. */
export async function certificateToVerify(companyCode: string, number: string, hash: string): Promise<Certificate | null> {
  if (!number || !/^[a-z0-9]{16}$/.test(hash)) return null
  return (await col()).findOne({ companyCode, registrationNumber: number, verificationHash: hash }, { projection: { _id: 0 } })
}

/** Ďalšie poradové číslo v roku — atomicky, dve vydania nedostanú to isté. */
async function nextSeq(companyCode: string, year: number): Promise<number> {
  const c = await getCollection<{ companyCode: string; year: number; seq: number }>(CERTIFICATE_COUNTERS_COLLECTION)
  const r = await c.findOneAndUpdate({ companyCode, year }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" })
  return r?.seq ?? 1
}

/**
 * Vydavateľ v čase vydania — kópia. Nahraté logo sa skopíruje do úložiska
 * (zmena loga organizácie vydaný certifikát nezmení); statické logo
 * (`/tenants/…`) sa nemení, stačí adresa. Bez loga ostane prázdne a
 * certifikát ukáže logo Contineo (rozhodnutie Jána 27. 9. 2026).
 */
async function issuerOf(tenant: Tenant, actor: string): Promise<CertificateIssuer> {
  const b = tenant.branding
  const issuer: CertificateIssuer = {
    kind: "tenant",
    name: b.displayName,
    legalName: tenant.controller?.legalName || undefined,
    address: tenant.controller?.address || undefined,
    registrationNumber: tenant.controller?.registrationNumber || undefined,
  }
  const logo = b.logoUrl ?? ""
  if (logo.startsWith("/api/brand/")) {
    const brand = await loadBrand(tenant.companyCode)
    if (brand) {
      const bytes = (brand.data as unknown as { buffer?: Uint8Array }).buffer ?? (brand.data as unknown as Uint8Array)
      const ext = brand.contentType.includes("svg") ? "svg" : brand.contentType.includes("png") ? "png" : brand.contentType.includes("webp") ? "webp" : "jpg"
      const f = await saveFile(tenant.companyCode, `certifikat-logo.${ext}`, brand.contentType, Buffer.from(bytes), actor)
      issuer.logoFileId = f.id
    }
  } else if (logo.startsWith("/")) {
    issuer.logoUrl = logo
  }
  return issuer
}

/**
 * Vydá certifikát k zápisu, ak ho kurz vydáva a je **naozaj** dokončený.
 * Vráti existujúci alebo nový; `null`, keď vydať nemožno.
 */
export async function ensureCertificate(enrollment: Enrollment, tenant: Tenant): Promise<Certificate | null> {
  const e = enrollment
  const existing = await certificateForEnrollment(e.companyCode, e.id)
  if (existing) return existing
  if (e.cancelledAt) return null
  const course = await getCourse(e.companyCode, e.courseKey)
  const version = course ? versionById(course, e.versionId) : null
  if (!course || !version?.issuesCertificate) return null
  const facts = await progressFacts(e.companyCode, e.id)
  const progress = courseProgress(version, facts)
  if (!progress.done || !progress.completedAt) return null

  const now = new Date()
  const year = progress.completedAt.getUTCFullYear()
  const cert: Certificate = {
    id: crypto.randomUUID(),
    companyCode: e.companyCode,
    type: "course",
    enrollmentId: e.id,
    personId: e.personId,
    holderName: e.fullName,
    courseKey: course.key,
    versionId: version.versionId,
    courseTitle: version.title,
    courseVersion: version.version,
    partsCount: version.parts.length,
    testsPassed: new Set(facts.passedTests.map(t => `${t.partKey}:${t.testKey}`)).size,
    completedAt: progress.completedAt,
    issuedAt: now,
    issuedBy: await issuerOf(tenant, "system"),
    signer: version.signer,
    registrationNumber: registrationNumber(numberPrefix(tenant.branding.shortName, e.companyCode), year, await nextSeq(e.companyCode, year)),
    verificationHash: newVerificationHash(),
    revokedAt: null,
    anonymizedAt: null,
  }
  try {
    await (await col()).insertOne({ ...cert })
  } catch (err) {
    // Súbežné vydanie toho istého zápisu — vyhral prvý.
    if ((err as { code?: number }).code === 11000) return certificateForEnrollment(e.companyCode, e.id)
    throw err
  }
  await writeAudit({ companyCode: e.companyCode, subject: "certificate", action: "created", actor: "system", targetId: cert.registrationNumber, targetLabel: `${e.fullName} · ${cert.courseTitle}` })
  return cert
}

/** Odvolanie (rám CERTIFICATE Q3 ✅): lektor, povinný dôvod, nevratné, audit. */
export async function revokeCertificate(companyCode: string, enrollmentId: string, reason: string, actor: string): Promise<Certificate> {
  const text = reason.trim()
  if (!text) throw new CertificateError("learning.reasonRequired", "Dôvod je povinný.")
  const c = await certificateForEnrollment(companyCode, enrollmentId)
  if (!c) throw new CertificateError("certificate.notFound", "Certifikát neexistuje.")
  if (c.revokedAt) return c
  const at = new Date()
  await (await col()).updateOne({ companyCode, id: c.id, revokedAt: null }, { $set: { revokedAt: at, revokedBy: actor, revokedReason: text } })
  await writeAudit({ companyCode, subject: "certificate", action: "revoked", actor, targetId: c.registrationNumber, targetLabel: `${c.holderName ?? "—"} · ${c.courseTitle}`, note: text })
  return { ...c, revokedAt: at, revokedBy: actor, revokedReason: text }
}
