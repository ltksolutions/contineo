<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-046 — PDF prevádza model, každé slovo sa strojovo kontroluje

> **Stav:** prijaté · **Dátum:** 2026-11-03
> **Rozhodol:** Ján Letko (2026-11-03) — „bolo by ideálne, nehľadiac na
> náklady, aby sa pri prevode naozaj spravila najskôr AI analýza a až potom
> prevod na AI, žiadne šablóny a prednastavené očakávania, každý dokument je
> iný"; z troch spôsobov zvolil odporúčaný **A: AI a kontrola slov**.
> **Nadväzuje na:** D53 (prevod beží u nás, model je druhý krok), ADR-011
> (schvaľuje sa PDF), ADR-026 (AI ako nastavenie organizácie, spotreba),
> ADR-035 (rez zo štruktúry Markdownu), D69 (nahrávajúci neschvaľuje sám).
> **Rozhodnutie:** D297–D302
> **Prekonáva:** časť D53 „model sa nevolá automaticky" — pre PDF s textovou
> vrstvou. Zákaz tichého ústupu a zákaz textu, ktorý v dokumente nie je,
> ostávajú; stráži ich kontrola slov namiesto poradia krokov.

---

## Kontext

Rozpis republikových súťaží SFZ 2026/27 (64 strán) prešiel 3. 11. 2026 prevodom
v aplikácii (pdfjs) a výsledok sa na vyhľadávanie nedal použiť:

- 0 z 50 úsekov malo článok — PDF nemá nadpisy, len polohu textu;
- tabuľky odmien A a B a rozpis tabuľky C sú v PDF **obrázky** — v texte
  chýbali úplne a prevod to nepovedal (strany mali dosť iného textu);
- ostatné tabuľky sa rozpadli na voľné riadky, slová sa lámali („komis iám").

Čistý prepis vznikol ručne s modelom. Pravidlá, ktoré by to robili samy
(„nadpis je riadok `7. VEĽKÝMI`"), sú šablóna jedného dokumentu — ďalší je iný.

D53 dovoľuje model len ako druhý krok na kliknutie a výstup len ako návrh
vedľa konceptu. Dôvod je správny: model vie potichu preštylizovať vetu alebo
domyslieť slovo a pri norme, ktorú ľudia potvrdzujú (D28), si to nikto nemusí
všimnúť. Lenže poradie krokov to nestráži — človek, ktorý prijme návrh
modelu, ho porovnáva s originálom rovnako ako ten, kto dostane prevod modelom
rovno. Stráži to až porovnanie slovo po slove, a to vie urobiť stroj.

## Rozhodnutie

1. **D297 — PDF s textovou vrstvou prevádza po nahratí model**, keď má
   organizácia nastavenú AI (ADR-026, účel `rewrite`). Doslovný prevod
   (pdfjs) sa robí stále: je koncept, kým model nedobehne, a je **vzorom**,
   s ktorým sa výsledok modelu porovnáva. Bez kľúča AI ostáva doslovný
   prevod a hlásenie to povie. `.docx`, `.md` a ďalšie formáty sa nemenia —
   majú štruktúru vlastnú.

2. **D298 — dva kroky: analýza, potom prevod po častiach.** Najprv model
   prečíta celé PDF (aj obrázky) a opíše, ako je *tento* dokument
   postavený: úrovne členenia a ich označenie, tabuľky, obrázky a čo je na
   nich, hlavičky a päty, zvláštnosti sadzby — a rozdelí ho na časti po
   stranách (najviac 5 strán na časť, aby sa volanie zmestilo do 300 s
   funkcie). Potom prevedie časť po časti podľa vlastnej analýzy; každá
   časť dostane svoje strany ako PDF aj ich textovú vrstvu, analýzu celého
   dokumentu a koniec predošlej časti. **Žiadna
   šablóna dokumentu**: pokyn obsahuje len zákazy (nemeniť slová, nedopĺňať)
   a tvar výstupu (Markdown), nie očakávanú štruktúru.

3. **D299 — každé slovo výsledku sa porovná s textovou vrstvou PDF**
   (`conversionCheck.ts`). Nezhoda je vynechané slovo, slovo navyše, iné
   slovo alebo zmena veľkých písmen. Nezhodou **nie je** značkovanie
   Markdownu, medzery, delenie slova na konci riadku, úvodzovky, pomlčky,
   odrážkové znaky, hlavička a päta na okraji strany a číslo strany.
   Nezhoda len v interpunkcii je drobná. Text navyše pri strane s obrázkom
   je označený — je to spravidla prepis z obrázka (tabuľka A).

4. **D300 — koncept nejde na schválenie, kým nie je každá nezhoda
   potvrdená.** Potvrdzuje správca obsahu v editore textu, nezhodu po
   nezhode (drobné naraz); potvrdenie sa viaže na odtlačok nezhody, takže
   prežije opakovanú kontrolu toho istého textu. Po každom uložení textu sa
   kontrola počíta znova — upravené miesto je nová nezhoda alebo zmizne.
   Schválenie druhou osobou (D69) ostáva.

5. **D301 — prevod beží na pozadí po krokoch** (vzor kontroly súladu,
   ADR-036): stav pri koncepte, jeden krok = jedno volanie modelu,
   nadväzuje sa vlastnou adresou, cron je poistka. Editor ukazuje priebeh.
   Keď model zlyhá, ostáva doslovný prevod a editor povie prečo — **žiadny
   tichý ústup** ani jedným smerom. Keď človek medzitým koncept upravil,
   výsledok modelu ho neprepíše: uloží sa ako návrh vedľa (D53).

6. **D302 — spotreba ide do výkazu ako „Prevod PDF modelom"** (ADR-026),
   náklady sa neobmedzujú (Ján: „nehľadiac na náklady"). Návrh rezov
   (ADR-035) beží až nad textom od modelu, nie nad doslovným prevodom.

## Dôsledky

- Kvalitu prevodu prestáva určovať formát súboru („čo nahrať, aby to
  dopadlo dobre", D53) — PDF bez štýlov dopadne ako `.docx` so štýlmi.
- Kontrola nevie posúdiť text z obrázka (v textovej vrstve nie je). Ten
  potvrdí človek proti originálu vľavo — kontrola mu povie, kde je.
- Skenované PDF (bez textovej vrstvy) sa nemení: prepis skenu na kliknutie,
  výsledok ako návrh (D53). Bez vzoru niet s čím porovnávať.
- Existujúce koncepty sa neprevádzajú samy; v editore je tlačidlo
  „Previesť modelom", ktoré spustí ten istý postup.
