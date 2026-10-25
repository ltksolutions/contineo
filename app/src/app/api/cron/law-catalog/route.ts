/**
 * GET /api/cron/law-catalog — denná kontrola katalógu legislatívy (ADR-039, D261).
 *
 * Jeden cron platformy namiesto kroku C per organizácia (ADR-037 D247):
 * prejde predpisy v katalógu, prečíta históriu na Slov-Lexe, stiahne
 * znenia, ktoré v katalógu nie sú (aj s účinnosťou v budúcnosti), a znovu
 * stiahne znenie účinné dnes, aby sa chytila oprava textu na portáli.
 * Katalóg nie je dôkazný záznam (D257), preto sa prepisuje bez pýtania.
 *
 * Po kontrole katalógu prejde dokumenty knižníc so sledovaným zdrojom
 * (fáza 2, D260): novšie znenie je koncept nového znenia v tej knižnici
 * a správcovia obsahu dostanú upozornenie.
 *
 * Beh je chránený `CRON_SECRET` ako ostatné crony: bez neho by to bol
 * verejný odkaz, ktorý na povel sťahuje megabajty z cudzieho portálu.
 */

import { NextResponse } from "next/server"
import { getCollection } from "@/lib/mongodb"
import { LAW_ACTS_COLLECTION, syncAct, type LawAct, type SyncOutcome } from "@/lib/lawCatalog"
import { draftNewVersionsFromCatalog } from "@/lib/webImport"

export const dynamic = "force-dynamic"
/** Každé znenie je 1,4 MB HTML a rez; strop stiahnutí na predpis drží beh pod minútou. */
export const maxDuration = 300

/** Najviac stiahnutí na jeden predpis a beh; zvyšok histórie príde ďalší deň. */
const DOWNLOADS_PER_ACT = 4

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const now = new Date()
  // Najdlhšie nekontrolované prvé — keď beh nestihne všetko, ďalší deň pokračuje tam, kde skončil.
  const acts = await (await getCollection<LawAct>(LAW_ACTS_COLLECTION))
    .find({}, { projection: { actId: 1, lastCheckedAt: 1 } }).sort({ lastCheckedAt: 1 }).toArray()

  const report: SyncOutcome[] = []
  for (const act of acts) {
    report.push(await syncAct(act.actId, now, DOWNLOADS_PER_ACT))
  }
  const failed = report.filter(r => r.error).length
  const drafts = await draftNewVersionsFromCatalog(now)
  console.log(`[legislativa] cron: ${report.length} predpisov, ${report.reduce((n, r) => n + r.added.length, 0)} nových znení, ${failed} chýb; koncepty v knižniciach: ${drafts.filter(d => d.result !== "error").length}, chyby: ${drafts.filter(d => d.result === "error").length}`)
  return NextResponse.json({ ok: true, acts: report.length, failed, report, drafts })
}
