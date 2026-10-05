/**
 * aiSettings.ts — umelá inteligencia ako nastavenie organizácie (D157, 5. 10. 2026).
 *
 * Dovtedy boli kľúč aj modely v prostredí na Verceli a v kóde: zmena modelu
 * znamenala nové nasadenie a všetci zákazníci platili cez jeden kľúč
 * prevádzkovateľa. Teraz si organizácia môže dať **vlastný kľúč** (platí za
 * svoje volania sama) a **vybrať modely** pre tri účely.
 *
 * Kľúč sa ukladá **zašifrovaný** tým istým spôsobom ako tajomstvá prihlásenia
 * (`secrets.ts`, AES-256-GCM). Von sa nikdy nevráti — obrazovka ukazuje len
 * koncovku.
 *
 * Keď organizácia vlastný kľúč nemá, použije sa kľúč prevádzkovateľa
 * (`ANTHROPIC_API_KEY`) — tak ako doteraz, nič sa tým nerozbije. Ktorý kľúč
 * sa použil, sa zapisuje do spotreby (PR 2).
 */

import Anthropic from "@anthropic-ai/sdk"
import { getCollection } from "./mongodb"
import { TENANTS_COLLECTION, type Tenant } from "./tenants"
import { decrypt, encrypt, encryptionAvailable } from "./secrets"
import { writeAudit } from "./audit"
import { AppError } from "./appError"

/** Na čo sa model používa. Kľúče sú dáta v tenantovi — nepremenúvať. */
export type AiPurpose = "answer" | "utility" | "rewrite"

export interface AiModelOption {
  id: string
  label: string
}

/**
 * Modely na výber podľa účelu. Zoznam je **zámerne krátky** — len modely,
 * ktoré sme s danou úlohou vyskúšali alebo ktoré sú ich priamymi nástupcami.
 *
 * **Pomocný model je len Haiku 4.5.** Úprava otázky beží pred vyhľadávaním
 * a čaká sa na ňu (strop 2,5 s, `queryPreprocessor.ts`). Novšie modely
 * (Sonnet 5 a vyššie) premýšľajú vždy a premýšľanie by spotrebovalo celý
 * rozpočet 256 tokenov skôr, než by napísali odpoveď.
 */
export const AI_MODELS: Record<AiPurpose, AiModelOption[]> = {
  answer: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  ],
  utility: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  rewrite: [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  ],
}

/** Modely, ktoré platia, kým organizácia nevyberie iné — dnešné správanie. */
export function defaultModels(): Record<AiPurpose, string> {
  return {
    answer: process.env.GENERATION_MODEL ?? "claude-sonnet-5",
    utility: process.env.UTILITY_MODEL ?? "claude-haiku-4-5-20251001",
    rewrite: process.env.CMS_PREPIS_MODEL ?? "claude-sonnet-4-5",
  }
}

/** Ako je nastavenie uložené v `tenants.ai`. */
export interface TenantAi {
  provider: "anthropic"
  /** Zašifrovaný kľúč (`secrets.encrypt`). Nikdy čitateľne. */
  apiKeyEnc?: string
  /** Posledné štyri znaky — aby správca spoznal, ktorý kľúč je nastavený. */
  apiKeyHint?: string
  apiKeySetAt?: Date
  apiKeySetBy?: string
  models?: Partial<Record<AiPurpose, string>>
  updatedAt?: Date
  updatedBy?: string
}

export type KeySource = "tenant" | "operator"

export interface ResolvedAi {
  apiKey: string | null
  keySource: KeySource | null
  /** Organizácia kľúč má, ale nedá sa rozšifrovať — volanie musí zlyhať, nie ísť cez prevádzkovateľa. */
  ownKeyUnreadable: boolean
  models: Record<AiPurpose, string>
}

export class AiSettingsError extends AppError {}

/** Model zo zoznamu pre daný účel, inak predvolený. Neznáme ID sa nepoužije. */
function pickModel(purpose: AiPurpose, wanted: string | undefined): string {
  const fallback = defaultModels()[purpose]
  return wanted && AI_MODELS[purpose].some(m => m.id === wanted) ? wanted : fallback
}

/**
 * Kľúč a modely, ktoré sa majú pre organizáciu použiť.
 *
 * Kľúč organizácie, ktorý sa nedá rozšifrovať (iný kľúč na šifrovanie, než
 * s akým bol uložený), sa **nepoužije potichu kľúč prevádzkovateľa**: volania
 * by sa začali účtovať niekomu inému, než si organizácia nastavila. Vráti sa
 * `null` a volanie zlyhá s jasnou chybou.
 */
export function resolveAi(ai: TenantAi | undefined): ResolvedAi {
  const models = {
    answer: pickModel("answer", ai?.models?.answer),
    utility: pickModel("utility", ai?.models?.utility),
    rewrite: pickModel("rewrite", ai?.models?.rewrite),
  }
  if (ai?.apiKeyEnc) {
    try {
      return { apiKey: decrypt(ai.apiKeyEnc), keySource: "tenant", ownKeyUnreadable: false, models }
    } catch {
      return { apiKey: null, keySource: null, ownKeyUnreadable: true, models }
    }
  }
  const operator = process.env.ANTHROPIC_API_KEY
  return { apiKey: operator || null, keySource: operator ? "operator" : null, ownKeyUnreadable: false, models }
}

