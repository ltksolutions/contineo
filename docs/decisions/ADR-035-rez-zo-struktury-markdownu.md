# ADR-035 — Prvý rez úsekov zo štruktúry Markdownu, bez profilov členenia

> **Stav:** prijaté · **Dátum:** 2026-10-16
> **Rozhodol:** Ján Letko (2026-10-16) — „náročky používame markdown
> a formátovanie nadpisov a častí blokov s číslovaním a podobne, to by mali
> byť prvé značky rozdelenia do blokov textu podľa úrovne nadpisu, alebo
> číslovania… aj PDF prevádzame do markdown, to isté ako keď markdown rovno
> nahrám, alebo vytvorím v editore"; „navrhujem úplne vyhodiť nastavenie,
> čo má hľadať prvý rez… každý dokument je iný"; „áno, rozhodni a urob to".
> **Čísla rozhodnutí:** D230–D233 (D223 medzitým použil ADR-033 pre Kuriér).
> **Prekonáva:** D58 (profil členenia organizácie), D79 (pomenované profily
> členenia per dokument) a ADR-027 D160 v časti „spôsob členenia podľa druhu
> dokumentu" — druh dokumentu už nevolí spôsob rezu.
> **Nadväzuje na:** KNIZ-rezac-blokov (Q1 A celý text modelu, Q3 A ručné
> hranice pri znení), D57 (`versionId` ≠ `chunkingId`).
> **Implementácia:** `lib/chunkHeadings.ts`, `lib/chunkCut.ts` (jedno miesto
> voľby rezu), stránka Členenie bez profilu; dávkové preindexovanie až po
> porovnaní na normách (`npm run chunking:compare`).

---

## 1. Kontext

Rez profilom hľadá v texte **slovo** („Článok", „§", „Bod") a delí podľa
počtu tokenov. Manuál ISSF-08 slovo „Článok" nemá — celý text skončil
v dvoch úsekoch po 1 000–1 200 tokenov, prvý „bez článku". Návrh AI nad tým
istým textom (kolo 1, 15. 10. 2026) vrátil 7 úsekov a **všetky hranice
ležali na nadpisoch `##` a `###`**: model zopakoval štruktúru, ktorú text už
nesie.

Všetky texty v Contineo sú Markdown — prevod PDF, nahratý `.md` aj text
z editora. Štruktúra (úroveň nadpisu, číslovanie) je teda v texte vždy, keď
ju autor dal. Profil je spôsob, ako ju hádať z textu bez štruktúry — a ten
už nemáme. Každý dokument je iný; nastavenie, ktoré pre jeden sedí, druhému
škodí.

## 2. Rozhodnutie

### D230 — Prvý rez je vždy zo štruktúry Markdownu

Bez nastavenia, pre každý dokument rovnako (`lib/chunkHeadings.ts`):

1. Úsek začína na nadpise **najvyššej úrovne**, ktorá dá rozumnú veľkosť:
   najprv `##`, a časť väčšia než cieľ (900 tokenov) sa delí na `###`,
   potom `####`.
2. Nadpisom je aj riadok, ktorý ním zjavne je bez mriežok: celý tučný krátky
   riadok, „Článok 5", „§ 5", „Príloha č. 2", „ČASŤ", „HLAVA". Úroveň dá
   číslovanie (`1` → 2, `1.2` → 3, `1.2.3` → 4; článok a § → 3).
3. Časť menšia než minimum (300 tokenov) sa pripojí k nasledujúcej, ak tá
   nezačína vyššou úrovňou a spolu nepresiahnu cieľ.
4. Časť bez podnadpisov väčšia než cieľ sa delí **medzi blokmi** (odsek,
   položka); tabuľka ani zoznam sa nedelia a ostávajú pri vete, ktorá ich
   uvádza (končí dvojbodkou).
5. Úsek nesie riadok kontextu „Názov dokumentu › nadradené nadpisy" ako
   doteraz (vyhľadávanie). Citácia (`articleRef`) je pri článku, § a prílohe
   v doterajšom tvare („čl. 5", „§ 5", „príloha č. 2"), inak text nadpisu
   („1.2 Spracovanie").

Text **bez nadpisov** (starý prepis, zápisnica bez štruktúry) sa reže
doterajším chunkerom s predvolenými hodnotami — bez profilu, bez nastavenia.

### D231 — Profily členenia zanikajú

- Pomenované profily organizácie (`tenants.chunkingProfiles`,
  `tenants.chunking`) a profil dokumentu (`documents.chunkingProfile`) kód
  **nečíta ani nezapisuje**. Dáta ostávajú, kým ich nezmaže migrácia
  (CLAUDE.md: polia v Mongu sú dáta).
- Na stránke Členenie zaniká výber profilu; „Spôsob" je „podľa nadpisov",
  „ručné hranice" alebo „bez štruktúry".
- Návrh profilu od AI zo štruktúry (`chunkingAdvice.ts`, 5. 10. 2026) zaniká;
  nahradil ho návrh hraníc s celým textom (KNIZ-rezac-blokov).

### D232 — Doladenie je návrh AI alebo človek, nie nastavenie

Poradie pri zápise (`cutForIndex()`): **ručné hranice** prijaté pre presne
tento text → **rez zo štruktúry** → chunker pre text bez nadpisov. Návrh AI
a poznámka „Čo nesedí" dolaďujú prvý rez; ťahanie hraníc (fáza 2 rezača) je
ďalšia cesta k ručným hraniciam.

### D233 — Prechod: nové znenia hneď, existujúce po porovnaní

Rez zo štruktúry má vlastný odtlačok, takže každý dokument s nadpismi ukáže
„treba preindexovať". Nové a novo nahraté znenia sa režú novo hneď.
Existujúce sa preindexujú dávkou **až po porovnaní na normách**
(`npm run chunking:compare`: počet úsekov, podiel s článkom a citácie pred
a po) — poistka „preindexovanie nesmie stratiť články" (14. 9. 2026)
ostáva pre rez zo štruktúry rovnako ako pre chunker.

## 3. Dôsledky

- Jedno pravidlo pre normu, manuál aj zmluvu; nič na nastavenie.
- Kvalita rezu závisí od toho, či má text štruktúru — prevod PDF a editor
  ju majú zachovať; stránka Členenie ukáže, keď nemá („bez štruktúry").
- Porovnanie znení (`comparison.ts`) ostáva na chunkeri podľa článkov
  s predvolenými hodnotami: páruje články podľa čísla, nie podľa nadpisu.
- Skripty profilov (`migrate:chunking`, `migrate:profiles`, `chunking:analyze`,
  `chunking:status`) sú zmazané — sú v histórii gitu; `chunking:status`
  nahradil `npm run chunking:compare`.
