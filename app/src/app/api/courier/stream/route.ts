/**
 * Živé spojenie Kuriéra (ADR-033, D210) — Server-Sent Events.
 *
 * Prehliadač (`EventSource`) sa pripojí, keď má človek otvorený Kuriér;
 * mimo neho sa spojenie nedrží. Beží do 55 s (`maxDuration = 60`), potom
 * sa prehliadač pripojí znova sám. Udalosti skladá `lib/courierLive.ts`;
 * tu je len prihlásenie, obálka SSE a udržiavací riadok každých 15 s.
 *
 * Čítanie bez `Origin`: `EventSource` ho pri rovnakom pôvode neposiela
 * a cookie cez cudziu stránku neprejde (`SameSite`). Zapisujúce cesty
 * (`typing`, `read`) pôvod kontrolujú.
 */

import type { NextRequest } from "next/server"
import { onboardingContext } from "@/lib/session"
import { liveEvents } from "@/lib/courierLive"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") return new Response(null, { status: 404 })
  if (ctx.state === "not-signed-in") return new Response("not-signed-in", { status: 401 })
  if (ctx.state !== "ready") return new Response("not-in-tenant", { status: 403 })

  const threadId = req.nextUrl.searchParams.get("thread")
  const sinceRaw = req.nextUrl.searchParams.get("since")
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : undefined
  const input = { companyCode: ctx.person.companyCode, personId: ctx.person.id, threadId: threadId || null }

  const enc = new TextEncoder()
  const abort = new AbortController()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const write = (s: string) => { if (closed) return; try { controller.enqueue(enc.encode(s)) } catch { closed = true } }
      const ping = setInterval(() => write(": ping\n\n"), 15_000)
      try {
        for await (const e of liveEvents(input, { signal: abort.signal, since })) {
          write(`data: ${JSON.stringify(e)}\n\n`)
        }
      } catch (e) {
        console.error("[courier] živé spojenie zlyhalo:", e)
      } finally {
        clearInterval(ping)
        closed = true
        try { controller.close() } catch { /* už zavreté */ }
      }
    },
    cancel() { abort.abort() },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  })
}
