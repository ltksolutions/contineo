/**
 * tenant_set.mjs — založenie a úprava tenanta (D29).
 *
 *     npm run tenant                     # výpis stavu
 *     npm run tenant -- --company SFZ \
 *       --host intranet.futbalsfz.sk --name "Slovenský futbalový zväz"
 *
 * `tenants` je jediné miesto, kde je napísané, ktorá doména patrí komu.
 * Neznámy hostiteľ sa správa ako zakázaný (`src/lib/tenants.ts`), takže
 * **pridanie domény vo Verceli samo o sebe nič nesprístupní** — a naopak.
 *
 * **Skript už neobsahuje žiadne pravidlo.** Kontrola vlastníctva domén,
 * normalizácia mien aj priradenie domény projektu žijú v `src/lib/` a volajú
 * ich rovnako obrazovka správy tenantov aj tento skript. Kým to tak nebolo,
 * existovali dve kópie toho istého pravidla — a druhá kópia pravidla o tom,
 * komu doména patrí, je presne to, čo nesmie vzniknúť.
 */

import {
  allTenants,
  createTenant,
  saveTenant,
  normalizeHostnames,
  DomainOwnedError,
  TenantValidationError,
} from "../src/lib/tenantAdmin.ts"
import { pridajDomenu } from "../src/lib/vercel.ts"
import { addVercelAuth } from "./lib/vercel-auth.mjs"

// `lib/vercel.ts` číta výhradne premenné prostredia — na serveri iná možnosť
// nie je. Na vývojárskom stroji ich doplníme z toho, čo si uložilo `vercel
// login`, aby skript nepýtal token zvlášť.
addVercelAuth()

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Nastav ju v app/.env.local alebo:`)
  console.error(`     export MONGODB_URI="mongodb+srv://..."`)
  process.exit(1)
}

/** `--host` sa smie opakovať; ostatné prepíšu predchádzajúcu hodnotu. */
function parseArgs(argv) {
  const out = { hosts: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--stav") { out.status = true; continue }
    if (a === "--no-vercel") { out.noVercel = true; continue }
    if (!a.startsWith("--")) continue
    const value = argv[i + 1]
    if (value === undefined || value.startsWith("--")) {
      console.error(`${FAIL} Prepínač ${a} potrebuje hodnotu`)
      process.exit(1)
    }
    i++
    switch (a) {
      case "--company": out.company = value; break
      case "--host": out.hosts.push(value); break
      case "--name": out.name = value; break
      case "--short": out.short = value; break
      case "--logo": out.logo = value; break
      case "--accent": out.accent = value; break
      case "--support": out.support = value; break
      case "--language": out.language = value; break
      case "--languages": out.languages = value.split(",").map(s => s.trim()); break
      case "--disable": out.disable = value === "true" || value === "1"; break
      default:
        console.error(`${FAIL} Neznámy prepínač ${a}`)
        process.exit(1)
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const ACTOR = process.env.USER ? `${process.env.USER}@cli` : "cli"

function print(t) {
  const mark = t.status === "active" ? OK : INFO
  console.log(`${mark} ${t.companyCode} · ${t.branding?.displayName ?? ""} · ${t.status}`)
  console.log(`   domény: ${(t.hostnames ?? []).join(", ") || "(žiadne)"}`)
  console.log(`   jazyky: ${(t.languages ?? []).join(", ")} (predvolený ${t.defaultLanguage})`)
}

try {
  if (args.status || !args.company) {
    const all = await allTenants()
    if (!all.length) {
      console.log(`${INFO} kolekcia tenants je prázdna — na žiadnej doméne sa nič neukáže`)
    }
    all.forEach(print)
    if (!args.company) {
      console.log(`\n${INFO} bez --company sa nič nemení`)
      process.exit(0)
    }
  }

  const hostnames = normalizeHostnames(args.hosts)
  const change = {
    ...(hostnames.length ? { hostnames } : {}),
    ...(args.name !== undefined ? { displayName: args.name } : {}),
    ...(args.short !== undefined ? { shortName: args.short } : {}),
    ...(args.logo !== undefined ? { logoUrl: args.logo } : {}),
    ...(args.accent !== undefined ? { accentColor: args.accent } : {}),
    ...(args.support !== undefined ? { supportEmail: args.support } : {}),
    ...(args.language ? { defaultLanguage: args.language } : {}),
    ...(args.languages ? { languages: args.languages } : {}),
    ...(args.disable !== undefined ? { status: args.disable ? "disabled" : "active" } : {}),
  }

  const already = (await allTenants()).some(t => t.companyCode === args.company.toUpperCase())
  const after = already
    ? await saveTenant(args.company, change, ACTOR)
    : await createTenant(args.company, { ...change, displayName: args.name ?? args.company }, ACTOR)

  console.log(`${OK} ${already ? "upravený" : "založený"} tenant ${after.companyCode}`)
  print(after)

  // Až po uloženom tenantovi: `tenants` je zdroj pravdy a výpadok cudzieho
  // API nesmie brániť organizáciu založiť.
  if (args.noVercel) {
    if (hostnames.length) console.log(`${INFO} --no-vercel: domény pridaj do Vercelu ručne`)
  } else {
    for (const h of after.hostnames) {
      const v = await pridajDomenu(h)
      if (v.stav === "preskocena") console.log(`${INFO} ${h} — vo Verceli netreba (${v.dovod})`)
      else if (v.stav === "pridana") {
        console.log(`${OK} ${h} pridaná do projektu vo Verceli`)
        console.log(`   Zákazník nech nastaví: CNAME ${h.split(".")[0]} → cname.vercel-dns.com`)
      } else if (v.stav === "uz-je") console.log(`${OK} ${h} už v projekte je`)
      else if (v.stav === "bez-nastavenia") {
        console.error(`${FAIL} ${h}: chýba VERCEL_TOKEN — doménu pridaj ručne (tenant je uložený)`)
      } else if (v.stav === "neplatny-token") {
        console.error(`${FAIL} ${h}: Vercel token neprijal (tenant je uložený).`)
        console.error(`     Hodnota z \`vercel login\` vyprší; na stálu prevádzku si vytvor`)
        console.error(`     vlastný token vo Verceli a daj ho do app/.env.local ako VERCEL_TOKEN.`)
      } else console.error(`${FAIL} ${h}: ${v.sprava} (tenant je uložený)`)
    }
  }
  process.exit(0)
} catch (e) {
  if (e instanceof DomainOwnedError) {
    console.error(`${FAIL} ${e.message}`)
    console.error(`     Najprv ju odober tam, potom prirad sem. Nič sa nezapísalo.`)
  } else if (e instanceof TenantValidationError) {
    console.error(`${FAIL} ${e.message}`)
  } else {
    console.error(`${FAIL} ${e.message}`)
  }
  process.exit(1)
}
