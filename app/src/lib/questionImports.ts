/**
 * Dočasný súbor importu otázok (rám TESTS, „Import CSV" v dvoch krokoch
 * bez JavaScriptu): 1. nahratie → náhľad z tohto záznamu, 2. „Importovať".
 * Záznam patrí tomu, kto ho nahral, a po 24 h zmizne (TTL index).
 */

import { getCollection } from "./mongodb"

export const QUESTION_IMPORTS_COLLECTION = "question_imports"

interface QuestionImport {
  id: string
  companyCode: string
  actor: string
  name: string
  csv: string
  createdAt: Date
  expiresAt: Date
}

/** Strop CSV — banka otázok, nie databáza (a pod stropom formulára 4 MB). */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

async function col() {
  return getCollection<QuestionImport>(QUESTION_IMPORTS_COLLECTION)
}

export async function storeImport(companyCode: string, actor: string, name: string, csv: string): Promise<string> {
  const now = new Date()
  const id = crypto.randomUUID()
  await (await col()).insertOne({ id, companyCode, actor, name, csv, createdAt: now, expiresAt: new Date(now.getTime() + 24 * 3600_000) })
  return id
}

export async function loadImport(companyCode: string, actor: string, id: string): Promise<{ name: string; csv: string } | null> {
  const r = await (await col()).findOne({ companyCode, actor, id }, { projection: { _id: 0, name: 1, csv: 1 } })
  return r ?? null
}

export async function dropImport(companyCode: string, actor: string, id: string): Promise<void> {
  await (await col()).deleteOne({ companyCode, actor, id })
}
