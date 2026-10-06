import { describe, it, expect } from "vitest"
import { isFormPending, setFormPending, subscribeFormPending } from "@/lib/formPending"

describe("formPending — stav formulára pre tlačidlo mimo neho", () => {
  it("zapíše, ohlási a zhodí stav podľa id formulára", () => {
    let calls = 0
    const off = subscribeFormPending(() => { calls++ })

    expect(isFormPending("remove-logo")).toBe(false)
    setFormPending("remove-logo", true)
    expect(isFormPending("remove-logo")).toBe(true)
    expect(isFormPending("remove-ai-key")).toBe(false)

    // Tá istá hodnota znova = žiadne zbytočné prekreslenie.
    setFormPending("remove-logo", true)
    expect(calls).toBe(1)

    setFormPending("remove-logo", false)
    expect(isFormPending("remove-logo")).toBe(false)
    expect(calls).toBe(2)

    off()
    setFormPending("remove-logo", true)
    expect(calls).toBe(2)
    setFormPending("remove-logo", false)
  })
})
