/**
 * routeOrigin.test.ts — cesty, ktoré zapisujú v mene prihláseného, odmietnu
 * požiadavku z cudzej stránky **skôr, než sa pozrú na reláciu** (CSRF).
 *
 * Serverové akcie Nextu pôvod kontrolujú samy, route handlery nie. Test
 * stráži, aby kontrola nevypadla pri ďalšej úprave cesty — a aby stála pred
 * `onboardingContext()`: odmietnutie po prečítaní relácie by pri `chat`
 * znamenalo, že cudzia stránka sa aspoň dozvie, či je človek prihlásený.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const session = vi.hoisted(() => ({
  onboardingContext: vi.fn(async () => ({ state: "not-signed-in" })),
}))
// Celý modul, nie len jedna funkcia: pôvodný potrebuje `cache()` zo servera
// Reactu, ktorý v teste nie je.
vi.mock("@/lib/session", () => ({
  onboardingContext: session.onboardingContext,
  currentPerson: vi.fn(async () => null),
  currentEmail: vi.fn(async () => null),
  currentTenant: vi.fn(async () => null),
  requestHostname: vi.fn(async () => "intranet.futbalsfz.sk"),
}))

import { POST as acknowledgementsPost } from "../src/app/api/acknowledgements/route"
import { POST as readingPost } from "../src/app/api/reading/route"
import { POST as ratingPost, PATCH as ratingPatch } from "../src/app/api/rating/route"
import { POST as chatPost } from "../src/app/api/chat/route"
import { NextRequest } from "next/server"

const HOST = "intranet.futbalsfz.sk"

function request(url: string, origin: string | null, method = "POST"): NextRequest {
  const headers: Record<string, string> = { host: HOST, "content-type": "application/json" }
  if (origin) headers.origin = origin
  return new NextRequest(`https://${HOST}${url}`, { method, headers, body: "{}" })
}

const HANDLERS: [string, (r: NextRequest) => Promise<Response | undefined>, string, string?][] = [
  ["POST /api/acknowledgements", r => acknowledgementsPost(r), "/api/acknowledgements"],
  ["POST /api/reading", r => readingPost(r), "/api/reading"],
  ["POST /api/rating", r => ratingPost(r), "/api/rating"],
  ["PATCH /api/rating", r => ratingPatch(r), "/api/rating", "PATCH"],
  ["POST /api/chat", r => chatPost(r), "/api/chat"],
]

beforeEach(() => session.onboardingContext.mockClear())

describe("kontrola pôvodu na cestách, ktoré zapisujú", () => {
  for (const [name, handler, url, method] of HANDLERS) {
    it(`${name}: cudzia stránka dostane 403 a relácia sa ani nečíta`, async () => {
      const r = await handler(request(url, "https://zly.example", method))
      expect(r?.status).toBe(403)
      expect(session.onboardingContext).not.toHaveBeenCalled()
    })

    it(`${name}: bez hlavičky Origin tiež 403`, async () => {
      const r = await handler(request(url, null, method))
      expect(r?.status).toBe(403)
    })

    it(`${name}: vlastná stránka prejde ku kontrole prihlásenia`, async () => {
      const r = await handler(request(url, `https://${HOST}`, method))
      expect(r?.status).not.toBe(403)
      expect(session.onboardingContext).toHaveBeenCalled()
    })
  }
})
