/**
 * vercel-auth.mjs — doplní prihlásenie do Vercelu z lokálneho stroja.
 *
 * `src/lib/vercel.ts` číta výhradne premenné prostredia. Je to zámerné: na
 * serveri iná možnosť nie je a čítať cudzie súbory z aplikácie by bolo
 * nesprávne. Skript na vývojárskom stroji ale nemá dôvod pýtať si token
 * zvlášť — `vercel login` už prebehol.
 *
 * Preto tento most: prečíta, čo si uložilo CLI, a **doplní** to do prostredia.
 * Existujúce premenné neprepisuje, takže `VERCEL_TOKEN` v `.env.local` alebo
 * v CI má vždy prednosť.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

function token() {
  for (const p of [
    path.join(os.homedir(), "Library", "Application Support", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".vercel", "auth.json"),
  ]) {
    try {
      const t = JSON.parse(fs.readFileSync(p, "utf8")).token
      if (t) return t
    } catch { /* ďalší kandidát */ }
  }
  return null
}

/** `.vercel/project.json` býva v koreni repozitára, skripty bežia v `app/`. */
function project() {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, ".vercel", "project.json"), "utf8"))
      if (j.projectId) return j
    } catch { /* o úroveň vyššie */ }
    const up = path.dirname(dir)
    if (up === dir) break
    dir = up
  }
  return null
}

/** Vráti `true`, keď je po jeho behu prostredie na volanie Vercelu pripravené. */
export function addVercelAuth() {
  if (!process.env.VERCEL_TOKEN) {
    const t = token()
    if (t) process.env.VERCEL_TOKEN = t
  }
  if (!process.env.VERCEL_PROJECT_ID) {
    const p = project()
    if (p) {
      process.env.VERCEL_PROJECT_ID = p.projectId
      if (p.orgId && !process.env.VERCEL_ORG_ID) process.env.VERCEL_ORG_ID = p.orgId
    }
  }
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID)
}
