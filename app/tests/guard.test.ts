import {
  embeddingSpace, isCompatible, assertEmbeddingSpace, embeddingStats,
  EmbeddingSpaceMismatchError,
} from "../src/lib/embeddingGuard"

import { t } from "./helper"

const chunk = (id: string, model?: string): any => ({
  _id: id, text: "x", documentId: "d", embeddingModel: model,
})

function hodi(fn: () => unknown): Error | null {
  try { fn(); return null } catch (e) { return e as Error }
}

// ── zdieľaný priestor rodiny voyage-4 ────────────────────────────────────
t("voyage-4 a voyage-4-nano su kompatibilne", isCompatible("voyage-4", "voyage-4-nano"))
t("voyage-4-large a voyage-4-lite su kompatibilne", isCompatible("voyage-4-large", "voyage-4-lite"))
t("priestor sa normalizuje na 'voyage-4'", embeddingSpace("voyage-4-nano") === "voyage-4")
t("velke pismena nevadia", isCompatible("Voyage-4", "voyage-4-NANO"))
t("medzery nevadia", isCompatible(" voyage-4 ", "voyage-4-lite"))

// ── nekompatibilné modely ────────────────────────────────────────────────
t("voyage-4 a BGE-M3 NIE su kompatibilne", !isCompatible("voyage-4", "BAAI/bge-m3"))
t("neznamy model je sam sebe priestorom", embeddingSpace("BAAI/bge-m3") === "baai/bge-m3")

// ── assertEmbeddingSpace ─────────────────────────────────────────────────
t("zhodny korpus prejde",
  hodi(() => assertEmbeddingSpace([chunk("1", "voyage-4"), chunk("2", "voyage-4")], "voyage-4")) === null)

t("korpus z inej rodiny voyage-4 prejde (zdielany priestor)",
  hodi(() => assertEmbeddingSpace([chunk("1", "voyage-4-nano")], "voyage-4")) === null)

let e = hodi(() => assertEmbeddingSpace([chunk("1", "voyage-4"), chunk("2", "BAAI/bge-m3")], "voyage-4"))
t("zmiesany korpus spadne", e instanceof EmbeddingSpaceMismatchError, String(e))
t("chyba menuje najdeny model", !!e && e.message.includes("BAAI/bge-m3"), String(e?.message))
t("chyba menuje ocakavany model", !!e && e.message.includes("voyage-4"), String(e?.message))
t("chyba odkazuje na reembed skript", !!e && e.message.includes("reembed.mjs"), String(e?.message))
t("chyba uvadza vzorku chunkov", !!e && e.message.includes("2"), String(e?.message))

t("stare chunky bez modelu sa preskocia (backfill ich doplni)",
  hodi(() => assertEmbeddingSpace([chunk("1"), chunk("2", "voyage-4")], "voyage-4")) === null)

t("prazdny korpus prejde", hodi(() => assertEmbeddingSpace([], "voyage-4")) === null)

// ── embeddingStats ───────────────────────────────────────────────────────
const s = embeddingStats(
  [chunk("1", "voyage-4"), chunk("2", "voyage-4-nano"), chunk("3", "BAAI/bge-m3"), chunk("4")],
  "voyage-4"
)
t("stats: spolu", s.spolu === 4, JSON.stringify(s))
t("stats: ok zapocita aj zdielany priestor", s.ok === 2, JSON.stringify(s))
t("stats: nezhodne", s.nezhodne === 1, JSON.stringify(s))
t("stats: bez modelu", s.bezModelu === 1, JSON.stringify(s))
t("stats: zoznam modelov", s.modely.length === 3, JSON.stringify(s))

