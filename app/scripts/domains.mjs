/**
 * domains.mjs — v akom stave sú domény tenantov a čo ešte čaká na zákazníka.
 *
 *     npm run domains                       # prehľad všetkých
 *     npm run domains -- --company SFZ      # jeden tenant
 *     npm run domains -- --company KLUB --poslat        # odošle pokyny
 *     npm run domains -- --company KLUB --poslat --komu it@klub.sk
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

import { MongoClient } from "mongodb"
import { send } from "../src/lib/ecomail.ts"
// Pravidlá o doménach majú jednu definíciu — v `lib/`. Skript ich volá,
// nekopíruje: dva rozdielne texty o tom istom nastavení sú spoľahlivý
// spôsob, ako niekomu poradiť dvakrát rozdielne.
import { preskocitVercel, pokynyPreZakaznika } from "../src/lib/vercel.ts"
import { addVercelAuth } from "./lib/vercel-auth.mjs"

const URI = process.env.MONGODB_URI
const DB = process.env.MONGODB_DB ?? "contineo"
const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const WAITING = "\x1b[33m…\x1b[0m"
const VERCEL_API = "https://api.vercel.com"

/** Cieľ, ktorý sa hovorí zákazníkovi. Vercel uvádza ako univerzálny. */
const CNAME_TARGET = "cname.vercel-dns.com"

