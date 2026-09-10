/**
 * evidence.ts — reťaz dôkazov o jednej povinnosti (ADR-005).
 *
 * **Čistá funkcia nad načítanými záznamami**, bez databázy — rovnako ako
 * `due.ts` a `approvals.ts`. Časová os je **pohľad, nie záznam** (D65):
 * neukladá sa nič a potvrdenie zostáva samonosné (D24). Toto len skladá, čo
 * už niekde je.
 *
 * Dve pravidlá, na ktorých celý súbor stojí:
 *
 * **1. Pri každom riadku je vidieť jeho váhu.** Pridelenie, otvorenie
 * a potvrdenie sú dôkazy; čas čítania je meranie na klientovi a `readingTime.ts`
 * o sebe hovorí, že dôkaz nie je. Miešať ich do jedného zoznamu bez rozlíšenia
 * by znamenalo, že sa raz niekto oprie o číslo, ktoré neunesie nič.
 *
 * **2. Chýbajúci riadok sa pomenuje, nevynechá.** Prázdne miesto vyzerá ako
 * zmazaný záznam. Preto tu chýbanie **je** udalosť s vlastným dôvodom: buď sa
 * vtedy ešte nezaznamenávalo, alebo sa meranie po roku zmazalo, alebo sa to
 * jednoducho nestalo.
 */

/**
 * Odkedy sa otvorenia znenia zaznamenávajú. Staršie potvrdenia otvorenie
 * **nemajú a mať nemôžu** — a os to musí povedať, nie mlčať.
 *
 * Dátum sa nedopočítava z dát: „najstaršie otvorenie v databáze" by sa menilo
 * podľa toho, čo sa práve zmazalo, a po prvom vymazaní by os začala tvrdiť
 * niečo iné než včera.
 */
export const OPENS_RECORDED_SINCE = new Date("2026-09-11T00:00:00.000Z")

export type EvidenceKind =
  | "assigned"
  | "notified"
  | "opened"
  | "read"
  | "acknowledged"

/**
 * Čo ten riadok unesie.
 *
 * - `proof` — serverový fakt, trvalý (pridelenie, otvorenie, potvrdenie).
 * - `informative` — meranie na klientovi s ročnou retenciou (čas čítania).
 * - `absent` — nestalo sa to, alebo sa to vtedy nezaznamenávalo. **Je to
 *   údaj**, nie prázdne miesto.
 */
export type EvidenceWeight = "proof" | "informative" | "absent"

/** Prečo riadok chýba. Bez dôvodu je prázdne miesto na nerozoznanie od chyby. */
export type EvidenceGap =
  /** Vtedy sa to ešte nezaznamenávalo. */
  | "before-recording"
  /** Zaznamenávalo sa, ale po roku sa meranie zmazalo (`reading_times` TTL). */
  | "expired"
  /** Jednoducho sa to nestalo — človek to neurobil. */
  | "not-yet"

export interface EvidenceEvent {
  kind: EvidenceKind
  at: Date | null
  weight: EvidenceWeight
  gap?: EvidenceGap
  /** Hodnoty do vety na obrazovke. Text sa skladá až tam, v jazyku človeka. */
  detail?: { by?: string; reason?: string; seconds?: number; count?: number }
}

export interface EvidenceInput {
  /** Odkedy povinnosť pre túto osobu beží (`dateForPerson`), nie `assignedAt`. */
  assignedAt: Date | null
  assignedBy?: string
  reason?: string
  /** Kedy sa jej o povinnosti ozvalo. Prázdne pole znamená „nikdy". */
  notifiedAt?: Date[]
  firstOpenedAt?: Date | null
  /** Sekundy z `reading_times`. `null` znamená „nemáme". */
  readingSeconds?: number | null
  acknowledgedAt?: Date | null
}

/**
 * Zloží časovú os jednej povinnosti.
 *
 * Poradie je **chronologické podľa času**, nie podľa druhu udalosti: reťaz má
 * ukázať, čo sa dialo, nie čo sme si predstavovali, že sa bude diať. Riadky
 * bez času (chýbajúce) idú na miesto, kde by logicky boli.
 */
export function evidenceTimeline(input: EvidenceInput): EvidenceEvent[] {
  const out: EvidenceEvent[] = []

  out.push({
    kind: "assigned",
    at: input.assignedAt,
    weight: input.assignedAt ? "proof" : "absent",
    ...(input.assignedAt ? {} : { gap: "not-yet" as const }),
    detail: {
      ...(input.assignedBy ? { by: input.assignedBy } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  })

  const notified = input.notifiedAt ?? []
  if (notified.length > 0) {
    // Jeden riadok, nie N: „ozvalo sa jej trikrát, naposledy 12. 9." je to,
    // čo človek potrebuje vedieť. Tri riadky by z osi spravili log.
    out.push({
      kind: "notified",
      at: notified[notified.length - 1],
      weight: "proof",
      detail: { count: notified.length },
    })
  }

  const opened = input.firstOpenedAt ?? null
  out.push(
    opened
      ? { kind: "opened", at: opened, weight: "proof" }
      : {
          kind: "opened",
          at: null,
          weight: "absent",
          /*
            Ak povinnosť vznikla skôr, než sa otvorenia zaznamenávali, jej
            chýbanie nič nehovorí o človeku — hovorí o systéme. Zamieňať to
            za „neotvoril" by bolo obvinenie z niečoho, čo sa nedá zistiť.
          */
          gap: startedBeforeRecording(input) ? "before-recording" : "not-yet",
        },
  )

  const seconds = input.readingSeconds ?? null
  out.push(
    seconds !== null
      ? { kind: "read", at: null, weight: "informative", detail: { seconds } }
      : {
          kind: "read",
          at: null,
          weight: "absent",
          /*
            Meranie má ročnú retenciu. Keď povinnosť vznikla pred viac než
            rokom, chýbajúce číslo je **premlčané meranie**, nie „nečítal" —
            a práve to je dôvod, prečo reťaz nestojí na ňom (ADR-005, časť 1).
          */
          gap: olderThanAYear(input.assignedAt) ? "expired" : "not-yet",
        },
  )

  out.push(
    input.acknowledgedAt
      ? { kind: "acknowledged", at: input.acknowledgedAt, weight: "proof" }
      : { kind: "acknowledged", at: null, weight: "absent", gap: "not-yet" },
  )

  return out
}

function startedBeforeRecording(input: EvidenceInput): boolean {
  const start = input.assignedAt
  return start instanceof Date && start.getTime() < OPENS_RECORDED_SINCE.getTime()
}

function olderThanAYear(at: Date | null | undefined): boolean {
  if (!(at instanceof Date)) return false
  const rok = 365 * 24 * 60 * 60 * 1000
  return Date.now() - at.getTime() > rok
}

/**
 * Zhrnutie osi jedným slovom — pre filter a pre stĺpec v zozname.
 *
 * `opened-not-acknowledged` je zámerne vlastný stav, nie „nepotvrdené":
 * je to práve tá otázka, kvôli ktorej reťaz vznikla. Zároveň je to údaj, ktorý
 * má bližšie k hodnoteniu človeka než čokoľvek ostatné — patrí k O14.
 */
export type EvidenceState = "acknowledged" | "opened-not-acknowledged" | "not-opened"

export function evidenceState(input: EvidenceInput): EvidenceState {
  if (input.acknowledgedAt) return "acknowledged"
  return input.firstOpenedAt ? "opened-not-acknowledged" : "not-opened"
}
