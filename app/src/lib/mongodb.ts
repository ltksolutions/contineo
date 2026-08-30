/**
 * mongodb.ts
 * Singleton MongoDB klient pre Next.js (App Router).
 * Zabraňuje vytváraniu nových spojení pri každom hot-reload v dev móde.
 * Exportuje: getClient(), getDb(), getCollection()
 */

// Typy zvlášť od hodnôt: Node vie TypeScript spustiť tak, že typy odstráni,
// ale nevie, ktoré z pomenovaných importov typy sú. Keby `Document` zostal
// medzi hodnotami, skripty spúšťané cez `scripts/lib/ts-hook.mjs` by spadli
// na „module 'mongodb' does not provide an export named 'Document'".
import { MongoClient } from "mongodb"
import type { Db, Collection, Document } from "mongodb"

const MONGODB_DB = process.env.MONGODB_DB ?? "contineo"

/**
 * Pripojenie sa zostavuje až pri PRVOM POUŽITÍ, nie pri importe modulu.
 *
 * Pôvodne sa `MONGODB_URI` čítalo a overovalo hneď na úrovni modulu. Lokálne
 * to fungovalo, lebo `.env.local` je vždy po ruke — ale `next build` prechádza
 * route handlery, aby zistil ich vlastnosti, čím sa modul naimportuje. Na
 * Verceli tak build padol na `MongoParseError` skôr, než sa vôbec dostal
 * k nasadeniu. Build nemá dôvod potrebovať databázu.
 */
function uri(): string {
  const v = process.env.MONGODB_URI
  if (!v) throw new Error("Chýba env premenná MONGODB_URI")
  return v
}

// ── Globálny cache pre dev hot-reload ────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient> | undefined

function connection(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    // V dev móde zdieľame spojenie cez global — hot-reload ho inak otvára
    // znova a znova, až cluster odmietne ďalšie.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri()).connect()
    }
    return global._mongoClientPromise
  }
  // V produkcii jedno spojenie na cold-start, držané v module.
  if (!clientPromise) clientPromise = new MongoClient(uri()).connect()
  return clientPromise
}

// ── Exporty ──────────────────────────────────────────────────────────────────

/** Vráti pripojeného MongoClient */
export async function getClient(): Promise<MongoClient> {
  return connection()
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

export default connection
