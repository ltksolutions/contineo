---
name: typescript-v-skriptoch
description: "Ako skripty v app/scripts/ importujú kód zo src/ — ts-hook.mjs, povinné `import type`, žiadny bundler"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

# TypeScript v skriptoch (od 2026-09-06)

**V projekte NIE JE esbuild ani iný bundler.** Bol odstránený 28. 8. 2026 pri bezpečnostných aktualizáciách (`docs/TODO.md`) a nevracia sa. Nepridávať ho ani cez `tsx`, ktorý si ho ťahá so sebou.

## Ako sa to rieši

`app/scripts/lib/ts-hook.mjs` — resolve háčik, ktorý dopĺňa prípony k bezprípponovým relatívnym importom (`./mongodb` → `./mongodb.ts`). Node samotný TypeScript spustiť vie (odstráni typy), ale príponu v ESM vyžaduje, kým TypeScript ju naopak nechce.

Skript, ktorý importuje zo `src/`, sa spúšťa cez npm skript s týmto tvarom:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=DEP0205 \
     --env-file=.env.local --import ./scripts/lib/ts-hook.mjs scripts/<meno>.mjs
```

Takto bežia `smoke`, `status`, `tenant`, `persons:import`, `versions`, `ack:report` a ďalšie.

## Dve pravidlá, bez ktorých to spadne

**1. Typový import musí byť `import type`.** Odstraňovanie typov je čisto textové — Node nevie, že `ChunkResult` alebo `Collection` je interface, a `import { ChunkResult }` sa pokúsi vykonať za behu. Padne to na `does not provide an export named 'X'` alebo (pri CJS balíkoch ako `mongodb`) na `is a CommonJS module, which may not support all named exports`. Pri `isolatedModules: true` je `import type` aj tak odporúčaný tvar, takže to nič nestojí.

Pozor na zmiešané importy: `providers/types.ts` exportuje samé typy **okrem triedy `ProviderConfigError`**. Taký import treba rozdeliť na hodnotový a typový — a to je jediné miesto, kde sa dá pri tejto zmene niečo ticho pokaziť. Preto `npm test` pred commitom, nie po ňom.

**2. Žiadne parameter properties v konštruktore.** `constructor(readonly x: string)` nie je typový zápis, musí sa transformovať na kód — odstraňovanie typov to nerobí a Node zahlási `TypeScript parameter property is not supported in strip-only mode`. Polia priraďovať výslovne. (Opravené v `EmbeddingSpaceMismatchError`, `embeddingGuard.ts`.)

## Čo z toho vyplýva pri písaní nového skriptu

Neprepisovať logiku zo `src/` do skriptu. Dve implementácie toho istého pravidla — napríklad ktorá verzia dokumentu platí — sa raz rozídu a nikto si to nevšimne, lebo obe „fungujú". Importovať skutočný modul; háčik na to je.
