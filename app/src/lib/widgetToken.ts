/**
 * widgetToken.ts — podpísaný token z cudzieho systému (ADR-028, D166).
 *
 * ISSF (alebo iný systém s vlastným prihlásením) po prihlásení človeka vydá
 * krátko platný **JWT HS256** podpísaný tajomstvom kanála. Widget ho pošle
 * s každou otázkou; Contineo z neho pozná osobu, e-mail, roly a klub bez
 * vlastného prihlásenia. Anonymný režim sa nepoužíva: bez e-mailu niet
 * ticketu a bez roly niet výberu FAQ.
 *
 * Tvar (claims):
 *   iss  – pôvod cudzieho systému (napr. https://issf.futbalsfz.sk), musí byť
 *          medzi povolenými pôvodmi kanála;
 *   aud  – kľúč kanála;
 *   sub  – jedinečný identifikátor osoby **vo vydávajúcom systéme**: v ISSF
 *          je to registračné číslo, na platforme Sportnet by to bolo
 *          sportnetID (Ján 6. 10. 2026 — dve rôzne platformy, dva rôzne
 *          identifikátory). Riešiteľ ho vidí pri tickete;
 *   email, given_name, family_name, roles[], club – údaje o osobe (kópia
 *          v čase vydania); `name` len ako záloha, keď mená zvlášť chýbajú;
 *   lang – jazyk rozhrania (sk/cs/en), nepovinný;
 *   iat, exp – vydanie a platnosť; `exp - iat` najviac 15 minút.
 *
 * Bez knižnice: HS256 je jeden HMAC a dve base64url; `jose` by pribudlo
 * kvôli dvadsiatim riadkom. Porovnanie podpisu je v konštantnom čase.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { AppError } from "./appError"

export class WidgetTokenError extends AppError {}

/** Najdlhšia povolená platnosť tokenu. Dlhší token je chyba vydavateľa, nie voľba. */
export const MAX_TOKEN_TTL_S = 15 * 60
/** Tolerancia hodín medzi systémami. */
export const CLOCK_SKEW_S = 60

export interface WidgetIdentity {
  /** Identifikátor v cudzom systéme (`sub`). */
  externalId: string
  email: string
  givenName: string
  familyName: string
  /** Celé meno — z `given_name` + `family_name`, inak z `name`. */
  name: string
  roles: string[]
  club: string | null
  language: "sk" | "cs" | "en" | null
  issuer: string
  expiresAt: Date
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url")
}

/** Vydanie tokenu — pre testy, dokumentáciu a skúšobnú stránku; ISSF má vlastnú implementáciu. */
export function signWidgetToken(
  claims: { iss: string; aud: string; sub: string; email: string; given_name?: string; family_name?: string; name?: string; roles?: string[]; club?: string | null; lang?: string },
  secret: string,
  now: Date = new Date(),
  ttlSeconds: number = MAX_TOKEN_TTL_S,
): string {
  const iat = Math.floor(now.getTime() / 1000)
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64url(JSON.stringify({ ...claims, iat, exp: iat + ttlSeconds }))
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${sig}`
}

/**
 * Overí token kanála. Vyhadzuje `WidgetTokenError` s kódom:
 * `widget.tokenShape`, `widget.tokenSignature`, `widget.tokenExpired`,
 * `widget.tokenAudience`, `widget.tokenIssuer`, `widget.tokenClaims`.
 */
export function verifyWidgetToken(
  token: string,
  channel: { key: string; secret: string; origins: string[] },
  now: Date = new Date(),
): WidgetIdentity {
  const parts = token.split(".")
  if (parts.length !== 3) throw new WidgetTokenError("widget.tokenShape", "Token nemá tvar JWT.")
  const [h, p, s] = parts
  let header: { alg?: string }
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(fromB64url(h).toString("utf8"))
    payload = JSON.parse(fromB64url(p).toString("utf8"))
  } catch {
    throw new WidgetTokenError("widget.tokenShape", "Token sa nedá prečítať.")
  }
  if (header.alg !== "HS256") throw new WidgetTokenError("widget.tokenSignature", "Token nie je podpísaný HS256.")

  const expected = createHmac("sha256", channel.secret).update(`${h}.${p}`).digest()
  const given = fromB64url(s)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new WidgetTokenError("widget.tokenSignature", "Podpis tokenu nesedí.")
  }

  const nowS = Math.floor(now.getTime() / 1000)
  const exp = Number(payload.exp)
  const iat = Number(payload.iat)
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) throw new WidgetTokenError("widget.tokenClaims", "Token nemá iat a exp.")
  if (exp <= nowS - CLOCK_SKEW_S) throw new WidgetTokenError("widget.tokenExpired", "Token vypršal.")
  if (iat > nowS + CLOCK_SKEW_S) throw new WidgetTokenError("widget.tokenClaims", "Token je z budúcnosti.")
  if (exp - iat > MAX_TOKEN_TTL_S + CLOCK_SKEW_S) {
    throw new WidgetTokenError("widget.tokenClaims", "Token platí dlhšie než 15 minút.", { max: MAX_TOKEN_TTL_S })
  }
  if (payload.aud !== channel.key) throw new WidgetTokenError("widget.tokenAudience", "Token patrí inému kanálu.")
  const iss = String(payload.iss ?? "").replace(/\/+$/, "")
  if (!iss || !channel.origins.some(o => o.replace(/\/+$/, "") === iss)) {
    throw new WidgetTokenError("widget.tokenIssuer", "Vydavateľ tokenu nie je medzi povolenými pôvodmi kanála.")
  }
  const sub = String(payload.sub ?? "").trim()
  const email = String(payload.email ?? "").trim().toLowerCase()
  if (!sub || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new WidgetTokenError("widget.tokenClaims", "Token nemá identifikátor osoby alebo e-mail.")
  }
  const lang = String(payload.lang ?? "")
  const tidy = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim()
  const givenName = tidy(payload.given_name)
  const familyName = tidy(payload.family_name)
  return {
    externalId: sub,
    email,
    givenName,
    familyName,
    name: [givenName, familyName].filter(Boolean).join(" ") || tidy(payload.name),
    roles: Array.isArray(payload.roles) ? payload.roles.map(r => String(r).trim()).filter(Boolean).slice(0, 20) : [],
    club: payload.club ? String(payload.club).trim() : null,
    language: lang === "sk" || lang === "cs" || lang === "en" ? lang : null,
    issuer: iss,
    expiresAt: new Date(exp * 1000),
  }
}
