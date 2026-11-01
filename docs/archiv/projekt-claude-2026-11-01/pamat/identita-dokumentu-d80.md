---
name: identita-dokumentu-d80
description: documentKey oddelený od sectionKey (D80) — čo je hotové, ako sa odvodzuje kľúč a čo zostáva; čítať pred zásahom do nahrávania dokumentov
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

**Hotové 2026-09-13 (commit `b2c3c11`), kroky A + časť B.**

`documentId = companyCode:documentKey` (`makeDocumentId()`,
`app/src/lib/libraryWrite.ts`). `sectionKey` je od D80 **len zaradenie**
a identitu netvorí. Keď `documentKey` chýba, berie sa `sectionKey` — pôvodné
správanie, takže dokumentom spred D80 sa identita nemení.

Why: `sectionKey` niesol zaradenie aj identitu naraz. Nahratie na existujúci
kľúč preto **ticho prepísalo** koncept, metadáta aj pôvodný súbor existujúceho
dokumentu, a dva rôzne dokumenty s tým istým zaradením sa nedali mať.

How to apply:

- `uploadDocument()` má **povinný** zámer `mode: "new" | "version"` bez
  predvolenej hodnoty. Pri `"new"` a existujúcom kľúči vyhodí
  `library.documentExists` — a kontrola beží **pred** `saveFile()`, aby po
  odmietnutí nezostal v úložisku súbor bez záznamu.
- nové znenie zo súboru ide cez `uploadVersionAction()` a formulár na detaile
  dokumentu; metadáta sa preberajú z existujúceho záznamu, formulár ich
  neposiela.
- migrácia: `npm run migrate:documentkey` (nasucho, `--zapis` zapíše).
  **Kľúč odvodzuje z `documentId`, nie zo `sectionKey`** — `sfz:test_onboarding`
  má `sectionKey: "smernice"`, takže odvodenie zo zaradenia by mu zmenilo
  identitu. Našiel to prvý beh nasucho; `documentId` je jediná pravdivá hodnota.
- na ostrých dátach prebehnutá, vytvorený unikátny index `document_id_unique`
  (dovtedy jedinečnosť držal výhradne filter `upsert`u).

**Zostáva:** porovnanie nového znenia s platným pred uložením; kontrola kolízie
pri písaní kľúča na `/library/new`; upratanie `sectionKey.json` na kategórie
a potom rozhodnutie, či sa zaradenie smie meniť cez `saveMetadata()` (od D80 už
identitu netvorí). Vedené v `docs/TODO.md`, sekcia **O3**.

Súvisí s [[chunking-per-dokument-d79]] a [[mazanie-dokumentov]].
