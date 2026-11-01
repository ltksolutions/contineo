---
name: prepis-cez-model-llmrewrite
description: llmRewrite — musí streamovať, zadanie pri štruktúrnych úrovniach musí byť doslovné; čo sa stane, keď nie je
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

**Opravené 2026-09-14 (commity `d006536`, `7018d43`).** Všetky tri nálezy vyšli
zo **skúšobného prepisu skutočného PDF**, nie z čítania kódu.

1. **Musí sa streamovať.** SDK odmieta nestreamované volanie s
   `max_tokens: 32 000`: *„Streaming is required for operations that may take
   longer than 10 minutes."* Prepis preto **nefungoval vôbec** — ani „prečistiť
   text", ani „prepísať sken". Pravdepodobne od aktualizácie SDK pri prechode na
   Next 16. Rozpočet tokenov **neznižovať**: dlhé normy ho potrebujú a orezanie
   by znamenalo prepis ticho zastavený v polovici predpisu.
2. **Zadanie pri štruktúrnych úrovniach musí byť doslovné a s príkladmi.**
   Voľné „obnov členenie" viedlo k tomu, že model skrátil `Článok` → `čl.`,
   dlhé články rozsekal na `ods. 1–6` / `ods. 7–12` a **úroveň `ČASŤ` zahodil
   úplne**. Model, ktorý dostane „obnov členenie", si členenie vymyslí.
3. **V nadpise Markdownu je pomlčka nepovinná** — model ju raz píše a raz nie.
   Mimo nadpisu sa vyžaduje ďalej, inak by veta „Článok 5 sa mení takto"
   vyrobila článok s názvom „sa mení takto".

**Ako overiť po zmene zadania** (stojí to jedno volanie modelu): stiahnuť
originál z GridFS (`cms_files`), pustiť `rewritePdf()` a spočítať `ČASŤ`,
`^#+\\s*Článok N` a `^#+\\s*čl\\. N`. Stav po oprave: Volebný poriadok 10/10
`## Článok N`, Disciplinárny poriadok 51 článkov a `PRVÁ ČASŤ` zachovaná.
Veľké PDF (~950 kB) beží cez 10 minút — spúšťať na pozadí, `osascript` má
krátky časový strop.

**Známa odchýlka modelu:** raz prehodil poradie v nadpise
(`## Konanie a rozhodovanie volebnej komisie Článok 4`). Chunker to správne
neprijme a spadne to do textu. Jeden nadpis z desiatich.

**Zostáva:** nahrať dokumenty znova z originálov. Pipeline je opravená, ale
uložený `versions[].markdown` je stále starý. Nový prepis = nový text = **nový
`versionId`**, teda nové schvaľovanie aj potvrdzovanie — pri skúšobnom korpuse
to nevadí, ale je to dôvod spraviť to **pred** nahratím ostrých znení.

Súvisí s [[chunker-nepozna-markdown-hlavicky]].
