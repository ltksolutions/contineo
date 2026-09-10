/**
 * WaitingForApproval.tsx — „čaká na schválenie" nad knižnicou (ADR-006, krok 6).
 *
 * **Zoznam, nie počet.** Návrh má na Prehľade dlaždicu s číslom; číslo samo
 * ale hovorí len to, že sa niečo deje. Predkladateľ potrebuje vedieť, na koho
 * sa čaká a ako dlho — to je jediné, s čím vie niečo urobiť.
 *
 * Kým Prehľad neexistuje, býva to nad knižnicou: je to obrazovka správcu
 * obsahu, teda toho, kto znenia predkladá. Keď Prehľad vznikne, presunie sa
 * tam ten istý komponent nad tou istou funkciou — dva pohľady, ktoré si to
 * isté počítajú každý po svojom, sa raz rozídu.
 */

import Link from "next/link"
import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import { pendingApprovers, type ApprovalRound } from "@/lib/approvals"

export default function WaitingForApproval({
  rounds,
  titles,
  language,
}: {
  rounds: ApprovalRound[]
  /** Názvy dokumentov. Kolo nesie `documentId`, názov je vec dokumentu. */
  titles: Map<string, string>
  language: UiLanguage
}) {
  if (rounds.length === 0) return null
  const t = dictionary(language).library.list.waiting

  return (
    <section className="card waiting" aria-labelledby="waiting-heading">
      <div className="waiting-head">
        <h2 id="waiting-heading" className="waiting-title">{t.heading}</h2>
        <span className="tag">{t.count(rounds.length)}</span>
      </div>

      <ul className="waiting-list">
        {rounds.map(r => {
          const pending = pendingApprovers(r)
          return (
            <li key={`${r.documentId}-${r.versionId}-${r.round}`} className="waiting-item">
              <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="waiting-name">
                {titles.get(r.documentId) ?? r.documentId}
              </Link>
              <span className="quiet waiting-meta">
                {t.since(formatDate(r.submittedAt, language))}
                {" · "}
                {/*
                  Menovite, nie „čaká sa na 2 ľudí". Kolo je zoznam konkrétnych
                  ľudí (D69) a otázka „na koho sa čaká" má mať odpoveď menom —
                  inak sa nedá urobiť to jediné, čo pomôže: opýtať sa ich.
                */}
                {pending.length === 0
                  ? t.nobodyPending
                  : t.waitingFor(pending.map(a => a.fullName).join(", "))}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
