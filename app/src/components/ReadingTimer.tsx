"use client"

/**
 * Merač času nad dokumentom (O14).
 *
 * Tri veci, ktoré ho odlišujú od naivného `setInterval`:
 *
 *  1. **Počíta sa len viditeľný čas.** Karta na pozadí sa nepočíta. Bez toho
 *     by údaj meral, ako dlho mal človek otvorený prehliadač, nie ako dlho
 *     čítal — a to je iná veličina s tým istým názvom.
 *  2. **Posiela sa priebežne aj pri odchode.** Väčšina ľudí kartu zavrie, nie
 *     potvrdí; keby sa posielalo len pri potvrdení, chýbal by čas práve tým,
 *     ktorí dokument nedočítali.
 *  3. **Odchod ide cez `sendBeacon()`.** Bežný `fetch()` prehliadač pri
 *     zatváraní karty zruší. `sendBeacon` je jediný spôsob, ako sa požiadavka
 *     ešte odošle.
 *
 * Číslo je na obrazovke vidieť **zámerne**. Meranie, o ktorom sa človek
 * dozvie až zo zásad ochrany údajov, je presne to, čo pri audite robí
 * problém — a keďže údaj nemá následok, nie je dôvod ho tajiť ani ho
 * podvádzať.
 */

import { useEffect, useRef, useState } from "react"
import { dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"

/** Ako často sa priebežne posiela. Menej často = menej presné pri páde karty. */
const SEND_EVERY_SECONDS = 30

/**
 * Prichádza **jazyk, nie hotové texty**.
 *
 * Pôvodne sa sem posielal objekt s funkciami (`seconds`, `minutes`,
 * `elapsed`) zo serverového komponentu. To nefunguje: cez hranicu server →
 * klient sa funkcie preniesť nedajú a React to odmietne až **za behu**
 * („Functions cannot be passed directly to Client Components"). Build ani
 * typy na to neupozornia — stránka sa jednoducho nenačíta.
 *
 * Tvary čísloviek sa navyše musia počítať z aktuálneho počtu sekúnd, ktorý
 * beží až tu. Hotový reťazec zo servera by po pár sekundách klamal.
 *
 * Slovník si preto komponent načíta sám, rovnako ako `Rating.tsx`,
 * `Search.tsx` a ďalších osem klientských komponentov — do balíka tým
 * nepribúda nič, čo tam už nie je.
 */
export default function ReadingTimer({
  documentId,
  language,
}: {
  documentId: string
  language: UiLanguage
}) {
  const t = dictionary(language).onboarding
  const [seconds, setSeconds] = useState(0)
  const sent = useRef(0)
  const current = useRef(0)

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return
      current.current += 1
      setSeconds(current.current)
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const url = "/api/reading"

    const send = (beacon: boolean) => {
      const value = current.current
      // Nič nové sa nenačítalo — netreba budiť server.
      if (value <= sent.current) return
      sent.current = value
      const payload = JSON.stringify({ documentId, seconds: value })
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))
        return
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Meranie bez následku nemá prečo hlásiť chybu človeku, ktorý číta
        // smernicu. Pri ďalšom odoslaní sa pošle vyššia hodnota a chýbajúci
        // pokus sa tým dorovná.
        sent.current = 0
      })
    }

    const id = window.setInterval(() => send(false), SEND_EVERY_SECONDS * 1000)

    // `visibilitychange` na `hidden` je jediná udalosť, ktorá spoľahlivo príde
    // aj vtedy, keď človek kartu zavrie alebo prepne aplikáciu na telefóne.
    // `beforeunload` na mobiloch často nepríde vôbec.
    const onHide = () => {
      if (document.visibilityState === "hidden") send(true)
    }
    document.addEventListener("visibilitychange", onHide)

    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onHide)
      send(true)
    }
  }, [documentId])

  const formatted = seconds < 60
    ? t.readingSeconds(seconds)
    : t.readingMinutes(Math.round(seconds / 60))

  return (
    <p className="tichy" style={{ fontSize: 13, margin: "12px 0 0" }}>
      {t.readingElapsed(formatted)} <span style={{ opacity: 0.8 }}>{t.readingNote}</span>
    </p>
  )
}
