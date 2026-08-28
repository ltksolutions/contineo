/**
 * seed_test_onboarding.mjs — skúšobný obsah pre testovacie prostredie.
 *
 *     npm run seed:test -- --person jan.letko@futbalsfz.sk --name "Ján Letko"
 *
 * **Prečo skúšobný dokument a nie niektorá zo skutočných noriem:** deväť
 * naimportovaných predpisov SFZ nemá v metadátach vyplnené `effectiveFrom`
 * — nikto im platnosť nevyhlásil. Doplniť ho odhadom by znamenalo vymyslieť
 * si právne metadáta a nechať ich v databáze vyzerať dôveryhodne. Platnosť
 * určuje kurátor (D25); dovtedy sa tie dokumenty potvrdiť nedajú a je to
 * správne správanie, nie chyba.
 *
 * Tento skript preto zakladá vlastný dokument, ktorý je už názvom označený
 * ako skúšobný, a odmietne siahnuť na čokoľvek iné.
 *
 * Je idempotentný — opakované spustenie nič nezdvojí.
 */

import { MongoClient } from "mongodb"

const OK = "\x1b[32m✔\x1b[0m", ERR = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const DOCUMENT_ID = "sfz:test_onboarding"
const TRACK_KEY = "test-2026"
const COMPANY = "SFZ"

const args = process.argv.slice(2)
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const personEmail = arg("--person")
const personName = arg("--name") ?? personEmail

if (!process.env.MONGODB_URI) {
  console.error(`${ERR} Chýba MONGODB_URI.`)
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })

const MARKDOWN = `# Skúšobná smernica (testovacie prostredie)

Tento dokument **nie je záväzný predpis**. Slúži na overenie, že potvrdzovanie
funguje od prihlásenia až po záznam v databáze.

## Článok 1 — Účel

Overiť tok: prihlásenie odkazom v e-maile → zoznam dokumentov → prečítanie →
potvrdenie → záznam v \`acknowledgements\` → výkaz pre HR.

## Článok 2 — Čo si na tom všimnúť

1. Potvrdenie sa viaže na **konkrétne znenie**, nie na dokument.
2. Znenie formulky, ktoré vidíte na obrazovke, je presne to, čo sa uloží.
3. Druhé potvrdenie tej istej verzie systém odmietne — nie je to chyba.

## Článok 3 — Odstránenie

Dokument aj skúšobnú trasu možno kedykoľvek zmazať; nič iné na nich nezávisí.
`

try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  console.log(`${OK} pripojené · databáza ${db.databaseName}\n`)

  // ── dokument ──
  const docs = db.collection("documents")
  const existing = await docs.findOne({ documentId: DOCUMENT_ID })
  if (existing && !existing.title?.includes("Skúšobná")) {
    console.error(`${ERR} ${DOCUMENT_ID} existuje a nevyzerá ako skúšobný — nesiaham naň.`)
    process.exit(1)
  }

  const versionId = "test-v1"
  const effectiveFrom = new Date(Date.UTC(2026, 0, 1))

  await docs.updateOne(
    { documentId: DOCUMENT_ID },
    {
      $set: {
        documentId: DOCUMENT_ID,
        title: "Skúšobná smernica (testovacie prostredie)",
        companyCode: COMPANY,
        accessLevel: "internal",
        language: "sk",
        sectionKey: "smernice",
        scope: "company",
        status: "published",
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  )

  const maVerziu = await docs.findOne({ documentId: DOCUMENT_ID, "versions.versionId": versionId })
  if (maVerziu) {
    console.log(`${INFO} verzia ${versionId} už existuje`)
  } else {
    await docs.updateOne({ documentId: DOCUMENT_ID }, {
      $push: {
        versions: {
          versionId, label: "1.0",
          effectiveFrom, effectiveTo: null, isActive: true,
          markdown: MARKDOWN,
          changeNote: "Prvé znenie skúšobného dokumentu.",
          publishedAt: new Date(), publishedBy: "seed_test_onboarding.mjs",
        },
      },
    })
    console.log(`${OK} dokument ${DOCUMENT_ID} + verzia 1.0 (platná od 1. 1. 2026)`)
  }

  // ── trasa ──
  await db.collection("onboarding_tracks").updateOne(
    { companyCode: COMPANY, key: TRACK_KEY },
    {
      $set: {
        companyCode: COMPANY, key: TRACK_KEY,
        title: "Skúšobná trasa",
        description: "Overenie potvrdzovacieho toku v testovacom prostredí.",
        steps: [{ order: 1, type: "document", documentId: DOCUMENT_ID, requiresAcknowledgement: true }],
        isActive: true,
        effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
        effectiveTo: null,
      },
      $setOnInsert: { createdAt: new Date(), createdBy: "seed_test_onboarding.mjs" },
    },
    { upsert: true }
  )
  console.log(`${OK} trasa ${TRACK_KEY} → 1 krok`)

  // ── osoba (voliteľne) ──
  if (personEmail) {
    const email = personEmail.trim().toLowerCase()
    const r = await db.collection("persons").updateOne(
      { companyCode: COMPANY, email },
      {
        $set: { fullName: personName, tracks: [TRACK_KEY], personType: "employee" },
        $setOnInsert: {
          companyCode: COMPANY, email,
          id: crypto.randomUUID(),
          status: "invited", language: "sk",
          invitedAt: new Date(),
          externalRef: { sportnetId: null, entraObjectId: null },
          createdBy: "seed_test_onboarding.mjs", createdAt: new Date(),
        },
      },
      { upsert: true }
    )
    console.log(`${OK} osoba ${email} — ${r.upsertedCount ? "založená" : "aktualizovaná"}, trasa ${TRACK_KEY}`)
  } else {
    console.log(`${INFO} osoba nezaložená (pridaj --person <e-mail> --name "Meno")`)
  }

  console.log(`\n${OK} hotovo — prihlás sa a otvor /dokumenty`)
} catch (e) {
  console.error(`${ERR} ${e.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
