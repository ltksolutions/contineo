/**
 * domeny.mjs — v akom stave sú domény tenantov a čo ešte čaká na zákazníka.
 *
 *     npm run domeny                       # prehľad všetkých
 *     npm run domeny -- --company SFZ      # jeden tenant
 *     npm run domeny -- --company KLUB --poslat        # odošle pokyny
 *     npm run domeny -- --company KLUB --poslat --komu it@klub.sk
 *
 * **Stav ani pokyny sa neukladajú.** Oboje sa číta naživo z Vercelu a odvodí
 * z hostname — uložená kópia by klamala presne vtedy, keď na tom najviac
 * záleží: zákazník si o mesiac prestaví DNS a náš záznam by ďalej tvrdil
 * „nastavené". Je to to isté pravidlo ako D27.
 *
 * **Zaznamenáva sa len akt:** komu a kedy sme pokyny poslali (`domainSetup`).
 * To sa odvodiť nedá a bez toho sa po čase nezistí, či zákazník pokyny vôbec
 * dostal — rovnaké rozlíšenie ako medzi úlohou a jej pridelením (D37).
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { MongoClient } from "mongodb"
import { send } from "../src/lib/ecomail.ts"
// Pravidlá o doménach majú jednu definíciu — v `lib/`. Skript ich volá,
// nekopíruje: dva rozdielne texty o tom istom nastavení sú spoľahlivý
// spôsob, ako niekomu poradiť dvakrát rozdielne.
import { preskocitVercel, pokynyPreZakaznika } from "../src/lib/vercel.ts"
import { doplnVercelPrihlasenie } from "./lib/vercel-auth.mjs"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const OK = "\x1b[32m✔\x1b[0m", CHYBA = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const CAKA = "\x1b[33m…\x1b[0m"
const VERCEL_API = "https://api.vercel.com"

/** Cieľ, ktorý sa hovorí zákazníkovi. Vercel uvádza ako univerzálny. */
const CNAME_CIEL = "cname.vercel-dns.com"

if (!URI) {
  console.error(`${CHYBA} Chýba MONGODB_URI (app/.env.local alebo export).`)
  process.exit(1)
}