if (!URI) {
  console.error(`${FAIL} Chýba MONGODB_URI (app/.env.local alebo export).`)
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
      console.error(`${FAIL} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    if (a === "--company") out.company = v
    else if (a === "--komu") out.komu = v
    else { console.error(`${FAIL} Neznámy prepínač ${a}`); process.exit(1) }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

// ── Vercel ───────────────────────────────────────────────────────────────────

const skip = preskocitVercel

function vercelToken() {
  return process.env.VERCEL_TOKEN ?? null
}

function vercelProject() {
  if (!process.env.VERCEL_PROJECT_ID) return null
  return { projectId: process.env.VERCEL_PROJECT_ID, orgId: process.env.VERCEL_ORG_ID }
}

async function api(token, path) {
  const r = await fetch(VERCEL_API + path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { stav: r.status, telo: await r.json().catch(() => ({})) }
}

/**
 * Stav jednej domény. Dva dotazy, lebo Vercel to má na dvoch miestach:
 * „patrí nám" (projekt) a „smeruje sem" (konfigurácia zóny).
 */
async function domainStatus(token, { projectId, orgId }, host) {
  const t = orgId ? `?teamId=${encodeURIComponent(orgId)}` : ""
  const q = encodeURIComponent(host)
  const inProject = await api(token, `/v9/projects/${encodeURIComponent(projectId)}/domains/${q}${t}`)
  const config = await api(token, `/v6/domains/${q}/config${t}`)
  return {
    vProjekte: inProject.stav === 200,
    overena: inProject.telo?.verified === true,
    nastaveneCez: config.telo?.configuredBy ?? null,
    konflikty: config.telo?.conflicts ?? [],
    odporucanyCname: config.telo?.recommendedCNAME?.[0]?.value ?? null,
  }
}

// ── pokyny pre zákazníka ─────────────────────────────────────────────────────

const instructions = pokynyPreZakaznika

// ── beh ──────────────────────────────────────────────────────────────────────

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const col = client.db(DB).collection("tenants")
  const filter = args.company ? { companyCode: args.company } : {}
  const tenants = await col.find(filter).sort({ companyCode: 1 }).toArray()

  if (!tenants.length) {
    console.log(`${INFO} nič sa nenašlo${args.company ? ` pre ${args.company}` : ""}`)
    process.exit(0)
  }

  addVercelAuth()
  const token = vercelToken()
  const project = vercelProject()
  if (!token || !project) {
    console.error(`${FAIL} bez prihlásenia do Vercelu sa stav domén zistiť nedá`)
    console.error(`     spusti \`vercel login\` alebo nastav VERCEL_TOKEN`)
    process.exit(1)
  }

  /** Domény, ktoré ešte čakajú na zákazníka — kvôli `--poslat`. */
  const pending = []

  for (const t of tenants) {
    console.log(`\n${t.companyCode} · ${t.branding?.displayName ?? ""}`)
    const contact = t.branding?.supportEmail
    console.log(`  kontakt: ${contact ?? "(nezadaný — `npm run tenant -- --support`)"}`)
    if (t.domainSetup?.requestedAt) {
      const when = new Date(t.domainSetup.requestedAt).toISOString().slice(0, 16).replace("T", " ")
      console.log(`  pokyny poslané: ${when} → ${t.domainSetup.requestedTo}`)
    }

    for (const host of t.hostnames ?? []) {
      const why = skip(host)
      if (why) { console.log(`  ${INFO} ${host} — netreba nič (${why})`); continue }

      let s
      try {
        s = await domainStatus(token, project, host)
      } catch (e) {
        console.log(`  ${FAIL} ${host} — stav sa nepodarilo zistiť: ${e.message}`)
        continue
      }

      const target = s.odporucanyCname ?? CNAME_TARGET
      if (!s.vProjekte) {
        console.log(`  ${FAIL} ${host} — NIE JE v projekte vo Verceli`)
        console.log(`      oprav: npm run tenant -- --company ${t.companyCode} --host ${host}`)
        continue
      }
      if (s.konflikty.length) {
        console.log(`  ${FAIL} ${host} — v zóne sú kolidujúce záznamy: ${s.konflikty.map(k => `${k.type} ${k.value}`).join(", ")}`)
      }
      if (!s.nastaveneCez) {
        console.log(`  ${WAITING} ${host} — čaká na zákazníka: CNAME ${host.split(".")[0]} → ${target}`)
        pending.push({ tenant: t, host, ciel: target })
        continue
      }
      console.log(`  ${OK} ${host} — nastavené (${s.nastaveneCez})${s.overena ? "" : ", ale NEOVERENÉ"}`)
    }
  }

  // ── odoslanie pokynov ──────────────────────────────────────────────────────
  if (!args.poslat) {
    if (pending.length) {
      console.log(`\n${INFO} ${pending.length} doména/y čaká na zákazníka.`)
      console.log(`   Pokyny odošleš: npm run domains -- --company ${pending[0].tenant.companyCode} --poslat`)
    }
    process.exit(0)
  }

  if (!args.company) {
    console.error(`\n${FAIL} --poslat vyžaduje --company. Hromadné rozposielanie zámerne nie je.`)
    process.exit(1)
  }
  if (!pending.length) {
    console.log(`\n${INFO} niet čo posielať — všetky domény sú nastavené`)
    process.exit(0)
  }

  const t = pending[0].tenant
  const to = args.komu ?? t.branding?.supportEmail
  if (!to) {
    console.error(`\n${FAIL} nie je kam poslať — doplň --komu alebo \`tenant_set.mjs --support\``)
    process.exit(1)
  }

  for (const { host, ciel: target } of pending) {
    const p = instructions(host, target)
    await send({
      to: to,
      subject: p.subject,
      text: p.text,
      html: `<pre style="font:14px ui-monospace,monospace;white-space:pre-wrap">${p.text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
    })
    console.log(`${OK} pokyny pre ${host} odoslané na ${to}`)
  }

  // Záznam aktu — nie stavu. Čo sme pýtali a kedy; či to zákazník spravil,
  // sa vždy číta naživo z Vercelu.
  await col.updateOne(
    { companyCode: t.companyCode },
    {
      $set: {
        domainSetup: {
          requestedAt: new Date(),
          requestedTo: to,
          hostnames: pending.map(c => c.host),
        },
      },
    },
  )
  console.log(`${OK} zaznamenané na tenantovi ${t.companyCode}`)
} catch (e) {
  console.error(`${FAIL} ${e.message}`)
  process.exit(1)
} finally {
  await client.close()
}