/** Nastavenie organizácie z databázy — bez cache, zmena platí hneď. */
export async function aiForCompany(companyCode: string): Promise<ResolvedAi> {
  try {
    const col = await getCollection<Tenant>(TENANTS_COLLECTION)
    const doc = await col.findOne({ companyCode }, { projection: { ai: 1 } })
    return resolveAi(doc?.ai)
  } catch {
    // Databáza nedostupná — ideme na kľúč a modely prevádzkovateľa, tak ako
    // `getTenantProfile()` ide na predvolený profil.
    return resolveAi(undefined)
  }
}

/** Čo sa smie ukázať na obrazovke. Kľúč nie, ani zašifrovaný. */
export interface AiSettingsView {
  hasOwnKey: boolean
  apiKeyHint?: string
  apiKeySetAt?: Date
  apiKeySetBy?: string
  operatorKeyAvailable: boolean
  models: Record<AiPurpose, string>
}

export function aiSettingsView(ai: TenantAi | undefined): AiSettingsView {
  return {
    hasOwnKey: Boolean(ai?.apiKeyEnc),
    apiKeyHint: ai?.apiKeyHint,
    apiKeySetAt: ai?.apiKeySetAt,
    apiKeySetBy: ai?.apiKeySetBy,
    operatorKeyAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    models: resolveAi({ provider: "anthropic", ...ai, apiKeyEnc: undefined }).models,
  }
}

/**
 * Overí kľúč jedným bezplatným volaním (zoznam modelov). Neplatný kľúč sa
 * neuloží — inak by sa na chybu prišlo až pri prvej otázke v asistentovi,
 * a to by ju zistil niekto iný než ten, kto kľúč zadal.
 */
export async function verifyApiKey(apiKey: string): Promise<void> {
  try {
    await new Anthropic({ apiKey, maxRetries: 1, timeout: 10_000 }).models.list({ limit: 1 })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AiSettingsError("ai.keyRejected", "Anthropic kľúč odmietol — skontrolujte, či je celý a platný.")
    }
    throw new AiSettingsError("ai.keyUnverified", "Kľúč sa nepodarilo overiť — Anthropic neodpovedá. Skúste to o chvíľu.")
  }
}

/**
 * Uloží nastavenie. **Prázdny kľúč znamená „nemeň"** — pole je pri každom
 * otvorení prázdne a uloženie zmeny modelu nesmie kľúč zmazať (rovnako ako
 * `saveOAuth()`). Na odstránenie je `deleteAiKey()`.
 */
export async function saveAiSettings(
  companyCode: string,
  input: { apiKey?: string; models?: Partial<Record<AiPurpose, string>> },
  actor: string,
): Promise<void> {
  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const existing = await col.findOne({ companyCode }, { projection: { ai: 1 } })
  const set: Record<string, unknown> = { "ai.provider": "anthropic" }
  const changes: Record<string, { from?: unknown; to: unknown }> = {}

  const key = input.apiKey?.trim()
  if (key) {
    if (!encryptionAvailable()) {
      throw new AiSettingsError(
        "tenant.noEncryptionKey",
        "Kľúč sa nedá uložiť: chýba OAUTH_SECRET_ENCRYPTION_KEY. Čitateľne ho ukladať nebudeme.",
      )
    }
    await verifyApiKey(key)
    set["ai.apiKeyEnc"] = encrypt(key)
    set["ai.apiKeyHint"] = key.slice(-4)
    set["ai.apiKeySetAt"] = new Date()
    set["ai.apiKeySetBy"] = actor
    // Do auditu len to, že sa kľúč zmenil, a koncovka — audit, ktorý zbiera
    // kľúče, je sám o sebe únik (D51).
    changes.apiKey = { from: existing?.ai?.apiKeyHint ? `…${existing.ai.apiKeyHint}` : null, to: `…${key.slice(-4)}` }
  }

  for (const purpose of Object.keys(AI_MODELS) as AiPurpose[]) {
    const wanted = input.models?.[purpose]
    if (wanted === undefined) continue
    if (!AI_MODELS[purpose].some(m => m.id === wanted)) {
      throw new AiSettingsError("ai.unknownModel", `Model „${wanted}" nie je v ponuke.`, { value: wanted })
    }
    const before = existing?.ai?.models?.[purpose] ?? defaultModels()[purpose]
    if (before !== wanted) changes[`model.${purpose}`] = { from: before, to: wanted }
    set[`ai.models.${purpose}`] = wanted
  }

  if (Object.keys(changes).length === 0) return
  set["ai.updatedAt"] = new Date()
  set["ai.updatedBy"] = actor
  await col.updateOne({ companyCode }, { $set: set } as never)
  await writeAudit({
    companyCode, subject: "ai-settings", action: "changed", actor,
    targetId: "anthropic", targetLabel: "Anthropic (Claude)", changes,
  })
}

/** Odstráni kľúč organizácie. Volania potom idú cez kľúč prevádzkovateľa. */
export async function deleteAiKey(companyCode: string, actor: string): Promise<void> {
  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const existing = await col.findOne({ companyCode }, { projection: { ai: 1 } })
  if (!existing?.ai?.apiKeyEnc) return
  await col.updateOne(
    { companyCode },
    {
      $unset: { "ai.apiKeyEnc": "", "ai.apiKeyHint": "", "ai.apiKeySetAt": "", "ai.apiKeySetBy": "" },
      $set: { "ai.updatedAt": new Date(), "ai.updatedBy": actor },
    } as never,
  )
  await writeAudit({
    companyCode, subject: "ai-settings", action: "deleted", actor,
    targetId: "anthropic", targetLabel: "Anthropic (Claude)",
    changes: { apiKey: { from: `…${existing.ai.apiKeyHint ?? ""}`, to: null } },
  })
}
