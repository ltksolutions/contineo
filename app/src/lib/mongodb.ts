/**
 * mongodb.ts
 * Singleton MongoDB klient pre Next.js (App Router).
 * Zabraňuje vytváraniu nových spojení pri každom hot-reload v dev móde.
 * Exportuje: getClient(), getDb(), getCollection()
 */

import { MongoClient, Db, Collection, Document } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI!
const MONGODB_DB  = process.env.MONGODB_DB ?? "contineo"

if (!MONGODB_URI) {
  throw new Error("Chýba env premenná MONGODB_URI")
}

// ── Globálny cache pre dev hot-reload ────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  // V dev móde zdieľame connection cez global object (hot-reload bezpečné)
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // V produkcii vytvoríme nové spojenie pri každom cold-start
  const client = new MongoClient(MONGODB_URI)
  clientPromise = client.connect()
}

// ── Exporty ──────────────────────────────────────────────────────────────────

/** Vráti pripojeného MongoClient */
export async function getClient(): Promise<MongoClient> {
  return clientPromise
}

/** Vráti Db inštanciu */
export async function getDb(): Promise<Db> {
  const client = await getClient()
  return client.db(MONGODB_DB)
}

/** Vráti typovanú Collection */
export async function getCollection<T extends Document = Document>(
  name: string
): Promise<Collection<T>> {
  const db = await getDb()
  return db.collection<T>(name)
}

export default clientPromise