// ── argumenty ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--poslat") { out.poslat = true; continue }
    if (!a.startsWith("--")) continue
    const v = argv[i + 1]
    if (v === undefined || v.startsWith("--")) {
      console.error(`${CHYBA} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    if (a === "--company") out.company = v
    else if (a === "--komu") out.komu = v
    else { console.error(`${CHYBA} Neznámy prepínač ${a}`); process.exit(1) }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

// ── Vercel ───────────────────────────────────────────────────────────────────

const preskocit = preskocitVercel

function vercelToken() {
  return process.env.VERCEL_TOKEN ?? null
}

function vercelProjekt() {
  if (!process.env.VERCEL_PROJECT_ID) return null
  return { projectId: process.env.VERCEL_PROJECT_ID, orgId: process.env.VERCEL_ORG_ID }
}

async function api(token, cesta) {
  const r = await fetch(VERCEL_API + cesta, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { stav: r.status, telo: await r.json().catch(() => ({})) }
}

/**
 * Stav jednej domény. Dva dotazy, lebo Vercel to má na dvoch miestach:
 * „patrí nám" (projekt) a „smeruje sem" (konfigurácia zóny).
 */
async function stavDomeny(token, { projectId, orgId }, host) {
  const t = orgId ? `?teamId=${encodeURIComponent(orgId)}` : ""
  const q = encodeURIComponent(host)
  const vProjekte = await api(token, `/v9/projects/${encodeURIComponent(projectId)}/domains/${q}${t}`)
  const konfig = await api(token, `/v6/domains/${q}/config${t}`)
  return {
    vProjekte: vProjekte.stav === 200,
    overena: vProjekte.telo?.verified === true,
    nastaveneCez: konfig.telo?.configuredBy ?? null,
    konflikty: konfig.telo?.conflicts ?? [],
    odporucanyCname: konfig.telo?.recommendedCNAME?.[0]?.value ?? null,
  }
}

// ── pokyny pre zákazníka ─────────────────────────────────────────────────────

const pokyny = pokynyPreZakaznika

// ── beh ──────────────────────────────────────────────────────────────────────

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(DB).collection("tenants")
  const filter = args.company ? { companyCode: args.company } : {}
  const tenanti = await col.find(filter).sort({ companyCode: 1 }).toArray()

  if (!tenanti.length) {
    console.log(`${INFO} nič sa nenašlo${args.company ? ` pre ${args.company}` : ""}`)
    process.exit(0)
  }

  doplnVercelPrihlasenie()
  const token = vercelToken()
  const projekt = vercelProjekt()
  if (!token || !projekt) {
    console.error(`${CHYBA} bez prihlásenia do Vercelu sa stav domén zistiť nedá`)
    console.error(`     spusti \`vercel login\` alebo nastav VERCEL_TOKEN`)
    process.exit(1)
  }

  /** Domény, ktoré ešte čakajú na zákazníka — kvôli `--poslat`. */
  const cakajuce = []

  for (const t of tenanti) {
    console.log(`\n${t.companyCode} · ${t.branding?.displayName ?? ""}`)
    const kontakt = t.branding?.supportEmail
    console.log(`  kontakt: ${kontakt ?? "(nezadaný — `npm run tenant -- --support`)"}`)
    if (t.domainSetup?.requestedAt) {
      const kedy = new Date(t.domainSetup.requestedAt).toISOString().slice(0, 16).replace("T", " ")
      console.log(`  pokyny poslané: ${kedy} → ${t.domainSetup.requestedTo}`)
    }

    for (const host of t.hostnames ?? []) {
      const preco = preskocit(host)
      if (preco) { console.log(`  ${INFO} ${host} — netreba nič (${preco})`); continue }

      let s
      try {
        s = await stavDomeny(token, projekt, host)
      } catch (e) {
        console.log(`  ${CHYBA} ${host} — stav sa nepodarilo zistiť: ${e.message}`)
        continue
      }

      const ciel = s.odporucanyCname ?? CNAME_CIEL
      if (!s.vProjekte) {
        console.log(`  ${CHYBA} ${host} — NIE JE v projekte vo Verceli`)
        console.log(`      oprav: npm run tenant -- --company ${t.companyCode} --host ${host}`)
        continue
      }
      if (s.konflikty.length) {
        console.log(`  ${CHYBA} ${host} — v zóne sú kolidujúce záznamy: ${s.konflikty.map(k => `${k.type} ${k.value}`).join(", ")}`)
      }
      if (!s.nastaveneCez) {
        console.log(`  ${CAKA} ${host} — čaká na zákazníka: CNAME ${host.split(".")[0]} → ${ciel}`)
        cakajuce.push({ tenant: t, host, ciel })
        continue
      }
      console.log(`  ${OK} ${host} — nastavené (${s.nastaveneCez})${s.overena ? "" : ", ale NEOVERENÉ"}`)
    }
  }

  // ── odoslanie pokynov ──────────────────────────────────────────────────────
  if (!args.poslat) {
    if (cakajuce.length) {
      console.log(`\n${INFO} ${cakajuce.length} doména/y čaká na zákazníka.`)
      console.log(`   Pokyny odošleš: npm run domeny -- --company ${cakajuce[0].tenant.companyCode} --poslat`)
    }
    process.exit(0)
  }

  if (!args.company) {
    console.error(`\n${CHYBA} --poslat vyžaduje --company. Hromadné rozposielanie zámerne nie je.`)
    process.exit(1)
  }
  if (!cakajuce.length) {
    console.log(`\n${INFO} niet čo posielať — všetky domény sú nastavené`)
    process.exit(0)
  }

  const t = cakajuce[0].tenant
  const komu = args.komu ?? t.branding?.supportEmail
  if (!komu) {
    console.error(`\n${CHYBA} nie je kam poslať — doplň --komu alebo \`tenant_set.mjs --support\``)
    process.exit(1)
  }

  for (const { host, ciel } of cakajuce) {
    const p = pokyny(host, ciel)
    await send({
      to: komu,
      subject: p.subject,
      text: p.text,
      html: `<pre style="font:14px ui-monospace,monospace;white-space:pre-wrap">${p.text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
    })
    console.log(`${OK} pokyny pre ${host} odoslané na ${komu}`)
  }

  // Záznam aktu — nie stavu. Čo sme pýtali a kedy; či to zákazník spravil,
  // sa vždy číta naživo z Vercelu.
  await col.updateOne(
    { companyCode: t.companyCode },
    {
      $set: {
        domainSetup: {
          requestedAt: new Date(),
          requestedTo: komu,
          hostnames: cakajuce.map(c => c.host),
        },
      },
    },
  )
  console.log(`${OK} zaznamenané na tenantovi ${t.companyCode}`)
} catch (e) {
  console.error(`${CHYBA} ${e.message}`)
  process.exit(1)
} finally {
  await client.close()
}
