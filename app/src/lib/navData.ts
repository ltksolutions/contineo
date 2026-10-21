/**
 * navData.ts — role a počty pre navigáciu shellu, na jednom mieste.
 *
 * Bývalo to vnútri `AppShell`; stránka `/more` (NASADENIE, PR 2) potrebuje
 * to isté pole položiek, aby zoznam „Viac" ukazoval presne to, čo lišta —
 * druhá kópia pravidla „kto čo vidí" by sa raz rozišla a v zozname by
 * svietil odkaz do sekcie, do ktorej stránka nepustí.
 *
 * `cache()` preto, aby shell (kreslí lištu) a stránka `/more` (kreslí
 * zoznam) v jednej požiadavke nepočítali dvakrát: role sú lacné porovnania
 * nad `cache()`-ovanou session, ale počty (`pendingForPerson`,
 * `roundsWaitingFor`, `queueCount`) sú skutočné dotazy.
 *
 * Zlyhanie sa berie ako „neukazovať" — rovnako ako v `layout.tsx`. Odkaz,
 * ktorý sa neukázal, je nepohodlie; odkaz, ktorý sa ukázal omylom, je únik.
 * Pri počtoch to isté smerom „bez čísla": navigácia bez štítku je
 * nepohodlie, navigácia, ktorá zhodila obrazovku, je výpadok.
 */

import { helpdeskContext } from "./helpdeskAgents"
import { listTickets } from "./tickets"
import { cache } from "react"
import type { NavFlags, NavCounts } from "@/lib/appNav"
import { hrContext } from "@/lib/hr"
import { peopleContext } from "@/lib/people"
import { libraryContext } from "@/lib/library"
import { evaluationContext, queueCount } from "@/lib/evaluation"
import { dpoContext } from "@/lib/dpo"
import { learningContext } from "@/lib/learning"
import { testsResponsibleFor } from "@/lib/testsDb"
import { currentPerson } from "@/lib/session"
import { pendingForPerson } from "@/lib/pending"
import { roundsWaitingFor } from "@/lib/approvalsDb"
import { unreadThreadCount } from "@/lib/courier"
import { isComplianceReviewer } from "@/lib/complianceAccess"
import { openRequests } from "@/lib/complianceRequests"
import { pendingCurations } from "@/lib/curation"

export interface ShellNavData {
  flags: NavFlags
  counts: NavCounts
}

export const shellNavData = cache(async (): Promise<ShellNavData> => {
  const flags: NavFlags = {}
  try {
    flags.isHr = (await hrContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu HR sa nepodarilo overiť:", e)
  }
  try {
    flags.isPeopleAdmin = (await peopleContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu správy osôb sa nepodarilo overiť:", e)
  }
  try {
    flags.isContentManager = (await libraryContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu správy obsahu sa nepodarilo overiť:", e)
  }
  try {
    flags.isEvaluator = (await evaluationContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu hodnotiteľa sa nepodarilo overiť:", e)
  }
  try {
    const person = await currentPerson()
    flags.isCompliance = Boolean(person && isComplianceReviewer(person))
  } catch (e) {
    console.error("[shell] rolu compliance sa nepodarilo overiť:", e)
  }
  try {
    flags.isDpo = (await dpoContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu DPO sa nepodarilo overiť:", e)
  }
  let helpdesk: Awaited<ReturnType<typeof helpdeskContext>> | null = null
  try {
    helpdesk = await helpdeskContext()
    flags.isHelpdesk = helpdesk.state === "ready" && helpdesk.channels.length > 0
  } catch (e) {
    console.error("[shell] rolu helpdesku sa nepodarilo overiť:", e)
  }
  try {
    const learning = await learningContext()
    flags.learning = learning.state === "ready"
    flags.isLearningAdmin = learning.state === "ready" && learning.isAdmin
    if (learning.state === "ready" && !learning.isAdmin) {
      flags.isTestResponsible = (await testsResponsibleFor(learning.person.companyCode, learning.person.id)).length > 0
    }
  } catch (e) {
    console.error("[shell] modul Vzdelávanie sa nepodarilo overiť:", e)
  }

  /*
   * Počty idú z tých istých funkcií, ktoré kreslia obrazovky, na ktoré
   * odkazujú — číslo, ktoré po kliknutí nesedí s tým, čo tam človek uvidí,
   * je horšie než žiadne.
   */
  const counts: NavCounts = {}
  try {
    const person = await currentPerson()
    if (person) {
      const [pending, rounds] = await Promise.all([
        pendingForPerson(person),
        roundsWaitingFor(person.companyCode, person.email),
      ])
      counts.toAcknowledge = pending.total
      counts.toApprove = rounds.length
      // Neprečítané vlákna Kuriéra (ADR-033) — to isté číslo ako na obálke
      // v hlavičke; `unreadThreadCount()` nikdy nevyhodí výnimku.
      counts.courier = await unreadThreadCount(person.companyCode, person.id)
      // Počíta sa len tomu, kto frontu vôbec vidí — cudzie čakajúce
      // odpovede nikomu inému nič nehovoria a je to dotaz navyše.
      if (flags.isEvaluator) counts.evaluation = await queueCount(person.companyCode)
      // Overené odpovede na zverejnenie (D11) a požiadavky „Čaká na kontrolu"
      // (D200) — to isté číslo, ktoré bolo do 21. 10. 2026 v dlaždici Prehľadu.
      if (flags.isContentManager) counts.curation = (await pendingCurations(person.companyCode)).length
      if (flags.isCompliance) counts.compliance = (await openRequests(person.companyCode)).length
      // Otvorené tickety kanálov riešiteľa (ADR-028, D170) — tá istá fronta
      // ako „Moje tickety" na `/channels/tickets`. Správcovi bez riešiteľstva
      // sa nepočíta: nie je to jeho práca.
      if (helpdesk?.state === "ready" && helpdesk.channels.length) {
        counts.channels = (await listTickets(person.companyCode, helpdesk.channels.map(c => c.key), "open")).length
      }
    }
  } catch (e) {
    console.error("[shell] počty pre navigáciu sa nepodarilo zistiť:", e)
  }

  return { flags: flags, counts: counts }
})
