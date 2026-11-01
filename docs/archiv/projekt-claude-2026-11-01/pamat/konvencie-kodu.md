---
name: konvencie-kodu
description: "Konvencie v Contineu — slovenčina je hlavný jazyk repozitára; anglicky sú identifikátory, routy a nové CSS triedy; slovník pojmov (Oddelenie, nie Útvar)"
type: feedback
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# Konvencie (povedané používateľom 2026-08-27)

## Slovenčina je hlavný jazyk repozitára

**Pravidlo:** *„Hlavný jazyk pre repozitár zostáva nateraz slovenčina — popisy a dôležité súbory ako ADR."*

Po slovensky sa píše **všetko okrem identifikátorov v kóde**:

| Po slovensky | Po anglicky |
|---|---|
| ADR (`ADR-001…003`), koncepčné dokumenty, `OPEN_DECISIONS.md`, `TODO.md`, `CHANGELOG.md`, `README` | názvy modulov, typov, funkcií |
| komentáre v kóde (a je ich veľa — zachytávajú *prečo*) | parametre a **lokálne premenné** |
| popisy testov (`t("neznámy jazyk padá na slovenčinu…")`) | hodnoty vracané z API (`"no-effective-version"`, `"already-acknowledged"`) — sú to strojové kľúče, nie text pre človeka |
| texty pre používateľa v `i18n.ts` | **routy / segmenty URL** a **názvy CSS tried v novom kóde** (viď nižšie) |
| správy commitov | |

**Why:** dve inštrukcie z toho istého dňa sa dajú ľahko preexponovať. *„Premenné a názvy parametrov v angličtine"* sa **netýka dokumentácie** — po nej prišlo výslovné spresnenie, že slovenčina zostáva hlavným jazykom repozitára. Nezačni písať ADR ani CHANGELOG po anglicky.

**How to apply:** nový kód píš rovno s anglickými menami; dokumenty, komentáre a popisy testov po slovensky. Staršie slovenské moduly (`hodnotenia.ts`, `cennik.ts`, `sada.ts`, `povoleneEmaily()`/`jePovoleny()`) sa **neprepisujú naraz** — premenujú sa, keď sa ich aj tak niekto dotkne. Konvencia je aj v `docs/rag-architecture.md`, sekcia „Konvencie v kóde".

## Routy sú po anglicky (2026-09-14)

**Pravidlo:** priečinok v `app/src/app/` a teda segment URL je **anglický**. `/directory`, nie `/adresar`.

**Why:** routa je identifikátor, nie text pre používateľa — patrí do pravého stĺpca tabuľky vyššie. Pomenovala som novú obrazovku `/adresar` podľa slovenského názvu v rozhraní a používateľ to zachytil hneď a dôrazne. Existujúce routy sú všetky anglické (`/people`, `/documents`, `/approvals`, `/library`, `/golden-set`, `/organisation`, `/sign-in`) — **jediná výnimka je `/prehlad`** a je to pozostatok, nie vzor. Slovenský názov obrazovky žije v `i18n.ts` (`nav.directory: "Adresár"`); URL s ním nemá nič spoločné.

**How to apply:** pri novej obrazovke pomenuj priečinok anglicky ešte predtým, než napíšeš prvý `href`. Keď sa routa premenúva, treba prejsť **päť miest**: priečinok (`git mv`, aby sa nestratila história), `href` v `lib/appNav.ts`, očakávaný zoznam v `tests/appNav.test.ts`, `CHANGELOG.md` a dokumenty v `docs/`. Po `git mv` hlási `tsc` chybu v `.next/types/validator.ts` na starú cestu — je to zvyšok po predošlom builde, zmizne po `npm run build`, netreba to riešiť inak.

## Slovník pojmov — „Oddelenie", nie „Útvar" (2026-09-07)

**Pravidlo:** organizačná jednotka sa v slovenských textoch **aj v komentároch** menuje **oddelenie**. Slovo „útvar" sa nepoužíva.

**Why:** premenovanie sa už raz spravilo a je zapísané v `CHANGELOG.md` („**„Útvar" sa premenoval na „Oddelenie"** v celom rozhraní aj dokumentácii"). Napísala som „útvar" do nových komentárov a používateľ to zachytil — je to regres proti usadenej konvencii, nie nová voľba. Rovnaká pasca hrozí pri texte z dizajnového handoffu, ktorý „Útvar / stredisko" ešte používa.

**How to apply:** v i18n, komentároch, CHANGELOGu aj v správach commitov píš „oddelenie". Dve miesta so slovom `utvar` v kóde sú **zámerné a nechávajú sa**: `personsImport.ts` ho berie ako akceptovanú hlavičku v importovanom CSV (staré súbory zákazníka) a `urlParams.ts` prekladá starý kľúč `?zalozka=utvary` → `departments` (staré odkazy musia chodiť). Databázové polia (`departmentId`, `departmentPath`, kolekcia `departments`) sú anglické a nemenia sa.

## CSS triedy: nové anglicky (2026-09-07)

**Pravidlo:** názvy CSS tried v novom kóde sú **anglické** (`.multiselect-control`, `.app-nav-item`, `.is-active`), hoci `globals.css` má dnes 125 slovenských (`.karta`, `.stitok`, `.vyber`, `.pole-vstup`, `.hlavicka-nav`) používaných v 47 `.tsx` súboroch.

**Why:** používateľ to povedal výslovne, keď uvidel nový `.multivyber-*`. CSS triedy nie sú v tabuľke jazykov v `CLAUDE.md` a vyzerá to ako posledná vrstva, na ktorú sa po identifikátoroch, routách a názvoch indexov v Mongu nedostalo — nie ako zámer, hoci handoff ich tak popisuje.

**How to apply:** nové triedy anglicky hneď. Premenovanie zvyšných 125 je samostatný PR, nie prílepok k rozpracovanej práci — v jednom veľkom diffe by sa vecná zmena stratila. Do premenovania sa mieša aj stavová konvencia `je-*` (`je-aktivny`, `je-otvorene`, `je-zvolena`, `je-zvyraznena`) → `is-*`.

## Testujeme funkcionalitu, nie preklady

**Pravidlo:** preklady prostredia sú samostatná vec, rovnako ako jazykové verzie dokumentov. Netestuj reťazce prekladov.

**Why:** kontrolovať znenie českého a anglického prekladu reťazec po reťazci znamená udržiavať slovník dvakrát — v `i18n.ts` a v teste.

**How to apply:** testuj **funkciu** — výber jazyka, fallback (neznámy → `sk`), uloženie `language` aj `documentLanguage` zvlášť, a invariant, že formulka v každom jazyku nesie názov, verziu aj dátum. Konkrétne znenie nie. `tests/i18n.test.ts` navyše stráži, že `cs` a `en` majú rovnaké kľúče ako `sk` a že žiadny text nie je prázdny — nová sekcia teda musí byť hneď kompletná vo všetkých troch jazykoch.

## Pozor pri hromadnom premenovaní

Regex cez celý súbor **rozbije slovenské komentáre** (slová `jazyk`, `verzia`, `dátum`, `osoba`, `znenie` sú v nich bežné) a tiež **obsah regulárnych výrazov** v testoch (`/verzia 1\.2/` → `/version 1\.2/`, test začne zlyhávať). Nástroj, ktorý to robí správne, bol v tejto relácii v `/tmp/rename.py`: rozdelí zdroják na kód / komentár / reťazec (vnútro `${…}` v šablóne je kód) a mení len kód. Regulárne výrazy si musí ošetriť zvlášť — ten nástroj ich ešte nepoznal.

## Správy commitov

Po slovensky. Doteraz som im strihala diakritiku, lebo idú cez `osascript` a úvodzovky/diakritika sa v `do shell script` zle prenášajú. Správne riešenie: napísať správu do súboru cez `device_bash` a commitnúť `git commit -F <súbor>` — potom má diakritiku aj viacriadkové telo bez ohýbania. (Overené 2026-09-07: viacero `-m` prepínačov s diakritikou cez `do shell script` prejde bez problému, `\n` v poslednom `-m` sa prenesie ako skutočný nový riadok.)
